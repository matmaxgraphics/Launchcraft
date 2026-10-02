import { Connection } from "@solana/web3.js";

/** Launchcraft deploys to devnet only for now. Override the endpoint with NEXT_PUBLIC_RPC_URL (still must be devnet). */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const CLUSTER = "devnet" as const;
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
/** Measured on devnet: a 16-point config + pool cost ~0.027 SOL in rent and fees. */
export const MIN_DEPLOY_SOL = 0.05;

let conn: Connection | null = null;
export function getConnection(): Connection {
  return (conn ??= new Connection(RPC_URL, "confirmed"));
}

/**
 * Hard safety rail: refuse to proceed unless the RPC really is devnet. Creating a pool on mainnet
 * would spend real SOL, so this check is independent of whatever network the wallet UI shows.
 */
export async function assertDevnet(c: Connection = getConnection()): Promise<void> {
  const hash = await c.getGenesisHash();
  if (hash !== DEVNET_GENESIS_HASH) {
    throw new Error("This RPC endpoint is not Solana devnet. Launchcraft only deploys to devnet for now, so nothing was sent.");
  }
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
export const explorerAddress = (a: string) => `https://explorer.solana.com/address/${a}?cluster=${CLUSTER}`;
export const shortAddr = (a: string, n = 4) => `${a.slice(0, n)}…${a.slice(-n)}`;
