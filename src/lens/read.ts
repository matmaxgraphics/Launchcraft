/**
 * LaunchLens data layer: turns raw DBC accounts into plain, typed numbers.
 * Static part (config, curve, metadata) is read once; the live part (price, reserves, fees) is polled.
 */
import { PublicKey, type Connection } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { sqrtToPrice, stateAtQuote, type CurveModel } from "@/launch/curveMath";

const LAMPORTS = 1e9;
const FEE_DENOMINATOR = 1e9;

const TOKEN_METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/* The SDK types these accounts via an Anchor IDL; the fields we read are stable, so use a narrow local view. */
interface BnLike {
  toString(): string;
  isZero(): boolean;
}
interface RawPool {
  config: PublicKey;
  creator: PublicKey;
  baseMint: PublicKey;
  baseReserve: BnLike;
  quoteReserve: BnLike;
  sqrtPrice: BnLike;
  isMigrated: number;
  finishCurveTimestamp: BnLike;
  protocolQuoteFee: BnLike;
  partnerQuoteFee: BnLike;
  creatorQuoteFee: BnLike;
  metrics: { totalTradingQuoteFee: BnLike; totalProtocolQuoteFee: BnLike };
  protocolLiquidityMigrationFeeBps: number;
  isWithdrawLeftover: number;
}
interface RawConfig {
  sqrtStartPrice: BnLike;
  migrationQuoteThreshold: BnLike;
  preMigrationTokenSupply: BnLike;
  swapBaseAmount: BnLike;
  migrationBaseThreshold: BnLike;
  migrationFeeOption: number;
  leftoverReceiver: PublicKey;
  tokenDecimal: number;
  poolFees: { baseFee: { cliffFeeNumerator: BnLike } };
  curve: { sqrtPrice: BnLike; liquidity: BnLike }[];
  creatorTradingFeePercentage: number;
  partnerPermanentLockedLiquidityPercentage: number;
  creatorPermanentLockedLiquidityPercentage: number;
  partnerLiquidityPercentage: number;
  creatorLiquidityPercentage: number;
}

export interface LaunchStatic {
  pool: string;
  config: string;
  baseMint: string;
  creator: string;
  name: string | null;
  symbol: string | null;
  supply: number;
  tokenDecimals: number;
  feeBps: number;
  creatorFeeSharePct: number;
  thresholdSol: number;
  startMarketCapSol: number;
  curve: CurveModel;
  /** Index into Meteora's DAMM v2 migration fee configs. */
  migrationFeeOption: number;
  /** Who receives leftover tokens when they're withdrawn. */
  leftoverReceiver: string;
  /** Base tokens that move into the DAMM v2 pool at migration (whole tokens). */
  migrationBaseTokens: number;
  /** Supply held back as leftover: total - sold-on-curve allocation - migration allocation (whole tokens). */
  leftoverTokens: number;
  lockedLiquidityPct: number;
  /** Raw accounts, kept for the SDK's swap quoting. */
  rawConfig: unknown;
}

export interface LaunchLive {
  price: number;
  marketCapSol: number;
  quoteReserveSol: number;
  /** 0-1. Quote reserve against the migration threshold; not market cap. */
  progress: number;
  /** Tokens sold along the curve (whole tokens), from reserves. */
  tokensSold: number;
  /** Price the curve math predicts for this reserve, to cross-check against the on-chain sqrt price. */
  modelPrice: number;
  isMigrated: boolean;
  curveComplete: boolean;
  /** Protocol's cut of the SOL when it migrates, in basis points (read from the pool). */
  migrationFeeBps: number;
  leftoverWithdrawn: boolean;
  fees: { creatorSol: number; partnerSol: number; protocolSol: number; totalTradingSol: number };
  updatedAt: number;
  /** Raw pool account, kept for the SDK's swap quoting. */
  rawPool: unknown;
}

const num = (b: BnLike, div = 1) => Number(b.toString()) / div;
const clientCache = new WeakMap<Connection, DynamicBondingCurveClient>();
export function dbcClient(conn: Connection): DynamicBondingCurveClient {
  let c = clientCache.get(conn);
  if (!c) clientCache.set(conn, (c = DynamicBondingCurveClient.create(conn, "confirmed")));
  return c;
}

/** The pool account wraps its data as `{ poolState }`; the config account is returned bare. */
async function readPool(client: DynamicBondingCurveClient, pool: PublicKey): Promise<{ state: RawPool; raw: unknown }> {
  const res = (await client.state.getPool(pool)) as unknown as { poolState?: RawPool } | null;
  if (!res) throw new Error("No DBC pool exists at this address on devnet.");
  return { state: (res.poolState ?? (res as unknown as RawPool)) as RawPool, raw: res };
}

export function parseAddress(s: string): PublicKey | null {
  try {
    return new PublicKey(s.trim());
  } catch {
    return null;
  }
}

/* ---------- token metadata (Metaplex), decoded by hand to avoid another dependency ---------- */

