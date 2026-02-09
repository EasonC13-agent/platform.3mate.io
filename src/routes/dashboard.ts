import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';

const router = Router();

/**
 * GET /api/dashboard/:suiAddress - Get full dashboard data for a user
 */
router.get('/:suiAddress', async (req: Request, res: Response) => {
  try {
    const { suiAddress } = req.params;

    const user = await prisma.user.findUnique({
      where: { suiAddress },
      include: {
        apiKeys: {
          where: { isActive: true },
          select: {
            id: true,
            publicKey: true,
            keyHint: true,
            name: true,
            createdAt: true,
            lastUsedAt: true
          }
        },
        tunnels: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: { type: 'not_found', message: 'User not found' }
      });
    }

    // Get usage stats
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [usage24h, usage7d, totalUsage] = await Promise.all([
      prisma.usageLog.aggregate({
        where: { userId: user.id, createdAt: { gte: last24h } },
        _count: true,
        _sum: { costUsdc: true, inputTokens: true, outputTokens: true }
      }),
      prisma.usageLog.aggregate({
        where: { userId: user.id, createdAt: { gte: last7d } },
        _count: true,
        _sum: { costUsdc: true, inputTokens: true, outputTokens: true }
      }),
      prisma.usageLog.aggregate({
        where: { userId: user.id },
        _count: true,
        _sum: { costUsdc: true, inputTokens: true, outputTokens: true }
      })
    ]);

    // Calculate balances
    const activeTunnel = user.tunnels.find(t => t.status === 'ACTIVE');
    const availableBalance = activeTunnel 
      ? activeTunnel.totalDeposit - activeTunnel.claimedAmount - activeTunnel.pendingAmount
      : BigInt(0);

    res.json({
      user: {
        suiAddress: user.suiAddress,
        createdAt: user.createdAt
      },
      apiKeys: user.apiKeys,
      tunnel: activeTunnel ? {
        id: activeTunnel.id,
        tunnelObjectId: activeTunnel.tunnelObjectId,
        totalDeposit: activeTunnel.totalDeposit.toString(),
        claimedAmount: activeTunnel.claimedAmount.toString(),
        pendingAmount: activeTunnel.pendingAmount.toString(),
        availableBalance: availableBalance.toString(),
        status: activeTunnel.status
      } : null,
      usage: {
        last24h: {
          requests: usage24h._count,
          costUsdc: (usage24h._sum.costUsdc || BigInt(0)).toString(),
          inputTokens: usage24h._sum.inputTokens || 0,
          outputTokens: usage24h._sum.outputTokens || 0
        },
        last7d: {
          requests: usage7d._count,
          costUsdc: (usage7d._sum.costUsdc || BigInt(0)).toString(),
          inputTokens: usage7d._sum.inputTokens || 0,
          outputTokens: usage7d._sum.outputTokens || 0
        },
        total: {
          requests: totalUsage._count,
          costUsdc: (totalUsage._sum.costUsdc || BigInt(0)).toString(),
          inputTokens: totalUsage._sum.inputTokens || 0,
          outputTokens: totalUsage._sum.outputTokens || 0
        }
      }
    });

  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

/**
 * GET /api/dashboard/:suiAddress/usage - Get detailed usage logs
 */
router.get('/:suiAddress/usage', async (req: Request, res: Response) => {
  try {
    const { suiAddress } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const user = await prisma.user.findUnique({
      where: { suiAddress }
    });

    if (!user) {
      return res.status(404).json({
        error: { type: 'not_found', message: 'User not found' }
      });
    }

    const logs = await prisma.usageLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: {
        apiKey: {
          select: { keyHint: true, name: true }
        }
      }
    });

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        model: log.model,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        costUsdc: log.costUsdc.toString(),
        latencyMs: log.latencyMs,
        apiKeyHint: log.apiKey.keyHint,
        apiKeyName: log.apiKey.name,
        createdAt: log.createdAt
      }))
    });

  } catch (error: any) {
    console.error('Usage logs error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

/**
 * GET /api/dashboard/pricing - Get current pricing
 */
router.get('/pricing', async (req: Request, res: Response) => {
  try {
    const pricing = await prisma.pricingConfig.findMany({
      where: { isActive: true }
    });

    res.json({
      pricing: pricing.map(p => ({
        model: p.model,
        flatFeeUsdc: p.flatFeeUsdc.toString(),
        flatFeeUsdcFormatted: `$${(Number(p.flatFeeUsdc) / 1_000_000).toFixed(2)}`
      }))
    });

  } catch (error: any) {
    console.error('Pricing error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

export { router as dashboardRouter };
