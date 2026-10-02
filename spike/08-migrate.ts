/**
 * DEVNET: migrate a completed DBC pool to a Meteora DAMM v2 pool, then inspect the result.
 * usage: npx tsx spike/08-migrate.ts <poolAddress>
 */
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  deriveDammV2PoolAddress,
  deriveDammV2TokenVaultAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { RPC_URL, assertDevnet, explorerAddress, explorerTx } from "../src/deploy/rpc";
import { signSendConfirm } from "../src/deploy/deploy";
import { dbcClient, fetchLaunchLive, fetchLaunchStatic } from "../src/lens/read";
import type { WalletHandle } from "../src/wallet/types";

async function tokenBal(conn: Connection, acct: PublicKey) {
  try {
    return (await conn.getTokenAccountBalance(acct, "confirmed")).value.uiAmount ?? 0;
  } catch {
    return null;
  }
}

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");
  await assertDevnet(conn);
  const pool = new PublicKey(process.argv[2]);
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "devnet.json"), "utf8"))));
  const wallet: WalletHandle = {
    id: "test", name: "test keypair", kind: "burner", publicKey: kp.publicKey,
    signTransaction: async (tx) => { tx.partialSign(kp); return tx; },
    disconnect: async () => {},
  };

  const st = await fetchLaunchStatic(conn, pool);
  const live = await fetchLaunchLive(conn, st);
  console.log(`pool ${st.name} $${st.symbol}: complete=${live.curveComplete} migrated=${live.isMigrated} reserve=${live.quoteReserveSol}/${st.thresholdSol}`);
  if (!live.curveComplete) throw new Error("curve is not complete yet");
  if (live.isMigrated) throw new Error("already migrated");

  const cfg = st.rawConfig as { migrationFeeOption: number; migrationOption: number };
  console.log("config.migrationOption:", cfg.migrationOption, " migrationFeeOption:", cfg.migrationFeeOption);
  const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[cfg.migrationFeeOption];
  console.log("dammConfig:", dammConfig.toBase58());

  const client = dbcClient(conn);
  const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } = await client.migration.migrateToDammV2({ payer: wallet.publicKey, pool, dammConfig });
  const before = (await conn.getBalance(wallet.publicKey)) / 1e9;
  const sig = await signSendConfirm(conn, transaction, wallet, [firstPositionNftKeypair, secondPositionNftKeypair]);
  const after = (await conn.getBalance(wallet.publicKey)) / 1e9;
  console.log("migration tx:", explorerTx(sig));
  console.log(`cost to payer: ${(before - after).toFixed(5)} SOL`);

  const dammPool = deriveDammV2PoolAddress(dammConfig, new PublicKey(st.baseMint), new PublicKey("So11111111111111111111111111111111111111112"));
  console.log("DAMM v2 pool:", explorerAddress(dammPool.toBase58()));
  const info = await conn.getAccountInfo(dammPool);
  console.log("DAMM pool account:", info ? `exists, owner ${info.owner.toBase58()}, ${info.data.length} bytes` : "MISSING");

  const baseVault = deriveDammV2TokenVaultAddress(dammPool, new PublicKey(st.baseMint));
  const quoteVault = deriveDammV2TokenVaultAddress(dammPool, new PublicKey("So11111111111111111111111111111111111111112"));
  const base = await tokenBal(conn, baseVault);
  const quote = await tokenBal(conn, quoteVault);
  console.log(`DAMM vaults: ${base} tokens, ${quote} SOL  ->  reserve ratio price ${base && quote ? (quote / base).toExponential(4) : "n/a"} SOL/token`);
  console.log(`graduation price from DBC: ${live.price.toExponential(4)} SOL/token`);

  const post = await fetchLaunchLive(conn, st);
  console.log("DBC pool isMigrated now:", post.isMigrated);
  console.log("position NFTs:", firstPositionNftKeypair.publicKey.toBase58(), secondPositionNftKeypair.publicKey.toBase58());
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  if (e?.logs) console.error((e.logs as string[]).slice(-12).join("\n"));
  process.exit(1);
});