export async function fetchTokenName(conn: Connection, mint: PublicKey): Promise<{ name: string | null; symbol: string | null }> {
  try {
    const [pda] = PublicKey.findProgramAddressSync([new TextEncoder().encode("metadata"), TOKEN_METADATA_PROGRAM.toBytes(), mint.toBytes()], TOKEN_METADATA_PROGRAM);
    const info = await conn.getAccountInfo(pda, "confirmed");
    if (!info) return { name: null, symbol: null };
    const d = new Uint8Array(info.data);
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const dec = new TextDecoder();
    let o = 1 + 32 + 32; // key + update authority + mint
    const readStr = () => {
      const len = dv.getUint32(o, true);
      const s = dec.decode(d.subarray(o + 4, o + 4 + len)).replace(/\0+$/g, "");
      o += 4 + len;
      return s;
    };
    return { name: readStr() || null, symbol: readStr() || null };
  } catch {
    return { name: null, symbol: null };
  }
}

/* ---------- static + live reads ---------- */

export async function fetchLaunchStatic(conn: Connection, poolPk: PublicKey): Promise<LaunchStatic> {
  const client = dbcClient(conn);
  const { state } = await readPool(client, poolPk);
  const cfg = (await client.state.getPoolConfig(state.config)) as unknown as RawConfig | null;
  if (!cfg) throw new Error("The pool's config account could not be read.");

  const steps = cfg.curve
    .filter((p) => !p.sqrtPrice.isZero())
    .map((p) => ({ sqrtEnd: BigInt(p.sqrtPrice.toString()), liquidity: BigInt(p.liquidity.toString()) }));
  const supply = num(cfg.preMigrationTokenSupply, 10 ** cfg.tokenDecimal);
  const curve: CurveModel = { supply, sqrtStart: BigInt(cfg.sqrtStartPrice.toString()), steps };
  const { name, symbol } = await fetchTokenName(conn, state.baseMint);

  return {
    pool: poolPk.toBase58(),
    config: state.config.toBase58(),
    baseMint: state.baseMint.toBase58(),
    creator: state.creator.toBase58(),
    name,
    symbol,
    supply,
    tokenDecimals: cfg.tokenDecimal,
    feeBps: num(cfg.poolFees.baseFee.cliffFeeNumerator) / (FEE_DENOMINATOR / 10_000),
    creatorFeeSharePct: cfg.creatorTradingFeePercentage,
    thresholdSol: num(cfg.migrationQuoteThreshold, LAMPORTS),
    startMarketCapSol: sqrtToPrice(curve.sqrtStart) * supply,
    curve,
    migrationFeeOption: cfg.migrationFeeOption,
    leftoverReceiver: cfg.leftoverReceiver.toBase58(),
    migrationBaseTokens: num(cfg.migrationBaseThreshold, 10 ** cfg.tokenDecimal),
    leftoverTokens: Math.max(0, supply - num(cfg.swapBaseAmount, 10 ** cfg.tokenDecimal) - num(cfg.migrationBaseThreshold, 10 ** cfg.tokenDecimal)),
    lockedLiquidityPct: cfg.partnerPermanentLockedLiquidityPercentage + cfg.creatorPermanentLockedLiquidityPercentage,
    rawConfig: cfg,
  };
}

export async function fetchLaunchLive(conn: Connection, st: LaunchStatic): Promise<LaunchLive> {
  const client = dbcClient(conn);
  const { state: p, raw } = await readPool(client, new PublicKey(st.pool));
  const quoteReserveSol = num(p.quoteReserve, LAMPORTS);
  const price = sqrtToPrice(BigInt(p.sqrtPrice.toString()));
  const model = stateAtQuote(st.curve, quoteReserveSol);
  const progress = Math.min(1, quoteReserveSol / st.thresholdSol);
  // initial base reserve is the whole pre-migration supply; what has left the pool was sold
  const tokensSold = Math.max(0, st.supply - num(p.baseReserve, 10 ** st.tokenDecimals));
  return {
    price,
    marketCapSol: price * st.supply,
    quoteReserveSol,
    progress,
    tokensSold,
    modelPrice: model.price,
    isMigrated: p.isMigrated === 1,
    curveComplete: quoteReserveSol >= st.thresholdSol || num(p.finishCurveTimestamp) > 0,
    migrationFeeBps: p.protocolLiquidityMigrationFeeBps,
    leftoverWithdrawn: p.isWithdrawLeftover === 1,
    fees: {
      creatorSol: num(p.creatorQuoteFee, LAMPORTS),
      partnerSol: num(p.partnerQuoteFee, LAMPORTS),
      protocolSol: num(p.protocolQuoteFee, LAMPORTS),
      totalTradingSol: num(p.metrics.totalTradingQuoteFee, LAMPORTS),
    },
    updatedAt: Date.now(),
    rawPool: raw, // swapQuote2 expects the wrapped { poolState } shape that getPool returns
  };
}

/* ---------- wallet holdings + activity ---------- */

export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN_PROGRAM.toBytes(), mint.toBytes()], ASSOCIATED_TOKEN_PROGRAM)[0];
}

/** Whole-token balance of `owner` for `mint`; 0 when the account doesn't exist yet. */
export async function fetchTokenBalance(conn: Connection, owner: PublicKey, mint: PublicKey): Promise<number> {
  try {
    const r = await conn.getTokenAccountBalance(associatedTokenAddress(owner, mint), "confirmed");
    return r.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

export interface ActivityRow {
  signature: string;
  blockTime: number | null;
  ok: boolean;
}

export async function fetchActivity(conn: Connection, pool: PublicKey, limit = 12): Promise<ActivityRow[]> {
  const sigs = await conn.getSignaturesForAddress(pool, { limit }, "confirmed");
  return sigs.map((s) => ({ signature: s.signature, blockTime: s.blockTime ?? null, ok: !s.err }));
}
