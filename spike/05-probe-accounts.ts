/** DEVNET probe: dump field names/values of a live pool + its config, to design the LaunchLens reader. */
import { Connection, PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";

const short = (v: unknown): unknown => {
  if (v && typeof v === "object") {
    const o = v as { toString?: () => string; constructor?: { name?: string } };
    const n = o.constructor?.name;
    if (n === "BN" || n === "PublicKey") return o.toString!();
    if (Array.isArray(v)) return `[array len ${v.length}]`;
    return "{" + Object.keys(v as object).join(",") + "}";
  }
  return v;
};

async function main() {
  const pool = new PublicKey(process.argv[2]);
  const client = DynamicBondingCurveClient.create(new Connection("https://api.devnet.solana.com", "confirmed"), "confirmed");
  const raw: any = await client.state.getPool(pool);
  const p = raw.poolState ?? raw;
  console.log("== pool ==");
  for (const [k, v] of Object.entries(p)) if (!/^padding|legacy/.test(k)) console.log(k.padEnd(34), short(v));
  console.log("metrics:", JSON.stringify(Object.fromEntries(Object.entries(p.metrics).map(([k, v]) => [k, String(v)]))));
  const cfgRaw: any = await client.state.getPoolConfig(p.config);
  const cfg = cfgRaw.poolConfig ?? cfgRaw;
  console.log("\n== config (wrapped as poolConfig?)", !!cfgRaw.poolConfig, "==");
  for (const [k, v] of Object.entries(cfg)) if (!/^padding/.test(k)) console.log(k.padEnd(34), short(v));
  console.log("poolFees.baseFee:", JSON.stringify(Object.fromEntries(Object.entries(cfg.poolFees.baseFee).map(([k, v]) => [k, String(v)]))));
  console.log("curve[0..2]:", cfg.curve.slice(0, 2).map((c: any) => [c.sqrtPrice.toString(), c.liquidity.toString()]));
  console.log("curve nonzero entries:", cfg.curve.filter((c: any) => !c.sqrtPrice.isZero()).length);
}
main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
