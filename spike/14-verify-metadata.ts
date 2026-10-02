/** DEVNET: read a pool's on-chain token metadata URI, fetch the JSON and image behind it, and check them. */
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "../src/deploy/rpc";
import { fetchLaunchStatic } from "../src/lens/read";
import { sniffImage } from "../src/upload/validate";

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");
  const st = await fetchLaunchStatic(conn, new PublicKey(process.argv[2]));
  console.log(`on-chain: name="${st.name}" symbol="${st.symbol}"`);
  console.log("on-chain metadata uri:", st.metadataUri);
  if (!st.metadataUri) return console.log("no uri");
  if (st.metadataUri.startsWith("data:")) return console.log("(placeholder data: URI; no image by design)");
  const res = await fetch(st.metadataUri);
  console.log("metadata fetch:", res.status, res.headers.get("content-type"));
  const meta = await res.json();
  console.log("metadata json:", JSON.stringify(meta));
  const img = await fetch(meta.image);
  const bytes = new Uint8Array(await img.arrayBuffer());
  console.log("image fetch:", img.status, img.headers.get("content-type"), bytes.length, "bytes; sniffed:", sniffImage(bytes));
  console.log("json matches chain name/symbol:", meta.name === st.name && meta.symbol === st.symbol);
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
