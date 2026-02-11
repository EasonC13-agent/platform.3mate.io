import { useState, useEffect } from 'react'
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { useQuery } from '@tanstack/react-query'

interface ContractConfig {
  packageId: string
  testUsdcManagerId: string
  creatorConfigId: string
  operatorAddress: string
  operatorPublicKey: string
  network: string
}

export default function TunnelManager() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)

  // Fetch config
  const { data: config } = useQuery<ContractConfig>({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
  })

  // Fetch tunnel status
  const { data: tunnelStatus, refetch: refetchTunnel } = useQuery({
    queryKey: ['tunnelStatus', account?.address],
    queryFn: async () => {
      if (!account?.address) return null
      const res = await fetch(`/api/tunnel/status/${account.address}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!account?.address,
  })

  // Fetch USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['usdcBalance', account?.address, config?.packageId],
    queryFn: async () => {
      if (!account?.address || !config?.packageId) return '0'
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: `${config.packageId}::test_usdc::TEST_USDC`,
      })
      return coins.data.reduce((s, c) => s + BigInt(c.balance), 0n).toString()
    },
    enabled: !!account?.address && !!config?.packageId,
  })

  // Fetch API keys list
  const { data: apiKeys, refetch: refetchKeys } = useQuery({
    queryKey: ['apiKeys', account?.address],
    queryFn: async () => {
      if (!account?.address) return []
      const res = await fetch(`/api/keys/${account.address}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.keys || []
    },
    enabled: !!account?.address,
  })

  const fmt = (amt: string | number) => `$${(Number(amt) / 1e6).toFixed(2)}`
  const coinType = config ? `${config.packageId}::test_usdc::TEST_USDC` : ''

  const mintUsdc = async () => {
    if (!config || !account) return
    setLoading(true); setStatus('Minting 100 TEST_USDC...')
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${config.packageId}::test_usdc::mint`,
        arguments: [tx.object(config.testUsdcManagerId), tx.pure.u64(100_000_000), tx.pure.address(account.address)],
      })
      const r = await signAndExecute({ transaction: tx })
      setStatus(`✅ Minted! ${r.digest.slice(0, 12)}...`)
      setTimeout(() => { refetchBalance() }, 2000)
    } catch (e: any) { setStatus(`❌ ${e.message}`) }
    setLoading(false)
  }

  const openTunnel = async () => {
    if (!config || !account) return
    setLoading(true); setStatus('Opening tunnel...')
    try {
      const coins = await suiClient.getCoins({ owner: account.address, coinType })
      if (!coins.data.length) { setStatus('No USDC. Mint first!'); setLoading(false); return }

      const tx = new Transaction()
      let coinArg
      if (coins.data.length === 1) {
        coinArg = tx.object(coins.data[0].coinObjectId)
      } else {
        const [p, ...rest] = coins.data
        coinArg = tx.object(p.coinObjectId)
        if (rest.length) tx.mergeCoins(coinArg, rest.map(c => tx.object(c.coinObjectId)))
      }

      // Get payer public key
      let pubKeyBytes: number[]
      if (account.publicKey) {
        const raw = Array.from(
          typeof account.publicKey === 'string'
            ? Uint8Array.from(atob(account.publicKey), c => c.charCodeAt(0))
            : new Uint8Array(account.publicKey)
        )
        pubKeyBytes = raw.length === 33 ? raw.slice(1) : raw
      } else { setStatus('Cannot get wallet public key'); setLoading(false); return }

      tx.moveCall({
        target: `${config.packageId}::tunnel::open_tunnel`,
        typeArguments: [coinType],
        arguments: [tx.object(config.creatorConfigId), coinArg, tx.pure.vector('u8', pubKeyBytes)],
      })
      const result = await signAndExecute({ transaction: tx })
      setStatus(`✅ Tunnel opened! ${result.digest.slice(0, 12)}...`)

      // Register with backend after indexer catches up
      setTimeout(async () => {
        try {
          const txDetail = await suiClient.getTransactionBlock({ digest: result.digest, options: { showEvents: true } })
          for (const ev of (txDetail.events || [])) {
            if (ev.type.includes('::tunnel::TunnelOpened')) {
              const p = ev.parsedJson as any
              await fetch('/api/tunnel/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suiAddress: account.address, tunnelObjectId: p.tunnel_id, totalDeposit: p.deposit_amount }),
              })
              setStatus(`✅ Tunnel registered: ${p.tunnel_id.slice(0, 12)}...`)
              break
            }
          }
          refetchTunnel(); refetchBalance()
        } catch (e: any) { console.error(e) }
      }, 3000)
    } catch (e: any) { setStatus(`❌ ${e.message}`) }
    setLoading(false)
  }

  const createApiKey = async () => {
    if (!config || !account) return
    const activeTunnel = activeTunnels[0]
    if (!activeTunnel) { setStatus('Open a tunnel first!'); return }

    setLoading(true); setStatus('Generating API key...')
    try {
      // Generate Ed25519 keypair
      const kp = Ed25519Keypair.generate()
      const pubKeyBytes = Array.from(kp.getPublicKey().toRawBytes())
      const apiKeyStr = kp.getSecretKey() // bech32 suiprivkey1...

      // Add authorized key on-chain
      setStatus('Adding key to tunnel (sign the transaction)...')
      const tx = new Transaction()
      tx.moveCall({
        target: `${config.packageId}::tunnel::add_authorized_key`,
        typeArguments: [coinType],
        arguments: [tx.object(activeTunnel.tunnelObjectId), tx.pure.vector('u8', pubKeyBytes)],
      })
      await signAndExecute({ transaction: tx })

      // Register key with backend
      try {
        await fetch('/api/keys/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suiAddress: account.address,
            apiKey: apiKeyStr,
            name: `Key ${(apiKeys?.length || 0) + 1}`,
          }),
        })
      } catch (e) { console.error('Key registration:', e) }

      setGeneratedKey(apiKeyStr)
      setStatus('✅ API key created and authorized on-chain!')
      refetchKeys()
    } catch (e: any) { setStatus(`❌ ${e.message}`) }
    setLoading(false)
  }

  const activeTunnels = tunnelStatus?.tunnels?.filter((t: any) => t.status === 'ACTIVE') || []

  return (
    <div className="space-y-6">
      {/* Testnet Warning */}
      <div className="bg-yellow-900/40 border border-yellow-600/40 rounded-xl p-4 flex items-center gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="font-semibold text-yellow-400 text-sm">Testnet Only</p>
          <p className="text-xs text-yellow-300/70">Switch your Sui wallet to <strong>Testnet</strong>. All transactions use TEST_USDC (no real funds).</p>
        </div>
      </div>

      {/* Wallet */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Sui Wallet</h3>
        <div className="flex items-center gap-4">
          <ConnectButton />
          {account && <span className="text-sm text-gray-400 font-mono">{account.address.slice(0, 10)}...{account.address.slice(-6)}</span>}
        </div>
      </div>

      {account && config && (
        <>
          {/* Balance + Actions */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">TEST_USDC</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm">Wallet Balance</p>
              <p className="text-3xl font-bold text-green-400">{fmt(usdcBalance || '0')}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={mintUsdc} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium">
                Mint 100 Demo USDC
              </button>
              <button onClick={openTunnel} disabled={loading} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium">
                Open Tunnel (Deposit All)
              </button>
            </div>
          </div>

          {/* Active Tunnels */}
          {activeTunnels.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Payment Tunnel</h3>
                <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded-full font-medium">Active</span>
              </div>
              {activeTunnels.map((t: any) => (
                <div key={t.id} className="bg-gray-900 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-gray-400 text-xs">Deposited</p>
                      <p className="font-medium text-lg">{fmt(t.totalDeposit)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Used</p>
                      <p className="font-medium text-lg">{fmt(BigInt(t.claimedAmount || 0) + BigInt(t.pendingAmount || 0))}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Remaining</p>
                      <p className="font-medium text-lg text-green-400">{fmt(t.availableBalance || t.totalDeposit)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 font-mono">{t.tunnelObjectId}</p>
                </div>
              ))}
            </div>
          )}

          {/* API Keys Section */}
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">API Keys</h3>
              <button
                onClick={createApiKey}
                disabled={loading || !activeTunnels.length}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-medium"
              >
                + Create Key
              </button>
            </div>

            {!activeTunnels.length && (
              <p className="text-gray-400 text-sm">Open a tunnel first, then create API keys to access the API.</p>
            )}

            {/* Generated Key (one-time display) */}
            {generatedKey && (
              <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>🔑</span>
                  <p className="font-semibold text-green-400 text-sm">New API Key Created</p>
                </div>
                <div className="bg-gray-900 rounded p-3 mb-3">
                  <code className="text-xs text-green-300 break-all select-all">{generatedKey}</code>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedKey); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000) }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs font-medium"
                  >
                    {keyCopied ? '✅ Copied!' : '📋 Copy'}
                  </button>
                  <button onClick={() => setGeneratedKey(null)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs">
                    I've saved it
                  </button>
                </div>
                <p className="text-xs text-red-400">⚠️ Save this now! We don't store it. It won't be shown again.</p>
              </div>
            )}

            {/* Key List */}
            {apiKeys && apiKeys.length > 0 && (
              <div className="space-y-2">
                {apiKeys.map((k: any) => (
                  <div key={k.id} className="bg-gray-900 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{k.name || 'API Key'}</p>
                      <p className="text-xs text-gray-400 font-mono">sk-...{k.keyHint || '****'}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${k.isActive !== false ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      {k.isActive !== false ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTunnels.length > 0 && (!apiKeys || apiKeys.length === 0) && (
              <p className="text-gray-400 text-sm">No API keys yet. Create one to start using the API.</p>
            )}
          </div>
        </>
      )}

      {/* Status */}
      {status && (
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-yellow-400">{status}</p>
        </div>
      )}
    </div>
  )
}
