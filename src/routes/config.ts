import { Router, Request, Response } from 'express';
import { getContractConfig, getOperatorAddress, getOperatorPublicKey } from '../utils/sui.js';

const router = Router();

/**
 * GET /api/config - Public contract and operator configuration
 */
router.get('/', (req: Request, res: Response) => {
  const config = getContractConfig();

  let operatorAddress = '';
  let operatorPublicKey = '';

  try {
    operatorAddress = process.env.PUBLIC_BACKEND_ADMIN_ADDRESS || getOperatorAddress();
    operatorPublicKey = Buffer.from(getOperatorPublicKey()).toString('base64');
  } catch (e) {
    // Key not configured yet
  }

  res.json({
    packageId: config.packageId,
    testUsdcManagerId: config.testUsdcManagerId,
    creatorConfigId: config.creatorConfigId,
    operatorAddress,
    operatorPublicKey,
    network: config.network,
  });
});

export { router as configRouter };
