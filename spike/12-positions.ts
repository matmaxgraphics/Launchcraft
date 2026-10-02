/**
 * DEVNET: list, claim fees on, and withdraw unlocked liquidity from a wallet's DAMM v2 positions
 * through the engine the UI uses. usage: tsx spike/12-positions.ts <dbcPool> [withdraw]
 */
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { RPC_URL, assertDevnet, explorerTx } from "../src/deploy/rpc";
import { fetchLaunchStatic } from "../src/lens/read";
import { claimPositionFees, fetchPositions, withdrawUnlocked } from "../src/lens/positions";
import type { WalletHandle } from "../src/wallet/types";
import { assertBudget } from "./_budget";

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");
  await assertDevnet(conn);
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "devnet.json"), "utf8"))));
  const wallet: WalletHandle = { id: "t", name: "t", kind: "burner", publicKey: kp.publicKey, signTransaction: async (tx) => { tx.partialSign(kp); return tx; }, disconnect: async () => {} };
  await assertBudget(conn, wallet.publicKey, 0.002, "positions: tx fees only");
  const st = await fetchLaunchStatic(conn, new PublicKey(process.argv[2]));
  const doWithdraw = process.argv[3] === "withdraw";

  const list = await fetchPositions(conn, st, wallet.publicKey);
  console.log(`${list.length} position(s)`);
  for (const p of list) console.log(`  ${p.position.slice(0, 8)}…  pool share ${(p.poolShare * 100).toFixed(2)}%  unlocked ${(p.unlockedFrac * 100).toFixed(0)}% / locked ${(p.lockedFrac * 100).toFixed(0)}%  ≈ ${p.unlockedTokens.toFixed(2)} tokens + ${p.unlockedSol.toFixed(6)} SOL  fees ${p.feeTokens}/${p.feeSol}`);

  if (list[0]) {
    try {
      console.log("claim fees on first position:", explorerTx(await claimPositionFees(conn, wallet, st, list[0])));
    } catch (e) { console.log("claim fees failed:", (e as Error).message); }
  }
  if (doWithdraw) {
    for (const p of list) {
      if (!p.canWithdraw) continue;
      const before = await conn.getBalance(wallet.publicKey);
      console.log(`withdraw ${p.position.slice(0, 8)}…:`, explorerTx(await withdrawUnlocked(conn, wallet, st, p)));
      const after = await conn.getBalance(wallet.publicKey);
      console.log(`  wallet SOL delta ${((after - before) / 1e9).toFixed(6)} (expected ≈ +${p.unlockedSol.toFixed(6)} less fees)`);
    }
    const left = await fetchPositions(conn, st, wallet.publicKey);
    for (const p of left) console.log(`  after: ${p.position.slice(0, 8)}…  pool share ${(p.poolShare * 100).toFixed(2)}%  unlocked ${(p.unlockedFrac * 100).toFixed(0)}% / locked ${(p.lockedFrac * 100).toFixed(0)}%`);
  }
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
