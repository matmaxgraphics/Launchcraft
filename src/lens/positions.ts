/**
 * Liquidity positions in the DAMM v2 pool a launch graduated into. Migration mints two position NFTs
 * (creator's and partner's); whoever holds an NFT owns that position's liquidity and fees.
 * A permanently locked share can never be withdrawn, only earn fees. Everything else can be.
 */
import BN from "bn.js";
import { PublicKey, type Connection } from "@solana/web3.js";
import { CpAmm, getUnClaimLpFee } from "@meteora-ag/cp-amm-sdk";
import { friendlyError, signSendConfirm } from "@/deploy/deploy";
import type { WalletHandle } from "@/wallet/types";
import { dammPoolAddress } from "./migrate";
import { TOKEN_PROGRAM, type LaunchStatic } from "./read";

type PoolState = Awaited<ReturnType<CpAmm["fetchPoolState"]>>;
type PositionState = Awaited<ReturnType<CpAmm["fetchPositionState"]>>;

export interface PositionView {
  position: string;
  nftAccount: string;
  nftMint: string;
  /** Share of the whole pool's liquidity this position holds (0-1), locked + unlocked. */
  poolShare: number;
  /** Fractions of THIS position (sum to 1). */
  unlockedFrac: number;
  lockedFrac: number;
  /** Estimated amounts the unlocked liquidity would return (whole tokens / SOL). For a full-range pool, amounts are proportional to liquidity. */
  unlockedTokens: number;
  unlockedSol: number;
  /** Unclaimed trading fees (whole tokens / SOL). */
  feeTokens: number;
  feeSol: number;
  canWithdraw: boolean;
}

const DEC = 6;
const bn = (x: unknown) => new BN(String(x));
const num = (b: BN) => Number(b.toString());

function pct(a: BN, total: BN): number {
  return total.isZero() ? 0 : num(a.muln(1_000_000).div(total)) / 1_000_000;
}

function toView(pool: PoolState, ps: PositionState, position: PublicKey, nftAccount: PublicKey): PositionView {
  const unlocked = bn(ps.unlockedLiquidity);
  const vested = bn(ps.vestedLiquidity);
  const permanent = bn(ps.permanentLockedLiquidity);
  const total = unlocked.add(vested).add(permanent);
  const poolLiq = bn(pool.liquidity);
  const fees = getUnClaimLpFee(pool, ps);
  // tokenA = the launched token (mint order puts it before WSOL), tokenB = SOL
  const aOut = poolLiq.isZero() ? new BN(0) : bn(pool.tokenAAmount).mul(unlocked).div(poolLiq);
  const bOut = poolLiq.isZero() ? new BN(0) : bn(pool.tokenBAmount).mul(unlocked).div(poolLiq);
  return {
    position: position.toBase58(),
    nftAccount: nftAccount.toBase58(),
    nftMint: ps.nftMint.toBase58(),
    poolShare: pct(total, poolLiq),
    unlockedFrac: pct(unlocked, total),
    lockedFrac: pct(vested.add(permanent), total),
    unlockedTokens: num(aOut) / 10 ** DEC,
    unlockedSol: num(bOut) / 1e9,
    feeTokens: num(fees.feeTokenA) / 10 ** DEC,
    feeSol: num(fees.feeTokenB) / 1e9,
    canWithdraw: !unlocked.isZero(),
  };
}

/** The positions `owner` holds in this launch's DAMM v2 pool. Empty when the wallet holds none. */
export async function fetchPositions(conn: Connection, st: LaunchStatic, owner: PublicKey): Promise<PositionView[]> {
  const cp = new CpAmm(conn);
  const poolAddr = dammPoolAddress(st);
  const pool = await cp.fetchPoolState(poolAddr);
  const found = await cp.getUserPositionByPool(poolAddr, owner);
  return found.map((p) => toView(pool, p.positionState, p.position, p.positionNftAccount));
}

async function context(conn: Connection, st: LaunchStatic, owner: PublicKey, pv: PositionView) {
  const cp = new CpAmm(conn);
  const poolAddr = dammPoolAddress(st);
  const pool = await cp.fetchPoolState(poolAddr);
  const position = new PublicKey(pv.position);
  const positionState = await cp.fetchPositionState(position);
  const base = {
    owner,
    position,
    pool: poolAddr,
    positionNftAccount: new PublicKey(pv.nftAccount),
    tokenAMint: pool.tokenAMint,
    tokenBMint: pool.tokenBMint,
    tokenAVault: pool.tokenAVault,
    tokenBVault: pool.tokenBVault,
    tokenAProgram: TOKEN_PROGRAM,
    tokenBProgram: TOKEN_PROGRAM,
  };
  return { cp, pool, positionState, base };
}

/** Claims the position's unclaimed trading fees to its owner. */
export async function claimPositionFees(conn: Connection, wallet: WalletHandle, st: LaunchStatic, pv: PositionView): Promise<string> {
  try {
    const { cp, base } = await context(conn, st, wallet.publicKey, pv);
    const tx = await cp.claimPositionFee({ ...base, feePayer: wallet.publicKey });
    return await signSendConfirm(conn, tx, wallet, []);
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

/** Withdraws all unlocked liquidity (permanently locked liquidity stays). Minimums allow 1% slippage. */
export async function withdrawUnlocked(conn: Connection, wallet: WalletHandle, st: LaunchStatic, pv: PositionView): Promise<string> {
  try {
    const { cp, pool, base } = await context(conn, st, wallet.publicKey, pv);
    const min = (x: number, dec: number) => new BN(Math.floor(x * 10 ** dec * 0.99).toString());
    const currentPoint = pool.activationType === 1 ? new BN(Math.floor(Date.now() / 1000)) : new BN(await conn.getSlot("confirmed"));
    const tx = await cp.removeAllLiquidity({
      ...base,
      tokenAAmountThreshold: min(pv.unlockedTokens, DEC),
      tokenBAmountThreshold: min(pv.unlockedSol, 9),
      vestings: [],
      currentPoint,
    });
    return await signSendConfirm(conn, tx, wallet, []);
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
