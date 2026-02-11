#!/usr/bin/env tsx
/**
 * Integration test: real Ed25519 claim() on testnet
 * Tests the actual ed25519_verify path in the contract
 * 
 * Flow: mint USDC → open tunnel (with known Ed25519 payer) → sign claim message → call claim()
 */

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'
import { Transaction } from '@mysten/sui/transactions'
import { fromHex, toHex } from '@mysten/sui/utils'
import nacl from 'tweetnacl'

const PACKAGE_ID = '0x0a906dc87bd311f0f00b2494308cdbfdbb6a6bad61bc00a0d79f897420970602'
const TEST_USDC_MANAGER = '0x3348f0defa0ef9f7fee5f21d51977636b4cf39be5420d6fdef7203ab5469fd24'
const CREATOR_CONFIG = '0x9833f3bb2429b6a7c26e9a1cfdcbeab446f5995d69bf7b218ce72d1c385cc90b'
const COIN_TYPE = `${PACKAGE_ID}::test_usdc::TEST_USDC`
const GAS_STATION_URL = 'https://gas.movevm.tools/api/sponsor'
const GAS_STATION_API_KEY = process.env.GAS_STATION_API_KEY || '3mate_gas_station_sui_testnet_iNQX1eL81qUZBuAH'
const NETWORK = 'testnet'

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') })

// Generate a fresh Ed25519 keypair for payer
const payerKeypair = Ed25519Keypair.generate()
const payerAddress = payerKeypair.toSuiAddress()
const payerPubKey = payerKeypair.getPublicKey().toRawBytes() // 32 bytes

// Backend operator keypair (from .env)
const BACKEND_KEY = process.env.BACKEND_SUI_PRIVATE_KEY
if (!BACKEND_KEY) {
  console.error('Set BACKEND_SUI_PRIVATE_KEY in env')
  process.exit(1)
}
const { secretKey } = decodeSuiPrivateKey(BACKEND_KEY)
const operatorKeypair = Ed25519Keypair.fromSecretKey(secretKey)
const operatorAddress = operatorKeypair.toSuiAddress()

console.log(`Payer:    ${payerAddress}`)
console.log(`Operator: ${operatorAddress}`)
console.log(`Payer PubKey (${payerPubKey.length} bytes): ${Buffer.from(payerPubKey).toString('hex').slice(0, 16)}...`)

/** BCS encode u64 as 8-byte little-endian */
function bcsU64(val: bigint): Uint8Array {
  const buf = new Uint8Array(8)
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(val & 0xFFn)
    val >>= 8n
  }
  return buf
}

/** Construct claim message: tunnel_id(32) || bcs(cumulative_amount) || bcs(nonce) */
function constructClaimMessage(tunnelIdHex: string, cumulativeAmount: bigint, nonce: bigint): Uint8Array {
  const tunnelIdBytes = Buffer.from(tunnelIdHex.replace('0x', ''), 'hex')
  const amountBytes = bcsU64(cumulativeAmount)
  const nonceBytes = bcsU64(nonce)
  const msg = new Uint8Array(tunnelIdBytes.length + amountBytes.length + nonceBytes.length)
  msg.set(tunnelIdBytes, 0)
  msg.set(amountBytes, tunnelIdBytes.length)
  msg.set(nonceBytes, tunnelIdBytes.length + amountBytes.length)
  return msg
}

