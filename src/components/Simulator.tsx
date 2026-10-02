"use client";

import { useEffect, useMemo, useState } from "react";
import { graduationQuoteSol, stateAtQuote, type CurveModel } from "@/launch/curveMath";
import { initialSimState, simulateBuy, simulateSell, type SimState, type TradeResult } from "@/launch/simulate";
import { fmtNum, fmtPct, fmtPrice, fmtSol, fmtTokens, fmtUsd } from "@/lib/fmt";

interface Props {
  curve: CurveModel;
  feeBps: number;
  solUsd: number;
  sim: SimState;
  onSim: (s: SimState) => void;
}

interface LogRow {
  id: number;
  side: "buy" | "sell";
  left: string;
  right: string;
}

export function Simulator({ curve, feeBps, solUsd, sim, onSim }: Props) {
  const [amount, setAmount] = useState("5");
  const [log, setLog] = useState<LogRow[]>([]);
  const [last, setLast] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feesPaid, setFeesPaid] = useState(0);
  const [seq, setSeq] = useState(1);

  // Any change to the curve invalidates earlier trades.
  useEffect(() => {
    onSim(initialSimState());
    setLog([]);
    setLast(null);
    setFeesPaid(0);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, feeBps]);

  const total = useMemo(() => graduationQuoteSol(curve), [curve]);
  const now = useMemo(() => stateAtQuote(curve, sim.quoteSol), [curve, sim.quoteSol]);
  const progress = sim.quoteSol / total;
  const graduated = progress >= 0.99999;
  const sol = Number(amount);

  function apply(t: TradeResult) {
    onSim(t.next);
    setLast(t);
    setFeesPaid((f) => f + t.feeSol);
    setError(null);
    setLog((l) =>
      [
        {
          id: seq,
          side: t.side,
          left: t.side === "buy" ? `${fmtSol(t.solIn)} → ${fmtTokens(t.tokensOut)} tokens` : `${fmtTokens(t.tokensIn)} tokens → ${fmtSol(t.solOut)}`,
          right: `${fmtNum(t.marketCapAfterSol, 1)} SOL mcap`,
        } as LogRow,
        ...l,
      ].slice(0, 30),
    );
    setSeq((s) => s + 1);
  }

  function buy(v: number) {
    try {
      if (graduated) throw new Error("The curve has graduated; nothing left to buy.");
      apply(simulateBuy(curve, sim, v, feeBps));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function sellPct(p: number) {
    try {
      apply(simulateSell(curve, sim, sim.tokensSold * p, feeBps));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function reset() {
    onSim(initialSimState());
    setLog([]);
    setLast(null);
    setFeesPaid(0);
    setError(null);
  }

  return (
    <div className="sim-grid">
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Trade against your curve
        </div>
        <div className="field">
          <label htmlFor="sim-amt">Buy amount</label>
          <div className="input-wrap">
            <input
              id="sim-amt"
              className="input has-suffix mono"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && sol > 0 && buy(sol)}
            />
            <span className="suffix">SOL</span>
          </div>
        </div>
        <div className="preset-row" style={{ marginTop: 10 }}>
          {[1, 5, 10, 25, 50].map((v) => (
            <button key={v} className="chip" onClick={() => setAmount(String(v))}>
              {v}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn accent" disabled={!(sol > 0) || graduated} onClick={() => buy(sol)}>
            Buy {sol > 0 ? fmtNum(sol, 2) : ""} SOL
          </button>
          {[0.25, 0.5, 1].map((p) => (
            <button key={p} className="btn sm" disabled={sim.tokensSold <= 0} onClick={() => sellPct(p)}>
              Sell {p * 100}%
            </button>
          ))}
          <button className="btn sm ghost" onClick={reset} disabled={!log.length}>
            Reset
          </button>
        </div>
        {error && (
          <p className="field-msg error" style={{ marginTop: 10 }} role="alert">
            {error}
          </p>
        )}
        {last && last.refundSol > 1e-9 && (
          <p className="field-msg warning" style={{ marginTop: 10 }}>
            Only {fmtSol(last.solIn)} fit before graduation; {fmtSol(last.refundSol)} would be returned.
          </p>
        )}

        <div className="log" aria-live="polite">
          {log.length === 0 && <span className="faint" style={{ fontSize: 13 }}>No trades yet. Changing the curve resets the simulation.</span>}
          {log.map((r) => (
            <div key={r.id} className="log-row">
              <span className={`tag ${r.side}`}>{r.side}</span>
              <span className="mono">{r.left}</span>
              <span className="faint mono">{r.right}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Curve state
        </div>
        <div className="kv">
          <span className="k">Market cap</span>
          <span className="v">
            {fmtSol(now.marketCapSol)} <span className="faint">· {fmtUsd(now.marketCapSol * solUsd)}</span>
          </span>
        </div>
        <div className="kv">
          <span className="k">Price</span>
          <span className="v">{fmtPrice(now.price)} SOL</span>
        </div>
        <div className="kv">
          <span className="k">SOL on curve</span>
          <span className="v">
            {fmtNum(sim.quoteSol, 2)} / {fmtNum(total, 1)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Tokens sold</span>
          <span className="v">{fmtTokens(sim.tokensSold)}</span>
        </div>
        <div className="kv">
          <span className="k">Fees paid</span>
          <span className="v">{fmtSol(feesPaid)}</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
            <span className="muted">Progress to graduation</span>
            <span className="mono">{fmtPct(progress)}</span>
          </div>
          <div className={`progress ${graduated ? "done" : ""}`} role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
          <p className="faint" style={{ fontSize: 12, margin: "8px 0 0" }}>
            Tracks SOL deposited, not market cap.
          </p>
        </div>

        {graduated && (
          <div className="fade-up" style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "var(--ok-soft)", border: "1px solid rgba(74,222,128,.3)" }}>
            <b style={{ color: "var(--ok)" }}>Graduated</b>
            <div className="mono" style={{ fontSize: 12.5, marginTop: 6 }}>
              DBC curve → migration → Meteora DAMM v2 pool
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
