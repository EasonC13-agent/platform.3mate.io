import { useState } from 'react'

interface LandingProps {
  onGetStarted: () => void
  onViewDocs: () => void
}

export default function Landing({ onGetStarted, onViewDocs }: LandingProps) {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-bold">3mate</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onViewDocs} className="text-gray-400 hover:text-white transition-colors text-sm">
              Docs
            </button>
            <button
              onClick={onGetStarted}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-block px-3 py-1 mb-6 text-xs font-medium bg-blue-600/20 text-blue-400 rounded-full border border-blue-600/30">
          Built on Sui  ·  Testnet Live
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Tunnel Payments<br />
          <span className="text-blue-400">for AI Services</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Accept crypto payments for any API. One smart contract, instant settlement, 
          no payment infrastructure to build. Start monetizing in minutes.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onGetStarted}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-lg transition-colors"
          >
            Get Started
          </button>
          <button
            onClick={onViewDocs}
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-medium text-lg transition-colors"
          >
            Read Docs
          </button>
        </div>
      </section>

      {/* How it Works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
        <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
          Three steps from zero to paid API. No payment processor, no invoicing, no chargebacks.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '1',
              icon: '💰',
              title: 'User Deposits USDC',
              desc: 'Users open a Tunnel (escrow channel) on Sui and deposit USDC. Funds are locked in a smart contract, visible on-chain.',
            },
            {
              step: '2',
              icon: '🔑',
              title: 'Call the API',
              desc: 'Users get an API key and make requests. Each call costs 0.1 USDC, deducted from their Tunnel balance automatically.',
            },
            {
              step: '3',
              icon: '✅',
              title: 'Provider Settles',
              desc: 'Provider closes the Tunnel to claim earned USDC. Remaining balance returns to the user. Fully trustless.',
            },
          ].map((item, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-600/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                  {item.step}
                </div>
                <span className="text-2xl">{item.icon}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Why 3mate</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              icon: '🔗',
              title: 'Anthropic-Compatible API',
              desc: 'Drop-in replacement. Use the same SDK, same format. Just swap the base URL and API key.',
            },
            {
              icon: '⛓️',
              title: 'On-Chain Escrow',
              desc: 'Funds held in a Sui smart contract. Both parties can verify balances at any time. No trust required.',
            },
            {
              icon: '🧩',
              title: 'For Any Developer',
              desc: '3mate is a platform. Integrate Tunnel payments into your own service, or use ours. LuLuAI is just one example.',
            },
            {
              icon: '💸',
              title: 'Simple Pricing',
              desc: '0.1 USDC per request. No tiers, no hidden fees, no monthly minimum. Pay only for what you use.',
            },
            {
              icon: '🌐',
              title: 'Global Access',
              desc: 'No bank account needed. Anyone with a Sui wallet and USDC can use AI services, anywhere in the world.',
            },
            {
              icon: '🛡️',
              title: 'Non-Custodial',
              desc: 'We never hold your funds. The smart contract handles everything. Withdraw unused balance anytime.',
            },
          ].map((f, i) => (
            <div
              key={i}
              className={`bg-gray-800/50 rounded-xl p-6 border transition-all cursor-default ${
                hoveredFeature === i ? 'border-blue-600/50 bg-gray-800' : 'border-gray-800'
              }`}
              onMouseEnter={() => setHoveredFeature(i)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="text-lg font-semibold mt-3 mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <p className="text-gray-400 text-sm mb-2 uppercase tracking-wide">Per API Request</p>
          <div className="flex items-baseline justify-center gap-1 mb-2">
            <span className="text-5xl font-bold">0.1</span>
            <span className="text-xl text-gray-400">USDC</span>
          </div>
          <p className="text-gray-500 text-sm mb-6">Claude Sonnet 4 · No minimum · No subscription</p>
          <ul className="text-left text-sm space-y-3 mb-8">
            {[
              'Pay per request, nothing more',
              'Deposit any amount of USDC',
              'Withdraw unused balance anytime',
              'On-chain settlement via Sui',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-gray-300">
                <span className="text-green-400">✓</span> {item}
              </li>
            ))}
          </ul>
          <button
            onClick={onGetStarted}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Start Building
          </button>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to integrate?</h2>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto">
          Whether you're building an AI app or monetizing your own API, 
          3mate makes crypto payments simple.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onGetStarted}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Create Account
          </button>
          <a
            href="https://github.com/nicemateOo"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-medium transition-colors"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <span>⚡</span>
            <span>3mate</span>
            <span className="mx-2">·</span>
            <span>Tunnel Payments for AI Services</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <button onClick={onViewDocs} className="hover:text-gray-300 transition-colors">Docs</button>
            <a href="https://github.com/nicemateOo" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <a href="https://suiscan.xyz/testnet" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Sui Explorer</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
