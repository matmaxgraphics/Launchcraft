/**
 * Integration check (DEVNET): real buy + sell through the LaunchLens trade engine, comparing quote vs outcome
 * and our curve math vs the on-chain price.
 * usage: npx tsx spike/06-trade-via-lib.ts <poolAddress> [buySol=0.05]
 */
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { RPC_URL, assertDevnet } from "../src/deploy/rpc";
import { fetchLaunchLive, fetchLaunchStatic, fetchTokenBalance } from "../src/lens/read";
import { executeSwap, previewSwap } from "../src/lens/trade";
import type { WalletHandle } from "../src/wallet/types";

const pct = (a: number, b: number) => (b === 0 ? "n/a" : (((a - b) / b) * 100).toExponential(2) + "%");

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");
  await assertDevnet(conn);
  const pool = new PublicKey(process.argv[2]);
  const buySol = Number(process.argv[3] ?? "0.05");
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "devnet.json"), "utf8"))));
  const wallet: WalletHandle = {
    id: "test", name: "test keypair", kind: "burner", publicKey: kp.publicKey,
    signTransaction: async (tx) => { tx.partialSign(kp); return tx; },
    disconnect: async () => {},
  };

  const st = await fetchLaunchStatic(conn, pool);
  console.log(`launch: ${st.name} ($${st.symbol})  supply ${st.supply}  fee ${st.feeBps} bps  threshold ${st.thresholdSol} SOL`);
  let live = await fetchLaunchLive(conn, st);
  console.log(`before: price ${live.price.toExponential(4)}  reserve ${live.quoteReserveSol} SOL  progress ${(live.progress * 100).toFixed(2)}%  modelPrice ${live.modelPrice.toExponential(4)}`);

  // ---- BUY ----
  const buy = await previewSwap(conn, st, live, "buy", buySol);
  console.log(`\nBUY ${buySol} SOL  preview: ${buy.amountOut.toFixed(2)} tokens, min ${buy.minOut.toFixed(2)}, fee ${buy.feeSol} SOL, price after ${buy.priceAfter.toExponential(4)}`);
  const balBefore = await fetchTokenBalance(conn, wallet.publicKey, new PublicKey(st.baseMint));
  const sig1 = await executeSwap(conn, wallet, st, "buy", buy.amountIn, buy.minOut);
  console.log("tx:", sig1);
  const after1 = await fetchLaunchLive(conn, st);
  const bal1 = await fetchTokenBalance(conn, wallet.publicKey, new PublicKey(st.baseMint));
  console.log(`after:  price ${after1.price.toExponential(4)} (preview ${pct(after1.price, buy.priceAfter)} off)  reserve ${after1.quoteReserveSol} SOL  progress ${(after1.progress * 100).toFixed(3)}%`);
  console.log(`tokens received: ${(bal1 - balBefore).toFixed(2)} (preview ${pct(bal1 - balBefore, buy.amountOut)} off)`);
  console.log(`curve-model price ${after1.modelPrice.toExponential(4)} vs on-chain ${after1.price.toExponential(4)} (${pct(after1.modelPrice, after1.price)} off)`);
  console.log(`tokensSold from reserves ${after1.tokensSold.toFixed(2)}  (wallet got ${(bal1 - balBefore).toFixed(2)})`);
  console.log(`reserve rose ${(after1.quoteReserveSol - live.quoteReserveSol).toFixed(6)} SOL for ${buy.amountIn} SOL in (fee ${buy.feeSol})`);
  console.log(`fees: creator ${after1.fees.creatorSol}  partner ${after1.fees.partnerSol}  protocol ${after1.fees.protocolSol}  total ${after1.fees.totalTradingSol}`);

  // ---- SELL half ----
  live = after1;
  const sellTokens = (bal1 - balBefore) / 2;
  const sell = await previewSwap(conn, st, live, "sell", sellTokens);
  console.log(`\nSELL ${sellTokens.toFixed(2)} tokens  preview: ${sell.amountOut.toFixed(6)} SOL, min ${sell.minOut.toFixed(6)}, fee ${sell.feeSol} SOL, price after ${sell.priceAfter.toExponential(4)}`);
  const sig2 = await executeSwap(conn, wallet, st, "sell", sell.amountIn, sell.minOut);
  console.log("tx:", sig2);
  const after2 = await fetchLaunchLive(conn, st);
  console.log(`after:  price ${after2.price.toExponential(4)} (preview ${pct(after2.price, sell.priceAfter)} off)  reserve ${after2.quoteReserveSol} SOL  progress ${(after2.progress * 100).toFixed(3)}%`);
  console.log(`curve-model price ${after2.modelPrice.toExponential(4)} vs on-chain ${after2.price.toExponential(4)} (${pct(after2.modelPrice, after2.price)} off)`);
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
