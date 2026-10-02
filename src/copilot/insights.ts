/**
 * Launch Copilot (prototype): deterministic, factual readouts derived from the real config + curve math.
 * Rules it follows: state what the configuration IS and DOES; never recommend values or predict outcomes.
 * An LLM can later rephrase these, but the numbers always come from here.
 */
import { curveBoundaries, stateAtQuote } from "@/launch/curveMath";
import type { LaunchConfig } from "@/launch/config";
import type { BuildResult } from "@/launch/toDbc";
import { fmtNum, fmtPct, fmtSol } from "@/lib/fmt";

export type StepId = "token" | "curve" | "economics" | "review";

export interface Insight {
  id: string;
  text: string;
  why?: string;
  /** Inclusive range of curve steps (0-15) to highlight when the user clicks "Show me". */
  highlight?: [number, number];
}

export interface QA {
  id: string;
  q: string;
  a: (ctx: Ctx) => string;
}

export interface Ctx {
  config: LaunchConfig;
  build: BuildResult;
}

export function insightsFor(step: StepId, ctx: Ctx): Insight[] {
  const { config: c, build } = ctx;
  const out: Insight[] = [];

  if (step === "token") {
    out.push({
      id: "tok-fixed",
      text: "Your token is a standard SPL token with 6 decimals and no mint or update authority after launch.",
      why: "Launchcraft v1 keeps token settings fixed so every launch behaves the same way on-chain.",
    });
    out.push({
      id: "tok-supply",
      text: `Total supply is ${fmtNum(c.token.supply, 0)} tokens.`,
      why: "Supply and the market-cap targets together set the token price at launch and at graduation.",
    });
    return out;
  }

  if (!build.ok) {
    const first = build.issues.find((i) => i.severity === "error");
    out.push({
      id: "invalid",
      text: first ? first.message : "Complete the highlighted fields to see a readout of your launch.",
      why: "The Copilot reads your curve once the configuration is valid.",
    });
    return out;
  }

  const b = curveBoundaries(build.curve);
  const total = b[16].quoteSol;
  const first4 = b[4].quoteSol / total;
  const last4 = (b[16].quoteSol - b[12].quoteSol) / total;

  if (step === "curve" || step === "review") {
    out.push({
      id: "grad",
      text: `Graduation happens when ${fmtSol(total)} has been deposited on the curve.`,
      why: "That number is derived from your curve shape and market-cap range; it isn't entered directly. Graduation is triggered by SOL deposited, not by market cap.",
    });

    if (last4 >= 0.4) {
      out.push({
        id: "depth",
        text: `${fmtPct(last4, 0)} of the SOL needed to graduate is absorbed in the last four price steps.`,
        why: "Where liquidity is deeper, the same amount of SOL moves the price less. Your top steps are the deepest.",
        highlight: [12, 15],
      });
    } else if (first4 >= 0.4) {
      out.push({
        id: "depth",
        text: `${fmtPct(first4, 0)} of the SOL needed to graduate is absorbed in the first four price steps.`,
        why: "Early steps are your deepest, so early buys move the price less and later buys move it more.",
        highlight: [0, 3],
      });
    } else {
      out.push({
        id: "depth",
        text: `${fmtPct(first4, 0)} of the SOL needed to graduate is absorbed in the first four price steps and ${fmtPct(last4, 0)} in the last four.`,
        why: "Even with equal liquidity per step, higher steps take more SOL to climb, because each step is a bigger move in absolute price.",
        highlight: [12, 15],
      });
    }

    const feeNet = 1 - c.fees.tradingFeeBps / 10_000;
    const probe = Math.min(10 * feeNet, total);
    const after = stateAtQuote(build.curve, probe);
    const startMc = b[0].marketCapSol;
    out.push({
      id: "first10",
      text: `The first ${fmtNum(probe / feeNet, 0)} SOL of buying moves market cap from ${fmtSol(startMc)} to ${fmtSol(after.marketCapSol)} (${fmtPct(after.marketCapSol / startMc - 1, 0)} up).`,
      why: "This is a simulated figure from your curve, after the trading fee. Try your own amounts in the simulator.",
      highlight: [0, Math.max(0, Math.min(15, Math.ceil(stepIndexAtQuote(b, probe))))],
    });

    out.push({
      id: "ratio",
      text: `Graduation market cap is ${fmtNum(c.curve.graduationMarketCapSol / c.curve.startMarketCapSol, 1)}× the starting market cap.`,
    });

    out.push({
      id: "sold",
      text: `${fmtPct(b[16].tokensSold / c.token.supply, 1)} of total supply is sold along the curve by the time it graduates.`,
      why: `${c.advanced.leftoverPct}% of supply is held back as leftover; the remainder is used for liquidity at graduation.`,
    });
  }

  if (step === "economics" || step === "review") {
    const fee = c.fees.tradingFeeBps / 100;
    const protoShare = 0.2; // observed in SDK quotes: protocol fee = 20% of the fee at 1%
    const creatorOfVolume = fee * (1 - protoShare) * (c.fees.creatorFeeSharePct / 100);
    out.push({
      id: "fee",
      text: `Every trade pays a ${fee}% fee in SOL. About ${fmtNum(creatorOfVolume, 2)}% of trading volume would go to the creator share.`,
      why: `In Meteora SDK quotes, roughly 20% of each fee goes to the protocol; the rest is split ${c.fees.creatorFeeSharePct}% creator / ${100 - c.fees.creatorFeeSharePct}% partner.`,
    });
    const locked = c.liquidity.creatorLockedPct + c.liquidity.partnerLockedPct;
    out.push({
      id: "locked",
      text: `${locked}% of the liquidity moved to the DAMM v2 pool at graduation is permanently locked.`,
      why: "Meteora requires at least 10% to be locked at day 1. Locked liquidity can't be withdrawn.",
    });
    out.push({
      id: "owners",
      text: "In this prototype the creator and the partner (config owner) are the same wallet.",
      why: "A platform can run as the partner and collect the partner share. Launchcraft uses your wallet for both in v1.",
    });
  }

  return out;
}

