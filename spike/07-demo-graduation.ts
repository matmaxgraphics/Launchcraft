/**
 * DEVNET demo: deploy a tiny-threshold launch (market cap 0.1 -> 1 SOL, graduation ~0.23 SOL), buy until the curve
 * completes, then probe what the program does with trades after completion.
 * usage: npx tsx spike/07-demo-graduation.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { RPC_URL, assertDevnet, explorerAddress } from "../src/deploy/rpc";
import { defaultLaunchConfig } from "../src/launch/config";
import { presetWeights } from "../src/launch/presets";
import { buildDbcConfig } from "../src/launch/toDbc";
import { deployLaunch } from "../src/deploy/deploy";
import { fetchLaunchLive, fetchLaunchStatic } from "../src/lens/read";
import { executeSwap, previewSwap } from "../src/lens/trade";
import type { WalletHandle } from "../src/wallet/types";

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");
  await assertDevnet(conn);
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "devnet.json"), "utf8"))));
  const wallet: WalletHandle = {
    id: "test", name: "test keypair", kind: "burner", publicKey: kp.publicKey,
    signTransaction: async (tx) => { tx.partialSign(kp); return tx; },
    disconnect: async () => {},
  };

  // optional args: <startMcapSol> <gradMcapSol> <name> <symbol>
  const [aStart, aGrad, aName, aSym] = process.argv.slice(2);
  const config = defaultLaunchConfig();
  config.token.name = aName ?? "Demo Graduate";
  config.token.symbol = aSym ?? "GRAD";
  config.curve.startMarketCapSol = Number(aStart ?? 0.1);
  config.curve.graduationMarketCapSol = Number(aGrad ?? 1);
  config.curve.weights = presetWeights("flat");
  config.curve.preset = "flat";
  const build = buildDbcConfig(config);
  if (!build.ok) throw new Error(build.issues.map((i) => i.message).join("; "));
  const thresholdSol = Number(build.graduationQuoteLamports) / 1e9;
  console.log("designed threshold:", thresholdSol, "SOL");
  const bal = (await conn.getBalance(kp.publicKey)) / 1e9;
  console.log("wallet balance:", bal, "SOL");
  if (bal < thresholdSol * 1.05 + 0.08) throw new Error("not enough devnet SOL in the spike wallet for this demo");

  const rec = await deployLaunch({ config, build, wallet, onProgress: (p) => console.log(`[${p.stage}] ${p.status}`) });
  console.log("verified:", rec.verified, "\npool:", rec.pool, explorerAddress(rec.pool));

  const st = await fetchLaunchStatic(conn, new PublicKey(rec.pool));
  for (let i = 0; i < 6; i++) {
    const live = await fetchLaunchLive(conn, st);
    if (live.curveComplete) break;
    const remaining = st.thresholdSol - live.quoteReserveSol;
    // ask for a little more than needed; PartialFill takes only what fits
    const want = Math.max(0.001, (remaining / (1 - st.feeBps / 10_000)) * 1.02);
    const pv = await previewSwap(conn, st, live, "buy", want);
    console.log(`buy ${want.toFixed(4)} SOL -> uses ${pv.amountIn.toFixed(4)}, unused ${pv.unusedIn.toFixed(4)}`);
    await executeSwap(conn, wallet, st, "buy", pv.amountIn, pv.minOut);
  }
  const done = await fetchLaunchLive(conn, st);
  console.log(`\nafter: reserve ${done.quoteReserveSol} / ${st.thresholdSol} SOL  progress ${(done.progress * 100).toFixed(2)}%  curveComplete=${done.curveComplete}  isMigrated=${done.isMigrated}`);
  console.log(`price ${done.price.toExponential(4)}  mcap ${done.marketCapSol.toFixed(4)} SOL (graduation mcap target 1)`);

  // what does the program do with trades once the curve is complete? (bypass the UI guard)
  try {
    await executeSwap(conn, wallet, st, "buy", 0.001, 0);
    console.log("post-completion BUY: accepted");
  } catch (e) {
    console.log("post-completion BUY rejected:", (e as Error).message);
  }
  try {
    await executeSwap(conn, wallet, st, "sell", 1000, 0);
    console.log("post-completion SELL: accepted");
  } catch (e) {
    console.log("post-completion SELL rejected:", (e as Error).message);
  }
  console.log("\nOPEN IN LAUNCHLENS: /launch/" + rec.pool);
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e, e?.stage ? `(stage: ${e.stage})` : "");
  process.exit(1);
});
