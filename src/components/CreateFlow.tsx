"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { BrandMark } from "./BrandMark";
import { Copilot } from "./Copilot";
import { AttemptedContext } from "./Field";
import { WalletButton } from "./WalletButton";
import { CurveStep } from "./steps/CurveStep";
import { EconomicsStep } from "./steps/EconomicsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { TokenStep } from "./steps/TokenStep";
import { designContext } from "@/copilot/context";
import { insightsFor, type StepId } from "@/copilot/insights";
import { defaultLaunchConfig, type LaunchConfig } from "@/launch/config";
import { initialSimState, type SimState } from "@/launch/simulate";
import { buildDbcConfig } from "@/launch/toDbc";
import { hasErrors, validateLaunchConfig } from "@/launch/validate";

const STEPS: { id: StepId; label: string; owns: (field: string) => boolean; qa: string[] }[] = [
  { id: "token", label: "Token", owns: (f) => f.startsWith("token."), qa: [] },
  { id: "curve", label: "CurveLab", owns: (f) => f.startsWith("curve.") || f === "sdk", qa: ["what-grad", "shape", "why16", "mcap"] },
  { id: "economics", label: "Fees & liquidity", owns: (f) => f.startsWith("fees.") || f.startsWith("liquidity") || f.startsWith("advanced."), qa: ["locked", "what-grad"] },
  { id: "review", label: "Review", owns: () => false, qa: ["what-grad", "mcap", "locked"] },
];

const STORAGE_KEY = "launchcraft:draft:v1";

export function CreateFlow() {
  const [config, setConfig] = useState<LaunchConfig>(defaultLaunchConfig);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [solUsd, setSolUsd] = useState(150);
  const [highlight, setHighlight] = useState<[number, number] | null>(null);
  const [showingId, setShowingId] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>(initialSimState);
  const [logo, setLogo] = useState<File | null>(null);

  // restore draft (per-viewer convenience only; storage can be unavailable)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // merge over the defaults so drafts saved before a field existed (e.g. token.description) still load
        if (saved?.config?.curve?.weights?.length === 16) {
          const d = defaultLaunchConfig();
          setConfig({ ...d, ...saved.config, token: { ...d.token, ...saved.config.token } });
        }
        if (typeof saved?.solUsd === "number") setSolUsd(saved.solUsd);
      }
    } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, solUsd }));
    } catch {}
  }, [config, solUsd, hydrated]);

  const update = useCallback((mut: (c: LaunchConfig) => void) => {
    setConfig((prev) => {
      const next = structuredClone(prev);
      mut(next);
      return next;
    });
  }, []);

  const issues = useMemo(() => validateLaunchConfig(config), [config]);
  const deferred = useDeferredValue(config);
  const build = useMemo(() => buildDbcConfig(deferred), [deferred]);

  const cur = STEPS[step];
  const stepErrors = (i: number) => issues.filter((x) => x.severity === "error" && STEPS[i].owns(x.field));
  const stepOk = (i: number) => stepErrors(i).length === 0 && (STEPS[i].id !== "curve" || build.ok);
  const allOk = !hasErrors(issues) && build.ok;

  const [attempted, setAttempted] = useState(false);
  const goTo = (i: number) => {
    setAttempted(false);
    setStep(i);
    setFurthest((f) => Math.max(f, i));
    setHighlight(null);
    setShowingId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const insights = useMemo(() => insightsFor(cur.id, { config, build }), [cur.id, config, build]);
  const base = { config, update, issues, build, solUsd, logo, setLogo };

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          <BrandMark /> Launchcraft
        </Link>
        <nav className="stepper" aria-label="Launch steps">
          {STEPS.map((s, i) => (
            <span key={s.id} style={{ display: "contents" }}>
              {i > 0 && <span className="step-sep" />}
              <button
                className={`step-pill ${i === step ? "active" : ""} ${i < step && stepOk(i) ? "done" : ""}`}
                disabled={i > furthest && i > step}
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
              >
                <span className="n">{i < step && stepOk(i) ? "✓" : i + 1}</span>
                <span className="t">{s.label}</span>
              </button>
            </span>
          ))}
        </nav>
        <label className="net-chip" style={{ gap: 6, marginRight: -8 }}>
          <span className="net-dot" /> devnet prototype · SOL ≈ $
          <input
            aria-label="SOL price in USD (display only)"
            className="mono"
            style={{ width: 44, background: "none", border: 0, color: "var(--text)", outline: "none" }}
            value={solUsd}
            inputMode="decimal"
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
              if (Number.isFinite(n)) setSolUsd(n);
            }}
          />
        </label>
        <WalletButton />
      </header>

      <div className="layout">
        <main className="col-main">
          <AttemptedContext.Provider value={attempted}>
            {cur.id === "token" && <TokenStep {...base} />}
            {cur.id === "curve" && <CurveStep {...base} highlight={highlight} sim={sim} setSim={setSim} />}
            {cur.id === "economics" && <EconomicsStep {...base} />}
            {cur.id === "review" && <ReviewStep {...base} highlight={highlight} goTo={goTo} />}
          </AttemptedContext.Provider>

          <div className="footer-nav">
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <button className="btn ghost" disabled={step === 0} onClick={() => goTo(step - 1)}>
                ← Back
              </button>
              <button
                className="link-btn"
                style={{ color: "var(--text-3)" }}
                onClick={() => {
                  if (!window.confirm("Start over? This clears your draft, including the chosen logo.")) return;
                  setConfig(defaultLaunchConfig());
                  setLogo(null);
                  setSim(initialSimState());
                  setFurthest(0);
                  goTo(0);
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {}
                }}
              >
                Start over
              </button>
            </div>
            {step < STEPS.length - 1 ? (
              <button className="btn primary" onClick={() => (stepOk(step) ? goTo(step + 1) : setAttempted(true))}>
                Continue →
              </button>
            ) : (
              <span className="faint" style={{ fontSize: 13 }}>
                {allOk ? "Ready for deployment" : "Some steps need attention"}
              </span>
            )}
          </div>
          {attempted && !stepOk(step) && step < STEPS.length - 1 && (
            <p className="field-msg error" role="alert" style={{ textAlign: "right", margin: "8px 0 0" }}>
              {stepErrors(step)[0]?.message ?? build.issues.find((i) => i.severity === "error")?.message}
            </p>
          )}
        </main>

        <div className="col-side">
          <Copilot
            insights={insights}
            ctx={{ config, build }}
            onShow={setHighlight}
            showingId={showingId}
            setShowingId={setShowingId}
            qaIds={cur.qa}
            getAskContext={() => designContext(config, build, insights.map((i) => i.text), cur.id)}
          />
        </div>
      </div>
    </>
  );
}
