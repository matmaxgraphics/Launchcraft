/**
 * SERVER-ONLY storage for token logos and metadata: Irys (permanent storage) on devnet, paid for by a small
 * uploader wallet in devnet SOL. Never import this from client code: it reads a secret key.
 *
 * The key comes from IRYS_UPLOADER_KEY (a JSON array of 64 bytes) or the gitignored file .keys/uploader.json.
 * Uploads cost ~0.00004 SOL each; the node balance is topped up automatically in small, bounded steps.
 */
import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@solana/web3.js";
import { RPC_URL } from "@/deploy/rpc";

export class UploadError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

/** Largest single top-up of the Irys node balance, in lamports (0.005 SOL). */
const MAX_TOPUP_LAMPORTS = 5_000_000;
const GATEWAY = "https://devnet.irys.xyz";

function loadKeyBytes(): Uint8Array | null {
  try {
    const env = process.env.IRYS_UPLOADER_KEY;
    const raw = env ?? fs.readFileSync(path.join(process.cwd(), ".keys", "uploader.json"), "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length === 64 ? Uint8Array.from(arr) : null;
  } catch {
    return null;
  }
}

export function uploaderStatus(): { configured: boolean; address: string | null } {
  const k = loadKeyBytes();
  return k ? { configured: true, address: Keypair.fromSecretKey(k).publicKey.toBase58() } : { configured: false, address: null };
}

let uploader: ReturnType<typeof create> | null = null;
async function create(key: Uint8Array) {
  // Loaded lazily, not at module top: the status check (GET /api/upload) must never depend on this heavy SDK
  // loading, and if it can't load on some platform the caller gets a clear message instead of an empty 500.
  let Uploader, Solana;
  try {
    [{ Uploader }, { Solana }] = await Promise.all([import("@irys/upload"), import("@irys/upload-solana")]);
  } catch (e) {
    uploader = null; // allow a later retry
    throw new UploadError(`Logo storage couldn't start on this server (${e instanceof Error ? e.message.slice(0, 120) : "unknown error"}). You can paste a metadata URI instead.`, 503);
  }
  return Uploader(Solana).withWallet(key).withRpc(RPC_URL).devnet();
}
function getUploader() {
  const key = loadKeyBytes();
  if (!key) throw new UploadError("Logo upload isn't set up on this server (no uploader key). You can paste a metadata URI instead.", 503);
  return (uploader ??= create(key));
}

/** Stores `data` permanently and returns its public URL. */
export async function uploadBytes(data: Buffer, contentType: string): Promise<string> {
  try {
    const irys = await getUploader();
    const price = await irys.getPrice(data.length);
    const loaded = await irys.getLoadedBalance();
    if (loaded.lt(price)) {
      // top up with headroom for ~20 uploads, never more than the cap
      const want = Math.min(MAX_TOPUP_LAMPORTS, Math.max(Number(price.multipliedBy(20).toFixed(0)), 100_000));
      await irys.fund(want);
    }
    const receipt = await irys.upload(data, { tags: [{ name: "Content-Type", value: contentType }] });
    return `${GATEWAY}/${receipt.id}`;
  } catch (e) {
    if (e instanceof UploadError) throw e;
    const m = e instanceof Error ? e.message : String(e);
    if (/insufficient|not enough|lamports|balance/i.test(m)) {
      throw new UploadError("The uploader wallet is out of devnet SOL, so the logo couldn't be stored. Try again later or paste a metadata URI.", 503);
    }
    throw new UploadError(`Storing the logo failed: ${m.slice(0, 160)}`, 502);
  }
}
