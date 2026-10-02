import { CURVE_POINTS, MIN_LOCKED_LIQUIDITY_PCT, type LaunchConfig } from "./config";

export type IssueSeverity = "error" | "warning";

export interface Issue {
  /** Dotted path into LaunchConfig, e.g. "liquidity.partnerLockedPct". Used to anchor the message in the UI. */
  field: string;
  severity: IssueSeverity;
  /** Human wording. The Copilot can restate these; the UI shows them verbatim. */
  message: string;
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Local, synchronous checks. These catch what we know without calling the SDK.
 * The SDK stays the final authority: see buildDbcConfig(), which maps SDK throws into Issues too.
 */
export function validateLaunchConfig(c: LaunchConfig): Issue[] {
  const out: Issue[] = [];
  const err = (field: string, message: string) => out.push({ field, severity: "error", message });
  const warn = (field: string, message: string) => out.push({ field, severity: "warning", message });

  // token
  const name = c.token.name.trim();
  if (!name) err("token.name", "Give your token a name.");
  else if (name.length > 32) err("token.name", "Token name must be 32 characters or fewer.");
  const symbol = c.token.symbol.trim();
  if (!symbol) err("token.symbol", "Give your token a symbol.");
  else if (symbol.length > 10) err("token.symbol", "Symbol must be 10 characters or fewer.");
  else if (!/^[A-Za-z0-9$]+$/.test(symbol)) err("token.symbol", "Symbol can only contain letters and numbers.");
  if (!isNum(c.token.supply) || c.token.supply <= 0 || !Number.isInteger(c.token.supply))
    err("token.supply", "Supply must be a whole number greater than 0.");
  if (!c.token.metadataUri.trim()) warn("token.metadataUri", "No metadata uri yet; the token won't show a logo until one is set.");

  // curve
  const { startMarketCapSol: a, graduationMarketCapSol: b, weights } = c.curve;
  if (!isNum(a) || a <= 0) err("curve.startMarketCapSol", "Starting market cap must be greater than 0.");
  if (!isNum(b) || b <= 0) err("curve.graduationMarketCapSol", "Graduation market cap must be greater than 0.");
  if (isNum(a) && isNum(b) && a > 0 && b > 0) {
    if (b <= a) err("curve.graduationMarketCapSol", "Graduation market cap must be higher than the starting market cap.");
    else if (b / a < 2) warn("curve.graduationMarketCapSol", "Graduation is less than 2x the starting market cap; price discovery will be very narrow.");
  }
  if (!Array.isArray(weights) || weights.length !== CURVE_POINTS) {
    err("curve.weights", `The curve needs exactly ${CURVE_POINTS} points.`);
  } else {
    if (weights.some((w) => !isNum(w) || w <= 0)) err("curve.weights", "Every curve point must be greater than 0.");
    else {
      const max = Math.max(...weights);
      const min = Math.min(...weights);
      if (max / min > 100) warn("curve.weights", "Some steps hold over 100x more liquidity than others; price will barely move in the deepest steps.");
    }
  }

  // fees
  if (!isNum(c.fees.tradingFeeBps) || c.fees.tradingFeeBps < 0 || c.fees.tradingFeeBps > 10_000)
    err("fees.tradingFeeBps", "Trading fee must be between 0% and 100%.");
  else if (c.fees.tradingFeeBps > 500) warn("fees.tradingFeeBps", "A trading fee above 5% will discourage trading.");
  if (!isNum(c.fees.creatorFeeSharePct) || c.fees.creatorFeeSharePct < 0 || c.fees.creatorFeeSharePct > 100)
    err("fees.creatorFeeSharePct", "Creator fee share must be between 0% and 100%.");

  // liquidity
  const l = c.liquidity;
  const parts = [l.creatorPct, l.partnerPct, l.creatorLockedPct, l.partnerLockedPct];
  if (parts.some((p) => !isNum(p) || p < 0 || p > 100)) {
    err("liquidity", "Each liquidity share must be between 0% and 100%.");
  } else {
    const sum = parts.reduce((x, y) => x + y, 0);
    if (Math.abs(sum - 100) > 1e-9) err("liquidity", `Liquidity shares add up to ${sum}%; they must add up to 100%.`);
    const locked = l.creatorLockedPct + l.partnerLockedPct;
    if (locked < MIN_LOCKED_LIQUIDITY_PCT)
      err("liquidity", `At least ${MIN_LOCKED_LIQUIDITY_PCT}% of liquidity must be locked at graduation (currently ${locked}%).`);
  }

  // advanced
  if (!isNum(c.advanced.leftoverPct) || c.advanced.leftoverPct < 0 || c.advanced.leftoverPct >= 100)
    err("advanced.leftoverPct", "Leftover must be between 0% and 100%.");
  else if (c.advanced.leftoverPct === 0) warn("advanced.leftoverPct", "A leftover of 0% often fails with weighted curves because of rounding.");

  return out;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === "error");
