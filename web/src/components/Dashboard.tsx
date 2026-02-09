import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'

interface DashboardProps {
  userId: string
}

export default function Dashboard({ userId }: DashboardProps) {
  const { user, getIdToken } = useAuth()

  const { data: balanceData } = useQuery({
    queryKey: ['balance', userId],
    queryFn: async () => {
      const token = await getIdToken()
      if (!token) return null
      const res = await fetch(`/api/balance/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) return null
      return res.json()
    },
  })

  const { data: keysData } = useQuery({
    queryKey: ['keys', userId],
    queryFn: async () => {
      const token = await getIdToken()
      if (!token) return { keys: [] }
      const res = await fetch(`/api/keys/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) return { keys: [] }
      return res.json()
    },
  })

  const formatUsdc = (amount: string | number | null | undefined) => {
    if (!amount) return '$0.00'
    const num = typeof amount === 'string' ? parseInt(amount) : amount
    return `$${(num / 1_000_000).toFixed(2)}`
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-2">
          Welcome, {user?.displayName || user?.email?.split('@')[0] || 'User'}! 👋
        </h2>
        <p className="text-gray-400">
          Manage your API keys and monitor your usage.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-gray-400 text-sm mb-2">Available Balance</h3>
          <p className="text-3xl font-bold text-green-400">
            {formatUsdc(balanceData?.balance)}
          </p>
        </div>

        {/* API Keys Card */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-gray-400 text-sm mb-2">Active API Keys</h3>
          <p className="text-3xl font-bold">{keysData?.keys?.length || 0}</p>
        </div>

        {/* Total Spent Card */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-gray-400 text-sm mb-2">Total Spent</h3>
          <p className="text-3xl font-bold text-gray-400">
            {formatUsdc(balanceData?.totalSpent)}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Start</h3>
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <p className="text-gray-400"># Use your API key with any Anthropic-compatible client</p>
          <p className="mt-2">curl https://platform.3mate.io/v1/messages \</p>
          <p className="pl-4">-H "x-api-key: YOUR_MATEAPIKEY" \</p>
          <p className="pl-4">-H "Content-Type: application/json" \</p>
          <p className="pl-4">-d '&#123;"model": "claude-sonnet-4-20250514", "max_tokens": 100, "messages": [&#123;"role": "user", "content": "Hello"&#125;]&#125;'</p>
        </div>
      </div>

      {/* Getting Started Steps */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">1</div>
            <div>
              <p className="font-medium">Add Balance</p>
              <p className="text-gray-400 text-sm">Deposit USDC to your account in the Balance tab</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">2</div>
            <div>
              <p className="font-medium">Generate API Key</p>
              <p className="text-gray-400 text-sm">Create an API key in the API Keys tab</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">3</div>
            <div>
              <p className="font-medium">Start Using</p>
              <p className="text-gray-400 text-sm">Use your API key with Claude API or LuLuAI Mac App</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
