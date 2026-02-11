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
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-emerald-400 rounded-lg flex items-center justify-center font-bold text-sm">3m</div>
            <span className="text-xl font-semibold">3mate Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onViewDocs} className="text-gray-400 hover:text-white transition-colors text-sm">Docs</button>
            <a href="https://github.com/3mate-labs" target="_blank" rel="noopener" className="text-gray-400 hover:text-white transition-colors text-sm">GitHub</a>
            <button onClick={onGetStarted} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center relative">
          <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium mb-6">
            Built on Sui · Powered by Tunnel Payments
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
            Pay-per-request APIs
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              with crypto micropayments
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            3mate lets any developer monetize their API with on-chain USDC payments. 
            No subscriptions, no invoices. Users deposit into a Tunnel, call your API with signed requests, 
            and settlements happen on-chain.
          </p>
          <div className="flex gap-4 justify-center">
            <button onClick={onGetStarted} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
              Start Building
            </button>
            <button onClick={onViewDocs} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-medium transition-colors">
              Read the Docs
            </button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-t border-gray-800">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-gray-400 text-center mb-14 max-w-xl mx-auto">
            Three steps from deposit to settlement. No gas fees on every request.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Deposit USDC into Tunnel',
                desc: 'Users open a payment Tunnel by depositing USDC on Sui. This creates an on-chain escrow between the user and the service provider.',
                icon: '🔐',
                color: 'blue',
              },
              {
                step: '02',
                title: 'Use the API with Signed Requests',
                desc: 'Each API call includes a cryptographic signature as a payment voucher. No on-chain transaction per request, so it\'s fast and free.',
                icon: '⚡',
                color: 'emerald',
              },
              {
                step: '03',
                title: 'Settle On-Chain',
                desc: 'The provider submits accumulated vouchers to the Tunnel contract. USDC moves from escrow to the provider. Fully transparent and verifiable.',
                icon: '✅',
                color: 'purple',
              },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 relative group hover:border-gray-600 transition-colors">
                <div className="text-xs text-gray-500 font-mono mb-4">STEP {item.step}</div>
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-gray-800 bg-gray-800/30">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Why 3mate?</h2>
          <p className="text-gray-400 text-center mb-14 max-w-xl mx-auto">
            A developer platform for building paid API services with crypto-native payments.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'Any API, Any Model', desc: 'Not just LLMs. Integrate Tunnel payments into image generation, data feeds, compute services, or any HTTP API.', icon: '🔌' },
              { title: 'Anthropic-Compatible', desc: 'Our LLM proxy speaks the Anthropic Messages API. Switch your base URL and you\'re paying with crypto.', icon: '🤖' },
              { title: 'No Per-Request Gas', desc: 'Signatures happen off-chain. Only deposits and settlements touch the blockchain, keeping costs near zero.', icon: '💨' },
              { title: 'Transparent Pricing', desc: 'Fixed 0.1 USDC per request. No hidden fees, no tiered pricing, no surprise bills. On-chain and auditable.', icon: '💎' },
              { title: 'For Service Providers', desc: 'Run your own LLM or API service. Register on 3mate, set your price, and start earning USDC from day one.', icon: '🏗️' },
              { title: 'Open Source', desc: 'Smart contracts and client libraries are open source. Audit the code, fork it, extend it.', icon: '📖' },
            ].map((f, i) => (
              <div
                key={i}
                className="flex gap-4 p-5 rounded-xl hover:bg-gray-800/60 transition-colors cursor-default"
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className={`text-2xl transition-transform ${hoveredFeature === i ? 'scale-110' : ''}`}>{f.icon}</div>
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 border-t border-gray-800">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Simple Pricing</h2>
          <p className="text-gray-400 mb-10">Pay only for what you use. No subscriptions.</p>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 max-w-sm mx-auto">
            <div className="text-5xl font-bold mb-2">
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">$0.10</span>
            </div>
            <div className="text-gray-400 mb-6">USDC per API request</div>
            <ul className="text-sm text-gray-300 space-y-3 text-left mb-8">
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> No minimum deposit</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> No monthly fees</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Withdraw unused balance anytime</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> On-chain settlement transparency</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> All models included</li>
            </ul>
            <button onClick={onGetStarted} className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
              Get Started Free
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-gray-800 bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to build?</h2>
          <p className="text-gray-400 mb-8">
            Whether you're integrating an AI assistant or monetizing your own API, 
            3mate gives you the payment rails.
          </p>
          <div className="flex gap-4 justify-center">
            <button onClick={onGetStarted} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
              Create Account
            </button>
            <button onClick={onViewDocs} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
              View Documentation
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-emerald-400 rounded flex items-center justify-center font-bold text-[10px]">3m</div>
            <span className="text-sm text-gray-400">3mate Labs · Built on Sui</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <button onClick={onViewDocs} className="hover:text-gray-300 transition-colors">Docs</button>
            <a href="https://github.com/3mate-labs" target="_blank" rel="noopener" className="hover:text-gray-300 transition-colors">GitHub</a>
            <a href="https://suiscan.xyz/testnet/object/0x0a906dc87bd311f0f00b2494308cdbfdbb6a6bad61bc00a0d79f897420970602" target="_blank" rel="noopener" className="hover:text-gray-300 transition-colors">Smart Contract</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
