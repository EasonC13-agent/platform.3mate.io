#!/usr/bin/env tsx
/**
 * Test full flow: mint USDC -> open tunnel -> register -> demo API call -> check status
 * Uses agent wallet at localhost:3847
 */

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'

const BACKEND_URL = 'http://localhost:3100'
const AGENT_WALLET_URL = 'http://localhost:3847'

async function main() {
  console.log('=== LuLuAI Full Flow Test ===\n')

  // 1. Get config
  const config = await fetch(`${BACKEND_URL}/api/config`).then(r => r.json())
  console.log('Config:', JSON.stringify(config, null, 2))
  
  // 2. Get agent wallet address
  const { address: agentAddr } = await fetch(`${AGENT_WALLET_URL}/address`).then(r => r.json())
  console.log(`\nAgent address: ${agentAddr}`)

  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') })
  const coinType = `${config.packageId}::test_usdc::TEST_USDC`

  // 3. Mint 100 TEST_USDC
  console.log('\n--- Step 1: Mint 100 TEST_USDC ---')
  {
    const tx = new Transaction()
    tx.moveCall({
      target: `${config.packageId}::test_usdc::mint`,
      arguments: [
        tx.object(config.testUsdcManagerId),
        tx.pure.u64(100_000_000),
        tx.pure.address(agentAddr),
      ],
    })
    tx.setSender(agentAddr)
    const built = await tx.build({ client: suiClient })
    const b64 = Buffer.from(built).toString('base64')
    
    const signRes = await fetch(`${AGENT_WALLET_URL}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txBytes: b64 }),
    }).then(r => r.json())
    
    const execRes = await suiClient.executeTransactionBlock({
      transactionBlock: b64,
      signature: signRes.signature,
    })
    console.log(`Mint digest: ${execRes.digest}`)
    await suiClient.waitForTransaction({ digest: execRes.digest })
  }

  // Wait for indexer
  await new Promise(r => setTimeout(r, 3000))

  // Check balance
  const coins = await suiClient.getCoins({ owner: agentAddr, coinType })
  const totalBalance = coins.data.reduce((s, c) => s + BigInt(c.balance), BigInt(0))
  console.log(`TEST_USDC balance: ${totalBalance} (${Number(totalBalance) / 1_000_000} USDC)`)

  if (coins.data.length === 0) {
    console.error('No coins found after mint!')
    process.exit(1)
  }

  // 4. Open tunnel
  console.log('\n--- Step 2: Open Tunnel ---')
  {
    // Get agent public key
    const { publicKey: agentPubKeyB64 } = await fetch(`${AGENT_WALLET_URL}/address`).then(r => r.json())
    let pubKeyBytes: number[]
    if (agentPubKeyB64) {
      const raw = Array.from(Buffer.from(agentPubKeyB64, 'base64'))
      pubKeyBytes = raw.length === 33 ? raw.slice(1) : raw
    } else {
      console.error('Cannot get agent public key')
      process.exit(1)
    }

    const tx = new Transaction()
    
    // Merge coins if needed
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
      target: `${config.packageId}::tunnel::open_tunnel`,
      typeArguments: [coinType],
      arguments: [
        tx.object(config.creatorConfigId),
        coinArg,
        tx.pure.vector('u8', pubKeyBytes),
      ],
    })
    tx.setSender(agentAddr)
    
    const built = await tx.build({ client: suiClient })
    const b64 = Buffer.from(built).toString('base64')
    
    const signRes = await fetch(`${AGENT_WALLET_URL}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txBytes: b64 }),
    }).then(r => r.json())
    
    const execRes = await suiClient.executeTransactionBlock({
      transactionBlock: b64,
      signature: signRes.signature,
    })
    console.log(`Open tunnel digest: ${execRes.digest}`)
    await suiClient.waitForTransaction({ digest: execRes.digest })
  }

  await new Promise(r => setTimeout(r, 3000))

  // 5. Find tunnel object
  console.log('\n--- Step 3: Find & Register Tunnel ---')
  const tunnelType = `${config.packageId}::tunnel::Tunnel<${coinType}>`
  const ownedObjects = await suiClient.getOwnedObjects({
    owner: agentAddr,
    filter: { StructType: tunnelType },
    options: { showContent: true },
  })

  if (ownedObjects.data.length === 0) {
    console.error('No tunnel objects found!')
    process.exit(1)
  }

  const tunnelObj = ownedObjects.data[0]
  const tunnelObjectId = tunnelObj.data!.objectId
  let totalDeposit = '0'
  if (tunnelObj.data?.content && 'fields' in tunnelObj.data.content) {
    const fields = tunnelObj.data.content.fields as any
    totalDeposit = fields.balance?.fields?.balance || '0'
  }
  console.log(`Tunnel: ${tunnelObjectId}, deposit: ${totalDeposit}`)

  // Register tunnel with backend
  const regRes = await fetch(`${BACKEND_URL}/api/tunnel/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suiAddress: agentAddr, tunnelObjectId, totalDeposit }),
  }).then(r => r.json())
  console.log('Register result:', JSON.stringify(regRes, null, 2))

  // 6. Call demo API
  console.log('\n--- Step 4: Call Demo API ---')
  // First we need the API key for this user
  // Check if user has one, or we need to get it
  const statusRes = await fetch(`${BACKEND_URL}/api/tunnel/status/${agentAddr}`).then(r => r.json())
  console.log('Tunnel status:', JSON.stringify(statusRes, null, 2))

  console.log('\n=== Flow test complete ===')
  console.log('To test demo API, create an API key for this user and call:')
  console.log(`  curl -X POST ${BACKEND_URL}/api/demo/call -H "x-api-key: <YOUR_API_KEY>"`)
}

main().catch(e => {
  console.error('Test failed:', e)
  process.exit(1)
})
