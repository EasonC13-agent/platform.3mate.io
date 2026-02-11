import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../index.js';
import { getPublicKeyFromApiKey, getKeyHint, signMessage, constructClaimMessage } from '../utils/signature.js';

const router = Router();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /v1/messages - Anthropic-compatible messages endpoint
 * 
 * Headers:
 *   x-api-key: mateapikey1... (user's API key)
 * 
 * Body: Same as Anthropic API
 */
router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // 1. Extract and validate API key
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({
        type: 'error',
        error: { type: 'authentication_error', message: 'Missing API key' }
      });
    }

    // 2. Get public key from API key
    let publicKey: string;
    try {
      publicKey = getPublicKeyFromApiKey(apiKey);
    } catch (err) {
      return res.status(401).json({
        type: 'error',
        error: { type: 'authentication_error', message: 'Invalid API key format' }
      });
    }

    // 3. Find API key in database
    const dbApiKey = await prisma.apiKey.findFirst({
      where: { 
        publicKey,
        isActive: true
      },
      include: { user: true }
    });

    if (!dbApiKey) {
      return res.status(401).json({
        type: 'error',
        error: { type: 'authentication_error', message: 'API key not registered' }
      });
    }

    // 4. Check user has active tunnel with balance
    const tunnel = await prisma.tunnel.findFirst({
      where: {
        userId: dbApiKey.userId,
        status: 'ACTIVE'
      }
    });

    // 5. Get pricing
    const pricing = await prisma.pricingConfig.findFirst({
      where: {
        OR: [
          { model: req.body.model || 'default' },
          { model: 'default' }
        ],
        isActive: true
      },
      orderBy: { model: 'desc' } // Prefer specific model over default
    });

    const costUsdc = pricing?.flatFeeUsdc || BigInt(100000); // 0.1 USDC default

    // 6. Check balance (if tunnel exists)
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
    }
    // Note: For hackathon demo, allow requests without tunnel (free tier)

    // 7. Check analysis cache for LuLu-style requests
    const { model, messages, max_tokens, system, ...rest } = req.body;
    
    let cachedResponse = null;
    let cacheKey: { processPath: string; ipAddress: string; port: string } | null = null;
    
    // Try to extract process+IP from the messages for caching
    if (messages?.length > 0) {
      const lastMsg = messages[messages.length - 1]?.content || '';
      const msgText = typeof lastMsg === 'string' ? lastMsg : JSON.stringify(lastMsg);
      
      // Match LuLu alert patterns: process path + IP address
      const pathMatch = msgText.match(/(?:Process Path|path):\s*([\/\w.-]+)/i);
      const ipMatch = msgText.match(/(?:ip address|ip):\s*([\d.]+)/i);
      const portMatch = msgText.match(/(?:port\/protocol|port):\s*(\d+)/i);
      
      if (pathMatch && ipMatch) {
        cacheKey = {
          processPath: pathMatch[1],
          ipAddress: ipMatch[1],
          port: portMatch ? portMatch[1] : ''
        };
        
        // Look up cache
        try {
          const cached = await prisma.analysisCache.findUnique({
            where: {
              processPath_ipAddress_port: cacheKey
            }
          });
          
          if (cached) {
            cachedResponse = JSON.parse(cached.analysisJson);
            // Increment hit count
            await prisma.analysisCache.update({
              where: { id: cached.id },
              data: { hitCount: cached.hitCount + 1 }
            });
            console.log(`Cache HIT: ${cacheKey.processPath} -> ${cacheKey.ipAddress}:${cacheKey.port} (hits: ${cached.hitCount + 1})`);
          }
        } catch (e) {
          // Cache miss or error, proceed normally
        }
      }
    }
    
    // Use cache or call Anthropic
    const response = cachedResponse || await anthropic.messages.create({
      model: model || 'claude-sonnet-4-20250514',
      messages,
      max_tokens: max_tokens || 1024,
      system,
      ...rest
    });
    
    // Save to cache if this was a fresh API call with a cache key
    if (!cachedResponse && cacheKey) {
      try {
        const processName = cacheKey.processPath.split('/').pop() || '';
        await prisma.analysisCache.upsert({
          where: {
            processPath_ipAddress_port: cacheKey
          },
          create: {
            processName,
            processPath: cacheKey.processPath,
            ipAddress: cacheKey.ipAddress,
            port: cacheKey.port,
            analysisJson: JSON.stringify(response),
            model: model || 'claude-sonnet-4-20250514'
          },
          update: {
            analysisJson: JSON.stringify(response),
            model: model || 'claude-sonnet-4-20250514'
          }
        });
        console.log(`Cache STORE: ${cacheKey.processPath} -> ${cacheKey.ipAddress}:${cacheKey.port}`);
      } catch (e) {
        console.error('Cache store error:', e);
      }
    }

    const latencyMs = Date.now() - startTime;
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;

    // 8. Update tunnel balance and sign new receipt
    if (tunnel) {
      const newPendingAmount = tunnel.pendingAmount + costUsdc;
      const newNonce = tunnel.latestNonce + BigInt(1);
      const newCumulativeAmount = tunnel.claimedAmount + newPendingAmount;
      
      // Sign the new state receipt
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

    // 9. Log usage
    await prisma.usageLog.create({
      data: {
        userId: dbApiKey.userId,
        apiKeyId: dbApiKey.id,
        model: model || 'claude-sonnet-4-20250514',
        inputTokens,
        outputTokens,
        costUsdc,
        latencyMs
      }
    });

    // 10. Update API key last used
    await prisma.apiKey.update({
      where: { id: dbApiKey.id },
      data: { lastUsedAt: new Date() }
    });

    // 11. Return Anthropic response
    res.json(response);

  } catch (error: any) {
    console.error('Messages API error:', error);
    
    // Handle Anthropic API errors
    if (error.status) {
      return res.status(error.status).json({
        type: 'error',
        error: { 
          type: 'api_error', 
          message: error.message 
        }
      });
    }

    res.status(500).json({
      type: 'error',
      error: { type: 'server_error', message: 'Internal server error' }
    });
  }
});

export { router as messagesRouter };
