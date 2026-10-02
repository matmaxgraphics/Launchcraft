/**
 * Real trading against a deployed DBC pool on devnet. Quotes come from the SDK using the pool's live
 * accounts (so they match what the program will do), then swap2 builds the transaction.
 */
import BN from "bn.js";
import { PublicKey, type Connection } from "@solana/web3.js";
import { SwapMode } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { signSendConfirm, friendlyError } from "@/deploy/deploy";
import { sqrtToPrice } from "@/launch/curveMath";
import type { WalletHandle } from "@/wallet/types";
import { dbcClient, type LaunchLive, type LaunchStatic } from "./read";

export type Side = "buy" | "sell";

export interface SwapPreview {
  side: Side;
  /** SOL for a buy, tokens for a sell (whole units). */
  amountIn: number;
  /** Tokens for a buy, SOL for a sell. */
  amountOut: number;
  minOut: number;
  feeSol: number;
  priceAfter: number;
  /** Input the curve couldn't absorb (a buy that would pass graduation); stays in the wallet. */
  unusedIn: number;
}

const LAMPORTS = 1e9;
const toRaw = (whole: number, decimals: number) => new BN(Math.round(whole * 10 ** decimals).toString());

interface QuoteCfg {
  activationType: number;
}

async function currentPoint(conn: Connection, cfg: QuoteCfg): Promise<BN> {
  // activationType 0 = slot, 1 = unix timestamp
  return cfg.activationType === 1 ? new BN(Math.floor(Date.now() / 1000)) : new BN(await conn.getSlot("confirmed"));
}

export async function previewSwap(conn: Connection, st: LaunchStatic, live: LaunchLive, side: Side, amount: number, slippageBps = 100): Promise<SwapPreview> {
  if (!(amount > 0)) throw new Error("Enter an amount greater than 0.");
  if (live.curveComplete || live.isMigrated) throw new Error("This curve is complete, so it no longer accepts trades.");
  const client = dbcClient(conn);
  const sell = side === "sell";
  const inDecimals = sell ? st.tokenDecimals : 9;
  const outDecimals = sell ? 9 : st.tokenDecimals;
  const amountIn = toRaw(amount, inDecimals);
  const q = client.pool.swapQuote2({
    virtualPool: live.rawPool as never,
    config: st.rawConfig as never,
    swapBaseForQuote: sell,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint: await currentPoint(conn, st.rawConfig as QuoteCfg),
    slippageBps,
    swapMode: sell ? SwapMode.ExactIn : SwapMode.PartialFill,
    amountIn,
  });
  const out = Number(q.outputAmount.toString()) / 10 ** outDecimals;
  const minOut = Number((q.minimumAmountOut ?? q.outputAmount).toString()) / 10 ** outDecimals;
  const left = Number(q.amountLeft?.toString?.() ?? "0") / 10 ** inDecimals;
  return {
    side,
    amountIn: amount - left,
    amountOut: out,
    minOut,
    feeSol: (Number(q.tradingFee.toString()) + Number(q.protocolFee.toString())) / LAMPORTS,
    priceAfter: sqrtToPrice(BigInt(q.nextSqrtPrice.toString())),
    unusedIn: left,
  };
}

/** Builds, signs (wallet), sends and confirms the swap. Returns the signature. */
export async function executeSwap(conn: Connection, wallet: WalletHandle, st: LaunchStatic, side: Side, amount: number, minOut: number): Promise<string> {
  try {
    const client = dbcClient(conn);
    const sell = side === "sell";
    const inDecimals = sell ? st.tokenDecimals : 9;
    const outDecimals = sell ? 9 : st.tokenDecimals;
    const tx = await client.pool.swap2({
      owner: wallet.publicKey,
      pool: new PublicKey(st.pool),
      swapBaseForQuote: sell,
      referralTokenAccount: null,
      swapMode: sell ? SwapMode.ExactIn : SwapMode.PartialFill,
      amountIn: toRaw(amount, inDecimals),
      // floor() so rounding never makes the minimum stricter than the quote
      minimumAmountOut: new BN(Math.floor(minOut * 10 ** outDecimals).toString()),
    });
    return await signSendConfirm(conn, tx, wallet, []);
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
