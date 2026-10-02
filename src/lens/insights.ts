/**
 * LaunchLens readouts: raw chain state -> plain-language statements. Deterministic and factual;
 * no predictions or advice. Every figure is derived from the live accounts.
 */
import { fmtNum, fmtPct, fmtSol, fmtTokens } from "@/lib/fmt";
import type { DammInfo } from "./migrate";
import type { LaunchLive, LaunchStatic } from "./read";

export interface Read {
  id: string;
  text: string;
  why?: string;
  tone?: "ok" | "warn";
}

export type LaunchStatus = "live" | "complete" | "migrated";

export function statusOf(live: LaunchLive): LaunchStatus {
  return live.isMigrated ? "migrated" : live.curveComplete ? "complete" : "live";
}

/** Relative difference between the designed curve's price and the on-chain price. */
export function modelDrift(live: LaunchLive): number {
  return live.price === 0 ? 0 : Math.abs(live.modelPrice - live.price) / live.price;
}

export function lensReads(st: LaunchStatic, live: LaunchLive, damm?: DammInfo | null): Read[] {
  const out: Read[] = [];
  const feeRate = st.feeBps / 10_000;
  const remaining = Math.max(0, st.thresholdSol - live.quoteReserveSol);
  const status = statusOf(live);

  if (status === "migrated") {
    out.push({
      id: "progress",
      text: damm?.exists
        ? `This launch has graduated. Its liquidity now sits in a Meteora DAMM v2 pool: ${fmtTokens(damm.baseTokens)} tokens and ${fmtSol(damm.quoteSol)}.`
        : "This launch has graduated and its liquidity has migrated to a Meteora DAMM v2 pool.",
      why: "Trading continues on DAMM v2, not on the bonding curve. The pool opened at the graduation price.",
      tone: "ok",
    });
  } else if (status === "complete") {
    out.push({
      id: "progress",
      text: `The curve is complete: ${fmtSol(live.quoteReserveSol)} has been deposited, reaching the ${fmtSol(st.thresholdSol)} threshold.`,
      why: "Trading on the curve has finished. The pool is ready to migrate to Meteora DAMM v2, and anyone can trigger the migration.",
      tone: "ok",
    });
  } else if (live.quoteReserveSol === 0) {
    out.push({
      id: "progress",
      text: `No one has traded yet. ${fmtSol(st.thresholdSol)} must be deposited for this launch to graduate.`,
      why: "Graduation is triggered by SOL deposited on the curve, not by market cap.",
    });
  } else {
    out.push({
      id: "progress",
      text: `${fmtPct(live.progress, live.progress < 0.1 ? 2 : 1)} of the way to graduation. About ${fmtSol(remaining)} more must be deposited${
        feeRate > 0 ? `, roughly ${fmtSol(remaining / (1 - feeRate))} of buying once the ${fmtNum(st.feeBps / 100, 2)}% fee is included` : ""
      }.`,
      why: "Graduation is triggered by SOL deposited on the curve, not by market cap.",
    });
  }

  const mult = live.marketCapSol / st.startMarketCapSol;
  out.push({
    id: "price",
    text:
      live.quoteReserveSol === 0
        ? `The price is at its starting level: a ${fmtSol(st.startMarketCapSol)} market cap.`
        : `Market cap is ${fmtSol(live.marketCapSol)}, ${fmtNum(mult, 2)}× the starting ${fmtSol(st.startMarketCapSol)}.`,
  });

  out.push({
    id: "sold",
    text: `${fmtPct(live.tokensSold / st.supply, 2)} of supply has been sold along the curve.`,
  });

  if (live.fees.totalTradingSol > 0) {
    out.push({
      id: "fees",
      text: `Traders have paid ${fmtSol(live.fees.totalTradingSol)} in fees. Unclaimed: creator ${fmtSol(live.fees.creatorSol)}, partner ${fmtSol(live.fees.partnerSol)}, protocol ${fmtSol(live.fees.protocolSol)}.`,
      why: "Creator and partner shares can be claimed by the config owner. Claiming isn't in Launchcraft yet.",
    });
  }

  const drift = modelDrift(live);
  out.push(
    drift < 0.001
      ? { id: "model", text: "The live price matches the curve you designed.", why: "Launchcraft's curve math and the on-chain price agree.", tone: "ok" }
      : { id: "model", text: `The live price differs from the designed curve by ${fmtPct(drift, 2)}.`, why: "This can happen if the pool was configured outside Launchcraft.", tone: "warn" },
  );
  return out;
}

export function relTime(unixSeconds: number | null, now = Date.now()): string {
  if (!unixSeconds) return "pending";
  const s = Math.max(0, Math.round(now / 1000 - unixSeconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