function stepIndexAtQuote(b: ReturnType<typeof curveBoundaries>, q: number) {
  for (let i = 1; i < b.length; i++) if (q <= b[i].quoteSol) return i - 1;
  return 15;
}

export const QA_LIST: QA[] = [
  {
    id: "what-grad",
    q: "What is graduation?",
    a: ({ build }) =>
      `While trading happens on the bonding curve, the pool is virtual. Once enough SOL has been deposited to reach the migration threshold${
        build.ok ? ` (${fmtSol(Number(build.graduationQuoteLamports) / 1e9)} for your curve)` : ""
      }, the curve is complete and the pool's liquidity is migrated to a Meteora <b>DAMM v2</b> pool.`,
  },
  {
    id: "shape",
    q: "What does the curve shape do?",
    a: () =>
      "The price range is cut into <b>16 steps</b>. Each bar sets how much liquidity sits in that step. More liquidity in a step means a given amount of SOL moves the price <b>less</b> there; less liquidity means it moves the price <b>more</b>.",
  },
  {
    id: "why16",
    q: "Why 16 points?",
    a: () =>
      "Meteora's curve builder divides the range between your starting and graduation prices into 16 geometric steps, so the curve is always edited as 16 liquidity weights.",
  },
  {
    id: "mcap",
    q: "Is graduation based on market cap?",
    a: () =>
      "No. Graduation is triggered by the quote reserve (SOL on the curve) reaching the threshold. Market cap is shown for context, but the progress bar tracks SOL deposited.",
  },
  {
    id: "locked",
    q: "What is locked liquidity?",
    a: () =>
      "A share of the liquidity migrated to DAMM v2 is permanently locked and can't be withdrawn. Meteora requires at least <b>10%</b> to be locked on day 1.",
  },
];
