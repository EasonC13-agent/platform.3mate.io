module lulupay::tunnel;

use sui::coin::{Self, Coin};
use sui::event;
use sui::bcs;
use sui::ed25519;
use sui::clock::Clock;

// ======== Error codes ========
const E_INVALID_SIGNATURE: u64 = 1;
#[allow(unused_const)]
const E_INVALID_NONCE: u64 = 2;
const E_INSUFFICIENT_BALANCE: u64 = 3;
const E_NOT_PAYER: u64 = 4;
const E_NOT_OPERATOR: u64 = 5;
const E_TUNNEL_CLOSING: u64 = 6;
const E_TUNNEL_NOT_CLOSING: u64 = 7;
const E_GRACE_PERIOD_NOT_ELAPSED: u64 = 8;
const E_CLAIM_AMOUNT_TOO_LOW: u64 = 9;
const E_TUNNEL_HAS_NO_CLAIMS: u64 = 10;

// ======== Structs ========

public struct CreatorConfig has key {
    id: UID,
    operator: address,
    operator_public_key: vector<u8>, // 32 bytes Ed25519
    metadata: vector<u8>,
    grace_period_ms: u64,
}

#[allow(lint(coin_field))]
public struct Tunnel<phantom T> has key {
    id: UID,
    payer: address,
    payer_public_key: vector<u8>, // 32 bytes Ed25519
    operator: address,
    operator_public_key: vector<u8>,
    balance: Coin<T>,
    cumulative_claimed: u64,
    nonce: u64,
    closing: bool,
    close_requested_at_ms: u64,
    grace_period_ms: u64,
    creator_config_id: ID,
}

// ======== Events ========

public struct CreatorConfigCreated has copy, drop {
    config_id: ID,
    operator: address,
}

public struct TunnelOpened has copy, drop {
    tunnel_id: ID,
    payer: address,
    operator: address,
    deposit_amount: u64,
}

public struct Claimed has copy, drop {
    tunnel_id: ID,
    claim_amount: u64,
    cumulative_claimed: u64,
    nonce: u64,
}

public struct TunnelClosed has copy, drop {
    tunnel_id: ID,
    refund_amount: u64,
    total_claimed: u64,
}

public struct CloseInitiated has copy, drop {
    tunnel_id: ID,
    close_requested_at_ms: u64,
    grace_period_ms: u64,
}

// ======== Functions ========

#[allow(lint(public_entry))]
public entry fun create_creator_config(
    operator: address,
    operator_public_key: vector<u8>,
    metadata: vector<u8>,
    grace_period_ms: u64,
    ctx: &mut TxContext,
) {
    let config = CreatorConfig {
        id: object::new(ctx),
        operator,
        operator_public_key,
        metadata,
        grace_period_ms,
    };
    event::emit(CreatorConfigCreated {
        config_id: object::id(&config),
        operator,
    });
    transfer::share_object(config);
}

/// User deposits coin to open a tunnel
#[allow(lint(public_entry))]
public entry fun open_tunnel<T>(
    config: &CreatorConfig,
    deposit: Coin<T>,
    payer_public_key: vector<u8>,
    ctx: &mut TxContext,
) {
    let deposit_amount = coin::value(&deposit);
    let tunnel = Tunnel<T> {
        id: object::new(ctx),
        payer: tx_context::sender(ctx),
        payer_public_key,
        operator: config.operator,
        operator_public_key: config.operator_public_key,
        balance: deposit,
        cumulative_claimed: 0,
        nonce: 0,
        closing: false,
        close_requested_at_ms: 0,
        grace_period_ms: config.grace_period_ms,
        creator_config_id: object::id(config),
    };
    event::emit(TunnelOpened {
        tunnel_id: object::id(&tunnel),
        payer: tx_context::sender(ctx),
        operator: config.operator,
        deposit_amount,
    });
    transfer::share_object(tunnel);
}

// ======== Internal claim logic ========

/// Shared claim logic: validates, transfers, updates state
fun claim_internal<T>(
    tunnel: &mut Tunnel<T>,
    cumulative_amount: u64,
    ctx: &mut TxContext,
) {
    assert!(!tunnel.closing, E_TUNNEL_CLOSING);
    assert!(tx_context::sender(ctx) == tunnel.operator, E_NOT_OPERATOR);
    assert!(cumulative_amount > tunnel.cumulative_claimed, E_CLAIM_AMOUNT_TOO_LOW);

    let expected_nonce = tunnel.nonce + 1;
    let claim_amount = cumulative_amount - tunnel.cumulative_claimed;
    assert!(coin::value(&tunnel.balance) >= claim_amount, E_INSUFFICIENT_BALANCE);

    let claimed_coin = coin::split(&mut tunnel.balance, claim_amount, ctx);
    transfer::public_transfer(claimed_coin, tunnel.operator);

    tunnel.cumulative_claimed = cumulative_amount;
    tunnel.nonce = expected_nonce;

    event::emit(Claimed {
        tunnel_id: object::id(tunnel),
        claim_amount,
        cumulative_claimed: cumulative_amount,
        nonce: expected_nonce,
    });
}

