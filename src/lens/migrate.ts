/**
 * Graduation -> Meteora DAMM v2. Migration is permissionless: any wallet can pay for the one transaction that
 * creates the DAMM v2 pool (and two position NFTs for creator/partner). Verified on devnet; see spike/08-migrate.ts.
 */
import { PublicKey, type Connection } from "@solana/web3.js";
import { DAMM_V2_MIGRATION_FEE_ADDRESS, deriveDammV2PoolAddress, deriveDammV2TokenVaultAddress } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { friendlyError, signSendConfirm } from "@/deploy/deploy";
import type { WalletHandle } from "@/wallet/types";
import { dbcClient, type LaunchStatic } from "./read";

const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

/** Measured on devnet: rent for the DAMM v2 pool, vaults and two position NFTs. */
export const MIGRATION_COST_SOL = 0.024;
/** Leave this much on top of the cost so the payer isn't drained. */
export const MIGRATION_MIN_BALANCE_SOL = MIGRATION_COST_SOL + 0.01;

/**
 * Migration fee options 0-5 are fixed-fee DAMM v2 configs and 6 is Meteora's shared "customizable" config
 * (all seven ship in the SDK). Anything else is unknown, so refuse rather than migrate against a wrong config.
 * Launchcraft itself only creates option 0 (0.25% fixed) pools today.
 */
export function dammConfigFor(migrationFeeOption: number): PublicKey {
  const cfg = Number.isInteger(migrationFeeOption) ? DAMM_V2_MIGRATION_FEE_ADDRESS[migrationFeeOption] : undefined;
  if (!cfg) throw new Error(`This pool uses an unknown DAMM v2 migration config (option ${migrationFeeOption}), so Launchcraft won't migrate it.`);
  return cfg;
}

export function dammPoolAddress(st: LaunchStatic): PublicKey {
  return deriveDammV2PoolAddress(dammConfigFor(st.migrationFeeOption), new PublicKey(st.baseMint), WSOL);
}

export interface DammInfo {
  pool: string;
  exists: boolean;
  baseTokens: number;
  quoteSol: number;
  /** SOL per token implied by the vault reserves; matches the pool price at open for a full-range position. */
  impliedPrice: number;
}

const bal = async (conn: Connection, a: PublicKey) => {
  try {
    return (await conn.getTokenAccountBalance(a, "confirmed")).value.uiAmount ?? 0;
  } catch {
    return 0;
  }
};

export async function fetchDammInfo(conn: Connection, st: LaunchStatic): Promise<DammInfo> {
  const pool = dammPoolAddress(st);
  const info = await conn.getAccountInfo(pool, "confirmed");
  if (!info) return { pool: pool.toBase58(), exists: false, baseTokens: 0, quoteSol: 0, impliedPrice: 0 };
  const [baseTokens, quoteSol] = await Promise.all([
    bal(conn, deriveDammV2TokenVaultAddress(pool, new PublicKey(st.baseMint))),
    bal(conn, deriveDammV2TokenVaultAddress(pool, WSOL)),
  ]);
  return { pool: pool.toBase58(), exists: true, baseTokens, quoteSol, impliedPrice: baseTokens > 0 ? quoteSol / baseTokens : 0 };
}

/* ---------- what migration will do, from the config (shown before the user signs) ---------- */

export interface MigrationPlan {
  /** Tokens and SOL that end up in the DAMM v2 pool, after the protocol's cut. */
  baseTokens: number;
  quoteSol: number;
  protocolFeeSol: number;
  protocolFeeTokens: number;
  lockedPct: number;
}

/**
 * The protocol takes `feeBps` of BOTH sides of the liquidity at migration (verified on devnet: 228.24M tokens +
 * 0.1141 SOL in, 227.78M + 0.1139 out at 20 bps).
 */
export function planMigration(st: LaunchStatic, reserveSol: number, feeBps: number): MigrationPlan {
  const rate = feeBps / 10_000;
  return {
    baseTokens: st.migrationBaseTokens * (1 - rate),
    quoteSol: reserveSol * (1 - rate),
    protocolFeeSol: reserveSol * rate,
    protocolFeeTokens: st.migrationBaseTokens * rate,
    lockedPct: st.lockedLiquidityPct,
  };
}

/* ---------- local record of what a migration produced (position NFT addresses are only known at that moment) ---------- */

export interface MigrationRecord {
  pool: string;
  dammPool: string;
  sig: string;
  positionNfts: [string, string];
  by: string;
  at: number;
}
const key = (pool: string) => `launchcraft:migration:${pool}`;

export function loadMigration(pool: string): MigrationRecord | null {
  try {
    const raw = localStorage.getItem(key(pool));
    return raw ? (JSON.parse(raw) as MigrationRecord) : null;
  } catch {
    return null;
  }
}
function saveMigration(r: MigrationRecord) {
  try {
    localStorage.setItem(key(r.pool), JSON.stringify(r));
  } catch {}
}

/** Builds, signs and sends the migration. Returns the record (also remembered in this browser). */
export async function migrateToDamm(conn: Connection, wallet: WalletHandle, st: LaunchStatic): Promise<MigrationRecord> {
  try {
    const client = dbcClient(conn);
    const dammConfig = dammConfigFor(st.migrationFeeOption);
    const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } = await client.migration.migrateToDammV2({
      payer: wallet.publicKey,
      pool: new PublicKey(st.pool),
      dammConfig,
    });
    // wallet signs first; the two NFT mint keypairs sign afterwards (see signSendConfirm)
    const sig = await signSendConfirm(conn, transaction, wallet, [firstPositionNftKeypair, secondPositionNftKeypair]);
    const rec: MigrationRecord = {
      pool: st.pool,
      dammPool: dammPoolAddress(st).toBase58(),
      sig,
      positionNfts: [firstPositionNftKeypair.publicKey.toBase58(), secondPositionNftKeypair.publicKey.toBase58()],
      by: wallet.publicKey.toBase58(),
      at: Date.now(),
    };
    saveMigration(rec);
    return rec;
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

/** Sends the pool's leftover base tokens to the config's leftoverReceiver. Anyone can pay for it. */
export async function withdrawLeftover(conn: Connection, wallet: WalletHandle, st: LaunchStatic): Promise<string> {
  try {
    const tx = await dbcClient(conn).migration.withdrawLeftover({ payer: wallet.publicKey, pool: new PublicKey(st.pool) });
    return await signSendConfirm(conn, tx, wallet, []);
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