/** Sponsor via gas station, sign, execute (works for addresses with no SUI) */
async function sponsorAndExecute(
  buildFn: (tx: Transaction) => void,
  signer: Ed25519Keypair,
): Promise<{ digest: string; events: any[] }> {
  const sender = signer.toSuiAddress()
  const tx = new Transaction()
  tx.setSender(sender)
  buildFn(tx)

  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })

  // Sponsor
  const res = await fetch(GAS_STATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: GAS_STATION_API_KEY,
      rawTxBytesHex: toHex(txBytes),
      sender,
      network: NETWORK,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gas station ${res.status}: ${text}`)
  }

  const sponsorRes = await res.json() as any
  if (!sponsorRes.txBytesHex) {
    throw new Error(`Gas station error: ${JSON.stringify(sponsorRes)}`)
  }

  const { signature } = await signer.signTransaction(fromHex(sponsorRes.txBytesHex))

  const result = await suiClient.executeTransactionBlock({
    transactionBlock: fromHex(sponsorRes.txBytesHex),
    signature: [signature, sponsorRes.sponsorSignature],
    options: { showEvents: true, showEffects: true },
  })

  const success = result.effects?.status.status === 'success'
  if (!success) {
    throw new Error(`Tx failed: ${JSON.stringify(result.effects?.status)}`)
  }

  await suiClient.waitForTransaction({ digest: result.digest })
  return { digest: result.digest, events: result.events || [] }
}

async function main() {
  console.log('\n=== Integration Test: Real Ed25519 claim() ===\n')

  // Step 1: Mint 10 TEST_USDC to payer (gas station sponsors, no SUI needed)
  console.log('--- Step 1: Mint 10 TEST_USDC ---')
  const { digest: mintDigest } = await sponsorAndExecute(tx => {
    tx.moveCall({
      target: `${PACKAGE_ID}::test_usdc::mint`,
      arguments: [
        tx.object(TEST_USDC_MANAGER),
        tx.pure.u64(10_000_000), // 10 USDC
        tx.pure.address(payerAddress),
      ],
    })
  }, payerKeypair)
  console.log(`  Mint digest: ${mintDigest}`)
  await new Promise(r => setTimeout(r, 3000))

  // Step 2: Open tunnel
  console.log('\n--- Step 2: Open Tunnel ---')
  const coins = await suiClient.getCoins({ owner: payerAddress, coinType: COIN_TYPE })
  if (coins.data.length === 0) throw new Error('No USDC coins after mint!')

  const { digest: openDigest, events: openEvents } = await sponsorAndExecute(tx => {
    let coinArg
    if (coins.data.length === 1) {
      coinArg = tx.object(coins.data[0].coinObjectId)
    } else {
      const [primary, ...rest] = coins.data
      coinArg = tx.object(primary.coinObjectId)
      if (rest.length > 0) {
        tx.mergeCoins(coinArg, rest.map(c => tx.object(c.coinObjectId)))
      }
    }
    tx.moveCall({
      target: `${PACKAGE_ID}::tunnel::open_tunnel`,
      typeArguments: [COIN_TYPE],
      arguments: [
        tx.object(CREATOR_CONFIG),
        coinArg,
        tx.pure.vector('u8', Array.from(payerPubKey)),
      ],
    })
  }, payerKeypair)
  console.log(`  Open digest: ${openDigest}`)

  // Find tunnel ID from events
  let tunnelId = ''
  for (const event of openEvents) {
    if (event.type.includes('::tunnel::TunnelOpened')) {
      tunnelId = (event.parsedJson as any).tunnel_id
      break
    }
  }
  if (!tunnelId) throw new Error('TunnelOpened event not found!')
  console.log(`  Tunnel ID: ${tunnelId}`)
  await new Promise(r => setTimeout(r, 2000))

  // Step 3: Sign claim message as payer, execute as operator
  console.log('\n--- Step 3: Claim with real Ed25519 signature ---')
  const claimAmount = 1_000_000n // 1 USDC
  const nonce = 1n
  const msg = constructClaimMessage(tunnelId, claimAmount, nonce)
  console.log(`  Message (${msg.length} bytes): ${Buffer.from(msg).toString('hex').slice(0, 32)}...`)

  // Sign with payer's Ed25519 key
  const { secretKey: payerSeed } = decodeSuiPrivateKey(payerKeypair.getSecretKey())
  const payerNaclKp = nacl.sign.keyPair.fromSeed(new Uint8Array(payerSeed))
  const sig = nacl.sign.detached(msg, payerNaclKp.secretKey)
  console.log(`  Signature (${sig.length} bytes): ${Buffer.from(sig).toString('hex').slice(0, 32)}...`)

  // Verify locally
  const ok = nacl.sign.detached.verify(msg, sig, payerPubKey)
  console.log(`  Local verify: ${ok}`)
  if (!ok) throw new Error('Local signature verification failed!')

  // Call claim() as operator
  const { digest: claimDigest, events: claimEvents } = await sponsorAndExecute(tx => {
    tx.moveCall({
      target: `${PACKAGE_ID}::tunnel::claim`,
      typeArguments: [COIN_TYPE],
      arguments: [
        tx.object(tunnelId),
        tx.pure.u64(Number(claimAmount)),
        tx.pure.vector('u8', Array.from(sig)),
      ],
    })
  }, operatorKeypair)
  console.log(`  Claim digest: ${claimDigest}`)

  for (const event of claimEvents) {
    if (event.type.includes('::tunnel::Claimed')) {
      const p = event.parsedJson as any
      console.log(`  ✅ Claimed! amount=${p.claim_amount}, cumulative=${p.cumulative_total}`)
    }
  }
  await new Promise(r => setTimeout(r, 2000))

  // Step 4: Close with receipt (as operator)
  console.log('\n--- Step 4: Close with receipt ---')
  const { digest: closeDigest, events: closeEvents } = await sponsorAndExecute(tx => {
    tx.moveCall({
      target: `${PACKAGE_ID}::tunnel::close_with_receipt`,
      typeArguments: [COIN_TYPE],
      arguments: [tx.object(tunnelId)],
    })
  }, operatorKeypair)
  console.log(`  Close digest: ${closeDigest}`)

  for (const event of closeEvents) {
    if (event.type.includes('::tunnel::TunnelClosed')) {
      const p = event.parsedJson as any
      console.log(`  ✅ Closed! refund=${p.refund_amount}`)
    }
  }

  console.log('\n=== ✅ Integration test passed! Real Ed25519 claim verified on-chain ===')
}

main().catch(e => {
  console.error('\n❌ Test failed:', e)
  process.exit(1)
})
