import { useState, useRef, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import ApiKeys from './components/ApiKeys'
import Usage from './components/Usage'
import Balance from './components/Balance'

function App() {
  const { user, loading, logout, firebaseUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'keys' | 'usage' | 'balance'>('dashboard')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!firebaseUser) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <h1 className="text-xl font-bold">LuLuAI Platform</h1>
          </div>
          
          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              {firebaseUser.photoURL ? (
                <img 
                  src={firebaseUser.photoURL} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium">
                  {(firebaseUser.displayName || firebaseUser.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium">{firebaseUser.displayName || 'User'}</p>
                <p className="text-xs text-gray-400">{firebaseUser.email}</p>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
                <div className="px-4 py-3 border-b border-gray-700">
                  <p className="text-sm font-medium">{firebaseUser.displayName || 'User'}</p>
                  <p className="text-xs text-gray-400 truncate">{firebaseUser.email}</p>
                </div>
                <button
                  onClick={() => { setActiveTab('balance'); setShowDropdown(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                >
                  <span>👤</span> Profile
                </button>
                <button
                  onClick={() => { setShowDropdown(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                >
                  <span>⚙️</span> Settings
                </button>
                <div className="border-t border-gray-700 mt-1 pt-1">
                  <button
                    onClick={() => { logout(); setShowDropdown(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <span>🚪</span> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-800 p-1 rounded-lg w-fit">
          {(['dashboard', 'balance', 'keys', 'usage'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'keys' ? 'API Keys' : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && <Dashboard userId={firebaseUser.uid} />}
        {activeTab === 'balance' && <Balance userId={firebaseUser.uid} />}
        {activeTab === 'keys' && <ApiKeys userId={firebaseUser.uid} />}
        {activeTab === 'usage' && <Usage userId={firebaseUser.uid} />}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          Powered by Sui Tunnel Payment • 0.1 USDC per request
        </div>
      </footer>
    </div>
  )
}

export default App
