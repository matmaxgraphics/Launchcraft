import { graduationQuoteSol, quoteAtTokensSold, stateAtQuote, type CurveModel } from "./curveMath";

/**
 * Sequential what-if trading on a curve, before anything is deployed. Pure and deterministic:
 * the simulator holds a SimState, each trade returns the next one.
 * Fees: charged on the SOL side of every trade (matches collectFeeMode = QuoteToken).
 */
export interface SimState {
  /** Net SOL on the curve (what counts toward graduation). */
  quoteSol: number;
  /** Tokens held by simulated traders. */
  tokensSold: number;
}

export const initialSimState = (): SimState => ({ quoteSol: 0, tokensSold: 0 });

export interface TradeResult {
  side: "buy" | "sell";
  next: SimState;
  /** What the trader put in / got out. */
  solIn: number;
  solOut: number;
  tokensIn: number;
  tokensOut: number;
  feeSol: number;
  priceBefore: number;
  priceAfter: number;
  marketCapAfterSol: number;
  /** 0-1: net SOL on the curve / graduation threshold. NOT market cap. */
  progressAfter: number;
  /** True if the buy would have passed graduation and was capped. */
  graduated: boolean;
  /** Unused SOL when a buy is capped at graduation. */
  refundSol: number;
}

export function simulateBuy(m: CurveModel, s: SimState, solGross: number, feeBps: number): TradeResult {
  if (!(solGross > 0)) throw new Error("Buy amount must be greater than 0.");
  const total = graduationQuoteSol(m);
  const feeRate = feeBps / 10_000;
  const room = total - s.quoteSol; // net SOL the curve can still absorb
  const netWanted = solGross * (1 - feeRate);
  const net = Math.min(netWanted, room);
  const graduated = netWanted >= room;
  const grossUsed = net / (1 - feeRate);
  const before = stateAtQuote(m, s.quoteSol);
  const after = stateAtQuote(m, s.quoteSol + net);
  return {
    side: "buy",
    next: { quoteSol: s.quoteSol + net, tokensSold: s.tokensSold + (after.tokensSold - before.tokensSold) },
    solIn: grossUsed,
    solOut: 0,
    tokensIn: 0,
    tokensOut: after.tokensSold - before.tokensSold,
    feeSol: grossUsed - net,
    priceBefore: before.price,
    priceAfter: after.price,
    marketCapAfterSol: after.marketCapSol,
    progressAfter: (s.quoteSol + net) / total,
    graduated,
    refundSol: solGross - grossUsed,
  };
}

export function simulateSell(m: CurveModel, s: SimState, tokens: number, feeBps: number): TradeResult {
  if (!(tokens > 0)) throw new Error("Sell amount must be greater than 0.");
  const sellable = stateAtQuote(m, s.quoteSol).tokensSold;
  if (tokens > sellable + 1e-9) throw new Error("Can't sell more tokens than have been bought on the curve.");
  const total = graduationQuoteSol(m);
  const feeRate = feeBps / 10_000;
  const before = stateAtQuote(m, s.quoteSol);
  const newQuote = Math.max(0, quoteAtTokensSold(m, before.tokensSold - tokens));
  const grossOut = s.quoteSol - newQuote;
  const fee = grossOut * feeRate;
  const after = stateAtQuote(m, newQuote);
  return {
    side: "sell",
    next: { quoteSol: newQuote, tokensSold: s.tokensSold - tokens },
    solIn: 0,
    solOut: grossOut - fee,
    tokensIn: tokens,
    tokensOut: 0,
    feeSol: fee,
    priceBefore: before.price,
    priceAfter: after.price,
    marketCapAfterSol: after.marketCapSol,
    progressAfter: newQuote / total,
    graduated: false,
    refundSol: 0,
  };
}
