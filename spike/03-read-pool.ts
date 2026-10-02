/**
 * Launchcraft spike 3 (DEVNET): read live pool state - the LaunchLens data path.
 * usage: npx tsx spike/03-read-pool.ts <poolAddress>
 */
import fs from "node:fs";
import { Connection, PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const poolAddr = new PublicKey(process.argv[2]);

async function main() {
  const client = DynamicBondingCurveClient.create(new Connection(RPC, "confirmed"), "confirmed");
  const raw: any = await client.state.getPool(poolAddr);
  if (!raw) throw new Error("pool not found");
  const pool = raw.poolState ?? raw; // SDK wraps the account in { poolState }

  console.log("pool fields:", Object.keys(pool).join(", "));
  const show = (k: string) => console.log(`${k}:`, pool[k]?.toString?.() ?? pool[k]);
  for (const k of ["config", "creator", "baseMint", "sqrtPrice", "quoteReserve", "baseReserve", "isMigrated"]) show(k);

  const threshold = await client.state.getPoolMigrationQuoteThreshold(poolAddr);
  console.log("migrationQuoteThreshold (SOL):", threshold.toNumber() / 1e9);
  console.log("quote curve progress:", await client.state.getPoolQuoteTokenCurveProgress(poolAddr));
  console.log("base curve progress:", await client.state.getPoolBaseTokenCurveProgress(poolAddr));

  const fees: any = await client.state.getPoolFeeMetrics(poolAddr);
  console.log("fees current quote (creator/partner):", fees.current.creatorQuoteFee.toString(), fees.current.partnerQuoteFee.toString());

  fs.mkdirSync("spike/out", { recursive: true });
  fs.writeFileSync("spike/out/last-launch.json", JSON.stringify({ pool: poolAddr.toBase58(), baseMint: pool.baseMint?.toBase58?.(), config: pool.config?.toBase58?.() }, null, 2));
}
main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
