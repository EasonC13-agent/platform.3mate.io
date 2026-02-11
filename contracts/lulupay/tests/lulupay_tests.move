#[test_only]
module lulupay::lulupay_tests;

use sui::test_scenario::{Self as ts, Scenario};
use sui::coin::{Self, Coin};
use sui::clock;
use lulupay::tunnel::{Self, CreatorConfig, Tunnel};
use lulupay::test_usdc::{Self, TEST_USDC, TEST_USDC_Manager};

// ======== Constants ========
const ADMIN: address = @0xAD;
const OPERATOR: address = @0xBEEF;
const PAYER: address = @0xCAFE;
const RANDOM: address = @0xDEAD;

// Dummy 32-byte public keys
const PUBKEY: vector<u8> = x"0000000000000000000000000000000000000000000000000000000000000001";
const PAYER_PUBKEY: vector<u8> = x"0000000000000000000000000000000000000000000000000000000000000002";

// ======== Helper functions ========

fun setup_config(scenario: &mut Scenario) {
    ts::next_tx(scenario, ADMIN);
    tunnel::create_creator_config(
        OPERATOR,
        PUBKEY,
        b"test metadata",
        1000, // 1 second grace period
        ts::ctx(scenario),
    );
}

fun setup_test_usdc(scenario: &mut Scenario) {
    ts::next_tx(scenario, ADMIN);
    test_usdc::init_for_testing(ts::ctx(scenario));
}

fun mint_test_usdc(scenario: &mut Scenario, amount: u64, recipient: address) {
    ts::next_tx(scenario, ADMIN);
    let mut manager = ts::take_shared<TEST_USDC_Manager>(scenario);
    test_usdc::mint(&mut manager, amount, recipient, ts::ctx(scenario));
    ts::return_shared(manager);
}

fun open_tunnel_helper(scenario: &mut Scenario) {
    ts::next_tx(scenario, PAYER);
    let config = ts::take_shared<CreatorConfig>(scenario);
    let deposit = ts::take_from_sender<Coin<TEST_USDC>>(scenario);
    tunnel::open_tunnel(&config, deposit, PAYER_PUBKEY, ts::ctx(scenario));
    ts::return_shared(config);
}

// ======== CreatorConfig Tests ========

#[test]
fun test_create_creator_config() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    let config = ts::take_shared<CreatorConfig>(&scenario);
    ts::return_shared(config);

    ts::end(scenario);
}

#[test]
fun test_create_creator_config_empty_metadata() {
    let mut scenario = ts::begin(ADMIN);
    ts::next_tx(&mut scenario, ADMIN);
    tunnel::create_creator_config(
        OPERATOR,
        PUBKEY,
        b"",
        5000,
        ts::ctx(&mut scenario),
    );
    ts::next_tx(&mut scenario, ADMIN);
    let config = ts::take_shared<CreatorConfig>(&scenario);
    ts::return_shared(config);
    ts::end(scenario);
}

// ======== open_tunnel Tests ========

#[test]
fun test_open_tunnel() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);

    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    ts::return_shared(tunnel);

    ts::end(scenario);
}

#[test]
fun test_open_tunnel_zero_deposit() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let config = ts::take_shared<CreatorConfig>(&scenario);
    let deposit = coin::zero<TEST_USDC>(ts::ctx(&mut scenario));
    tunnel::open_tunnel(&config, deposit, PAYER_PUBKEY, ts::ctx(&mut scenario));
    ts::return_shared(config);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    ts::return_shared(tunnel);

    ts::end(scenario);
}

// ======== claim Tests (using test helper) ========

#[test]
fun test_claim_valid() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 500000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::end(scenario);
}

#[test]
fun test_claim_multiple() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 300000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 700000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::end(scenario);
}

#[test]
fun test_claim_exact_balance() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 1000000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_NOT_OPERATOR)]
fun test_claim_wrong_sender() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, RANDOM);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 500000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_CLAIM_AMOUNT_TOO_LOW)]
fun test_claim_amount_too_low() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 500000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    // Same cumulative amount (should fail)
    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 500000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_CLAIM_AMOUNT_TOO_LOW)]
fun test_claim_cumulative_zero() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 0, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_INSUFFICIENT_BALANCE)]
fun test_claim_insufficient_balance() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 2000000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_TUNNEL_CLOSING)]
fun test_claim_while_closing() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    // Payer initiates close
    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);
    clock::destroy_for_testing(clock);

    // Operator tries to claim
    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 500000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::end(scenario);
}

// ======== close_with_receipt Tests ========

#[test]
fun test_close_with_receipt() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 500000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::next_tx(&mut scenario, OPERATOR);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::close_with_receipt(tunnel, ts::ctx(&mut scenario));

    ts::end(scenario);
}

