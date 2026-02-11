import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

let _keypair: Ed25519Keypair | null = null;
let _client: SuiClient | null = null;

export function getBackendKeypair(): Ed25519Keypair {
  if (_keypair) return _keypair;

  const privateKey = process.env.BACKEND_SUI_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('BACKEND_SUI_PRIVATE_KEY not configured');
  }

  const { secretKey } = decodeSuiPrivateKey(privateKey);
  _keypair = Ed25519Keypair.fromSecretKey(secretKey);
  return _keypair;
}

export function getSuiClient(): SuiClient {
  if (_client) return _client;

  const network = (process.env.SUI_NETWORK || 'testnet') as 'mainnet' | 'testnet' | 'devnet';
  _client = new SuiClient({ url: getFullnodeUrl(network) });
  return _client;
}

export function getContractConfig() {
  return {
    packageId: process.env.SUI_PACKAGE_ID || '',
    testUsdcManagerId: process.env.TEST_USDC_MANAGER_ID || '',
    creatorConfigId: process.env.CREATOR_CONFIG_ID || '',
    network: process.env.SUI_NETWORK || 'testnet',
  };
}

export function getOperatorAddress(): string {
  return getBackendKeypair().getPublicKey().toSuiAddress();
}

export function getOperatorPublicKey(): Uint8Array {
  return getBackendKeypair().getPublicKey().toRawBytes();
}
