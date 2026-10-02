import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDbcConfig,
  curveBoundaries,
  defaultLaunchConfig,
  graduationQuoteSol,
  initialSimState,
  matchPreset,
  presetWeights,
  simulateBuy,
  simulateSell,
  validateLaunchConfig,
  type LaunchConfig,
} from "../src/launch";
import { sdkQuoteBuy } from "../src/launch/sdkQuote";

function valid(preset: Parameters<typeof presetWeights>[0] = "gradual"): LaunchConfig {
  const c = defaultLaunchConfig();
  c.token.name = "Signal";
  c.token.symbol = "SIG";
  c.token.metadataUri = "https://example.com/signal.json";
  c.curve.weights = presetWeights(preset);
  c.curve.preset = preset;
  return c;
}
const close = (a: number, b: number, rel = 1e-6) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} !~ ${b}`);

test("default config is incomplete until named", () => {
  const issues = validateLaunchConfig(defaultLaunchConfig());
  assert.deepEqual(issues.filter((i) => i.severity === "error").map((i) => i.field).sort(), ["token.name", "token.symbol"]);
});

test("rejects <10% locked liquidity and non-100 sums", () => {
  const c = valid();
  c.liquidity = { creatorPct: 50, partnerPct: 50, creatorLockedPct: 0, partnerLockedPct: 0 };
  assert.match(validateLaunchConfig(c).find((i) => i.field === "liquidity")!.message, /locked/);
  c.liquidity = { creatorPct: 50, partnerPct: 40, creatorLockedPct: 0, partnerLockedPct: 20 };
  assert.match(validateLaunchConfig(c).find((i) => i.field === "liquidity")!.message, /add up/);
});

test("rejects graduation <= start and wrong weight count", () => {
  const c = valid();
  c.curve.graduationMarketCapSol = c.curve.startMarketCapSol;
  c.curve.weights = [1, 2, 3];
  const f = validateLaunchConfig(c).filter((i) => i.severity === "error").map((i) => i.field);
  assert.ok(f.includes("curve.graduationMarketCapSol") && f.includes("curve.weights"));
});

test("SDK failures surface as issues (leftover 0)", () => {
  const c = valid();
  c.advanced.leftoverPct = 0;
  const r = buildDbcConfig(c);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.issues.some((i) => i.field === "sdk"));
});

test("matchPreset round-trips and detects custom", () => {
  assert.equal(matchPreset(presetWeights("accelerated")), "accelerated");
  const w = presetWeights("flat");
  w[3] = 2;
  assert.equal(matchPreset(w), "custom");
});

test("gradual preset graduates at the threshold measured on devnet (82.98964464 SOL)", () => {
  const r = buildDbcConfig(valid("gradual"));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.graduationQuoteLamports, 82_989_644_640n);
  close(graduationQuoteSol(r.curve), 82.98964464, 1e-6); // our math == SDK threshold
});

test("curve boundaries span start -> graduation market cap, monotonic", () => {
  const r = buildDbcConfig(valid("balanced"));
  assert.ok(r.ok);
  if (!r.ok) return;
  const b = curveBoundaries(r.curve);
  assert.equal(b.length, 17);
  close(b[0].marketCapSol, 30, 1e-4);
  close(b[16].marketCapSol, 300, 1e-4);
  for (let i = 1; i < b.length; i++) assert.ok(b[i].price > b[i - 1].price && b[i].quoteSol > b[i - 1].quoteSol);
});

for (const preset of ["flat", "gradual", "accelerated"] as const) {
  test(`our buy simulation matches the SDK quote (${preset})`, () => {
    const r = buildDbcConfig(valid(preset));
    assert.ok(r.ok);
    if (!r.ok) return;
    for (const sol of [1, 10, 40]) {
      const ours = simulateBuy(r.curve, initialSimState(), sol, 100);
      const sdk = sdkQuoteBuy(r.params, sol);
      close(ours.tokensOut, sdk.tokensOut, 1e-6);
      close(ours.priceAfter, sdk.priceAfter, 1e-6);
      close(ours.feeSol, sdk.feeSol, 1e-6);
    }
  });
}

test("sequential buys compose; sell reverses a buy (minus fees)", () => {
  const r = buildDbcConfig(valid("balanced"));
  assert.ok(r.ok);
  if (!r.ok) return;
  const one = simulateBuy(r.curve, initialSimState(), 30, 0);
  const a = simulateBuy(r.curve, initialSimState(), 10, 0);
  const b = simulateBuy(r.curve, a.next, 20, 0);
  close(b.next.tokensSold, one.next.tokensSold, 1e-9);
  close(b.priceAfter, one.priceAfter, 1e-9);
  const sold = simulateSell(r.curve, one.next, one.tokensOut, 0);
  close(sold.solOut, 30, 1e-6);
  close(sold.progressAfter, 0, 1e-6);
});

test("buy past graduation is capped and flagged; progress != market cap", () => {
  const r = buildDbcConfig(valid("gradual"));
  assert.ok(r.ok);
  if (!r.ok) return;
  const t = simulateBuy(r.curve, initialSimState(), 500, 100);
  assert.equal(t.graduated, true);
  close(t.progressAfter, 1, 1e-9);
  assert.ok(t.refundSol > 0);
  const small = simulateBuy(r.curve, initialSimState(), 10, 100);
  assert.ok(small.progressAfter < small.marketCapAfterSol / 300); // progress and mcap-ratio are distinct measures
});
