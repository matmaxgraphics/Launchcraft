/**
 * DEVNET probe: upload a tiny PNG to Irys devnet with the uploader key, read it back from the gateway.
 * Establishes the exact SDK calls, price, funding behaviour and public URL shape before building the API route.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { RPC_URL } from "../src/deploy/rpc";
import { assertBudget } from "./_budget";
import { Connection, Keypair } from "@solana/web3.js";

function crc32(buf: Buffer): number {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** 64x64 violet->green diagonal gradient PNG. */
function makePng(): Buffer {
  const w = 64, h = 64;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x + y) / (w + h);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(143 + (74 - 143) * t); raw[o + 1] = Math.round(124 + (222 - 124) * t); raw[o + 2] = Math.round(255 + (128 - 255) * t);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function main() {
  const key = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".keys", "uploader.json"), "utf8"));
  const kp = Keypair.fromSecretKey(Uint8Array.from(key));
  const conn = new Connection(RPC_URL, "confirmed");
  console.log("uploader:", kp.publicKey.toBase58(), (await conn.getBalance(kp.publicKey)) / 1e9, "SOL on devnet");

  const irys = await Uploader(Solana).withWallet(Uint8Array.from(key)).withRpc(RPC_URL).devnet();
  console.log("irys address:", irys.address, " url:", (irys as any).url?.toString?.() ?? "(n/a)", " token:", irys.token);

  const png = makePng();
  console.log("png bytes:", png.length);
  const price = await irys.getPrice(png.length);
  console.log("price (lamports):", price.toString(), "=", Number(price.toString()) / 1e9, "SOL");
  const loaded = await irys.getLoadedBalance();
  console.log("loaded balance at Irys:", loaded.toString());

  if (loaded.lt(price)) {
    const topUp = price.multipliedBy(20); // buffer for many small uploads
    await assertBudget(conn, kp.publicKey, Number(topUp.toString()) / 1e9, "fund Irys node", { reserve: 0.005 });
    const f = await irys.fund(topUp);
    console.log("funded:", f.quantity?.toString?.(), "tx", f.id);
  }
  const receipt = await irys.upload(png, { tags: [{ name: "Content-Type", value: "image/png" }] });
  console.log("receipt id:", receipt.id);
  const url = `https://devnet.irys.xyz/${receipt.id}`;
  console.log("url:", url);

  // read it back
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url).catch(() => null);
    if (r?.ok) {
      const body = Buffer.from(await r.arrayBuffer());
      console.log(`gateway: ${r.status} ${r.headers.get("content-type")} ${body.length} bytes, identical=${body.equals(png)}`);
      return;
    }
    console.log(`gateway not ready (${r?.status ?? "no response"}), retrying…`);
    await new Promise((res) => setTimeout(res, 2500));
  }
  console.log("gateway never served the file");
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
