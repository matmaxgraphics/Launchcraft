"use client";

import { useMemo } from "react";
import { CurveChart } from "../CurveChart";
import { Field, NumInput, pick } from "../Field";
import { Simulator } from "../Simulator";
import { WeightBars } from "../WeightBars";
import { curveBoundaries } from "@/launch/curveMath";
import { matchPreset, PRESETS, presetWeights } from "@/launch/presets";
import type { SimState } from "@/launch/simulate";
import { fmtNum, fmtPct, fmtSol, fmtUsd } from "@/lib/fmt";
import type { StepProps } from "./types";

interface Props extends StepProps {
  highlight: [number, number] | null;
  sim: SimState;
  setSim: (s: SimState) => void;
}

export function CurveStep({ config, update, issues, build, solUsd, highlight, sim, setSim }: Props) {
  const c = config.curve;
  const boundaries = useMemo(() => (build.ok ? curveBoundaries(build.curve) : null), [build]);
  const stepStarts = useMemo(() => {
    // before a valid build exists, fall back to the geometric progression from the inputs
    const r = Math.pow(c.graduationMarketCapSol / c.startMarketCapSol, 1 / 16);
    return Array.from({ length: 16 }, (_, i) => c.startMarketCapSol * Math.pow(r, i));
  }, [c.graduationMarketCapSol, c.startMarketCapSol]);

  const setWeights = (w: number[]) =>
    update((x) => {
      x.curve.weights = w;
      x.curve.preset = matchPreset(w);
    });

  return (
    <div className="fade-up">
      <div className="eyebrow">Step 2 of 4 · CurveLab</div>
      <h1 className="page-title">Shape your price discovery</h1>
      <p className="page-sub">
        The curve shows how market cap climbs as SOL flows in. Paint the bars below to decide where liquidity is deep and where it&apos;s thin.
      </p>

      <div className="metrics" style={{ marginBottom: 16 }}>
        <div className="metric">
          <div className="k">Graduates at</div>
          <div className="v">{build.ok && boundaries ? fmtSol(boundaries[16].quoteSol) : "—"}</div>
          <div className="s">deposited · from your curve</div>
        </div>
        <div className="metric">
          <div className="k">Starting market cap</div>
          <div className="v">{fmtSol(c.startMarketCapSol)}</div>
          <div className="s">{fmtUsd(c.startMarketCapSol * solUsd)}</div>
        </div>
        <div className="metric">
          <div className="k">Graduation market cap</div>
          <div className="v">{fmtSol(c.graduationMarketCapSol)}</div>
          <div className="s">{fmtUsd(c.graduationMarketCapSol * solUsd)}</div>
        </div>
        <div className="metric">
          <div className="k">Supply sold on curve</div>
          <div className="v">{build.ok && boundaries ? fmtPct(boundaries[16].tokensSold / config.token.supply, 0) : "—"}</div>
          <div className="s">by graduation</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Curve</span>
          <span className="faint" style={{ fontSize: 12.5 }}>
            hover to inspect · a wider step takes more SOL to climb
          </span>
        </div>
        {build.ok ? (
          <CurveChart curve={build.curve} highlight={highlight} sim={sim} solUsd={solUsd} />
        ) : (
          <div style={{ padding: "60px 0", textAlign: "center" }} className="muted">
            {build.issues.find((i) => i.severity === "error")?.message ?? "Fix the highlighted fields to draw your curve."}
          </div>
        )}

        <hr className="hr" />

        <div className="preset-row" style={{ marginBottom: 14 }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>
            Liquidity per step
          </span>
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((id) => (
            <button
              key={id}
              className={`chip ${c.preset === id ? "on" : ""}`}
              title={PRESETS[id].blurb}
              onClick={() =>
                update((x) => {
                  x.curve.weights = presetWeights(id);
                  x.curve.preset = id;
                })
              }
            >
              {PRESETS[id].label}
            </button>
          ))}
          {c.preset === "custom" && <span className="chip on">Custom</span>}
          <span className="sp" />
          <span className="faint" style={{ fontSize: 12.5 }}>
            {c.preset !== "custom" ? PRESETS[c.preset].blurb : "Your own shape."}
          </span>
        </div>
        <WeightBars weights={c.weights} onChange={setWeights} highlight={highlight} stepStartMcap={stepStarts} />
        <p className="faint" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          Steps 1 → 16 run from {fmtNum(stepStarts[0], 0)} SOL to {fmtNum(c.graduationMarketCapSol, 0)} SOL market cap. Drag across the bars to paint, or focus one and use the arrow keys.
        </p>
        {pick(issues, "curve.weights") && <p className={`field-msg ${pick(issues, "curve.weights")!.severity}`}>{pick(issues, "curve.weights")!.message}</p>}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Range</span>
        </div>
        <div className="grid-2">
          <Field label="Starting market cap" issue={pick(issues, "curve.startMarketCapSol")} hint={`≈ ${fmtUsd(c.startMarketCapSol * solUsd)} at the SOL price you set above`}>
            {({ id, invalid }) => <NumInput id={id} suffix="SOL" invalid={invalid} value={c.startMarketCapSol} onChange={(n) => update((x) => void (x.curve.startMarketCapSol = n))} />}
          </Field>
          <Field label="Graduation market cap" issue={pick(issues, "curve.graduationMarketCapSol")} hint={`≈ ${fmtUsd(c.graduationMarketCapSol * solUsd)} · the top of the curve`}>
            {({ id, invalid }) => <NumInput id={id} suffix="SOL" invalid={invalid} value={c.graduationMarketCapSol} onChange={(n) => update((x) => void (x.curve.graduationMarketCapSol = n))} />}
          </Field>
        </div>
        {pick(issues, "sdk") && <p className="field-msg error" style={{ marginTop: 12 }}>{pick(issues, "sdk")!.message}</p>}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Try the launch</span>
          <span className="faint" style={{ fontSize: 12.5 }}>
            simulated · nothing is signed
          </span>
        </div>
        {build.ok ? (
          <Simulator curve={build.curve} feeBps={config.fees.tradingFeeBps} solUsd={solUsd} sim={sim} onSim={setSim} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            The simulator unlocks once your curve is valid.
          </p>
        )}
      </div>
    </div>
  );
}
