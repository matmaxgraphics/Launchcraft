import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, type Connection } from "@solana/web3.js";
import { lensReads, modelDrift, relTime, statusOf } from "../src/lens/insights";
import { fetchTokenName, parseAddress, type LaunchLive, type LaunchStatic } from "../src/lens/read";

const st = { thresholdSol: 100, feeBps: 100, startMarketCapSol: 30, supply: 1_000_000_000 } as LaunchStatic;
const live = (o: Partial<LaunchLive> = {}): LaunchLive => ({
  price: 3e-8, modelPrice: 3e-8, marketCapSol: 30, quoteReserveSol: 0, progress: 0, tokensSold: 0,
  isMigrated: false, curveComplete: false, migrationFeeBps: 20, leftoverWithdrawn: false,
  fees: { creatorSol: 0, partnerSol: 0, protocolSol: 0, totalTradingSol: 0 },
  updatedAt: 0, rawPool: null, ...o,
});

test("statusOf: migrated beats complete beats live", () => {
  assert.equal(statusOf(live()), "live");
  assert.equal(statusOf(live({ curveComplete: true })), "complete");
  assert.equal(statusOf(live({ curveComplete: true, isMigrated: true })), "migrated");
});

test("reads: untouched pool says no one has traded and shows the threshold", () => {
  const r = lensReads(st, live());
  assert.match(r[0].text, /No one has traded yet/);
  assert.match(r[0].text, /100 SOL/);
});

test("reads: mid-progress states percent, remaining SOL, and the fee-inclusive buy amount", () => {
  const r = lensReads(st, live({ quoteReserveSol: 25, progress: 0.25, marketCapSol: 45, tokensSold: 1e7 }));
  assert.match(r[0].text, /25\.0% of the way/);
  assert.match(r[0].text, /75 SOL more/);
  assert.match(r[0].text, /75\.76 SOL of buying/); // 75 / 0.99
  assert.match(r.find((x) => x.id === "price")!.text, /1\.5×/);
});

test("reads: tiny progress keeps two decimals instead of rounding to 0.0%", () => {
  const r = lensReads(st, live({ quoteReserveSol: 0.04, progress: 0.0004 }));
  assert.match(r[0].text, /0\.04% of the way/);
});

test("reads: complete and migrated states explain what happens next", () => {
  const complete = lensReads(st, live({ curveComplete: true, quoteReserveSol: 100, progress: 1 }))[0];
  assert.match(complete.text, /curve is complete/);
  assert.match(complete.why!, /anyone can trigger the migration/);
  assert.match(lensReads(st, live({ curveComplete: true, isMigrated: true }))[0].text, /migrated to a Meteora DAMM v2/);
});

test("reads: once migrated, the readout reports the DAMM v2 pool's real reserves", () => {
  const damm = { pool: "x", exists: true, baseTokens: 227_784_002, quoteSol: 0.2278, impliedPrice: 1e-9 };
  const t = lensReads(st, live({ curveComplete: true, isMigrated: true }), damm)[0].text;
  assert.match(t, /DAMM v2 pool: 227\.78M tokens and 0\.2278 SOL/);
});

test("reads: fee line only appears once fees exist", () => {
  assert.equal(lensReads(st, live()).some((x) => x.id === "fees"), false);
  const f = lensReads(st, live({ fees: { creatorSol: 0.1, partnerSol: 0.1, protocolSol: 0.05, totalTradingSol: 0.25 } }));
  assert.match(f.find((x) => x.id === "fees")!.text, /0\.25 SOL/);
});

test("reads: model-vs-chain drift warns past 0.1%, passes below", () => {
  assert.equal(lensReads(st, live()).find((x) => x.id === "model")!.tone, "ok");
  const drifted = live({ modelPrice: 3.03e-8 }); // 1% off
  assert.ok(modelDrift(drifted) > 0.009);
  assert.equal(lensReads(st, drifted).find((x) => x.id === "model")!.tone, "warn");
});

test("relTime", () => {
  const now = 1_000_000_000_000;
  const t = now / 1000;
  assert.equal(relTime(t - 5, now), "5s ago");
  assert.equal(relTime(t - 125, now), "2m ago");
  assert.equal(relTime(t - 7300, now), "2h ago");
  assert.equal(relTime(t - 200_000, now), "2d ago");
  assert.equal(relTime(null, now), "pending");
});

test("parseAddress accepts a real key and rejects junk", () => {
  assert.ok(parseAddress(Keypair.generate().publicKey.toBase58()));
  assert.equal(parseAddress("not-a-key"), null);
  assert.equal(parseAddress(""), null);
});

function metadataBytes(name: string, symbol: string): Uint8Array {
  const enc = new TextEncoder();
  const str = (s: string, pad: number) => {
    const body = new Uint8Array(pad);
    body.set(enc.encode(s));
    const out = new Uint8Array(4 + pad);
    new DataView(out.buffer).setUint32(0, pad, true);
    out.set(body, 4);
    return out;
  };
  const parts = [new Uint8Array(1 + 32 + 32), str(name, 32), str(symbol, 10), str("https://x", 200)];
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return all;
}

test("fetchTokenName decodes Metaplex name/symbol and strips the NUL padding", async () => {
  const conn = { getAccountInfo: async () => ({ data: metadataBytes("Signal", "SIG") }) } as unknown as Connection;
  assert.deepEqual(await fetchTokenName(conn, Keypair.generate().publicKey), { name: "Signal", symbol: "SIG" });
});

test("fetchTokenName tolerates a missing or malformed account", async () => {
  const none = { getAccountInfo: async () => null } as unknown as Connection;
  assert.deepEqual(await fetchTokenName(none, Keypair.generate().publicKey), { name: null, symbol: null });
  const junk = { getAccountInfo: async () => ({ data: new Uint8Array(10) }) } as unknown as Connection;
  assert.deepEqual(await fetchTokenName(junk, Keypair.generate().publicKey), { name: null, symbol: null });
});
