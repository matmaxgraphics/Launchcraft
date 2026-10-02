/** Creates a throwaway devnet keypair file (gitignored under .keys/). usage: tsx spike/new-key.ts <name> */
import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@solana/web3.js";

const name = process.argv[2];
if (!name || !/^[\w-]+$/.test(name)) throw new Error("usage: tsx spike/new-key.ts <name>");
const file = path.join(process.cwd(), ".keys", `${name}.json`);
if (fs.existsSync(file)) {
  console.log(`${name}.json already exists`);
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(Array.from(Keypair.generate().secretKey)));
  console.log(`created .keys/${name}.json`);
}
console.log("address:", Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8")))).publicKey.toBase58());
