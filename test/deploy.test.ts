import { test } from "node:test";
import assert from "node:assert/strict";
import type { Connection } from "@solana/web3.js";
import { friendlyError, placeholderMetadataUri } from "../src/deploy/deploy";
import { assertDevnet, DEVNET_GENESIS_HASH } from "../src/deploy/rpc";

const conn = (hash: string) => ({ getGenesisHash: async () => hash }) as unknown as Connection;

test("assertDevnet passes on the devnet genesis hash", async () => {
  await assertDevnet(conn(DEVNET_GENESIS_HASH));
});

test("assertDevnet refuses any other cluster (mainnet-beta genesis) so no real SOL can be spent", async () => {
  const MAINNET = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
  await assert.rejects(() => assertDevnet(conn(MAINNET)), /not Solana devnet/);
  await assert.rejects(() => assertDevnet(conn("anything")), /not Solana devnet/);
});

test("friendlyError: wallet rejection", () => {
  assert.match(friendlyError(new Error("User rejected the request.")), /declined the signature/);
  assert.match(friendlyError(new Error("WalletSignTransactionError: code 4001")), /declined the signature/);
});

test("friendlyError: expired blockhash and low funds", () => {
  assert.match(friendlyError(new Error("block height exceeded")), /expired/);
  assert.match(friendlyError(new Error("Attempt to debit an account but found no record of a prior credit.")), /enough devnet SOL/);
});

test("friendlyError surfaces the program's own error message from logs", () => {
  const e = Object.assign(new Error("Transaction simulation failed"), {
    logs: ["Program log: Instruction: CreateConfig", "Program log: AnchorError occurred. Error Code: InvalidCurve. Error Message: Invalid migration locked liquidity."],
  });
  assert.equal(friendlyError(e), "Meteora rejected the transaction: Invalid migration locked liquidity.");
});

test("friendlyError truncates unknown long errors", () => {
  assert.ok(friendlyError(new Error("z".repeat(500))).length <= 221);
});

test("placeholder metadata uri fits the on-chain limit and round-trips", () => {
  const uri = placeholderMetadataUri("Signal", "SIG");
  assert.ok(uri.length <= 200);
  assert.deepEqual(JSON.parse(decodeURIComponent(uri.replace("data:application/json,", ""))), { name: "Signal", symbol: "SIG" });
  // longest allowed name/symbol still fits
  assert.ok(placeholderMetadataUri("N".repeat(32), "S".repeat(10)).length <= 200);
});
