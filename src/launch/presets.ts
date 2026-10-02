import { CURVE_POINTS, type CurvePresetId } from "./config";

/**
 * Presets are UX shortcuts, not Meteora strategies. Each is just a 16-weight array.
 * Weight at index i = relative liquidity (token depth) in price step i.
 * More liquidity in a step => price moves less per SOL there.
 */
const idx = () => Array.from({ length: CURVE_POINTS }, (_, i) => i);

export const PRESETS: Record<Exclude<CurvePresetId, "custom">, { label: string; blurb: string; weights: number[] }> = {
  flat: {
    label: "Flat",
    blurb: "Even liquidity across every price step.",
    weights: idx().map(() => 1),
  },
  gradual: {
    label: "Gradual",
    blurb: "Deeper liquidity at higher prices, so late buyers see calmer price moves.",
    weights: idx().map((i) => 1 + i * 0.25),
  },
  balanced: {
    label: "Balanced",
    blurb: "Mild extra depth toward the top of the curve.",
    weights: idx().map((i) => 1 + i * 0.1),
  },
  accelerated: {
    label: "Accelerated",
    blurb: "Deeper liquidity early, so price climbs faster toward graduation.",
    weights: idx().map((i) => Math.max(0.2, 3 - i * 0.18)),
  },
};

export function presetWeights(id: Exclude<CurvePresetId, "custom">): number[] {
  return [...PRESETS[id].weights];
}

/** Detects whether weights still match a preset (ratios), so the UI can show "Custom" after a drag. */
export function matchPreset(weights: number[]): CurvePresetId {
  const norm = (w: number[]) => {
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / s);
  };
  const nw = norm(weights);
  for (const [id, p] of Object.entries(PRESETS)) {
    const np = norm(p.weights);
    if (np.length === nw.length && np.every((x, i) => Math.abs(x - nw[i]) < 1e-9)) return id as CurvePresetId;
  }
  return "custom";
}
