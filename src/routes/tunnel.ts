import { Router, Request, Response } from 'express';
import { Transaction } from '@mysten/sui/transactions';
import { prisma } from '../index.js';
import { getSuiClient, getContractConfig } from '../utils/sui.js';
import { sponsorAndExecute } from '../utils/gasStation.js';

const router = Router();

/**
 * POST /api/tunnel/register - Register a new tunnel after on-chain creation
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { suiAddress, tunnelObjectId, totalDeposit } = req.body;

    if (!suiAddress || !tunnelObjectId || !totalDeposit) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'Missing required fields' },
      });
    }

    // Verify tunnel exists on-chain
    const suiClient = getSuiClient();
    try {
      const obj = await suiClient.getObject({
        id: tunnelObjectId,
        options: { showContent: true },
      });
      if (obj.data?.content && 'fields' in obj.data.content) {
        const fields = obj.data.content.fields as Record<string, any>;
        if (fields.payer !== suiAddress) {
          return res.status(400).json({
            error: { type: 'validation_error', message: 'Tunnel payer does not match suiAddress' },
          });
        }
      }
    } catch (err) {
      console.warn('[Tunnel] Could not verify on-chain tunnel:', err);
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) {
      return res.status(404).json({
        error: { type: 'not_found', message: 'User not found. Register API key first.' },
      });
    }

    // Check if tunnel already exists
    const existing = await prisma.tunnel.findUnique({ where: { tunnelObjectId } });
    if (existing) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'Tunnel already registered' },
      });
    }

    const tunnel = await prisma.tunnel.create({
      data: {
        userId: user.id,
        tunnelObjectId,
        totalDeposit: BigInt(totalDeposit),
      },
    });

    res.json({
      id: tunnel.id,
      tunnelObjectId: tunnel.tunnelObjectId,
      totalDeposit: tunnel.totalDeposit.toString(),
      status: tunnel.status,
      message: 'Tunnel registered successfully',
    });
  } catch (error: any) {
    console.error('Register tunnel error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

/**
 * GET /api/tunnel/status/:suiAddress - Get tunnel status for a user
 */
