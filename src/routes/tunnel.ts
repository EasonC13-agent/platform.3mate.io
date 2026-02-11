import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { sponsorAndExecute } from '../utils/gasStation.js';
import { getContractConfig, getSuiClient } from '../utils/sui.js';

const router = Router();

/**
 * POST /api/tunnel/register - Register a new tunnel after on-chain creation
 * Called by frontend after user creates tunnel via wallet
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { suiAddress, tunnelObjectId, totalDeposit } = req.body;

    if (!suiAddress || !tunnelObjectId || !totalDeposit) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'Missing required fields' }
      });
    }

    // Find user
    let user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) {
      user = await prisma.user.create({ data: { id: suiAddress, email: suiAddress, suiAddress } });
    }

    // Check if tunnel already exists
    const existing = await prisma.tunnel.findUnique({ where: { tunnelObjectId } });
    if (existing) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'Tunnel already registered' }
      });
    }

    const tunnel = await prisma.tunnel.create({
      data: {
        userId: user.id,
        tunnelObjectId,
        totalDeposit: BigInt(totalDeposit),
      }
    });

    res.json({
      id: tunnel.id,
      tunnelObjectId: tunnel.tunnelObjectId,
      totalDeposit: tunnel.totalDeposit.toString(),
      status: tunnel.status,
      message: 'Tunnel registered successfully'
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
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      suiAddress,
      tunnels: tunnels.map(t => ({
        id: t.id,
        tunnelObjectId: t.tunnelObjectId,
        totalDeposit: t.totalDeposit.toString(),
        claimedAmount: t.claimedAmount.toString(),
        pendingAmount: t.pendingAmount.toString(),
        availableBalance: (t.totalDeposit - t.claimedAmount - t.pendingAmount).toString(),
        status: t.status,
        createdAt: t.createdAt,
      }))
    });
  } catch (error: any) {
    console.error('Get tunnel status error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

/**
 * POST /api/tunnel/claim - Execute on-chain claim using gas station
 * 
 * This is called internally by the system when enough pending amount accumulates,
 * or can be triggered manually.
 * 
 * Body: { tunnelObjectId }
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
        error: { type: 'validation_error', message: 'No pending amount to claim' }
      });
    }

    const config = getContractConfig();
    const cumulativeAmount = tunnel.claimedAmount + tunnel.pendingAmount;
    const nonce = tunnel.latestNonce;
    const signature = Buffer.from(tunnel.latestSignature, 'base64');

    // Execute claim on-chain via gas station
    const result = await sponsorAndExecute((tx: any) => {
      tx.moveCall({
        target: `${config.packageId}::tunnel::claim`,
        typeArguments: [`${config.packageId}::test_usdc::TEST_USDC`],
        arguments: [
          tx.object(tunnelObjectId),
          tx.pure.u64(Number(cumulativeAmount)),
          tx.pure.u64(Number(nonce)),
          tx.pure(Array.from(signature)),
        ],
      });
    });

    // Update DB: move pending to claimed
    await prisma.tunnel.update({
      where: { tunnelObjectId },
      data: {
        claimedAmount: cumulativeAmount,
        pendingAmount: BigInt(0),
      }
    });

    res.json({
      tunnelObjectId,
      digest: result.digest,
      claimedAmount: cumulativeAmount.toString(),
      message: 'Claim executed successfully'
    });
  } catch (error: any) {
    console.error('Claim error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

/**
 * POST /api/tunnel/close - Close tunnel and refund remaining to payer
 * 
 * Body: { tunnelObjectId }
 */
router.post('/close', async (req: Request, res: Response) => {
  try {
    const { tunnelObjectId } = req.body;

    const config = getContractConfig();

    // Execute close on-chain via gas station
    const result = await sponsorAndExecute((tx: any) => {
      tx.moveCall({
        target: `${config.packageId}::tunnel::close_with_receipt`,
        typeArguments: [`${config.packageId}::test_usdc::TEST_USDC`],
        arguments: [tx.object(tunnelObjectId)],
      });
    });

    // Update DB
    await prisma.tunnel.update({
      where: { tunnelObjectId },
      data: { status: 'CLOSED' }
    });

    res.json({
      tunnelObjectId,
      digest: result.digest,
      status: 'CLOSED',
      message: 'Tunnel closed successfully'
    });
  } catch (error: any) {
    console.error('Close tunnel error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

/**
 * GET /api/tunnel/onchain/:tunnelObjectId - Get on-chain tunnel state
 */
router.get('/onchain/:tunnelObjectId', async (req: Request, res: Response) => {
  try {
    const { tunnelObjectId } = req.params;
    const client = getSuiClient();

    const obj = await client.getObject({
      id: tunnelObjectId,
      options: { showContent: true },
    });

    if (!obj.data?.content || !('fields' in obj.data.content)) {
      return res.status(404).json({ error: { type: 'not_found', message: 'Tunnel not found on-chain' } });
    }

    res.json({
      tunnelObjectId,
      fields: obj.data.content.fields,
    });
  } catch (error: any) {
    console.error('Get on-chain tunnel error:', error);
    res.status(500).json({ error: { type: 'server_error', message: error.message } });
  }
});

export { router as tunnelRouter };
