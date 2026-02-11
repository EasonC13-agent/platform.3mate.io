#!/usr/bin/env tsx
/**
 * Test full flow: mint USDC -> open tunnel -> register -> demo API call -> check status
 * Uses agent wallet at localhost:3847 (sign-and-execute endpoint)
 */

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'

const BACKEND_URL = 'http://localhost:3100'
const AGENT_WALLET_URL = 'http://localhost:3847'

async function signAndExecute(tx: Transaction, agentAddr: string, suiClient: SuiClient) {
  tx.setSender(agentAddr)
  const built = await tx.build({ client: suiClient })
  const b64 = Buffer.from(built).toString('base64')
  
  const res = await fetch(`${AGENT_WALLET_URL}/sign-and-execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txBytes: b64 }),
  }).then(r => r.json())
  
  if (!res.success) throw new Error(`TX failed: ${JSON.stringify(res)}`)
  console.log(`  Digest: ${res.digest}`)
  
  // Wait for finality
  await suiClient.waitForTransaction({ digest: res.digest })
  return res
}

async function main() {
  console.log('=== 3mate Platform Full Flow Test ===\n')

  // 1. Get config
  const config = await fetch(`${BACKEND_URL}/api/config`).then(r => r.json())
  console.log('Config:', JSON.stringify(config, null, 2))
  
  // 2. Get agent wallet info
  const walletInfo = await fetch(`${AGENT_WALLET_URL}/address`).then(r => r.json())
  const agentAddr = walletInfo.address
  const agentPubKeyB64 = walletInfo.publicKey
  console.log(`\nAgent: ${agentAddr}`)

  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') })
  const coinType = `${config.packageId}::test_usdc::TEST_USDC`

  // 3. Mint 100 TEST_USDC
  console.log('\n--- Step 1: Mint 100 TEST_USDC ---')
  const mintTx = new Transaction()
  mintTx.moveCall({
    target: `${config.packageId}::test_usdc::mint`,
    arguments: [
      mintTx.object(config.testUsdcManagerId),
      mintTx.pure.u64(100_000_000), // 100 USDC (6 decimals)
      mintTx.pure.address(agentAddr),
    ],
  })
  await signAndExecute(mintTx, agentAddr, suiClient)
  
  await new Promise(r => setTimeout(r, 3000))

  // Check balance
  const coins = await suiClient.getCoins({ owner: agentAddr, coinType })
  const totalBalance = coins.data.reduce((s, c) => s + BigInt(c.balance), BigInt(0))
  console.log(`  TEST_USDC balance: ${Number(totalBalance) / 1_000_000} USDC (${coins.data.length} coins)`)

  if (coins.data.length === 0) {
    console.error('No coins after mint!')
    process.exit(1)
  }

  // 4. Open tunnel
  console.log('\n--- Step 2: Open Tunnel ---')
  let pubKeyBytes: number[]
  const raw = Array.from(Buffer.from(agentPubKeyB64, 'base64'))
  pubKeyBytes = raw.length === 33 ? raw.slice(1) : raw // strip scheme flag if present
  console.log(`  PubKey (${pubKeyBytes.length} bytes): ${Buffer.from(pubKeyBytes).toString('hex').slice(0, 16)}...`)

  const openTx = new Transaction()
  
  // Merge coins if needed, then use
  let coinArg
  if (coins.data.length === 1) {
    coinArg = openTx.object(coins.data[0].coinObjectId)
  } else {
    const [primary, ...rest] = coins.data
    coinArg = openTx.object(primary.coinObjectId)
    if (rest.length > 0) {
      openTx.mergeCoins(coinArg, rest.map(c => openTx.object(c.coinObjectId)))
    }
  }

  openTx.moveCall({
    target: `${config.packageId}::tunnel::open_tunnel`,
    typeArguments: [coinType],
    arguments: [
      openTx.object(config.creatorConfigId),
      coinArg,
      openTx.pure.vector('u8', pubKeyBytes),
    ],
  })
  const openRes = await signAndExecute(openTx, agentAddr, suiClient)
  
  await new Promise(r => setTimeout(r, 3000))

  // 5. Find tunnel object (shared objects aren't "owned")
  console.log('\n--- Step 3: Find Tunnel ---')
  
  // Parse events from the transaction to find tunnel ID
  const txDetail = await suiClient.getTransactionBlock({
    digest: openRes.digest,
    options: { showEvents: true },
  })
  
  let tunnelObjectId = ''
  let depositAmount = '0'
  for (const event of (txDetail.events || [])) {
    if (event.type.includes('::tunnel::TunnelOpened')) {
      const parsed = event.parsedJson as any
      tunnelObjectId = parsed.tunnel_id
      depositAmount = parsed.deposit_amount
      break
    }
  }
  
  if (!tunnelObjectId) {
    console.error('Could not find TunnelOpened event!')
    // Try listing recent events
    console.log('Events:', JSON.stringify(txDetail.events, null, 2))
    process.exit(1)
  }
  
  console.log(`  Tunnel ID: ${tunnelObjectId}`)
  console.log(`  Deposit: ${Number(depositAmount) / 1_000_000} USDC`)

  // 6. Register tunnel with backend
  console.log('\n--- Step 4: Register Tunnel ---')
  const regRes = await fetch(`${BACKEND_URL}/api/tunnel/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      suiAddress: agentAddr, 
      tunnelObjectId, 
      totalDeposit: depositAmount 
    }),
  }).then(r => r.json())
  console.log('  Result:', JSON.stringify(regRes))

  // 7. Check tunnel status
  console.log('\n--- Step 5: Tunnel Status ---')
  const statusRes = await fetch(`${BACKEND_URL}/api/tunnel/status/${agentAddr}`).then(r => r.json())
  console.log('  Status:', JSON.stringify(statusRes, null, 2))

  // 8. Try demo API (need an API key first)
  console.log('\n--- Step 6: Demo API Call ---')
  console.log('  (Skipping - need API key registration flow)')
  console.log('  To test manually:')
  console.log(`  curl -X POST ${BACKEND_URL}/api/demo/call -H "x-api-key: <key>"`)

  console.log('\n=== ✅ Flow test complete! ===')
}

main().catch(e => {
  console.error('\nTest failed:', e)
  process.exit(1)
})
