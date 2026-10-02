"use client";

import { useRef } from "react";
import { CURVE_POINTS } from "@/launch/config";
import { fmtNum } from "@/lib/fmt";

const MAX_W = 5;
const MIN_W = 0.1;

interface Props {
  weights: number[];
  onChange: (w: number[]) => void;
  highlight?: [number, number] | null;
  /** Market cap (SOL) at the start of each step, for the tick labels. */
  stepStartMcap: number[];
}

/** 16 draggable liquidity bars. Press and drag across them to paint a shape; arrow keys nudge a focused bar. */
export function WeightBars({ weights, onChange, highlight, stepStartMcap }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const last = useRef<{ i: number; v: number } | null>(null);

  function locate(e: React.PointerEvent) {
    const r = box.current!.getBoundingClientRect();
    const i = Math.min(CURVE_POINTS - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * CURVE_POINTS)));
    const t = 1 - (e.clientY - r.top) / r.height;
    const v = Math.round(Math.min(MAX_W, Math.max(MIN_W, t * MAX_W)) * 100) / 100;
    return { i, v };
  }

  function paint(e: React.PointerEvent) {
    const { i, v } = locate(e);
    const next = [...weights];
    const prev = last.current;
    if (prev && Math.abs(prev.i - i) > 1) {
      // fast drag: interpolate skipped columns so the shape stays continuous
      const [a, b] = prev.i < i ? [prev, { i, v }] : [{ i, v }, prev];
      for (let k = a.i; k <= b.i; k++) next[k] = Math.round((a.v + ((b.v - a.v) * (k - a.i)) / (b.i - a.i)) * 100) / 100;
    } else next[i] = v;
    last.current = { i, v };
    onChange(next);
  }

  function key(e: React.KeyboardEvent, i: number) {
    const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 0.1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -0.1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = [...weights];
    next[i] = Math.round(Math.min(MAX_W, Math.max(MIN_W, next[i] + d)) * 100) / 100;
    onChange(next);
  }

  return (
    <div>
      <div
        ref={box}
        className="bars"
        onPointerDown={(e) => {
          dragging.current = true;
          last.current = null;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          paint(e);
        }}
        onPointerMove={(e) => dragging.current && paint(e)}
        onPointerUp={() => {
          dragging.current = false;
          last.current = null;
        }}
        onPointerCancel={() => (dragging.current = false)}
      >
        {weights.map((w, i) => (
          <div
            key={i}
            className={`bar-col ${highlight && i >= highlight[0] && i <= highlight[1] ? "hl" : ""}`}
            role="slider"
            tabIndex={0}
            aria-label={`Step ${i + 1} liquidity, starts at ${fmtNum(stepStartMcap[i], 1)} SOL market cap`}
            aria-valuemin={MIN_W}
            aria-valuemax={MAX_W}
            aria-valuenow={w}
            onKeyDown={(e) => key(e, i)}
            title={`Step ${i + 1} · ${fmtNum(stepStartMcap[i], 1)} SOL mcap · weight ${w}`}
          >
            <div className="bar" style={{ height: `${(w / MAX_W) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="bar-ticks" aria-hidden>
        {weights.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
    </div>
  );
}
