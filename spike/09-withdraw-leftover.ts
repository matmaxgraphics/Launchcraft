/** DEVNET: withdraw leftover base tokens from a migrated DBC pool to the config's leftoverReceiver. */
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { RPC_URL, assertDevnet, explorerTx } from "../src/deploy/rpc";
import { signSendConfirm } from "../src/deploy/deploy";
import { associatedTokenAddress, dbcClient, fetchLaunchStatic } from "../src/lens/read";
import type { WalletHandle } from "../src/wallet/types";

const bal = async (c: Connection, a: PublicKey) => {
  try { return (await c.getTokenAccountBalance(a, "confirmed")).value.uiAmount ?? 0; } catch { return null; }
};

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");
  await assertDevnet(conn);
  const pool = new PublicKey(process.argv[2]);
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "devnet.json"), "utf8"))));
  const wallet: WalletHandle = { id: "t", name: "t", kind: "burner", publicKey: kp.publicKey, signTransaction: async (tx) => { tx.partialSign(kp); return tx; }, disconnect: async () => {} };

  const client = dbcClient(conn);
  const st = await fetchLaunchStatic(conn, pool);
  const raw: any = await client.state.getPool(pool);
  const ps = raw.poolState;
  const cfg: any = st.rawConfig;
  const receiver: PublicKey = cfg.leftoverReceiver;
  const receiverAta = associatedTokenAddress(receiver, new PublicKey(st.baseMint));
  console.log("isMigrated:", ps.isMigrated, " isWithdrawLeftover:", ps.isWithdrawLeftover);
  console.log("leftoverReceiver:", receiver.toBase58());
  console.log("DBC base vault balance before:", await bal(conn, ps.baseVault));
  console.log("receiver token balance before:", await bal(conn, receiverAta));

  const tx = await client.migration.withdrawLeftover({ payer: wallet.publicKey, pool });
  const sig = await signSendConfirm(conn, tx, wallet, []);
  console.log("tx:", explorerTx(sig));
  console.log("DBC base vault balance after:", await bal(conn, ps.baseVault));
  console.log("receiver token balance after:", await bal(conn, receiverAta));
  const after: any = await client.state.getPool(pool);
  console.log("isWithdrawLeftover now:", after.poolState.isWithdrawLeftover);
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); if (e?.logs) console.error(e.logs.slice(-8).join("\n")); process.exit(1); });
