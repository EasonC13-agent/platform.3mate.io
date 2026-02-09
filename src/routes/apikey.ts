import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { generateMateApiKey, getPublicKeyFromApiKey, getKeyHint } from '../utils/signature.js';

const router = Router();

/**
 * POST /api/keys/generate - Generate a new API key
 * 
 * Body:
 *   suiAddress: string (user's Sui wallet address)
 *   name?: string (optional key name)
 * 
 * Returns the full API key ONCE - must be saved by user
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { suiAddress, name } = req.body;

    if (!suiAddress) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'suiAddress is required' }
      });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { suiAddress }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { suiAddress }
      });
    }

    // Generate new key
    const { apiKey, publicKey, suiAddress: derivedAddress } = generateMateApiKey();
    const keyHint = getKeyHint(apiKey);

    // Save to database
    const dbApiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        publicKey,
        keyHint,
        name: name || 'Default Key'
      }
    });

    // Return the full key (only time it's shown)
    res.json({
      id: dbApiKey.id,
      apiKey, // Full key - user must save this!
      publicKey,
      keyHint,
      name: dbApiKey.name,
      warning: 'Save this API key securely! It will not be shown again.'
    });

  } catch (error: any) {
    console.error('Generate key error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

/**
 * POST /api/keys/register - Register an existing Sui private key as API key
 * 
 * Body:
 *   suiAddress: string (user's Sui wallet address for account)
 *   apiKey: string (suiprivkey or mateapikey format)
 *   name?: string
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { suiAddress, apiKey, name } = req.body;

    if (!suiAddress || !apiKey) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'suiAddress and apiKey are required' }
      });
    }

    // Validate and extract public key
    let publicKey: string;
    try {
      publicKey = getPublicKeyFromApiKey(apiKey);
    } catch (err) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'Invalid API key format' }
      });
    }

    const keyHint = getKeyHint(apiKey);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { suiAddress }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { suiAddress }
      });
    }

    // Check if key already registered
    const existingKey = await prisma.apiKey.findFirst({
      where: { publicKey }
    });

    if (existingKey) {
      return res.status(400).json({
        error: { type: 'validation_error', message: 'This key is already registered' }
      });
    }

    // Save to database
    const dbApiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        publicKey,
        keyHint,
        name: name || 'Imported Key'
      }
    });

    res.json({
      id: dbApiKey.id,
      publicKey,
      keyHint,
      name: dbApiKey.name,
      message: 'Key registered successfully'
    });

  } catch (error: any) {
    console.error('Register key error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

/**
 * GET /api/keys/:suiAddress - List all API keys for a user
 */
router.get('/:suiAddress', async (req: Request, res: Response) => {
  try {
    const { suiAddress } = req.params;

    const user = await prisma.user.findUnique({
      where: { suiAddress },
      include: {
        apiKeys: {
          select: {
            id: true,
            publicKey: true,
            keyHint: true,
            name: true,
            isActive: true,
            createdAt: true,
            lastUsedAt: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: { type: 'not_found', message: 'User not found' }
      });
    }

    res.json({
      suiAddress: user.suiAddress,
      keys: user.apiKeys
    });

  } catch (error: any) {
    console.error('List keys error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

/**
 * DELETE /api/keys/:id - Deactivate an API key
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Key deactivated' });

  } catch (error: any) {
    console.error('Delete key error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: error.message }
    });
  }
});

export { router as apiKeyRouter };
