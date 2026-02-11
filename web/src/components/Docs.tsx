import { useState } from 'react'

interface DocsProps {
  onBack: () => void
  onGetStarted: () => void
}

type Section = 'quickstart' | 'api' | 'payment' | 'providers' | 'contracts'

const PACKAGE_ID = '0x0a906dc87bd311f0f00b2494308cdbfdbb6a6bad61bc00a0d79f897420970602'

export default function Docs({ onBack, onGetStarted }: DocsProps) {
  const [active, setActive] = useState<Section>('quickstart')

  const sections: { id: Section; label: string }[] = [
    { id: 'quickstart', label: 'Quick Start' },
    { id: 'api', label: 'API Reference' },
    { id: 'payment', label: 'Payment Flow' },
    { id: 'providers', label: 'For Providers' },
    { id: 'contracts', label: 'Contracts' },
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 sticky top-0 bg-gray-900/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <span>←</span>
            <span className="text-xl font-bold">3mate</span>
          </button>
          <button
            onClick={onGetStarted}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block w-48 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium">Documentation</p>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  active === s.id ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-4 -mt-2 mb-4 w-full">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                active === s.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {active === 'quickstart' && <QuickStart />}
          {active === 'api' && <ApiReference />}
          {active === 'payment' && <PaymentFlow />}
          {active === 'providers' && <ForProviders />}
          {active === 'contracts' && <Contracts />}
        </main>
      </div>
    </div>
  )
}

function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm overflow-x-auto my-4">
      <code>{children}</code>
    </pre>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold mt-8 mb-4">{children}</h2>
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold mt-6 mb-3">{children}</h3>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-300 leading-relaxed mb-4">{children}</p>
}

function QuickStart() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Quick Start</h1>
      <p className="text-gray-400 mb-8">Get up and running in under 5 minutes.</p>

      <H2>1. Create an Account</H2>
      <P>Sign in with Google or email at <a href="https://platform.3mate.io" className="text-blue-400 hover:underline">platform.3mate.io</a>.</P>

      <H2>2. Deposit USDC</H2>
      <P>
        Connect your Sui wallet in the Balance tab. Open a Tunnel (payment channel) and deposit USDC.
        This creates an on-chain escrow that the platform draws from as you make API calls.
      </P>

      <H2>3. Generate an API Key</H2>
      <P>Go to the API Keys tab and create a new key. Copy it somewhere safe.</P>

      <H2>4. Make Your First Request</H2>
      <Code>{`curl https://platform.3mate.io/v1/messages \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 256,
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }'`}</Code>
      <P>That's it. Each request costs 0.1 USDC, deducted from your Tunnel balance.</P>

      <H2>Using with Anthropic SDKs</H2>
      <H3>Python</H3>
      <Code>{`import anthropic

client = anthropic.Anthropic(
    api_key="YOUR_API_KEY",
    base_url="https://platform.3mate.io"
)

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=256,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(message.content[0].text)`}</Code>

      <H3>TypeScript</H3>
      <Code>{`import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'https://platform.3mate.io',
});

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 256,
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(message.content[0].text);`}</Code>
    </div>
  )
}

