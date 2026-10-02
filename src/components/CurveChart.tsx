"use client";

import { useId, useMemo, useRef, useState } from "react";
import { curveBoundaries, graduationQuoteSol, stateAtQuote, type CurveModel } from "@/launch/curveMath";
import type { SimState } from "@/launch/simulate";
import { fmtNum, fmtPct, fmtPrice, fmtSol, fmtUsd } from "@/lib/fmt";

interface Props {
  curve: CurveModel;
  /** Inclusive step range (0-15) to highlight. */
  highlight?: [number, number] | null;
  sim?: SimState | null;
  solUsd?: number;
  compact?: boolean;
}

const W = 860;
const M = { l: 62, r: 22, t: 30, b: 38 };

/**
 * x = share of the graduation threshold (SOL deposited), y = market cap on a LOG axis.
 * On a log axis all 16 geometric price steps have equal height, so each step's *width*
 * is exactly how much SOL it takes to climb it: wide = deep liquidity, narrow = thin.
 */
export function CurveChart({ curve, highlight, sim, solUsd, compact }: Props) {
  const gid = useId().replace(/:/g, "");
  const H = compact ? 250 : 340;
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null); // progress 0-1

  const geo = useMemo(() => {
    const b = curveBoundaries(curve);
    const total = graduationQuoteSol(curve);
    const mcMin = b[0].marketCapSol;
    const mcMax = b[16].marketCapSol;
    const X = (p: number) => M.l + p * (W - M.l - M.r);
    const Y = (mc: number) => {
      const t = Math.log(mc / mcMin) / Math.log(mcMax / mcMin);
      return H - M.b - Math.min(1, Math.max(0, t)) * (H - M.t - M.b);
    };
    const N = 180;
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      pts.push([X(p), Y(stateAtQuote(curve, p * total).marketCapSol)]);
    }
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return { b, total, mcMin, mcMax, X, Y, line, area: `${line} L ${X(1)} ${H - M.b} L ${X(0)} ${H - M.b} Z` };
  }, [curve, H]);

  const { b, total, X, Y } = geo;
  const hoverState = hover == null ? null : stateAtQuote(curve, hover * total);
  const simState = sim && sim.quoteSol > 0 ? stateAtQuote(curve, sim.quoteSol) : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.min(1, Math.max(0, (px - M.l) / (W - M.l - M.r))));
  }

  const yTicks = [0, 0.5, 1].map((t) => ({ t, mc: geo.mcMin * Math.pow(geo.mcMax / geo.mcMin, t) }));
  const hl = highlight ? { x1: X(b[highlight[0]].quoteSol / total), x2: X(b[highlight[1] + 1].quoteSol / total) } : null;

  return (
    <div className="curve-wrap">
      <svg
        ref={ref}
        className="curve-svg"
        viewBox={`0 0 ${W} ${H}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Bonding curve: market cap against SOL deposited"
      >
        <defs>
          <linearGradient id={`s${gid}`} x1="0" x2="1">
            <stop offset="0" stopColor="#8f7cff" />
            <stop offset="1" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id={`f${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8f7cff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#8f7cff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* y grid */}
        {yTicks.map(({ t, mc }) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={Y(mc)} y2={Y(mc)} stroke="#1c1c21" strokeDasharray={t === 0 || t === 1 ? "0" : "3 5"} />
            <text className="axis-label" x={M.l - 10} y={Y(mc) + 4} textAnchor="end">
              {fmtNum(mc, mc < 100 ? 0 : 0)}
            </text>
          </g>
        ))}
        <text className="axis-label" x={4} y={11} textAnchor="start">
          Market cap (SOL, log scale)
        </text>

        {/* step boundaries: the 16 columns */}
        {b.map((p, i) => (
          <line key={i} x1={X(p.quoteSol / total)} x2={X(p.quoteSol / total)} y1={M.t} y2={H - M.b} stroke="#17171b" />
        ))}

        {hl && <rect x={hl.x1} y={M.t} width={hl.x2 - hl.x1} height={H - M.t - M.b} fill="rgba(245,184,75,0.10)" stroke="rgba(245,184,75,0.35)" />}

        <path d={geo.area} fill={`url(#f${gid})`} />
        <path d={geo.line} fill="none" stroke={`url(#s${gid})`} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />

        {/* x axis */}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="#2a2a31" />
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <text key={p} className="axis-label" x={X(p)} y={H - 14} textAnchor={p === 0 ? "start" : p === 1 ? "end" : "middle"}>
            {p === 0 ? "0 SOL" : p === 1 ? fmtSol(total) : fmtNum(p * total, 0)}
          </text>
        ))}

        {/* endpoints */}
        <circle cx={X(0)} cy={Y(geo.mcMin)} r={4} fill="#8f7cff" />
        <circle cx={X(1)} cy={Y(geo.mcMax)} r={5} fill="#4ade80" />
        <circle cx={X(1)} cy={Y(geo.mcMax)} r={11} fill="#4ade80" opacity={0.15} />

        {simState && (
          <g>
            <line x1={X(sim!.quoteSol / total)} x2={X(sim!.quoteSol / total)} y1={Y(simState.marketCapSol)} y2={H - M.b} stroke="#fff" strokeOpacity={0.35} strokeDasharray="2 4" />
            <circle cx={X(sim!.quoteSol / total)} cy={Y(simState.marketCapSol)} r={6} fill="#fff" />
            <circle cx={X(sim!.quoteSol / total)} cy={Y(simState.marketCapSol)} r={13} fill="#fff" opacity={0.14} />
          </g>
        )}

        {hoverState && hover != null && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={M.t} y2={H - M.b} stroke="#8f7cff" strokeOpacity={0.5} />
            <circle cx={X(hover)} cy={Y(hoverState.marketCapSol)} r={4.5} fill="#0a0a0c" stroke="#b7a9ff" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hoverState && hover != null && (
        <div className="curve-tip" style={{ left: `${(X(hover) / W) * 100}%`, top: `${(Y(hoverState.marketCapSol) / H) * 100}%` }}>
          <div className="faint">After {fmtSol(hover * total)} deposited</div>
          <div>
            Market cap <b>{fmtSol(hoverState.marketCapSol)}</b>
            {solUsd ? <span className="faint"> · {fmtUsd(hoverState.marketCapSol * solUsd)}</span> : null}
          </div>
          <div className="faint">
            Price <b>{fmtPrice(hoverState.price)}</b> SOL · {fmtPct(hover, 0)} to graduation
          </div>
        </div>
      )}
    </div>
  );
}