/// Construct the claim message: tunnel_id_bytes || bcs(cumulative_amount) || bcs(nonce)
fun construct_claim_message<T>(tunnel: &Tunnel<T>, cumulative_amount: u64, nonce: u64): vector<u8> {
    let mut msg = object::id_bytes(tunnel);
    msg.append(bcs::to_bytes(&cumulative_amount));
    msg.append(bcs::to_bytes(&nonce));
    msg
}

/// Operator claims funds with payer's signature on (tunnel_id || cumulative_amount || nonce)
#[allow(lint(public_entry))]
public entry fun claim<T>(
    tunnel: &mut Tunnel<T>,
    cumulative_amount: u64,
    signature: vector<u8>,
    ctx: &mut TxContext,
) {
    let expected_nonce = tunnel.nonce + 1;
    let msg = construct_claim_message(tunnel, cumulative_amount, expected_nonce);

    // Verify payer's signature
    assert!(
        ed25519::ed25519_verify(&signature, &tunnel.payer_public_key, &msg),
        E_INVALID_SIGNATURE,
    );

    claim_internal(tunnel, cumulative_amount, ctx);
}

/// Close tunnel after at least one claim, refund remaining to payer
#[allow(lint(public_entry))]
public entry fun close_with_receipt<T>(
    tunnel: Tunnel<T>,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == tunnel.operator, E_NOT_OPERATOR);
    assert!(tunnel.nonce > 0, E_TUNNEL_HAS_NO_CLAIMS);

    let Tunnel {
        id,
        payer,
        payer_public_key: _,
        operator: _,
        operator_public_key: _,
        balance,
        cumulative_claimed,
        nonce: _,
        closing: _,
        close_requested_at_ms: _,
        grace_period_ms: _,
        creator_config_id: _,
    } = tunnel;

    let refund_amount = coin::value(&balance);

    event::emit(TunnelClosed {
        tunnel_id: object::uid_to_inner(&id),
        refund_amount,
        total_claimed: cumulative_claimed,
    });

    if (refund_amount > 0) {
        transfer::public_transfer(balance, payer);
    } else {
        coin::destroy_zero(balance);
    };

    object::delete(id);
}

// ======== Getter functions ========

public fun tunnel_id<T>(tunnel: &Tunnel<T>): ID { object::id(tunnel) }
public fun payer<T>(tunnel: &Tunnel<T>): address { tunnel.payer }
public fun is_closed<T>(tunnel: &Tunnel<T>): bool { tunnel.closing }
public fun total_deposit<T>(tunnel: &Tunnel<T>): u64 { coin::value(&tunnel.balance) + tunnel.cumulative_claimed }
public fun claimed_amount<T>(tunnel: &Tunnel<T>): u64 { tunnel.cumulative_claimed }
public fun remaining_balance<T>(tunnel: &Tunnel<T>): u64 { coin::value(&tunnel.balance) }

/// Payer initiates close with grace period
#[allow(lint(public_entry))]
public entry fun init_close<T>(
    tunnel: &mut Tunnel<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == tunnel.payer, E_NOT_PAYER);
    assert!(!tunnel.closing, E_TUNNEL_CLOSING);

    let now = sui::clock::timestamp_ms(clock);
    tunnel.closing = true;
    tunnel.close_requested_at_ms = now;

    event::emit(CloseInitiated {
        tunnel_id: object::id(tunnel),
        close_requested_at_ms: now,
        grace_period_ms: tunnel.grace_period_ms,
    });
}

// ======== Test-only helpers ========

#[test_only]
/// Claim without signature verification (for testing)
public fun claim_for_testing<T>(
    tunnel: &mut Tunnel<T>,
    cumulative_amount: u64,
    ctx: &mut TxContext,
) {
    claim_internal(tunnel, cumulative_amount, ctx);
}

#[test_only]
/// Expose construct_claim_message for testing
public fun construct_claim_message_for_testing<T>(
    tunnel: &Tunnel<T>,
    cumulative_amount: u64,
    nonce: u64,
): vector<u8> {
    construct_claim_message(tunnel, cumulative_amount, nonce)
}

/// Finalize close after grace period
#[allow(lint(public_entry))]
public entry fun finalize_close<T>(
    tunnel: Tunnel<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == tunnel.payer, E_NOT_PAYER);
    assert!(tunnel.closing, E_TUNNEL_NOT_CLOSING);

    let now = sui::clock::timestamp_ms(clock);
    assert!(
        now >= tunnel.close_requested_at_ms + tunnel.grace_period_ms,
        E_GRACE_PERIOD_NOT_ELAPSED,
    );

    let Tunnel {
        id,
        payer,
        payer_public_key: _,
        operator: _,
        operator_public_key: _,
        balance,
        cumulative_claimed,
        nonce: _,
        closing: _,
        close_requested_at_ms: _,
        grace_period_ms: _,
        creator_config_id: _,
    } = tunnel;

    let refund_amount = coin::value(&balance);

    event::emit(TunnelClosed {
        tunnel_id: object::uid_to_inner(&id),
        refund_amount,
        total_claimed: cumulative_claimed,
    });

    if (refund_amount > 0) {
        transfer::public_transfer(balance, payer);
    } else {
        coin::destroy_zero(balance);
    };

    object::delete(id);
}
