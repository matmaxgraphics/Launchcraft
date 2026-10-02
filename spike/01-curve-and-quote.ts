/**
 * Launchcraft spike 1 (offline): LaunchConfig-ish input -> DBC curve -> simulated buys/sells.
 * No RPC, no wallet. Proves: curve builder works, pre-pool quotes work, we can derive price + progress.
 */
import BN from "bn.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  MigratedCollectFeeMode,
  DammV2DynamicFeeMode,
  DammV2BaseFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithLiquidityWeights,
  buildCurveWithMarketCap,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { Connection } from "@solana/web3.js";

const base = {
  token: {
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: TokenDecimal.SIX,
    tokenQuoteDecimal: TokenDecimal.NINE, // SOL
    tokenAuthorityOption: TokenAuthorityOption.Immutable,
    totalTokenSupply: 1_000_000_000,
    leftover: 0,
  },
  fee: {
    baseFeeParams: {
      baseFeeMode: BaseFeeMode.FeeSchedulerLinear as const,
      feeSchedulerParam: {
        startingFeeBps: 100,
        endingFeeBps: 100,
        numberOfPeriod: 0,
        totalDuration: 0,
      },
    },
    dynamicFeeEnabled: false,
    collectFeeMode: CollectFeeMode.QuoteToken,
    creatorTradingFeePercentage: 50,
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
    partnerPermanentLockedLiquidityPercentage: 0,
    partnerLiquidityPercentage: 50,
    creatorPermanentLockedLiquidityPercentage: 0,
    creatorLiquidityPercentage: 50,
  },
  lockedVesting: {
    totalLockedVestingAmount: 0,
    numberOfVestingPeriod: 0,
    cliffUnlockAmount: 0,
    totalVestingDuration: 0,
    cliffDurationFromMigrationTime: 0,
  },
  activationType: ActivationType.Timestamp,
};
void DammV2BaseFeeMode;

// initialMarketCap / migrationMarketCap are in QUOTE units (SOL) here.
const INITIAL_MC = 30; // 30 SOL
const MIGRATION_MC = 300; // 300 SOL

const client = DynamicBondingCurveClient.create(new Connection("https://api.devnet.solana.com"), "confirmed");

function describe(name: string, cfg: any) {
  console.log(`\n=== ${name} ===`);
  console.log("curve points:", cfg.curve.length);
  console.log("sqrtStartPrice:", cfg.sqrtStartPrice.toString());
  console.log("migrationQuoteThreshold (lamports):", cfg.migrationQuoteThreshold.toString());
  console.log(
    "curve:",
    cfg.curve.map((c: any) => ({ sqrtPrice: c.sqrtPrice.toString(), liquidity: c.liquidity.toString() })),
  );
}

// price (quote per base, human units) from sqrt price (Q64.64)
function sqrtToPrice(sqrt: BN, baseDec: number, quoteDec: number): number {
  const q = BigInt(sqrt.toString());
  const sq = Number(q) / 2 ** 64;
  return sq * sq * 10 ** (baseDec - quoteDec);
}

function quoteBuy(cfg: any, sol: number) {
  const amountIn = new BN(Math.round(sol * 1e9));
  const q = client.pool.getQuoteFromInputAmount({
    config: cfg,
    swapBaseForQuote: false,
    amountIn,
    slippageBps: 50,
  } as any);
  return q as any;
}

function run(name: string, cfg: any) {
  describe(name, cfg);
  const start = sqrtToPrice(cfg.sqrtStartPrice, 6, 9);
  console.log("start price (SOL/token):", start.toExponential(4));
  for (const sol of [1, 10, 50, 100]) {
    try {
      const q = quoteBuy(cfg, sol);
      console.log(`BUY ${sol} SOL ->`, Object.fromEntries(Object.entries(q).map(([k, v]) => [k, (v as any)?.toString?.() ?? v])));
      if (q.nextSqrtPrice) {
        console.log("   price after:", sqrtToPrice(q.nextSqrtPrice, 6, 9).toExponential(4));
      }
    } catch (e: any) {
      console.log(`BUY ${sol} SOL failed:`, e.message);
    }
  }
}

// A) simplest builder: initial MC + migration MC (single/2-seg default shape)
const simple = buildCurveWithMarketCap({ ...base, initialMarketCap: INITIAL_MC, migrationMarketCap: MIGRATION_MC } as any);
run("buildCurveWithMarketCap", simple);

// B) the one CurveLab needs: user-shaped liquidity weights.
// FINDING: the SDK always slices [startPrice, migrationPrice] into 16 geometric steps
// and requires exactly 16 weights. CurveLab = 16 draggable points.
const N = 16;
const presets: Record<string, number[]> = {
  flat: Array.from({ length: N }, () => 1),
  gradual: Array.from({ length: N }, (_, i) => 1 + i * 0.25), // later steps hold more liquidity
  accelerated: Array.from({ length: N }, (_, i) => Math.max(0.2, 3 - i * 0.18)), // early steps hold more
};
for (const [name, w] of Object.entries(presets)) {
  const cfg = buildCurveWithLiquidityWeights({
    ...base,
    // weighted builder needs headroom: rounding can push required supply above total
    token: { ...base.token, leftover: 50_000_000 },
    initialMarketCap: INITIAL_MC,
    migrationMarketCap: MIGRATION_MC,
    liquidityWeights: w,
  } as any);
  run(`weights:${name}`, cfg);
}
