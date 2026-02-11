import { useState, useEffect } from 'react'
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
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

  // Fetch config from backend
  const { data: config } = useQuery<ContractConfig>({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await fetch('/api/config')
      return res.json()
    },
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

  // Fetch TEST_USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['usdcBalance', account?.address, config?.packageId],
    queryFn: async () => {
      if (!account?.address || !config?.packageId) return '0'
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: `${config.packageId}::test_usdc::TEST_USDC`,
      })
      const total = coins.data.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0))
      return total.toString()
    },
    enabled: !!account?.address && !!config?.packageId,
  })

  const formatUsdc = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseInt(amount) : amount
    return `$${(num / 1_000_000).toFixed(2)}`
  }

  const mintUsdc = async () => {
    if (!config || !account) return
    setLoading(true)
    setStatus('Minting 100 TEST_USDC...')
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${config.packageId}::test_usdc::mint`,
        arguments: [
          tx.object(config.testUsdcManagerId),
          tx.pure.u64(100_000_000), // 100 USDC (6 decimals)
          tx.pure.address(account.address),
        ],
      })
      const result = await signAndExecute({ transaction: tx })
      setStatus(`Minted! Digest: ${result.digest.slice(0, 16)}...`)
      setTimeout(() => { refetchBalance(); }, 2000)
    } catch (e: any) {
      setStatus(`Mint failed: ${e.message}`)
    }
    setLoading(false)
  }

  const openTunnel = async () => {
    if (!config || !account) return
    setLoading(true)
    setStatus('Opening tunnel...')
    try {
      // Get USDC coins
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: `${config.packageId}::test_usdc::TEST_USDC`,
      })
      if (coins.data.length === 0) {
        setStatus('No TEST_USDC coins. Mint first!')
        setLoading(false)
        return
      }

      const tx = new Transaction()
      
      // Merge all coins into one if multiple
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

      // Get payer public key (32 bytes) from account
      // account.publicKey is base64-encoded, but may include scheme flag byte
      let pubKeyBytes: number[]
      if (account.publicKey) {
        const raw = Array.from(
          typeof account.publicKey === 'string'
            ? Uint8Array.from(atob(account.publicKey), c => c.charCodeAt(0))
            : new Uint8Array(account.publicKey)
        )
        // If 33 bytes, first byte is scheme flag (0x00 for Ed25519)
        pubKeyBytes = raw.length === 33 ? raw.slice(1) : raw
      } else {
        setStatus('Cannot get wallet public key')
        setLoading(false)
        return
      }

      tx.moveCall({
        target: `${config.packageId}::tunnel::open_tunnel`,
        typeArguments: [`${config.packageId}::test_usdc::TEST_USDC`],
        arguments: [
          tx.object(config.creatorConfigId),
          coinArg,
          tx.pure.vector('u8', pubKeyBytes),
        ],
      })

      const result = await signAndExecute({ transaction: tx })
      setStatus(`Tunnel opened! Digest: ${result.digest.slice(0, 16)}...`)

      // Wait for indexer then try to find and register the tunnel
      setTimeout(async () => {
        try {
          // Find tunnel objects owned by this address
          const objects = await suiClient.getOwnedObjects({
            owner: account.address,
            filter: { StructType: `${config.packageId}::tunnel::Tunnel<${config.packageId}::test_usdc::TEST_USDC>` },
            options: { showContent: true },
          })
          
          if (objects.data.length > 0) {
            const tunnelObj = objects.data[0]
            const tunnelObjectId = tunnelObj.data?.objectId
            if (tunnelObjectId) {
              // Get balance from on-chain
              let totalDeposit = '0'
              if (tunnelObj.data?.content && 'fields' in tunnelObj.data.content) {
                const fields = tunnelObj.data.content.fields as any
                totalDeposit = fields.balance?.fields?.balance || '0'
              }
              
              // Register with backend
              await fetch('/api/tunnel/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  suiAddress: account.address,
                  tunnelObjectId,
                  totalDeposit,
                }),
              })
              setStatus(`Tunnel registered! ID: ${tunnelObjectId.slice(0, 16)}...`)
            }
          }
          refetchTunnel()
          refetchBalance()
        } catch (e: any) {
          console.error('Tunnel registration error:', e)
          setStatus(`Tunnel opened on-chain but registration failed: ${e.message}`)
        }
      }, 3000)
    } catch (e: any) {
      setStatus(`Open tunnel failed: ${e.message}`)
    }
    setLoading(false)
  }

  const activeTunnels = tunnelStatus?.tunnels?.filter((t: any) => t.status === 'ACTIVE') || []

  return (
    <div className="space-y-6">
      {/* Wallet Connection */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Sui Wallet</h3>
        <div className="flex items-center gap-4">
          <ConnectButton />
          {account && (
            <div className="text-sm text-gray-400">
              <span className="font-mono">{account.address.slice(0, 10)}...{account.address.slice(-6)}</span>
            </div>
          )}
        </div>
      </div>

      {account && config && (
        <>
          {/* TEST_USDC Balance & Actions */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">TEST_USDC</h3>
            <div className="flex items-center gap-6 mb-4">
              <div className="bg-gray-900 rounded-lg p-4 flex-1">
                <p className="text-gray-400 text-sm">Wallet Balance</p>
                <p className="text-3xl font-bold text-green-400">
                  {formatUsdc(usdcBalance || '0')}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={mintUsdc}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
              >
                Mint 100 Demo USDC
              </button>
              <button
                onClick={openTunnel}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg"
              >
                Open Tunnel (Deposit All)
              </button>
            </div>
          </div>

          {/* Active Tunnels */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Payment Tunnels</h3>
            {activeTunnels.length > 0 ? (
              <div className="space-y-4">
                {activeTunnels.map((t: any) => (
                  <div key={t.id} className="bg-gray-900 rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm">Status</p>
                        <p className="font-medium text-green-400">{t.status}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Deposited</p>
                        <p className="font-medium">{formatUsdc(t.totalDeposit)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Used</p>
                        <p className="font-medium">{formatUsdc(BigInt(t.claimedAmount) + BigInt(t.pendingAmount))}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Remaining</p>
                        <p className="font-medium text-green-400">{formatUsdc(t.availableBalance)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 font-mono">{t.tunnelObjectId}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No active tunnels. Mint USDC and open a tunnel to start.</p>
            )}
          </div>
        </>
      )}

      {/* Status Messages */}
      {status && (
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-yellow-400">{status}</p>
        </div>
      )}
    </div>
  )
}
