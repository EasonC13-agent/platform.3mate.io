# LLM Service with Sui Tunnel Payment

A proxy service for LLM APIs (Claude/Anthropic) with micropayment support via Sui Tunnel.

## Features

- 🔐 **Sui Wallet Authentication**: Use your Sui private key as API key
- 💰 **Micropayments**: Pay-per-request with Tunnel escrow system
- 🔄 **Anthropic Compatible**: Drop-in replacement for `api.anthropic.com`
- 📊 **Dashboard**: Track usage and manage API keys

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Client (LuLuAI Mac App)                            │
│  x-api-key: mateapikey1...                          │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  LLM Service (Express)                              │
│  ├─ Verify signature                                │
│  ├─ Check balance                                   │
│  ├─ Sign StateReceipt                               │
│  ├─ Proxy to Anthropic                              │
│  └─ Update usage                                    │
└─────────────────┬───────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│  Anthropic    │   │  Sui Tunnel   │
│  API          │   │  (On-chain)   │
└───────────────┘   └───────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

## API Endpoints

### Messages API (Anthropic Compatible)

```bash
POST /v1/messages
Headers:
  x-api-key: mateapikey1...
Body: (same as Anthropic API)
```

### API Key Management

```bash
# Generate new API key
POST /api/keys/generate
Body: { "suiAddress": "0x..." }

# Register existing key
POST /api/keys/register
Body: { "suiAddress": "0x...", "apiKey": "mateapikey1..." }

# List keys
GET /api/keys/:suiAddress
```

### Tunnel Management

```bash
# Register tunnel (after on-chain creation)
POST /api/tunnel/register
Body: { "suiAddress": "0x...", "tunnelObjectId": "0x...", "totalDeposit": "1000000" }

# Get status
GET /api/tunnel/status/:suiAddress

# Claim pending funds
POST /api/tunnel/claim
Body: { "tunnelObjectId": "0x..." }
```

### Dashboard

```bash
# Get dashboard data
GET /api/dashboard/:suiAddress

# Get usage logs
GET /api/dashboard/:suiAddress/usage
```

## API Key Format

The API key is a Sui Ed25519 private key with prefix changed:

```
Original: suiprivkey1qr...
Our format: mateapikey1qr...
```

The key is used to:
1. Derive public key for identity
2. Sign StateReceipts for micropayments

## Pricing

Default: 0.1 USDC per request (configurable in `pricing_configs` table)

## Environment Variables

```env
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
PORT=3100
SUI_NETWORK=mainnet
PROVIDER_PRIVATE_KEY=suiprivkey...
TUNNEL_PACKAGE_ID=0x...
CREATOR_CONFIG_ID=0x...
```

## License

MIT
