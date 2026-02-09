import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { messagesRouter } from './routes/messages.js';
import { tunnelRouter } from './routes/tunnel.js';
import { apiKeyRouter } from './routes/apikey.js';
import { dashboardRouter } from './routes/dashboard.js';
import { authRouter } from './routes/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3100;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/v1/messages', messagesRouter);  // Anthropic-compatible endpoint
app.use('/api/auth', authRouter);          // Firebase auth
app.use('/api/balance', authRouter);       // Balance (same router)
app.use('/api/tunnel', tunnelRouter);      // Tunnel management
app.use('/api/keys', apiKeyRouter);        // API key management
app.use('/api/dashboard', dashboardRouter); // Dashboard data

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/v1') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: { type: 'server_error', message: err.message } });
});

// Start server
async function main() {
  // Initialize default pricing if not exists
  const defaultPricing = await prisma.pricingConfig.findUnique({
    where: { model: 'default' }
  });
  
  if (!defaultPricing) {
    await prisma.pricingConfig.create({
      data: {
        model: 'default',
        flatFeeUsdc: BigInt(100000), // 0.1 USDC (6 decimals)
      }
    });
    console.log('Created default pricing: 0.1 USDC per request');
  }

  app.listen(PORT, () => {
    console.log(`🚀 LLM Service running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Messages API: http://localhost:${PORT}/v1/messages`);
  });
}

main().catch(console.error);

export { prisma };
