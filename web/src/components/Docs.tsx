interface DocsProps {
  onBack: () => void
  onGetStarted: () => void
}

export default function Docs({ onBack, onGetStarted }: DocsProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 sticky top-0 bg-gray-900/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-emerald-400 rounded flex items-center justify-center font-bold text-[10px]">3m</div>
            <span className="font-semibold">3mate Platform</span>
          </button>
          <button onClick={onGetStarted} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
            Get Started
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Documentation</h1>
        <p className="text-gray-400 mb-12">Everything you need to integrate with 3mate Platform.</p>

        {/* Table of Contents */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-12">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">On this page</h3>
          <ul className="space-y-2 text-sm">
            {[
              ['#quick-start', 'Quick Start'],
              ['#api-reference', 'API Reference'],
              ['#payment-flow', 'Payment Flow (Tunnel)'],
              ['#service-providers', 'For Service Providers'],
              ['#smart-contracts', 'Smart Contracts'],
            ].map(([href, label]) => (
              <li key={href}><a href={href} className="text-blue-400 hover:text-blue-300 transition-colors">{label}</a></li>
            ))}
          </ul>
        </div>

        {/* Quick Start */}
        <section id="quick-start" className="mb-16 scroll-mt-20">
          <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-gray-800">Quick Start</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>Get up and running in under 5 minutes.</p>
            
            <h3 className="text-lg font-semibold text-white mt-6">1. Create an account</h3>
            <p>Sign up at <span className="text-blue-400">platform.3mate.io</span> using Google or email. You'll get access to the dashboard where you can manage API keys and monitor usage.</p>

            <h3 className="text-lg font-semibold text-white mt-6">2. Fund your Tunnel</h3>
            <p>Connect your Sui wallet and deposit USDC into a payment Tunnel. This creates an on-chain escrow that will fund your API usage.</p>

            <h3 className="text-lg font-semibold text-white mt-6">3. Get your API key</h3>
            <p>Generate an API key from the dashboard. Use it as your bearer token in API requests.</p>

            <h3 className="text-lg font-semibold text-white mt-6">4. Make your first request</h3>
            <Code>{`curl -X POST https://platform.3mate.io/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }'`}</Code>
            <p className="text-sm text-gray-400">The API is fully compatible with the Anthropic Messages API. You can use any Anthropic SDK by changing the base URL.</p>
          </div>
        </section>

        {/* API Reference */}
        <section id="api-reference" className="mb-16 scroll-mt-20">
          <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-gray-800">API Reference</h2>

          <div className="space-y-10">
            <div>
              <Endpoint method="POST" path="/v1/messages" />
              <p className="text-gray-300 mt-3 mb-4">Create a message. Fully compatible with the <a href="https://docs.anthropic.com/en/api/messages" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Anthropic Messages API</a>.</p>
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Headers</h4>
              <ParamTable rows={[
                ['x-api-key', 'string', 'Required. Your 3mate API key.'],
                ['anthropic-version', 'string', 'Required. API version (e.g. 2023-06-01).'],
                ['Content-Type', 'string', 'application/json'],
              ]} />
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-2">Body</h4>
              <p className="text-sm text-gray-400 mb-3">Same schema as the Anthropic Messages API. Key fields:</p>
              <ParamTable rows={[
                ['model', 'string', 'Model ID (e.g. claude-sonnet-4-20250514)'],
                ['messages', 'array', 'Array of message objects with role and content'],
                ['max_tokens', 'integer', 'Maximum tokens to generate'],
                ['stream', 'boolean', 'Enable streaming responses (SSE)'],
              ]} />
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-2">Response</h4>
              <Code>{`{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "usage": {
    "input_tokens": 12,
    "output_tokens": 10
  }
}`}</Code>
            </div>

            <div>
              <Endpoint method="GET" path="/api/config" />
              <p className="text-gray-300 mt-3 mb-4">Returns the platform configuration, including the Tunnel contract address and supported tokens.</p>
              <Code>{`{
  "tunnel_package": "0x0a906dc87bd...970602",
  "network": "testnet",
  "usdc_type": "0x...::usdc::USDC",
  "price_per_request": "100000",
  "provider_address": "0x..."
}`}</Code>
            </div>

            <div>
              <Endpoint method="POST" path="/api/tunnel/create" />
              <p className="text-gray-300 mt-3 mb-4">Get the transaction bytes to create a new payment Tunnel with an initial USDC deposit.</p>
              <ParamTable rows={[
                ['amount', 'string', 'Deposit amount in USDC base units (6 decimals)'],
                ['user_address', 'string', 'Your Sui wallet address'],
              ]} />
            </div>

            <div>
              <Endpoint method="POST" path="/api/tunnel/topup" />
              <p className="text-gray-300 mt-3 mb-4">Get transaction bytes to add more USDC to an existing Tunnel.</p>
              <ParamTable rows={[
                ['tunnel_id', 'string', 'Object ID of your Tunnel'],
                ['amount', 'string', 'Additional USDC amount to deposit'],
              ]} />
            </div>
          </div>
        </section>

        {/* Payment Flow */}
        <section id="payment-flow" className="mb-16 scroll-mt-20">
          <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-gray-800">Payment Flow (Tunnel)</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              The Tunnel is a payment channel between a user and a service provider, implemented as a Sui Move object.
              It holds USDC in escrow and tracks cumulative usage via signed vouchers.
            </p>

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 my-6">
              <h4 className="font-semibold mb-4 text-white">Flow Diagram</h4>
              <div className="font-mono text-sm text-gray-400 space-y-1">
                <p>User ──deposit USDC──▶ <span className="text-emerald-400">Tunnel (on-chain escrow)</span></p>
                <p>User ──signed request──▶ <span className="text-blue-400">Service Provider (off-chain)</span></p>
                <p>User ◀──API response──── <span className="text-blue-400">Service Provider</span></p>
                <p className="text-gray-600">  ... repeat N times, no gas fees ...</p>
                <p>Provider ──submit vouchers──▶ <span className="text-emerald-400">Tunnel (settle on-chain)</span></p>
                <p>Provider ◀──USDC payout──── <span className="text-emerald-400">Tunnel</span></p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6">Key Concepts</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-gray-200">Tunnel Object:</strong> An on-chain escrow holding USDC. Created by the user, specifying the provider.</li>
              <li><strong className="text-gray-200">Voucher:</strong> A signed message containing the cumulative payment amount. Each new voucher supersedes the previous one.</li>
              <li><strong className="text-gray-200">Settlement:</strong> The provider calls the smart contract with the latest voucher to withdraw earned USDC.</li>
              <li><strong className="text-gray-200">Withdrawal:</strong> Users can withdraw remaining USDC from the Tunnel after the provider has settled.</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mt-6">Why Tunnel?</h3>
            <p className="text-gray-400">
              Traditional per-request on-chain payments require a transaction (and gas) for every API call. 
              Tunnel batches payments: only the deposit and settlement are on-chain. 
              Everything in between uses cryptographic signatures, making individual requests instant and gas-free.
            </p>
          </div>
        </section>

        {/* For Service Providers */}
        <section id="service-providers" className="mb-16 scroll-mt-20">
          <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-gray-800">For Service Providers</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              3mate isn't just for LLMs. Any developer can integrate Tunnel payments to monetize their API service.
            </p>

            <h3 className="text-lg font-semibold text-white mt-6">How to Integrate</h3>
            <ol className="list-decimal list-inside space-y-3 text-gray-400">
              <li><strong className="text-gray-200">Register as a provider</strong> on the 3mate platform. You'll receive a provider address on Sui.</li>
              <li><strong className="text-gray-200">Set your pricing</strong> per request. This is encoded in the Tunnel contract configuration.</li>
              <li><strong className="text-gray-200">Verify vouchers</strong> in your API middleware. Each incoming request includes a signed voucher. Validate the signature and cumulative amount before serving.</li>
              <li><strong className="text-gray-200">Settle periodically</strong> by submitting the latest voucher to the Tunnel contract to collect your USDC earnings.</li>
            </ol>

            <h3 className="text-lg font-semibold text-white mt-6">Example: LLM Proxy</h3>
            <p className="text-gray-400">
              LuLuAI is a reference implementation: it wraps the Anthropic API, adds Tunnel payment verification, 
              and charges 0.1 USDC per request. You can build similar proxies for OpenAI, Replicate, or any API.
            </p>

            <h3 className="text-lg font-semibold text-white mt-6">SDK (Coming Soon)</h3>
            <p className="text-gray-400">
              We're building a TypeScript SDK that handles voucher verification and settlement, 
              so you can add Tunnel payments to any Express/Fastify server with a few lines of code.
            </p>
          </div>
        </section>

        {/* Smart Contracts */}
        <section id="smart-contracts" className="mb-16 scroll-mt-20">
          <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-gray-800">Smart Contracts</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>The Tunnel payment system is implemented as a Sui Move package.</p>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 my-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Package ID (Testnet)</span>
                <a
                  href="https://suiscan.xyz/testnet/object/0x0a906dc87bd311f0f00b2494308cdbfdbb6a6bad61bc00a0d79f897420970602"
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-blue-400 hover:underline"
                >
                  View on SuiScan ↗
                </a>
              </div>
              <code className="text-sm text-emerald-400 break-all">
                0x0a906dc87bd311f0f00b2494308cdbfdbb6a6bad61bc00a0d79f897420970602
              </code>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6">Key Modules</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-gray-200">tunnel::create</strong> - Create a new payment Tunnel with initial deposit</li>
              <li><strong className="text-gray-200">tunnel::topup</strong> - Add funds to an existing Tunnel</li>
              <li><strong className="text-gray-200">tunnel::settle</strong> - Provider submits voucher to claim earned USDC</li>
              <li><strong className="text-gray-200">tunnel::withdraw</strong> - User withdraws remaining balance</li>
              <li><strong className="text-gray-200">tunnel::close</strong> - Close a Tunnel and return remaining funds</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mt-6">Network</h3>
            <p className="text-gray-400">
              Currently deployed on <strong className="text-gray-200">Sui Testnet</strong>. 
              Mainnet deployment is planned after audit completion.
            </p>
          </div>
        </section>

        {/* Back to top */}
        <div className="text-center pt-8 border-t border-gray-800">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

/* Helper Components */

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto text-sm">
      <code className="text-gray-300">{children}</code>
    </pre>
  )
}

function Endpoint({ method, path }: { method: string; path: string }) {
  const color = method === 'GET' ? 'text-emerald-400 bg-emerald-400/10' : 'text-blue-400 bg-blue-400/10'
  return (
    <div className="flex items-center gap-3">
      <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${color}`}>{method}</span>
      <code className="text-sm font-mono text-gray-200">{path}</code>
    </div>
  )
}

function ParamTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden text-sm">
      {rows.map(([name, type, desc], i) => (
        <div key={i} className={`flex gap-4 px-4 py-2.5 ${i > 0 ? 'border-t border-gray-800' : ''}`}>
          <code className="text-emerald-400 font-mono w-40 shrink-0">{name}</code>
          <span className="text-gray-500 w-16 shrink-0">{type}</span>
          <span className="text-gray-400">{desc}</span>
        </div>
      ))}
    </div>
  )
}
