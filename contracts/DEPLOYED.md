# LuLuPay Contract Deployment (v2 - Multi-Key)

**Network:** testnet
**Deployed:** 2026-02-11
**Digest:** 5h2GRPNgQq5to9hprvKgLmzPxiDb2SFXLZtCn82e1wpK

## Package

- **Package ID:** `0x42a47edd3066dd10e516ec2715ba61fbca91eec0be12288c97b0edb04d092678`

## Objects

- **TEST_USDC_Manager (shared):** `0x9fef50d4749b6818281316a0b6b025b1683e6615106229ccfcb438201f4f6460`
- **CoinMetadata (immutable):** `0x1c85a9b027d875fb6d3074b611c5976a102ba32c45a08f9526ed4155ec04602e`
- **UpgradeCap:** `0xe5466cad0cf3117de2a10b3c8b6de19f50b003534207f4939ebfa528d0382107`

## CreatorConfig (CURRENT - Backend Operator)

- **CreatorConfig ID (shared):** `0xf89f574e6bd9a9354c55ad347e397d3a845bbf5a2c416a664f42770064e8ebf6`
- **Operator:** `0xb467e3a2d287fa003b8f62c0cb1efb98f54c20e27604078a831b3c49d5f0cdde`
- **Operator Public Key (base64):** `WA9dzj2nNWlIfjddC3MZ1xldyjPJuBn+5J4Tovt+A+A=`
- **Grace Period:** 3,600,000 ms (60 minutes)
- **Metadata:** "3mate Platform v2"

## v2 Changes (Multi-Key Support)

- `payer_public_key` replaced with `authorized_keys: vector<vector<u8>>`
- `add_authorized_key()` - payer adds new authorized signing key
- `remove_authorized_key()` - payer removes key (cannot remove last)
- `claim()` verifies signature against ANY authorized key
- New events: `AuthorizedKeyAdded`, `AuthorizedKeyRemoved`
- New getters: `authorized_keys()`, `authorized_key_count()`

## Previous Deployment (v1)

- **Package ID:** `0x0a906dc87bd311f0f00b2494308cdbfdbb6a6bad61bc00a0d79f897420970602`
- **CreatorConfig:** `0x9833f3bb2429b6a7c26e9a1cfdcbeab446f5995d69bf7b218ce72d1c385cc90b`

## Coin Type

- **TEST_USDC:** `0x42a47edd3066dd10e516ec2715ba61fbca91eec0be12288c97b0edb04d092678::test_usdc::TEST_USDC`

## Key Functions

```bash
# Mint test USDC
sui client call --package <PACKAGE> --module test_usdc --function mint \
  --args <TEST_USDC_MANAGER> <amount_u64> <recipient_address>

# Open tunnel
sui client call --package <PACKAGE> --module tunnel --function open_tunnel \
  --type-args <TUSDC_TYPE> \
  --args <CREATOR_CONFIG> <coin_object> <payer_public_key_bytes>

# Add authorized key (payer only)
sui client call --package <PACKAGE> --module tunnel --function add_authorized_key \
  --type-args <TUSDC_TYPE> \
  --args <tunnel_object> <new_public_key_bytes>

# Remove authorized key (payer only)
sui client call --package <PACKAGE> --module tunnel --function remove_authorized_key \
  --type-args <TUSDC_TYPE> \
  --args <tunnel_object> <public_key_bytes>

# Claim (operator with authorized key's signature)
sui client call --package <PACKAGE> --module tunnel --function claim \
  --type-args <TUSDC_TYPE> \
  --args <tunnel_object> <cumulative_amount> <signature_bytes>
```