router.get('/status/:suiAddress', async (req: Request, res: Response) => {
  try {
    const { suiAddress } = req.params;

    const user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) {
      return res.status(404).json({ error: { type: 'not_found', message: 'User not found' } });
    }

    const tunnels = await prisma.tunnel.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const tunnelsWithBalance = tunnels.map((t) => ({
      id: t.id,
      tunnelObjectId: t.tunnelObjectId,
      totalDeposit: t.totalDeposit.toString(),
      claimedAmount: t.claimedAmount.toString(),
      pendingAmount: t.pendingAmount.toString(),
      availableBalance: (t.totalDeposit - t.claimedAmount - t.pendingAmount).toString(),
      status: t.status,
      createdAt: t.createdAt,
    }));

    res.json({ suiAddress, tunnels: tunnelsWithBalance });
  } catch (error: any) {
    console.error('Get tunnel status error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

/**
 * GET /api/tunnel/balance/:suiAddress - Check user's tunnel balance on-chain
 */
router.get('/balance/:suiAddress', async (req: Request, res: Response) => {
  try {
    const { suiAddress } = req.params;
    const suiClient = getSuiClient();

    const user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) {
      return res.status(404).json({ error: { type: 'not_found', message: 'User not found' } });
    }

    const dbTunnels = await prisma.tunnel.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
    });

    const tunnels = await Promise.all(
      dbTunnels.map(async (t) => {
        try {
          const obj = await suiClient.getObject({
            id: t.tunnelObjectId,
            options: { showContent: true },
          });
          if (obj.data?.content && 'fields' in obj.data.content) {
            const fields = obj.data.content.fields as Record<string, any>;
            return {
              tunnelObjectId: t.tunnelObjectId,
              onChainBalance: fields.balance?.fields?.balance || '0',
              cumulativeClaimed: fields.cumulative_claimed || '0',
              nonce: fields.nonce || '0',
              closing: fields.closing || false,
              dbTotalDeposit: t.totalDeposit.toString(),
              dbClaimedAmount: t.claimedAmount.toString(),
              dbPendingAmount: t.pendingAmount.toString(),
            };
          }
        } catch (err) {
          console.warn(`[Tunnel] Failed to fetch on-chain data for ${t.tunnelObjectId}:`, err);
        }
        return {
          tunnelObjectId: t.tunnelObjectId,
          error: 'Could not fetch on-chain data',
          dbTotalDeposit: t.totalDeposit.toString(),
          dbClaimedAmount: t.claimedAmount.toString(),
          dbPendingAmount: t.pendingAmount.toString(),
        };
      })
    );

    res.json({ suiAddress, tunnels });
  } catch (error: any) {
    console.error('Get tunnel balance error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

/**
 * POST /api/tunnel/claim - Execute on-chain claim
 *
 * Body: { tunnelObjectId: string }
 *
 * Uses stored payer signature; operator (backend) calls claim via gas station.
 */
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const { tunnelObjectId } = req.body;

    const tunnel = await prisma.tunnel.findUnique({ where: { tunnelObjectId } });
    if (!tunnel) {
      return res.status(404).json({ error: { type: 'not_found', message: 'Tunnel not found' } });
    }

    if (!tunnel.latestSignature || tunnel.pendingAmount === BigInt(0)) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'No pending amount to claim' },
      });
    }

    const config = getContractConfig();
    const cumulativeAmount = tunnel.claimedAmount + tunnel.pendingAmount;
    const signatureBytes = Array.from(Buffer.from(tunnel.latestSignature, 'base64'));

    // Build and execute claim transaction via gas station
    // Contract: claim<T>(tunnel: &mut Tunnel<T>, cumulative_amount: u64, signature: vector<u8>, ctx)
    const result = await sponsorAndExecute((tx) => {
      tx.moveCall({
        target: `${config.packageId}::tunnel::claim`,
        typeArguments: [`${config.packageId}::test_usdc::TEST_USDC`],
        arguments: [
          tx.object(tunnelObjectId),
          tx.pure.u64(Number(cumulativeAmount)),
          tx.pure.vector('u8', signatureBytes),
        ],
      });
    });

    // Update DB on success
    await prisma.tunnel.update({
      where: { tunnelObjectId },
      data: {
        claimedAmount: cumulativeAmount,
        pendingAmount: BigInt(0),
      },
    });

    res.json({
      success: true,
      digest: result.digest,
      tunnelObjectId,
      claimedAmount: cumulativeAmount.toString(),
    });
  } catch (error: any) {
    console.error('Claim error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

/**
 * POST /api/tunnel/close - Operator closes tunnel with receipt
 *
 * Body: { tunnelObjectId: string }
 */
router.post('/close', async (req: Request, res: Response) => {
  try {
    const { tunnelObjectId } = req.body;

    const tunnel = await prisma.tunnel.findUnique({ where: { tunnelObjectId } });
    if (!tunnel) {
      return res.status(404).json({ error: { type: 'not_found', message: 'Tunnel not found' } });
    }

    const config = getContractConfig();

    const result = await sponsorAndExecute((tx) => {
      tx.moveCall({
        target: `${config.packageId}::tunnel::close_with_receipt`,
        typeArguments: [`${config.packageId}::test_usdc::TEST_USDC`],
        arguments: [tx.object(tunnelObjectId)],
      });
    });

    await prisma.tunnel.update({
      where: { tunnelObjectId },
      data: { status: 'CLOSED' },
    });

    res.json({
      success: true,
      digest: result.digest,
      tunnelObjectId,
      message: 'Tunnel closed. Remaining balance refunded to payer.',
    });
  } catch (error: any) {
    console.error('Close tunnel error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

export { router as tunnelRouter };
