import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { getPublicKeyFromApiKey, signMessage, constructClaimMessage } from '../utils/signature.js';

const router = Router();

/**
 * POST /api/demo/call - Demo API call that costs 0.1 USDC
 * Same auth + tunnel flow as /v1/messages but no Anthropic call
 */
router.post('/call', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({
        type: 'error',
        error: { type: 'authentication_error', message: 'Missing API key' }
      });
    }

    let publicKey: string;
    try {
      publicKey = getPublicKeyFromApiKey(apiKey);
    } catch {
      return res.status(401).json({
        type: 'error',
        error: { type: 'authentication_error', message: 'Invalid API key format' }
      });
    }

    const dbApiKey = await prisma.apiKey.findFirst({
      where: { publicKey, isActive: true },
      include: { user: true }
    });

    if (!dbApiKey) {
      return res.status(401).json({
        type: 'error',
        error: { type: 'authentication_error', message: 'API key not registered' }
      });
    }

    const tunnel = await prisma.tunnel.findFirst({
      where: { userId: dbApiKey.userId, status: 'ACTIVE' }
    });

    const costUsdc = BigInt(100000); // 0.1 USDC

    if (tunnel) {
      const availableBalance = tunnel.totalDeposit - tunnel.claimedAmount - tunnel.pendingAmount;
      if (availableBalance < costUsdc) {
        return res.status(402).json({
          type: 'error',
          error: {
            type: 'insufficient_balance',
            message: 'Insufficient balance in tunnel',
            balance: availableBalance.toString(),
            required: costUsdc.toString()
          }
        });
      }

      // Update tunnel balance and sign receipt
      const newPendingAmount = tunnel.pendingAmount + costUsdc;
      const newNonce = tunnel.latestNonce + BigInt(1);
      const newCumulativeAmount = tunnel.claimedAmount + newPendingAmount;

      const claimMessage = constructClaimMessage(
        tunnel.tunnelObjectId,
        newCumulativeAmount,
        newNonce
      );
      const signature = signMessage(apiKey, claimMessage);

      await prisma.tunnel.update({
        where: { id: tunnel.id },
        data: {
          pendingAmount: newPendingAmount,
          latestNonce: newNonce,
          latestSignature: Buffer.from(signature).toString('base64'),
        }
      });
    }

    const latencyMs = Date.now() - startTime;

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: dbApiKey.userId,
        apiKeyId: dbApiKey.id,
        model: 'demo',
        inputTokens: 0,
        outputTokens: 0,
        costUsdc,
        latencyMs
      }
    });

    await prisma.apiKey.update({
      where: { id: dbApiKey.id },
      data: { lastUsedAt: new Date() }
    });

    const remaining = tunnel
      ? (tunnel.totalDeposit - tunnel.claimedAmount - tunnel.pendingAmount - costUsdc).toString()
      : 'no tunnel';

    res.json({
      message: 'Demo call successful',
      cost: '0.1 USDC',
      remaining,
      latencyMs,
    });
  } catch (error: any) {
    console.error('Demo API error:', error);
    res.status(500).json({
      type: 'error',
      error: { type: 'server_error', message: error.message }
    });
  }
});

export { router as demoRouter };
