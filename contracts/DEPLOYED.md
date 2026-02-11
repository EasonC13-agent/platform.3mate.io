# LuLuPay Contract Deployment

**Network:** testnet
**Deployed:** 2026-02-11
**Digest:** AjZpugzwNbTmyN6aTfmUyCRv4LjdbRufXcJbgtffLWGy

## Package

- **Package ID:** `0x0a906dc87bd311f0f00b2494308cdbfdbb6a6bad61bc00a0d79f897420970602`

## Objects

- **TEST_USDC_Manager (shared):** `0x3348f0defa0ef9f7fee5f21d51977636b4cf39be5420d6fdef7203ab5469fd24`
- **CoinMetadata (immutable):** `0x3f3962e34cc74d60bae8d8074da4fda618ee642d65d34eb223e9c63cfa96c328`
- **UpgradeCap:** `0x697850fef17f62b7ce5820e4efad1c1176fe14b715ce71f3beaf046e404699d2`

## CreatorConfig

- **CreatorConfig ID (shared):** `0xeecfff58414e378629adea0192cf8e6b369ee41710af582f8ec3100381bf115f`
- **Operator:** `0x5eef0f57e2544a274fb1fa99b26c9cda55e329bdf2e33da7a9dafba2c061f227`
- **Operator Public Key (base64):** `lhjxSX4XRGp9GAlFIUPv0YGgN6mIvIuQ8E0IvHaYXCU=`
- **Grace Period:** 3,600,000 ms (60 minutes)
- **Metadata:** "LuLuAI Platform"
- **Creation Digest:** 75okvzUgfvfuxrLLWZcd2iVDvycebEBidYHGiBtxTKge

## Coin Type

- **TEST_USDC:** `0x0a906dc87bd311f0f00b2494308cdbfdbb6a6bad61bc00a0d79f897420970602::test_usdc::TEST_USDC`

## Key Functions

```bash
# Mint test USDC (anyone can call)
sui client call --package <PACKAGE> --module test_usdc --function mint \
  --args <TEST_USDC_MANAGER> <amount_u64> <recipient_address>

# Open tunnel (user deposits USDC)
sui client call --package <PACKAGE> --module tunnel --function open_tunnel \
  --type-args <TUSDC_TYPE> \
  --args <CREATOR_CONFIG> <coin_object> <payer_public_key_bytes>

# Claim (operator with payer's signature)
sui client call --package <PACKAGE> --module tunnel --function claim \
  --type-args <TUSDC_TYPE> \
  --args <tunnel_object> <cumulative_amount> <signature_bytes>

# Close with receipt (operator, after claim)
sui client call --package <PACKAGE> --module tunnel --function close_with_receipt \
  --type-args <TUSDC_TYPE> \
  --args <tunnel_object>

# Init close (payer-initiated)
sui client call --package <PACKAGE> --module tunnel --function init_close \
  --type-args <TUSDC_TYPE> \
  --args <tunnel_object> 0x6

# Finalize close (payer, after grace period)
sui client call --package <PACKAGE> --module tunnel --function finalize_close \
  --type-args <TUSDC_TYPE> \
  --args <tunnel_object> 0x6
```
