/**
 * `npm run doctor`: read-only pre-flight for a demo or submission. Spends nothing, changes nothing, prints no secrets.
 * Exit code 1 only when something REQUIRED is broken; optional features just show a note.
 */
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { EVIDENCE } from "../src/lib/evidence";
import { DEVNET_GENESIS_HASH, RPC_URL } from "../src/deploy/rpc";

const root = process.cwd();
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const note = (m: string) => console.log(`  • ${m}`);
const bad = (m: string) => {
  failed++;
  console.log(`  ✗ ${m}`);
};
const head = (t: string) => console.log(`\n${t}`);

function envHas(name: string): boolean {
  if (process.env[name]) return true;
  for (const f of [".env.local", ".env"]) {
    try {
      const m = new RegExp(`^\\s*${name}\\s*=\\s*(\\S+)`, "m").exec(fs.readFileSync(path.join(root, f), "utf8"));
      if (m && m[1].replace(/['"]/g, "").length > 0) return true; // existence only; the value is never printed
    } catch {}
  }
  return false;
}
function keyAddress(file: string): PublicKey | null {
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(root, ".keys", file), "utf8")))).publicKey;
  } catch {
    return null;
  }
}

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");

  head("Network");
  try {
    const g = await conn.getGenesisHash();
    g === DEVNET_GENESIS_HASH ? ok(`RPC ${RPC_URL} is Solana devnet`) : bad(`RPC ${RPC_URL} is NOT devnet; the app will refuse to send transactions`);
  } catch (e) {
    bad(`RPC unreachable (${(e as Error).message.slice(0, 80)}). The public devnet RPC is flaky; retry or set NEXT_PUBLIC_RPC_URL.`);
    return;
  }

  head("Wallets (devnet SOL)");
  for (const [label, file, min, why] of [
    ["test wallet", "devnet.json", 0.3, "funds scripts and the demo; keep the 0.25 reserve"],
    ["uploader", "uploader.json", 0.005, "pays for logo uploads (~0.00004 SOL each)"],
  ] as const) {
    const pk = keyAddress(file);
    if (!pk) {
      note(`${label}: no .keys/${file} (${label === "uploader" ? "logo upload will be unavailable; run: npx tsx spike/new-key.ts uploader" : "scripts that need it will fail"})`);
      continue;
    }
    const sol = (await conn.getBalance(pk)) / 1e9;
    (sol >= min ? ok : note)(`${label} ${pk.toBase58().slice(0, 4)}…${pk.toBase58().slice(-4)}: ${sol.toFixed(4)} SOL ${sol >= min ? "" : `(low: want ≥ ${min}; ${why})`}`);
  }
  note("The browser's burner wallet is separate; its balance shows in the app's top-right pill.");

  head("Optional features");
  envHas("ANTHROPIC_API_KEY") ? ok("ANTHROPIC_API_KEY is set: AI answers enabled") : note("ANTHROPIC_API_KEY not set: AI Copilot answers off (the rule-based Copilot still works). See .env.example");
  try {
    const r = await fetch("https://devnet.irys.xyz/", { method: "HEAD", signal: AbortSignal.timeout(8000) });
    r.status < 500 ? ok("Irys devnet gateway reachable (logo storage)") : note(`Irys gateway answered ${r.status}`);
  } catch {
    note("Irys devnet gateway unreachable right now (logo upload would fail; the launch can proceed without a logo)");
  }

  head("Proof links on the landing page");
  let live = 0;
  for (const e of EVIDENCE) {
    try {
      const exists = await conn.getAccountInfo(new PublicKey(e.id), "confirmed");
      exists ? (live++, ok(`${e.step}: ${e.title}`)) : bad(`${e.step}: ${e.id} no longer exists on devnet. Replace it in src/lib/evidence.ts (devnet may have been reset).`);
    } catch (err) {
      note(`${e.step}: couldn't check (${(err as Error).message.slice(0, 60)})`);
    }
  }
  note(`${live}/${EVIDENCE.length} artifacts resolve`);

  head("Result");
  console.log(failed ? `  ${failed} required check(s) failed.` : "  Ready.");
}

main()
  .catch((e) => {
    console.error("doctor crashed:", e?.message ?? e);
    failed++;
  })
  .finally(() => process.exit(failed ? 1 : 0));
