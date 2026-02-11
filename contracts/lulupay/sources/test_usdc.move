module lulupay::test_usdc;

use sui::coin::{Self, TreasuryCap};
use sui::url;

public struct TEST_USDC has drop {}

public struct TEST_USDC_Manager has key {
    id: UID,
    treasury_cap: TreasuryCap<TEST_USDC>,
}

fun init(witness: TEST_USDC, ctx: &mut TxContext) {
    let icon_url = url::new_unsafe_from_bytes(b"https://cryptologos.cc/logos/usd-coin-usdc-logo.png");
    let (treasury_cap, metadata) = coin::create_currency<TEST_USDC>(
        witness,
        6,
        b"TUSDC",
        b"Test USDC",
        b"Test USDC for LuLuAI Platform demo",
        option::some(icon_url),
        ctx,
    );
    transfer::public_freeze_object(metadata);
    let manager = TEST_USDC_Manager {
        id: object::new(ctx),
        treasury_cap,
    };
    transfer::share_object(manager);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(TEST_USDC {}, ctx);
}

public entry fun mint(
    manager: &mut TEST_USDC_Manager,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let coin = coin::mint(&mut manager.treasury_cap, amount, ctx);
    transfer::public_transfer(coin, recipient);
}
