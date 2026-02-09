import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'

interface UsageProps {
  userId: string
}

export default function Usage({ userId }: UsageProps) {
  const { getIdToken } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['usage', userId],
    queryFn: async () => {
      const token = await getIdToken()
      if (!token) return { logs: [] }
      const res = await fetch(`/api/dashboard/user/${userId}/usage?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) return { logs: [] }
      return res.json()
    },
  })

  const formatUsdc = (amount: string) => {
    const num = parseInt(amount) / 1_000_000
    return `$${num.toFixed(4)}`
  }

  if (isLoading) {
    return <div className="text-center py-10">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Usage Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Recent API Calls</h3>
        </div>
        
        {!data?.logs?.length ? (
          <div className="p-6 text-center text-gray-400">
            No API calls yet. Generate an API key and start making requests!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Model</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">API Key</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Input</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Output</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-400">
                      {log.model.replace('claude-', '').slice(0, 15)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      ...{log.apiKeyHint}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {log.inputTokens.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {log.outputTokens.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-400">
                      {formatUsdc(log.costUsdc)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-400">
                      {log.latencyMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pricing Info */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Per Request (Flat Fee)</p>
            <p className="text-2xl font-bold text-green-400">$0.10</p>
            <p className="text-gray-500 text-xs mt-1">Regardless of token count</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Supported Models</p>
            <p className="text-lg font-medium">Claude Sonnet 4</p>
            <p className="text-gray-500 text-xs mt-1">More models coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}
