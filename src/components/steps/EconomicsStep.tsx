"use client";

import { Field, NumInput, pick } from "../Field";
import { MIN_LOCKED_LIQUIDITY_PCT } from "@/launch/config";
import type { StepProps } from "./types";

const PARTS = [
  { key: "creatorPct", label: "Creator", color: "#8f7cff", hint: "Liquidity you can claim after graduation." },
  { key: "partnerPct", label: "Partner", color: "#5fb8ff", hint: "Config owner's unlocked share." },
  { key: "creatorLockedPct", label: "Creator · locked", color: "#4ade80", hint: "Permanently locked." },
  { key: "partnerLockedPct", label: "Partner · locked", color: "#2fb872", hint: "Permanently locked." },
] as const;

export function EconomicsStep({ config, update, issues }: StepProps) {
  const l = config.liquidity;
  const sum = l.creatorPct + l.partnerPct + l.creatorLockedPct + l.partnerLockedPct;
  const locked = l.creatorLockedPct + l.partnerLockedPct;
  const liqIssue = pick(issues, "liquidity");

  return (
    <div className="fade-up">
      <div className="eyebrow">Step 3 of 4</div>
      <h1 className="page-title">Fees &amp; liquidity</h1>
      <p className="page-sub">Who earns from trading on the curve, and where the liquidity goes when it graduates to DAMM v2.</p>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Trading fees</span>
        </div>
        <div className="grid-2">
          <Field label="Trading fee" issue={pick(issues, "fees.tradingFeeBps")} hint="Charged in SOL on every buy and sell.">
            {({ id, invalid }) => (
              <NumInput id={id} suffix="%" invalid={invalid} value={config.fees.tradingFeeBps / 100} onChange={(n) => update((c) => void (c.fees.tradingFeeBps = Math.round(n * 100)))} />
            )}
          </Field>
          <Field label="Creator fee share" issue={pick(issues, "fees.creatorFeeSharePct")} hint="Your share of the fee that isn't taken by the protocol.">
            {({ id, invalid }) => <NumInput id={id} suffix="%" invalid={invalid} value={config.fees.creatorFeeSharePct} onChange={(n) => update((c) => void (c.fees.creatorFeeSharePct = n))} />}
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Where liquidity goes at graduation</span>
          <span className={`mono ${Math.abs(sum - 100) < 1e-9 ? "faint" : ""}`} style={{ fontSize: 13, color: Math.abs(sum - 100) < 1e-9 ? undefined : "var(--bad)" }}>
            {sum}% / 100%
          </span>
        </div>

        <div role="img" aria-label="Liquidity split" style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--bg-raise)", border: "1px solid var(--line)" }}>
          {PARTS.map((p) => (
            <div key={p.key} style={{ width: `${Math.max(0, Math.min(100, l[p.key]))}%`, background: p.color, transition: "width .25s" }} title={`${p.label} ${l[p.key]}%`} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "12px 0 18px" }}>
          {PARTS.map((p) => (
            <span key={p.key} className="muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 7 }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} /> {p.label}
            </span>
          ))}
        </div>

        <div className="grid-2">
          {PARTS.map((p) => (
            <Field key={p.key} label={p.label} hint={p.hint}>
              {({ id }) => <NumInput id={id} suffix="%" value={l[p.key]} onChange={(n) => update((c) => void (c.liquidity[p.key] = n))} />}
            </Field>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <span className={`chip ${locked >= MIN_LOCKED_LIQUIDITY_PCT ? "on" : ""}`} style={{ cursor: "default" }}>
            Locked {locked}% · minimum {MIN_LOCKED_LIQUIDITY_PCT}%
          </span>
          {Math.abs(sum - 100) > 1e-9 && (
            <button
              className="btn sm"
              onClick={() =>
                update((c) => {
                  // put the remainder into the creator's unlocked share
                  const rest = c.liquidity.partnerPct + c.liquidity.creatorLockedPct + c.liquidity.partnerLockedPct;
                  c.liquidity.creatorPct = Math.max(0, 100 - rest);
                })
              }
            >
              Balance to 100%
            </button>
          )}
        </div>
        {liqIssue && <p className={`field-msg ${liqIssue.severity}`} style={{ marginTop: 12 }}>{liqIssue.message}</p>}
        <p className="faint" style={{ fontSize: 12.5, margin: "14px 0 0" }}>
          In this prototype creator and partner are the same wallet, so the split matters for locking, not for who receives it.
        </p>
      </div>
    </div>
  );
}
