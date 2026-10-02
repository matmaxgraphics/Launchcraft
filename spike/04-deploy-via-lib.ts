/**
 * Integration check (DEVNET): drives the same deployLaunch() the UI uses, with the throwaway keypair as the wallet.
 * usage: npx tsx spike/04-deploy-via-lib.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@solana/web3.js";
import { defaultLaunchConfig } from "../src/launch/config";
import { presetWeights } from "../src/launch/presets";
import { buildDbcConfig } from "../src/launch/toDbc";
import { deployLaunch } from "../src/deploy/deploy";
import { explorerAddress, explorerTx } from "../src/deploy/rpc";
import type { WalletHandle } from "../src/wallet/types";

async function main() {
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "devnet.json"), "utf8"))));
  const wallet: WalletHandle = {
    id: "test",
    name: "test keypair",
    kind: "burner",
    publicKey: kp.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(kp);
      return tx;
    },
    disconnect: async () => {},
  };

  const config = defaultLaunchConfig();
  config.token.name = "Signal Lib";
  config.token.symbol = "SIGL";
  config.curve.weights = presetWeights("gradual");
  config.curve.preset = "gradual";

  const build = buildDbcConfig(config);
  if (!build.ok) throw new Error(build.issues.map((i) => i.message).join("; "));

  const record = await deployLaunch({
    config,
    build,
    wallet,
    onProgress: (p) => console.log(`[${p.stage}] ${p.status}`),
  });

  console.log("\nverified:", record.verified, `(expected ${record.expectedGraduationLamports}, on-chain ${record.onChainGraduationLamports})`);
  console.log("pool:", explorerAddress(record.pool));
  console.log("config tx:", explorerTx(record.configSig));
  console.log("pool tx:", explorerTx(record.poolSig));
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e, e?.stage ? `(stage: ${e.stage})` : "");
  process.exit(1);
});
