import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';

const router = Router();

/**
 * POST /api/tunnel/register - Register a new tunnel after on-chain creation
 * 
 * Body:
 *   suiAddress: string
 *   tunnelObjectId: string (on-chain tunnel ID)
 *   totalDeposit: string (in USDC smallest unit)
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
    const user = await prisma.user.findUnique({
      where: { suiAddress }
    });

    if (!user) {
      return res.status(404).json({
        error: { type: 'not_found', message: 'User not found. Register API key first.' }
      });
    }

    // Check if tunnel already exists
    const existingTunnel = await prisma.tunnel.findUnique({
      where: { tunnelObjectId }
    });

    if (existingTunnel) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'Tunnel already registered' }
      });
    }

    // Create tunnel record
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
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

/**
 * GET /api/tunnel/status/:suiAddress - Get tunnel status for a user
 */
router.get('/status/:suiAddress', async (req: Request, res: Response) => {
  try {
    const { suiAddress } = req.params;

    const user = await prisma.user.findUnique({
      where: { suiAddress }
    });

    if (!user) {
      return res.status(404).json({
        error: { type: 'not_found', message: 'User not found' }
      });
    }

    const tunnels = await prisma.tunnel.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    const tunnelsWithBalance = tunnels.map(t => ({
      id: t.id,
      tunnelObjectId: t.tunnelObjectId,
      totalDeposit: t.totalDeposit.toString(),
      claimedAmount: t.claimedAmount.toString(),
      pendingAmount: t.pendingAmount.toString(),
      availableBalance: (t.totalDeposit - t.claimedAmount - t.pendingAmount).toString(),
      status: t.status,
      createdAt: t.createdAt,
    }));

    res.json({
      suiAddress,
      tunnels: tunnelsWithBalance
    });

  } catch (error: any) {
    console.error('Get tunnel status error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

/**
 * POST /api/tunnel/claim - Trigger manual claim (admin/provider)
 * 
 * Body:
 *   tunnelObjectId: string
 */
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const { tunnelObjectId } = req.body;

    const tunnel = await prisma.tunnel.findUnique({
      where: { tunnelObjectId }
    });

    if (!tunnel) {
      return res.status(404).json({
        error: { type: 'not_found', message: 'Tunnel not found' }
      });
    }

    if (!tunnel.latestSignature || tunnel.pendingAmount === BigInt(0)) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'No pending amount to claim' }
      });
    }

    // TODO: Execute on-chain claim transaction
    // For now, just return the claim data
    
    res.json({
      tunnelObjectId,
      claimData: {
        cumulativeAmount: (tunnel.claimedAmount + tunnel.pendingAmount).toString(),
        nonce: tunnel.latestNonce.toString(),
        signature: tunnel.latestSignature,
      },
      message: 'Claim data ready. Execute on-chain transaction to complete.'
    });

  } catch (error: any) {
    console.error('Claim error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

/**
 * POST /api/tunnel/close - Initiate tunnel close
 * 
 * Body:
 *   tunnelObjectId: string
 */
router.post('/close', async (req: Request, res: Response) => {
  try {
    const { tunnelObjectId } = req.body;

    const tunnel = await prisma.tunnel.update({
      where: { tunnelObjectId },
      data: { status: 'CLOSING' }
    });

    res.json({
      tunnelObjectId,
      status: tunnel.status,
      message: 'Tunnel closing initiated. Grace period started.'
    });

  } catch (error: any) {
    console.error('Close tunnel error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

export { router as tunnelRouter };
