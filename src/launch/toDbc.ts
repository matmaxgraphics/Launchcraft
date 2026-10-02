/**
 * Translation layer: LaunchConfig -> Meteora DBC SDK. This is the ONLY module (besides sdkQuote.ts)
 * that imports Meteora types, so SDK upgrades stay contained.
 */
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DammV2DynamicFeeMode,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithLiquidityWeights,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import type { LaunchConfig } from "./config";
import type { CurveModel } from "./curveMath";
import { hasErrors, validateLaunchConfig, type Issue } from "./validate";

type BuildParams = Parameters<typeof buildCurveWithLiquidityWeights>[0];
export type DbcConfigParameters = ReturnType<typeof buildCurveWithLiquidityWeights>;

export function toBuildParams(c: LaunchConfig): BuildParams {
  return {
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE, // SOL
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: c.token.supply,
      leftover: Math.round((c.token.supply * c.advanced.leftoverPct) / 100),
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        // flat fee: start == end, no periods
        feeSchedulerParam: {
          startingFeeBps: c.fees.tradingFeeBps,
          endingFeeBps: c.fees.tradingFeeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: c.fees.creatorFeeSharePct,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps25,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: DammV2DynamicFeeMode.Disabled,
        poolFeeBps: 25,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: c.liquidity.partnerLockedPct,
      partnerLiquidityPercentage: c.liquidity.partnerPct,
      creatorPermanentLockedLiquidityPercentage: c.liquidity.creatorLockedPct,
      creatorLiquidityPercentage: c.liquidity.creatorPct,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: c.curve.startMarketCapSol,
    migrationMarketCap: c.curve.graduationMarketCapSol,
    liquidityWeights: c.curve.weights,
  } as BuildParams;
}

export type BuildResult =
  | { ok: true; params: DbcConfigParameters; curve: CurveModel; graduationQuoteLamports: bigint; issues: Issue[] }
  | { ok: false; issues: Issue[] };

/** Validate, then build. SDK throws become Issues so the UI has a single error channel. */
export function buildDbcConfig(c: LaunchConfig): BuildResult {
  const issues = validateLaunchConfig(c);
  if (hasErrors(issues)) return { ok: false, issues };
  try {
    const params = buildCurveWithLiquidityWeights(toBuildParams(c));
    return {
      ok: true,
      params,
      curve: curveModelFromParams(params, c.token.supply),
      graduationQuoteLamports: BigInt(params.migrationQuoteThreshold.toString()),
      issues,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, issues: [...issues, { field: "sdk", severity: "error", message }] };
  }
}

export function curveModelFromParams(p: DbcConfigParameters, supply: number): CurveModel {
  return {
    supply,
    sqrtStart: BigInt(p.sqrtStartPrice.toString()),
    steps: p.curve.map((pt) => ({ sqrtEnd: BigInt(pt.sqrtPrice.toString()), liquidity: BigInt(pt.liquidity.toString()) })),
  };
}
