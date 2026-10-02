/**
 * DEVNET: claim creator + partner trading fees from a pool through the same engine the UI uses.
 * usage: npx tsx spike/10-claim.ts <poolAddress>
 */
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { RPC_URL, assertDevnet, explorerTx } from "../src/deploy/rpc";
import { claimFees, claimOptions } from "../src/lens/claim";
import { fetchLaunchLive, fetchLaunchStatic } from "../src/lens/read";
import type { WalletHandle } from "../src/wallet/types";
import { assertBudget } from "./_budget";

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");
  await assertDevnet(conn);
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "devnet.json"), "utf8"))));
  const wallet: WalletHandle = { id: "t", name: "t", kind: "burner", publicKey: kp.publicKey, signTransaction: async (tx) => { tx.partialSign(kp); return tx; }, disconnect: async () => {} };
  const pool = new PublicKey(process.argv[2]);

  await assertBudget(conn, wallet.publicKey, 0.001, "claim fees (tx fees only)");
  const st = await fetchLaunchStatic(conn, pool);
  const before = await fetchLaunchLive(conn, st);
  const me = wallet.publicKey.toBase58();
  console.log(`creator ${st.creator} | feeClaimer ${st.feeClaimer} | me ${me}`);
  console.log("unclaimed before:", before.fees);

  const balBefore = await conn.getBalance(wallet.publicKey);
  for (const o of claimOptions(st, before, me)) {
    console.log(`${o.role}: ${o.amountSol} SOL claimable by ${o.claimant === me ? "me" : o.claimant}`);
    if (!o.canClaim) { console.log("  skipped (not the claimant)"); continue; }
    const sig = await claimFees(conn, wallet, st, o.role);
    console.log("  claimed:", explorerTx(sig));
  }
  const after = await fetchLaunchLive(conn, st);
  const balAfter = await conn.getBalance(wallet.publicKey);
  console.log("unclaimed after:", after.fees);
  console.log(`wallet delta: +${((balAfter - balBefore) / 1e9).toFixed(6)} SOL (net of tx fees)`);
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
