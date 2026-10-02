/**
 * Pure curve math on a DBC curve (no SDK, no network). Lets CurveLab render the curve and the
 * simulator run sequential buys/sells. Cross-checked against the SDK's own quotes in test/.
 *
 * DBC liquidity maths (all sqrt prices are Q64.64, liquidity is Q64.64):
 *   quote(step)  = L * (sqrtHi - sqrtLo)            (lamports)
 *   base(step)   = L * (1/sqrtLo - 1/sqrtHi)        (raw token units)
 */
export const BASE_DECIMALS = 6;
export const QUOTE_DECIMALS = 9;
const Q64 = 2 ** 64;

export interface CurveStep {
  sqrtEnd: bigint;
  liquidity: bigint;
}
export interface CurveModel {
  sqrtStart: bigint;
  steps: CurveStep[];
  /** Whole tokens. */
  supply: number;
}

export interface CurveBoundary {
  /** SOL per token. */
  price: number;
  marketCapSol: number;
  /** Cumulative SOL that must be deposited to reach this point (net of fees). */
  quoteSol: number;
  /** Cumulative tokens sold at this point. */
  tokensSold: number;
}

const real = (q: bigint) => Number(q) / Q64;

export function sqrtToPrice(sqrtQ64: bigint): number {
  const s = real(sqrtQ64);
  return s * s * 10 ** (BASE_DECIMALS - QUOTE_DECIMALS);
}

/** Boundary i is the curve state after i steps (boundary 0 = launch). */
export function curveBoundaries(m: CurveModel): CurveBoundary[] {
  const out: CurveBoundary[] = [boundaryAt(m, m.sqrtStart, 0, 0)];
  let lo = m.sqrtStart;
  let quote = 0;
  let base = 0;
  for (const s of m.steps) {
    const L = real(s.liquidity);
    const sLo = real(lo);
    const sHi = real(s.sqrtEnd);
    quote += (L * (sHi - sLo)) / 10 ** QUOTE_DECIMALS;
    base += (L * (1 / sLo - 1 / sHi)) / 10 ** BASE_DECIMALS;
    out.push(boundaryAt(m, s.sqrtEnd, quote, base));
    lo = s.sqrtEnd;
  }
  return out;
}

function boundaryAt(m: CurveModel, sqrt: bigint, quoteSol: number, tokensSold: number): CurveBoundary {
  const price = sqrtToPrice(sqrt);
  return { price, marketCapSol: price * m.supply, quoteSol, tokensSold };
}

/** Total net SOL the curve absorbs before graduation. */
export const graduationQuoteSol = (m: CurveModel) => curveBoundaries(m).at(-1)!.quoteSol;

export interface CurveState {
  price: number;
  marketCapSol: number;
  tokensSold: number;
  /** Net SOL deposited so far. */
  quoteSol: number;
}

/** State of the curve after `quoteSol` net SOL has been deposited (clamped to [0, graduation]). */
export function stateAtQuote(m: CurveModel, quoteSol: number): CurveState {
  const total = graduationQuoteSol(m);
  const target = Math.min(Math.max(quoteSol, 0), total);
  let lo = m.sqrtStart;
  let remaining = target * 10 ** QUOTE_DECIMALS; // lamports
  let tokens = 0;
  for (const s of m.steps) {
    const L = real(s.liquidity);
    const sLo = real(lo);
    const sHi = real(s.sqrtEnd);
    const stepQuote = L * (sHi - sLo);
    if (remaining >= stepQuote) {
      tokens += L * (1 / sLo - 1 / sHi);
      remaining -= stepQuote;
      lo = s.sqrtEnd;
      continue;
    }
    // partial step: sqrtNew = sqrtLo + dQuote / L
    const sNew = sLo + remaining / L;
    tokens += L * (1 / sLo - 1 / sNew);
    const price = sNew * sNew * 10 ** (BASE_DECIMALS - QUOTE_DECIMALS);
    return { price, marketCapSol: price * m.supply, tokensSold: tokens / 10 ** BASE_DECIMALS, quoteSol: target };
  }
  const price = sqrtToPrice(lo);
  return { price, marketCapSol: price * m.supply, tokensSold: tokens / 10 ** BASE_DECIMALS, quoteSol: target };
}

/** Inverse of tokensSold(quote): net SOL deposited when `tokensSold` tokens are out. Monotonic, so bisect. */
export function quoteAtTokensSold(m: CurveModel, tokensSold: number): number {
  const total = graduationQuoteSol(m);
  let lo = 0;
  let hi = total;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (stateAtQuote(m, mid).tokensSold < tokensSold) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
