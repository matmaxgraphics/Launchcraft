/**
 * DEVNET helper: send SOL from the throwaway spike wallet to another devnet address (e.g. a browser burner wallet).
 * usage: npx tsx spike/fund.ts <address> [sol=0.1]
 */
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { assertDevnet, RPC_URL } from "../src/deploy/rpc";
import { assertBudget } from "./_budget";

async function main() {
  const to = new PublicKey(process.argv[2]);
  const sol = Number(process.argv[3] ?? "0.1");
  const conn = new Connection(RPC_URL, "confirmed");
  await assertDevnet(conn);
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "devnet.json"), "utf8"))));
  await assertBudget(conn, kp.publicKey, sol, `fund ${to.toBase58().slice(0, 6)}…`);
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) }));
  const sig = await sendAndConfirmTransaction(conn, tx, [kp]);
  console.log(`sent ${sol} SOL to ${to.toBase58()}\n${sig}`);
  console.log("recipient balance:", (await conn.getBalance(to)) / LAMPORTS_PER_SOL, "SOL");
}
main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
