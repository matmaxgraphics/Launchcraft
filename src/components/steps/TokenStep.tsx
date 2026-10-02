"use client";

import { Field, NumInput, pick } from "../Field";
import type { StepProps } from "./types";

export function TokenStep({ config, update, issues }: StepProps) {
  return (
    <div className="fade-up">
      <div className="eyebrow">Step 1 of 4</div>
      <h1 className="page-title">Name your token</h1>
      <p className="page-sub">The basics. Everything about how it trades comes next.</p>

      <div className="card">
        <div className="grid-2">
          <Field label="Name" issue={pick(issues, "token.name")} hint="Shown in wallets and explorers.">
            {({ id, invalid }) => (
              <input
                id={id}
                className={`input ${invalid ? "err" : ""}`}
                placeholder="Signal"
                maxLength={40}
                value={config.token.name}
                onChange={(e) => update((c) => void (c.token.name = e.target.value))}
              />
            )}
          </Field>
          <Field label="Symbol" issue={pick(issues, "token.symbol")} hint="Up to 10 characters.">
            {({ id, invalid }) => (
              <input
                id={id}
                className={`input mono ${invalid ? "err" : ""}`}
                placeholder="SIG"
                maxLength={12}
                value={config.token.symbol}
                onChange={(e) => update((c) => void (c.token.symbol = e.target.value.toUpperCase()))}
              />
            )}
          </Field>
        </div>
        <hr className="hr" />
        <div className="grid-2">
          <Field label="Total supply" issue={pick(issues, "token.supply")} hint="Whole tokens. 1,000,000,000 is a common choice.">
            {({ id, invalid }) => <NumInput id={id} value={config.token.supply} invalid={invalid} onChange={(n) => update((c) => void (c.token.supply = Math.round(n)))} />}
          </Field>
          <div className="field">
            <label>Quote asset</label>
            <div className="input" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#9945ff,#14f195)" }} />
              SOL
              <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>
                fixed in v1
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Metadata</span>
          <span className="faint" style={{ fontSize: 12.5 }}>
            optional for now
          </span>
        </div>
        <Field label="Metadata URI" issue={pick(issues, "token.metadataUri")} hint="Points to the JSON with your logo and description. Image upload arrives with deployment.">
          {({ id }) => (
            <input
              id={id}
              className="input mono"
              placeholder="https://…/signal.json"
              value={config.token.metadataUri}
              onChange={(e) => update((c) => void (c.token.metadataUri = e.target.value))}
            />
          )}
        </Field>
        <hr className="hr" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["SPL token", "6 decimals", "No mint authority", "Metadata immutable"].map((t) => (
            <span key={t} className="chip" style={{ cursor: "default" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
