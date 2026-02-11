import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex } from '@mysten/sui/utils';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [0, 1000, 2000, 3000, 5000];

interface SponsorResponse {
  txBytesHex: string;
  sponsorSignature: string;
  digest?: string;
}

/**
 * Build a transaction (onlyTransactionKind), sponsor via gas station,
 * sign with backend keypair, and execute with both signatures.
 * Retries up to 5 times on gas station failure.
 */
export async function sponsorAndExecute(
  tx: Transaction,
  keypair: Ed25519Keypair,
  client: SuiClient,
): Promise<{ digest: string; success: boolean }> {
  const senderAddress = keypair.getPublicKey().toSuiAddress();
  tx.setSender(senderAddress);

  // Build with onlyTransactionKind for gas station
  const txBytes = await tx.build({ client, onlyTransactionKind: true });

  const gasStationUrl = process.env.GAS_STATION_URL || 'https://gas.movevm.tools/api/sponsor';
  const apiKey = process.env.GAS_STATION_API_KEY;
  if (!apiKey) throw new Error('GAS_STATION_API_KEY not configured');

  const network = process.env.SUI_NETWORK || 'testnet';

  // Retry loop for gas station
  let sponsorResponse: SponsorResponse | null = null;
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt] || 5000;
      console.log(`[GasStation] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const res = await fetch(gasStationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          rawTxBytesHex: toHex(txBytes),
          sender: senderAddress,
          network,
        }),
      });

      if (!res.ok) {
        lastError = `Gas station ${res.status}: ${await res.text()}`;
        console.error(`[GasStation] ${lastError}`);
        continue;
      }

      sponsorResponse = await res.json() as SponsorResponse;
      break;
    } catch (err) {
      lastError = String(err);
      console.error(`[GasStation] Request failed (attempt ${attempt + 1}):`, lastError);
    }
  }

  if (!sponsorResponse) {
    throw new Error(`Gas station failed after ${MAX_RETRIES} attempts: ${lastError}`);
  }

  const { txBytesHex, sponsorSignature } = sponsorResponse;

  // Sign with backend keypair
  const { signature: userSignature } = await keypair.signTransaction(fromHex(txBytesHex));

  // Execute with both signatures
  const result = await client.executeTransactionBlock({
    transactionBlock: fromHex(txBytesHex),
    signature: [userSignature, sponsorSignature],
    options: { showEffects: true },
  });

  const success = result.effects?.status.status === 'success';
  const digest = result.digest || sponsorResponse.digest || '';

  console.log(`[GasStation] Tx ${success ? 'success' : 'failed'}: ${digest}`);
  return { digest, success };
}
