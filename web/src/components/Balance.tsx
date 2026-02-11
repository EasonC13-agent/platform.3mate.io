import TunnelManager from './TunnelManager'

interface BalanceProps {
  userId: string
}

export default function Balance({ userId }: BalanceProps) {
  return (
    <div className="space-y-6">
      <TunnelManager />
      
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
