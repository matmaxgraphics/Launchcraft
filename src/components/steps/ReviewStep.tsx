"use client";

import { useState } from "react";
import { CurveChart } from "../CurveChart";
import { DeployPanel } from "../DeployPanel";
import { curveBoundaries } from "@/launch/curveMath";
import { PRESETS } from "@/launch/presets";
import { fmtNum, fmtPrice, fmtSol, fmtUsd } from "@/lib/fmt";
import type { StepProps } from "./types";

interface Props extends StepProps {
  highlight: [number, number] | null;
  goTo: (i: number) => void;
}

export function ReviewStep({ config: c, build, issues, solUsd, highlight, goTo, logo }: Props) {
  const [copied, setCopied] = useState(false);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const b = build.ok ? curveBoundaries(build.curve) : null;
  const locked = c.liquidity.creatorLockedPct + c.liquidity.partnerLockedPct;
  const ready = build.ok;

  const checks: { label: string; state: "ok" | "error" | "warning"; detail?: string }[] = [
    { label: "Token details complete", state: errors.some((e) => e.field.startsWith("token.")) ? "error" : "ok" },
    { label: "Curve is valid and builds on Meteora's SDK", state: build.ok ? "ok" : "error", detail: build.ok ? undefined : build.issues.find((i) => i.severity === "error")?.message },
    { label: "Fees within range", state: errors.some((e) => e.field.startsWith("fees.")) ? "error" : "ok" },
    { label: `Liquidity adds to 100% with ${locked}% locked`, state: errors.some((e) => e.field === "liquidity") ? "error" : "ok" },
    { label: "Migrates to Meteora DAMM v2", state: "ok" },
    ...warnings.map((w) => ({ label: w.message, state: "warning" as const })),
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(c, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be blocked; ignore */
    }
  }

  return (
    <div className="fade-up">
      <div className="eyebrow">Step 4 of 4</div>
      <h1 className="page-title">Review your launch</h1>
      <p className="page-sub">Everything below is what will be written on-chain. Check it like you&apos;d check a deploy.</p>

      <div className="card">
        <div className="card-head">
          <span className="card-title">
            {c.token.name || "Untitled"} <span className="faint mono">${c.token.symbol || "—"}</span>
          </span>
          <span className="faint" style={{ fontSize: 12.5 }}>
            {PRESETS[c.curve.preset as keyof typeof PRESETS]?.label ?? "Custom"} curve
          </span>
        </div>
        {build.ok ? <CurveChart curve={build.curve} compact highlight={highlight} solUsd={solUsd} /> : <p className="muted">Fix the issues below to preview your curve.</p>}
      </div>

      <div className="review-grid" style={{ marginTop: 16 }}>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-head">
            <span className="card-title">Token</span>
            <button className="link-btn" onClick={() => goTo(0)}>
              Edit
            </button>
          </div>
          <div className="kv"><span className="k">Supply</span><span className="v">{fmtNum(c.token.supply, 0)}</span></div>
          <div className="kv"><span className="k">Type</span><span className="v">SPL · 6 decimals</span></div>
          <div className="kv"><span className="k">Quote</span><span className="v">SOL</span></div>
          <div className="kv"><span className="k">Authorities</span><span className="v">Immutable</span></div>
          <div className="kv">
            <span className="k">Logo</span>
            <span className="v">{c.token.metadataUri.trim() ? "Your metadata URI" : logo ? `${logo.name} (uploads at launch)` : "None"}</span>
          </div>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-head">
            <span className="card-title">Price discovery</span>
            <button className="link-btn" onClick={() => goTo(1)}>
              Edit
            </button>
          </div>
          <div className="kv"><span className="k">Start market cap</span><span className="v">{fmtSol(c.curve.startMarketCapSol)} · {fmtUsd(c.curve.startMarketCapSol * solUsd)}</span></div>
          <div className="kv"><span className="k">Graduation market cap</span><span className="v">{fmtSol(c.curve.graduationMarketCapSol)} · {fmtUsd(c.curve.graduationMarketCapSol * solUsd)}</span></div>
          <div className="kv"><span className="k">Graduates at</span><span className="v">{b ? fmtSol(b[16].quoteSol) : "—"}</span></div>
          <div className="kv"><span className="k">Start price</span><span className="v">{b ? `${fmtPrice(b[0].price)} SOL` : "—"}</span></div>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-head">
            <span className="card-title">Fees</span>
            <button className="link-btn" onClick={() => goTo(2)}>
              Edit
            </button>
          </div>
          <div className="kv"><span className="k">Trading fee</span><span className="v">{c.fees.tradingFeeBps / 100}%</span></div>
          <div className="kv"><span className="k">Creator share</span><span className="v">{c.fees.creatorFeeSharePct}%</span></div>
          <div className="kv"><span className="k">Fee schedule</span><span className="v">Flat</span></div>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-head">
            <span className="card-title">Liquidity at graduation</span>
            <button className="link-btn" onClick={() => goTo(2)}>
              Edit
            </button>
          </div>
          <div className="kv"><span className="k">Destination</span><span className="v">Meteora DAMM v2</span></div>
          <div className="kv"><span className="k">Creator / locked</span><span className="v">{c.liquidity.creatorPct}% / {c.liquidity.creatorLockedPct}%</span></div>
          <div className="kv"><span className="k">Partner / locked</span><span className="v">{c.liquidity.partnerPct}% / {c.liquidity.partnerLockedPct}%</span></div>
          <div className="kv"><span className="k">Leftover</span><span className="v">{c.advanced.leftoverPct}% of supply</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Pre-flight</span>
          <span className="faint" style={{ fontSize: 12.5 }}>
            {errors.length ? `${errors.length} to fix` : "all checks pass"}
          </span>
        </div>
        {checks.map((k, i) => (
          <div key={i} className={`check ${k.state}`}>
            <span className="ic">{k.state === "ok" ? "✓" : k.state === "warning" ? "!" : "✕"}</span>
            <span>
              {k.label}
              {k.detail && <span className="faint"> — {k.detail}</span>}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <DeployPanel config={c} build={build} logo={logo} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn sm ghost" onClick={copy}>
          {copied ? "Copied ✓" : "Copy config JSON"}
        </button>
        <span className="faint" style={{ fontSize: 12.5 }}>
          {ready ? "Two wallet signatures will be requested." : "Resolve the issues above first."}
        </span>
      </div>

      {build.ok && (
        <details style={{ marginTop: 16 }}>
          <summary>Advanced · derived DBC parameters</summary>
          <pre className="code" style={{ marginTop: 10 }}>
            {JSON.stringify(
              {
                sqrtStartPrice: build.params.sqrtStartPrice.toString(),
                migrationQuoteThreshold_lamports: build.params.migrationQuoteThreshold.toString(),
                curvePoints: build.params.curve.length,
                curve: build.params.curve.map((p) => ({ sqrtPrice: p.sqrtPrice.toString(), liquidity: p.liquidity.toString() })),
              },
              null,
              2,
            )}
          </pre>
        </details>
      )}
    </div>
  );
}
