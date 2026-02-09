import nacl from 'tweetnacl';
import { bech32 } from '@scure/base';

const MATEAPIKEY_PREFIX = 'mateapikey';
const SUIPRIVKEY_PREFIX = 'suiprivkey';

/**
 * Parse mateapikey format to extract private key bytes
 * Format: mateapikey1{bech32_encoded_data}
 */
export function parseMateApiKey(apiKey: string): { privateKey: Uint8Array; publicKey: Uint8Array } {
  // Accept both mateapikey and suiprivkey formats
  let keyToParse = apiKey;
  
  if (apiKey.startsWith(MATEAPIKEY_PREFIX)) {
    // Convert mateapikey to suiprivkey for parsing
    keyToParse = SUIPRIVKEY_PREFIX + apiKey.slice(MATEAPIKEY_PREFIX.length);
  }
  
  if (!keyToParse.startsWith(SUIPRIVKEY_PREFIX)) {
    throw new Error('Invalid API key format');
  }

  // Decode bech32
  const decoded = bech32.decode(keyToParse as `${string}1${string}`, 90);
  const data = bech32.fromWords(decoded.words);
  
  // First byte is key scheme (0x00 = Ed25519), rest is 32-byte private key
  if (data[0] !== 0x00) {
    throw new Error('Only Ed25519 keys are supported');
  }
  
  const privateKey = new Uint8Array(data.slice(1));
  
  if (privateKey.length !== 32) {
    throw new Error('Invalid private key length');
  }

  // Derive public key from private key
  const keypair = nacl.sign.keyPair.fromSeed(privateKey);
  
  return {
    privateKey: keypair.secretKey, // 64 bytes (seed + public key)
    publicKey: keypair.publicKey,  // 32 bytes
  };
}

/**
 * Get public key from mateapikey
 */
export function getPublicKeyFromApiKey(apiKey: string): string {
  const { publicKey } = parseMateApiKey(apiKey);
  return Buffer.from(publicKey).toString('base64');
}

/**
 * Get last 6 characters of the API key for hint display
 */
export function getKeyHint(apiKey: string): string {
  return apiKey.slice(-6);
}

/**
 * Sign a message with the API key
 */
export function signMessage(apiKey: string, message: Uint8Array): Uint8Array {
  const { privateKey } = parseMateApiKey(apiKey);
  return nacl.sign.detached(message, privateKey);
}

/**
 * Verify a signature against a public key
 */
export function verifySignature(
  publicKeyBase64: string,
  signature: Uint8Array,
  message: Uint8Array
): boolean {
  const publicKey = Buffer.from(publicKeyBase64, 'base64');
  return nacl.sign.detached.verify(message, signature, publicKey);
}

/**
 * Construct claim message: tunnel_id || cumulative_amount || nonce
 */
export function constructClaimMessage(
  tunnelId: string,
  cumulativeAmount: bigint,
  nonce: bigint
): Uint8Array {
  // Convert tunnel ID (hex string) to bytes
  const tunnelIdBytes = Buffer.from(tunnelId.replace('0x', ''), 'hex');
  
  // Convert amount to 8-byte little-endian
  const amountBytes = Buffer.alloc(8);
  amountBytes.writeBigUInt64LE(cumulativeAmount);
  
  // Convert nonce to 8-byte little-endian
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(nonce);
  
  // Concatenate
  return Buffer.concat([tunnelIdBytes, amountBytes, nonceBytes]);
}

/**
 * Generate a new Sui keypair and return in mateapikey format
 */
export function generateMateApiKey(): { apiKey: string; publicKey: string; suiAddress: string } {
  // Generate random 32-byte seed
  const seed = nacl.randomBytes(32);
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  
  // Encode as bech32 (suiprivkey format, then convert to mateapikey)
  const dataWithScheme = new Uint8Array([0x00, ...seed]); // 0x00 = Ed25519
  const words = bech32.toWords(dataWithScheme);
  const suiPrivKey = bech32.encode('suiprivkey', words, 90);
  
  // Convert to mateapikey format
  const mateApiKey = MATEAPIKEY_PREFIX + suiPrivKey.slice(SUIPRIVKEY_PREFIX.length);
  
  // Derive Sui address (blake2b hash of flag + public key)
  // For simplicity, we'll use a placeholder - in production use @mysten/sui
  const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
  
  return {
    apiKey: mateApiKey,
    publicKey: publicKeyBase64,
    suiAddress: '0x' + Buffer.from(keypair.publicKey).toString('hex').slice(0, 64),
  };
}
