import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'

interface BalanceProps {
  userId: string
}

async function fetchBalance(userId: string, token: string) {
  const res = await fetch(`/api/balance/${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  if (!res.ok) throw new Error('Failed to fetch balance')
  return res.json()
}

export default function Balance({ userId }: BalanceProps) {
  const { getIdToken } = useAuth()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['balance', userId],
    queryFn: async () => {
      const token = await getIdToken()
      if (!token) throw new Error('Not authenticated')
      return fetchBalance(userId, token)
    },
  })

  const formatUsdc = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseInt(amount) : amount
    return `$${(num / 1_000_000).toFixed(2)}`
  }

  if (isLoading) {
    return <div className="text-center py-10">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Your Balance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Available</p>
            <p className="text-3xl font-bold text-green-400">
              {formatUsdc(data?.balance || 0)}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Pending</p>
            <p className="text-3xl font-bold text-yellow-400">
              {formatUsdc(data?.pendingBalance || 0)}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total Spent</p>
            <p className="text-3xl font-bold text-gray-400">
              {formatUsdc(data?.totalSpent || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Deposit Section */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Deposit USDC</h3>
        <p className="text-gray-400 mb-4">
          Send USDC to your deposit address to add funds to your account.
        </p>
        
        {data?.depositAddress ? (
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-2">Deposit Address (Sui Network)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-gray-800 px-3 py-2 rounded break-all">
                {data.depositAddress}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(data.depositAddress)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg p-4 text-center">
            <p className="text-gray-400 mb-4">No deposit address yet.</p>
            <button
              onClick={() => {/* TODO: Generate deposit address */}}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Generate Deposit Address
            </button>
          </div>
        )}
      </div>

      {/* Tunnel Status */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Payment Tunnel</h3>
        {data?.tunnel ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <p className={`font-medium ${
                  data.tunnel.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {data.tunnel.status}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Tunnel ID</p>
                <p className="font-mono text-sm">{data.tunnel.id.slice(0, 16)}...</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Deposited</p>
                <p className="font-medium">{formatUsdc(data.tunnel.totalDeposit)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Used</p>
                <p className="font-medium">{formatUsdc(data.tunnel.claimedAmount)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">No active payment tunnel.</p>
            <p className="text-sm text-gray-500">
              Deposit USDC to create a payment tunnel and start using the API.
            </p>
          </div>
        )}
      </div>

      {/* Pricing Info */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Pricing</h3>
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Per API Request</p>
              <p className="text-sm text-gray-400">Claude Sonnet 4</p>
            </div>
            <p className="text-2xl font-bold text-green-400">$0.10</p>
          </div>
        </div>
      </div>
    </div>
  )
}