function ApiReference() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">API Reference</h1>
      <p className="text-gray-400 mb-8">Anthropic-compatible Messages API.</p>

      <H2>POST /v1/messages</H2>
      <P>
        Fully compatible with the Anthropic Messages API. Send the same request body,
        get the same response format. The only difference: authentication uses <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm">x-api-key</code> with your 3mate API key.
      </P>

      <H3>Headers</H3>
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left p-3 text-gray-400">Header</th>
              <th className="text-left p-3 text-gray-400">Required</th>
              <th className="text-left p-3 text-gray-400">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-700">
              <td className="p-3 font-mono text-blue-400">x-api-key</td>
              <td className="p-3">Yes</td>
              <td className="p-3 text-gray-300">Your 3mate API key</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="p-3 font-mono text-blue-400">Content-Type</td>
              <td className="p-3">Yes</td>
              <td className="p-3 text-gray-300">application/json</td>
            </tr>
            <tr>
              <td className="p-3 font-mono text-blue-400">anthropic-version</td>
              <td className="p-3">Optional</td>
              <td className="p-3 text-gray-300">API version (e.g. 2023-06-01)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H3>Request Body</H3>
      <Code>{`{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing in simple terms."
    }
  ],
  "system": "You are a helpful assistant.",  // optional
  "temperature": 0.7,                        // optional
  "stream": false                             // optional
}`}</Code>

      <H3>Response</H3>
      <Code>{`{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Quantum computing uses..."
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 12,
    "output_tokens": 84
  }
}`}</Code>

      <H3>Streaming</H3>
      <P>
        Set <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm">"stream": true</code> to receive Server-Sent Events.
        The stream format matches Anthropic's SSE protocol exactly.
      </P>

      <H3>Error Codes</H3>
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left p-3 text-gray-400">Status</th>
              <th className="text-left p-3 text-gray-400">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['401', 'Invalid or missing API key'],
              ['402', 'Insufficient Tunnel balance'],
              ['429', 'Rate limited'],
              ['500', 'Internal server error'],
            ].map(([code, desc], i) => (
              <tr key={i} className={i < 3 ? 'border-b border-gray-700' : ''}>
                <td className="p-3 font-mono text-yellow-400">{code}</td>
                <td className="p-3 text-gray-300">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaymentFlow() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Payment Flow</h1>
      <p className="text-gray-400 mb-8">How Tunnel payments work under the hood.</p>

      <H2>Overview</H2>
      <P>
        3mate uses "Tunnel" payment channels built on Sui. A Tunnel is an on-chain escrow 
        between a user and a service provider. Funds flow one direction: from user to provider, 
        request by request.
      </P>

      <H2>Lifecycle</H2>
      <div className="space-y-4 my-6">
        {[
          {
            title: 'Open Tunnel',
            desc: 'User calls the smart contract to create a Tunnel, depositing USDC into escrow. The Tunnel is tied to a specific provider.',
          },
          {
            title: 'Use Service',
            desc: 'Each API request deducts 0.1 USDC from the off-chain balance. The platform tracks cumulative spending.',
          },
          {
            title: 'Top Up',
            desc: 'Users can deposit more USDC into an existing Tunnel at any time without creating a new one.',
          },
          {
            title: 'Close / Settle',
            desc: 'Either party can close the Tunnel. The provider receives earned USDC; remaining balance returns to the user.',
          },
        ].map((step, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
              {i + 1}
            </div>
            <div>
              <p className="font-semibold mb-1">{step.title}</p>
              <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <H2>Security Model</H2>
      <P>
        Funds are held by the Sui smart contract, not by 3mate. The contract enforces that:
      </P>
      <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4 ml-4">
        <li>Only the designated provider can claim spent funds</li>
        <li>Users can always reclaim unspent balance</li>
        <li>Settlement requires a valid signed state from both parties</li>
      </ul>

      <H2>Balance Tracking</H2>
      <P>
        The platform maintains an off-chain balance that mirrors on-chain state. 
        Each API request atomically decrements this balance. When a Tunnel is closed, 
        the final off-chain balance is submitted on-chain for settlement.
      </P>
    </div>
  )
}

function ForProviders() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">For Providers</h1>
      <p className="text-gray-400 mb-8">Integrate Tunnel payments into your own service.</p>

      <H2>What is 3mate?</H2>
      <P>
        3mate is not just one AI service. It's a platform that any developer can use to accept
        Tunnel-based crypto payments for their API. LuLuAI (our Claude proxy) is the first service 
        built on 3mate, but you can build your own.
      </P>

      <H2>Integration Overview</H2>
      <P>As a provider, you:</P>
      <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4 ml-4">
        <li>Register your service on the 3mate platform</li>
        <li>Set your per-request price</li>
        <li>Accept API calls from users who have open Tunnels with you</li>
        <li>Settle Tunnels to claim your earnings</li>
      </ol>

      <H2>Why Tunnel Payments?</H2>
      <div className="grid gap-4 my-6">
        {[
          { title: 'No payment infrastructure', desc: 'No Stripe, no invoicing, no chargebacks. The blockchain handles everything.' },
          { title: 'Global by default', desc: 'Accept payments from anyone with a Sui wallet. No banking requirements.' },
          { title: 'Instant settlement', desc: 'Close a Tunnel and receive USDC immediately. No 30-day net terms.' },
          { title: 'Transparent', desc: 'All payment state is on-chain. Users can verify their balance at any time.' },
        ].map((item, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="font-semibold mb-1">{item.title}</p>
            <p className="text-gray-400 text-sm">{item.desc}</p>
          </div>
        ))}
      </div>

      <H2>Getting Started</H2>
      <P>
        Provider integration is coming soon. If you're interested in building on 3mate,
        reach out on <a href="https://github.com/nicemateOo" className="text-blue-400 hover:underline">GitHub</a> or 
        check the Contracts section for smart contract details.
      </P>
    </div>
  )
}

function Contracts() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Contracts</h1>
      <p className="text-gray-400 mb-8">On-chain smart contract details.</p>

      <H2>Tunnel Payment Contract</H2>
      <P>The Tunnel payment system is deployed on Sui Testnet.</P>

      <H3>Package ID</H3>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 my-4 font-mono text-sm break-all">
        <a
          href={`https://suiscan.xyz/testnet/object/${PACKAGE_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          {PACKAGE_ID}
        </a>
      </div>
      <P>Network: <span className="text-yellow-400 font-medium">Sui Testnet</span></P>

      <H2>Key Functions</H2>
      <div className="space-y-4 my-4">
        {[
          {
            name: 'open_tunnel',
            desc: 'Create a new payment channel between user and provider, depositing initial USDC.',
          },
          {
            name: 'top_up',
            desc: 'Add more USDC to an existing Tunnel.',
          },
          {
            name: 'close_tunnel',
            desc: 'Close the Tunnel. Provider receives earned amount; user gets remainder.',
          },
        ].map((fn, i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <code className="text-green-400 font-mono">{fn.name}</code>
            <p className="text-gray-400 text-sm mt-1">{fn.desc}</p>
          </div>
        ))}
      </div>

      <H2>USDC on Testnet</H2>
      <P>
        The contract uses testnet USDC. You can obtain test USDC from the Sui testnet faucet
        or through the platform's test token distribution.
      </P>

      <H2>Source Code</H2>
      <P>
        The smart contract source code is available on{' '}
        <a href="https://github.com/nicemateOo" className="text-blue-400 hover:underline">GitHub</a>.
        Contributions and audits are welcome.
      </P>
    </div>
  )
}
