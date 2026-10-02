import { test } from "node:test";
import assert from "node:assert/strict";
import { dammConfigFor, dammPoolAddress, MIGRATION_COST_SOL, MIGRATION_MIN_BALANCE_SOL, planMigration } from "../src/lens/migrate";
import type { LaunchStatic } from "../src/lens/read";

const st = {
  baseMint: "esnyHm8FQBAwJ9cVTMmw5wKbyLT7E4YvpbaWjgeDhyH",
  migrationFeeOption: 0,
  migrationBaseTokens: 192_856_383.829051,
  lockedLiquidityPct: 10,
} as LaunchStatic;

test("dammConfigFor maps fee options 0-6 (fixed tiers + customizable) to distinct DAMM v2 configs", () => {
  const keys = [0, 1, 2, 3, 4, 5, 6].map((i) => dammConfigFor(i).toBase58());
  assert.equal(new Set(keys).size, 7);
  assert.equal(keys[0], "7F6dnUcRuyM2TwR8myT1dYypFXpPSxqwKNSFNkxyNESd"); // FixedBps25, the one used on devnet
});

test("dammConfigFor refuses unknown options instead of migrating against a wrong config", () => {
  for (const bad of [7, 99, -1, 1.5, Number.NaN]) assert.throws(() => dammConfigFor(bad), /unknown DAMM v2 migration config/);
});

test("dammPoolAddress is deterministic and depends on the config", () => {
  const a = dammPoolAddress(st).toBase58();
  assert.equal(a, dammPoolAddress(st).toBase58());
  assert.notEqual(a, dammPoolAddress({ ...st, migrationFeeOption: 1 }).toBase58());
});

test("planMigration takes the protocol fee from BOTH sides (devnet: 0.228240419 SOL -> 0.227783939 at 20 bps)", () => {
  const p = planMigration(st, 0.228240419, 20);
  assert.ok(Math.abs(p.protocolFeeSol - 0.000456481) < 1e-9);
  assert.ok(Math.abs(p.quoteSol - 0.227783938) < 1e-8);
  assert.ok(Math.abs(p.baseTokens - st.migrationBaseTokens * 0.998) < 1e-6);
  assert.ok(Math.abs(p.protocolFeeTokens - st.migrationBaseTokens * 0.002) < 1e-6);
  assert.equal(p.lockedPct, 10);
});

test("migration balance floor sits above the measured cost", () => {
  assert.ok(MIGRATION_MIN_BALANCE_SOL > MIGRATION_COST_SOL);
});
