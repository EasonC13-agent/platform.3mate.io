import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface ApiKeysProps {
  userId: string
}

export default function ApiKeys({ userId }: ApiKeysProps) {
  const queryClient = useQueryClient()
  const { getIdToken } = useAuth()
  const [showNewKey, setShowNewKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
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

  const generateMutation = useMutation({
    mutationFn: async (name: string) => {
      const token = await getIdToken()
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, name }),
      })
      if (!res.ok) throw new Error('Failed to generate key')
      return res.json()
    },
    onSuccess: (data) => {
      setShowNewKey(data.apiKey)
      setNewKeyName('')
      queryClient.invalidateQueries({ queryKey: ['keys', userId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getIdToken()
      const res = await fetch(`/api/keys/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to delete key')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys', userId] })
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return <div className="text-center py-10">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* New Key Modal */}
      {showNewKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-green-400">🔑 New API Key Created!</h3>
            <p className="text-yellow-400 text-sm mb-4">
              ⚠️ Save this key now! It will only be shown once.
            </p>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm break-all mb-4">
              {showNewKey}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(showNewKey)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {copied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={() => setShowNewKey(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate New Key */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Generate New API Key</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production, Testing)"
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => generateMutation.mutate(newKeyName || 'New Key')}
            disabled={generateMutation.isPending}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Keys List */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Your API Keys</h3>
        {data?.keys?.length === 0 ? (
          <p className="text-gray-400">No API keys yet. Generate one above to get started.</p>
        ) : (
          <div className="space-y-4">
            {data?.keys?.map((key: any) => (
              <div
                key={key.id}
                className="flex items-center justify-between bg-gray-900 rounded-lg p-4"
              >
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-gray-400 text-sm font-mono">
                    mateapikey...{key.keyHint}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Created: {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && ` • Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this key?')) {
                      deleteMutation.mutate(key.id)
                    }
                  }}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Key Format Info */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">About API Keys</h3>
        <div className="text-gray-400 space-y-2 text-sm">
          <p>• API keys are derived from Sui Ed25519 keypairs</p>
          <p>• Format: <code className="bg-gray-900 px-2 py-1 rounded">mateapikey1...</code></p>
          <p>• Each request is signed with your key for payment verification</p>
          <p>• Keys can be used with any Anthropic-compatible client</p>
        </div>
      </div>
    </div>
  )
}
