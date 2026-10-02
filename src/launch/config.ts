/**
 * Launchcraft application model. The UI only ever talks to these types;
 * nothing in here imports Meteora SDK types (see toDbc.ts for the translation layer).
 *
 * Units: market caps are in SOL (the quote asset). USD display is a UI concern.
 */

/** DBC always slices the price range into exactly 16 geometric steps. CurveLab edits 16 weights. */
export const CURVE_POINTS = 16;

export type CurvePresetId = "flat" | "gradual" | "balanced" | "accelerated" | "custom";

export interface LaunchConfig {
  token: {
    name: string;
    symbol: string;
    /** Whole tokens, e.g. 1_000_000_000 */
    supply: number;
    /** Metadata JSON uri (name/symbol/image). Uploaded by the app before deploy. */
    metadataUri: string;
  };
  curve: {
    /** Market cap at the first trade, in SOL. */
    startMarketCapSol: number;
    /** Market cap at which the curve completes, in SOL. */
    graduationMarketCapSol: number;
    /** Relative liquidity per price step, length CURVE_POINTS. Only ratios matter. */
    weights: number[];
    preset: CurvePresetId;
  };
  fees: {
    /** Flat trading fee in basis points (100 = 1%). */
    tradingFeeBps: number;
    /** Share of trading fees that goes to the creator, 0-100. */
    creatorFeeSharePct: number;
  };
  liquidity: {
    /** The four values below must sum to 100. */
    creatorPct: number;
    partnerPct: number;
    creatorLockedPct: number;
    partnerLockedPct: number;
  };
  /** Advanced; defaults are fine for most launches. */
  advanced: {
    /** Tokens held back for rounding headroom, as % of supply. SDK needs > 0 for weighted curves. */
    leftoverPct: number;
  };
}

/** Protocol rule discovered on devnet: at least this much liquidity must be locked at day 1. */
export const MIN_LOCKED_LIQUIDITY_PCT = 10;

export function defaultLaunchConfig(): LaunchConfig {
  return {
    token: { name: "", symbol: "", supply: 1_000_000_000, metadataUri: "" },
    curve: {
      startMarketCapSol: 30,
      graduationMarketCapSol: 300,
      weights: Array.from({ length: CURVE_POINTS }, () => 1),
      preset: "flat",
    },
    fees: { tradingFeeBps: 100, creatorFeeSharePct: 50 },
    liquidity: { creatorPct: 50, partnerPct: 40, creatorLockedPct: 0, partnerLockedPct: 10 },
    advanced: { leftoverPct: 5 },
  };
}