#[test]
fun test_close_with_receipt_all_claimed() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 1000000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    // Zero refund path (coin::destroy_zero)
    ts::next_tx(&mut scenario, OPERATOR);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::close_with_receipt(tunnel, ts::ctx(&mut scenario));

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_NOT_OPERATOR)]
fun test_close_with_receipt_wrong_sender() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 500000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::next_tx(&mut scenario, RANDOM);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::close_with_receipt(tunnel, ts::ctx(&mut scenario));

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_TUNNEL_HAS_NO_CLAIMS)]
fun test_close_with_receipt_no_claims() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::close_with_receipt(tunnel, ts::ctx(&mut scenario));

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_NOT_OPERATOR)]
fun test_close_with_receipt_payer_tries() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::claim_for_testing(&mut tunnel, 500000, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::close_with_receipt(tunnel, ts::ctx(&mut scenario));

    ts::end(scenario);
}

// ======== init_close Tests ========

#[test]
fun test_init_close() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_NOT_PAYER)]
fun test_init_close_wrong_sender() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, RANDOM);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_TUNNEL_CLOSING)]
fun test_init_close_already_closing() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    // Try again (should fail)
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_NOT_PAYER)]
fun test_init_close_operator_tries() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, OPERATOR);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

// ======== finalize_close Tests ========

#[test]
fun test_finalize_close() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    clock::set_for_testing(&mut clock, 1001);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::finalize_close(tunnel, &clock, ts::ctx(&mut scenario));
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test]
fun test_finalize_close_zero_balance() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let config = ts::take_shared<CreatorConfig>(&scenario);
    let deposit = coin::zero<TEST_USDC>(ts::ctx(&mut scenario));
    tunnel::open_tunnel(&config, deposit, PAYER_PUBKEY, ts::ctx(&mut scenario));
    ts::return_shared(config);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    clock::set_for_testing(&mut clock, 1001);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::finalize_close(tunnel, &clock, ts::ctx(&mut scenario));
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_NOT_PAYER)]
fun test_finalize_close_wrong_sender() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    clock::set_for_testing(&mut clock, 1001);

    ts::next_tx(&mut scenario, RANDOM);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::finalize_close(tunnel, &clock, ts::ctx(&mut scenario));
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_TUNNEL_NOT_CLOSING)]
fun test_finalize_close_not_closing() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::finalize_close(tunnel, &clock, ts::ctx(&mut scenario));
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_GRACE_PERIOD_NOT_ELAPSED)]
fun test_finalize_close_too_early() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    // Only 500ms (grace period is 1000ms)
    clock::set_for_testing(&mut clock, 500);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::finalize_close(tunnel, &clock, ts::ctx(&mut scenario));
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test]
fun test_finalize_close_exact_grace_period() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    // Exactly at grace period boundary
    clock::set_for_testing(&mut clock, 1000);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::finalize_close(tunnel, &clock, ts::ctx(&mut scenario));
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_GRACE_PERIOD_NOT_ELAPSED)]
fun test_finalize_close_one_ms_early() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    // 999ms (1ms before grace period ends)
    clock::set_for_testing(&mut clock, 999);

    ts::next_tx(&mut scenario, PAYER);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::finalize_close(tunnel, &clock, ts::ctx(&mut scenario));
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

#[test, expected_failure(abort_code = tunnel::E_NOT_PAYER)]
fun test_finalize_close_operator_tries() {
    let mut scenario = ts::begin(ADMIN);
    setup_config(&mut scenario);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);
    open_tunnel_helper(&mut scenario);

    ts::next_tx(&mut scenario, PAYER);
    let mut tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    tunnel::init_close(&mut tunnel, &clock, ts::ctx(&mut scenario));
    ts::return_shared(tunnel);

    clock::set_for_testing(&mut clock, 1001);

    ts::next_tx(&mut scenario, OPERATOR);
    let tunnel = ts::take_shared<Tunnel<TEST_USDC>>(&scenario);
    tunnel::finalize_close(tunnel, &clock, ts::ctx(&mut scenario));
    clock::destroy_for_testing(clock);

    ts::end(scenario);
}

// ======== test_usdc Tests ========

#[test]
fun test_mint_usdc() {
    let mut scenario = ts::begin(ADMIN);
    setup_test_usdc(&mut scenario);
    mint_test_usdc(&mut scenario, 1000000, PAYER);

    ts::next_tx(&mut scenario, PAYER);
    let coin = ts::take_from_sender<Coin<TEST_USDC>>(&scenario);
    assert!(coin::value(&coin) == 1000000);
    ts::return_to_sender(&scenario, coin);

    ts::end(scenario);
}
