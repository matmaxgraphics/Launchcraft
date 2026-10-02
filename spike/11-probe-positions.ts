/** DEVNET probe: DAMM v2 pool + the positions a wallet owns in it. usage: tsx spike/11-probe-positions.ts <dbcPool> <owner> */
import { Connection, PublicKey } from "@solana/web3.js";
import { CpAmm } from "@meteora-ag/cp-amm-sdk";
import { RPC_URL } from "../src/deploy/rpc";
import { dammPoolAddress } from "../src/lens/migrate";
import { fetchLaunchStatic } from "../src/lens/read";

const s = (v: unknown): unknown => {
  const o = v as { constructor?: { name?: string }; toString?: () => string };
  if (o && typeof o === "object" && (o.constructor?.name === "BN" || o.constructor?.name === "PublicKey")) return o.toString!();
  if (Array.isArray(v)) return `[array ${v.length}]`;
  if (v && typeof v === "object") return "{" + Object.keys(v).join(",") + "}";
  return v;
};

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");
  const st = await fetchLaunchStatic(conn, new PublicKey(process.argv[2]));
  const owner = new PublicKey(process.argv[3]);
  const damm = dammPoolAddress(st);
  const cp = new CpAmm(conn);
  const pool: any = await cp.fetchPoolState(damm);
  console.log("== pool state ==");
  for (const [k, v] of Object.entries(pool)) if (!/padding|reward|^_/.test(k)) console.log(k.padEnd(28), s(v));
  console.log("\nbase mint (DBC):", st.baseMint);
  const positions: any[] = await cp.getUserPositionByPool(damm, owner);
  console.log(`\n${positions.length} position(s) owned by ${owner.toBase58()}`);
  for (const p of positions) {
    console.log("keys:", Object.keys(p).join(","));
    console.log("position:", p.position.toBase58(), " nftAccount:", p.positionNftAccount.toBase58());
    const ps = p.positionState;
    for (const [k, v] of Object.entries(ps)) if (!/padding|reward|^_/.test(k)) console.log("  ", k.padEnd(26), s(v));
    console.log("  isLocked:", cp.isLockedPosition(ps), " isPermanentLocked:", cp.isPermanentLockedPosition(ps));
  }
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
