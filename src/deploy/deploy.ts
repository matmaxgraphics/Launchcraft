/**
 * Two-transaction DBC deployment: (1) createConfig, (2) createPool, then an on-chain read-back that
 * proves the live config matches what the user designed. UI-agnostic: takes a WalletHandle, reports progress.
 */
import { Keypair, PublicKey, type Connection, type Transaction } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import type { LaunchConfig } from "@/launch/config";
import type { BuildResult } from "@/launch/toDbc";
import type { WalletHandle } from "@/wallet/types";
import { saveDeployment, type DeployRecord } from "./records";
import { assertDevnet, getConnection, MIN_DEPLOY_SOL } from "./rpc";

const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

export type DeployStage = "check" | "config" | "pool" | "verify";

export interface DeployProgress {
  stage: DeployStage;
  status: "active" | "done";
  config?: string;
  baseMint?: string;
  configSig?: string;
  poolSig?: string;
  pool?: string;
}

/** What survives if config creation succeeded but pool creation didn't. */
export interface PartialDeploy {
  config: string;
  configSig: string;
}

export class DeployError extends Error {
  constructor(
    message: string,
    public stage: DeployStage,
    /** Set when the config transaction already landed, so a retry can skip it. */
    public partial?: PartialDeploy,
  ) {
    super(message);
  }
}

export interface DeployArgs {
  config: LaunchConfig;
  build: Extract<BuildResult, { ok: true }>;
  wallet: WalletHandle;
  resume?: PartialDeploy;
  connection?: Connection;
  onProgress?: (p: DeployProgress) => void;
}

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const logs: string[] = (e as { logs?: string[] } | null)?.logs ?? [];
  const logMsg = logs.map((l) => /Error Message: (.*)$/.exec(l)?.[1]).find(Boolean);
  if (/reject|declin|denied|cancel|4001/i.test(raw)) return "You declined the signature request in your wallet.";
  if (/blockhash not found|block height exceeded|expired/i.test(raw)) return "The transaction expired before it confirmed. Try again.";
  if (/no record of a prior credit|insufficient (lamports|funds)/i.test(raw + logs.join(" "))) return "The wallet doesn't have enough devnet SOL for this launch.";
  if (logMsg) return `Meteora rejected the transaction: ${logMsg}`;
  if (/429|too many requests/i.test(raw)) return "The devnet RPC is rate-limiting requests. Wait a few seconds and retry.";
  return raw.length > 220 ? raw.slice(0, 220) + "…" : raw;
}

/** Metadata fallback so a pool can be created without hosted JSON. Wallets won't show a logo from it. */
export function placeholderMetadataUri(name: string, symbol: string): string {
  return `data:application/json,${encodeURIComponent(JSON.stringify({ name, symbol }))}`;
}

async function signSendConfirm(conn: Connection, tx: Transaction, wallet: WalletHandle, extraSigners: Keypair[]): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;
  // Wallet first, other keypairs after: some wallets (Phantom) may add instructions, which would
  // invalidate signatures made before they touch the transaction.
  const signed = await wallet.signTransaction(tx);
  if (extraSigners.length) signed.partialSign(...extraSigners);
  const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });
  const res = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error("Transaction failed on-chain: " + JSON.stringify(res.value.err));
  return sig;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function deployLaunch({ config: c, build, wallet, resume, connection, onProgress }: DeployArgs): Promise<DeployRecord> {
  const conn = connection ?? getConnection();
  const say = (p: DeployProgress) => onProgress?.(p);
  let stage: DeployStage = "check";
  let partial: PartialDeploy | undefined = resume;

  try {
    // 1) safety + funds
    say({ stage: "check", status: "active" });
    await assertDevnet(conn);
    const bal = (await conn.getBalance(wallet.publicKey, "confirmed")) / 1e9;
    if (bal < MIN_DEPLOY_SOL) {
      throw new Error(`The wallet has ${bal.toFixed(3)} SOL on devnet; a launch needs about ${MIN_DEPLOY_SOL} SOL. Get some from faucet.solana.com.`);
    }
    say({ stage: "check", status: "done" });

    const client = DynamicBondingCurveClient.create(conn, "confirmed");

    // 2) config (skipped when resuming after a failed pool step)
    let configPk: PublicKey;
    let configSig: string;
    if (resume) {
      configPk = new PublicKey(resume.config);
      configSig = resume.configSig;
      say({ stage: "config", status: "done", config: resume.config, configSig });
    } else {
      stage = "config";
      say({ stage: "config", status: "active" });
      const configKp = Keypair.generate();
      const configTx = await client.partner.createConfig({
        ...build.params,
        config: configKp.publicKey,
        feeClaimer: wallet.publicKey,
        leftoverReceiver: wallet.publicKey,
        quoteMint: WSOL,
        payer: wallet.publicKey,
      } as never);
      configSig = await signSendConfirm(conn, configTx, wallet, [configKp]);
      configPk = configKp.publicKey;
      partial = { config: configPk.toBase58(), configSig };
      say({ stage: "config", status: "done", config: partial.config, configSig });
    }

    // 3) pool
    stage = "pool";
    say({ stage: "pool", status: "active", config: configPk.toBase58(), configSig });
    const baseMintKp = Keypair.generate();
    const poolTx = await client.creator.createPool({
      name: c.token.name.trim(),
      symbol: c.token.symbol.trim(),
      uri: c.token.metadataUri.trim() || placeholderMetadataUri(c.token.name.trim(), c.token.symbol.trim()),
      payer: wallet.publicKey,
      poolCreator: wallet.publicKey,
      config: configPk,
      baseMint: baseMintKp.publicKey,
    });
    const poolSig = await signSendConfirm(conn, poolTx, wallet, [baseMintKp]);
    say({ stage: "pool", status: "done", config: configPk.toBase58(), configSig, poolSig, baseMint: baseMintKp.publicKey.toBase58() });

    // 4) read it back from the chain and compare with the design
    stage = "verify";
    say({ stage: "verify", status: "active" });
    let poolAddress: PublicKey | null = null;
    for (let i = 0; i < 10 && !poolAddress; i++) {
      poolAddress = (await client.state.getPoolByBaseMint(baseMintKp.publicKey))?.publicKey ?? null;
      if (!poolAddress) await sleep(1200);
    }
    if (!poolAddress) throw new Error("The pool was created but isn't readable yet. Check the transaction on the explorer.");
    const onChain = await client.state.getPoolMigrationQuoteThreshold(poolAddress);
    const expected = build.graduationQuoteLamports;
    const record: DeployRecord = {
      id: poolAddress.toBase58(),
      createdAt: Date.now(),
      cluster: "devnet",
      name: c.token.name.trim(),
      symbol: c.token.symbol.trim(),
      creator: wallet.publicKey.toBase58(),
      config: configPk.toBase58(),
      baseMint: baseMintKp.publicKey.toBase58(),
      pool: poolAddress.toBase58(),
      configSig,
      poolSig,
      expectedGraduationLamports: expected.toString(),
      onChainGraduationLamports: onChain.toString(),
      verified: onChain.toString() === expected.toString(),
    };
    saveDeployment(record);
    say({ stage: "verify", status: "done", config: record.config, baseMint: record.baseMint, pool: record.pool, configSig, poolSig });
    return record;
  } catch (e) {
    throw new DeployError(friendlyError(e), stage, partial);
  }
}
