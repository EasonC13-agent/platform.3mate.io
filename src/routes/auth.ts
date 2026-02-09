import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import { prisma } from '../index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = Router();

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  try {
    // Try to load service account from file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      join(__dirname, '../../firebase-service-account.json');
    
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    console.log('Firebase Admin initialized with service account');
  } catch (error) {
    console.error('Failed to load service account, using project ID only:', error);
    admin.initializeApp({
      projectId: 'llm-service-3587a',
    });
  }
}

// Middleware to verify Firebase token
async function verifyToken(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * GET /api/auth/me - Get current user
 */
router.get('/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).firebaseUser;
    
    const user = await prisma.user.findUnique({
      where: { id: firebaseUser.uid }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get balance info
    const tunnel = await prisma.tunnel.findFirst({
      where: { userId: user.id, status: 'ACTIVE' }
    });

    const balance = tunnel 
      ? (tunnel.totalDeposit - tunnel.claimedAmount - tunnel.pendingAmount)
      : BigInt(0);

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      balance: balance.toString(),
    });

  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/register - Register new user
 */
router.post('/register', verifyToken, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).firebaseUser;
    const { displayName, photoURL } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: firebaseUser.uid }
    });

    if (existingUser) {
      return res.json(existingUser);
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: displayName || firebaseUser.name || null,
        photoURL: photoURL || firebaseUser.picture || null,
      }
    });

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      balance: '0',
    });

  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/balance/:userId - Get user balance
 */
router.get('/balance/:userId', verifyToken, async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).firebaseUser;
    const { userId } = req.params;

    // Verify user is accessing their own data
    if (firebaseUser.uid !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tunnel = await prisma.tunnel.findFirst({
      where: { userId: user.id, status: 'ACTIVE' }
    });

    // Get total spent
    const totalSpent = await prisma.usageLog.aggregate({
      where: { userId: user.id },
      _sum: { costUsdc: true }
    });

    const balance = tunnel 
      ? (tunnel.totalDeposit - tunnel.claimedAmount - tunnel.pendingAmount)
      : BigInt(0);

    res.json({
      balance: balance.toString(),
      pendingBalance: tunnel?.pendingAmount.toString() || '0',
      totalSpent: (totalSpent._sum.costUsdc || BigInt(0)).toString(),
      tunnel: tunnel ? {
        id: tunnel.id,
        tunnelObjectId: tunnel.tunnelObjectId,
        totalDeposit: tunnel.totalDeposit.toString(),
        claimedAmount: tunnel.claimedAmount.toString(),
        pendingAmount: tunnel.pendingAmount.toString(),
        status: tunnel.status,
      } : null,
      depositAddress: user.suiAddress || null,
    });

  } catch (error: any) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as authRouter };
