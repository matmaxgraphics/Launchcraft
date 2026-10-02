/**
 * Builds the compact, factual JSON the AI Copilot is allowed to use. Every number here is computed by Launchcraft
 * (curve math, on-chain reads); the model explains them, it doesn't produce them. Safe to import from client code.
 * Strings that users or the chain control (names, descriptions) are length-capped and stripped of control characters.
 */
import type { LaunchConfig } from "@/launch/config";
import { curveBoundaries } from "@/launch/curveMath";
import type { BuildResult } from "@/launch/toDbc";
import type { DammInfo } from "@/lens/migrate";
import type { LaunchLive, LaunchStatic } from "@/lens/read";
import { statusOf } from "@/lens/insights";

// eslint-disable-next-line no-control-regex
const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").slice(0, max);
const r = (n: number, d = 6) => Number(n.toPrecision(d));

export interface CopilotContext {
  mode: "design" | "live";
  [k: string]: unknown;
}

/** Context while the user is designing a launch (the Create flow). */
export function designContext(config: LaunchConfig, build: BuildResult, readouts: string[], step: string): CopilotContext {
  const base: CopilotContext = {
    mode: "design",
    step,
    token: { name: clean(config.token.name, 40), symbol: clean(config.token.symbol, 12), supply: config.token.supply, description: clean(config.token.description, 300) },
    curve: {
      startMarketCapSol: config.curve.startMarketCapSol,
      graduationMarketCapSol: config.curve.graduationMarketCapSol,
      preset: config.curve.preset,
      liquidityWeightsBySteps: config.curve.weights.map((w) => r(w, 3)),
    },
    fees: { tradingFeePercent: config.fees.tradingFeeBps / 100, creatorShareOfFeePercent: config.fees.creatorFeeSharePct },
    liquidityAtGraduationPercent: { ...config.liquidity },
    leftoverPercentOfSupply: config.advanced.leftoverPct,
    launchcraftReadouts: readouts.map((t) => clean(t, 300)),
  };
  if (build.ok) {
    const b = curveBoundaries(build.curve);
    const total = b[16].quoteSol;
    (base.curve as Record<string, unknown>).graduationRequiresSolDeposited = r(total);
    (base.curve as Record<string, unknown>).tokensSoldAtGraduationPercentOfSupply = r((b[16].tokensSold / config.token.supply) * 100, 4);
    (base.curve as Record<string, unknown>).solAbsorbedInFirstFourStepsPercent = r((b[4].quoteSol / total) * 100, 4);
    (base.curve as Record<string, unknown>).solAbsorbedInLastFourStepsPercent = r(((total - b[12].quoteSol) / total) * 100, 4);
  } else {
    base.validationProblems = build.issues.filter((i) => i.severity === "error").map((i) => clean(i.message, 200));
  }
  return base;
}

/** Context while looking at a deployed launch (LaunchLens). */
export function liveContext(st: LaunchStatic, live: LaunchLive, damm: DammInfo | null, readouts: string[]): CopilotContext {
  return {
    mode: "live",
    status: statusOf(live),
    token: { name: clean(st.name, 40), symbol: clean(st.symbol, 12), supply: st.supply },
    market: {
      priceSolPerToken: r(live.price),
      marketCapSol: r(live.marketCapSol),
      startingMarketCapSol: r(st.startMarketCapSol),
      solDepositedOnCurve: r(live.quoteReserveSol),
      solNeededToGraduate: r(st.thresholdSol),
      progressToGraduationPercent: r(live.progress * 100, 4),
      tokensSoldPercentOfSupply: r((live.tokensSold / st.supply) * 100, 4),
    },
    fees: {
      tradingFeePercent: st.feeBps / 100,
      creatorShareOfFeePercent: st.creatorFeeSharePct,
      unclaimedSol: { creator: r(live.fees.creatorSol), partner: r(live.fees.partnerSol), protocol: r(live.fees.protocolSol) },
      totalTradingFeesPaidSol: r(live.fees.totalTradingSol),
    },
    migration: {
      protocolMigrationFeePercent: live.migrationFeeBps / 100,
      permanentlyLockedLiquidityPercent: st.lockedLiquidityPct,
      leftoverWithdrawn: live.leftoverWithdrawn,
      dammV2Pool: damm?.exists ? { tokenReserve: r(damm.baseTokens), solReserve: r(damm.quoteSol), impliedPriceSolPerToken: r(damm.impliedPrice) } : null,
    },
    launchcraftReadouts: readouts.map((t) => clean(t, 300)),
  };
}
