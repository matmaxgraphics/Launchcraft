export function fmtNum(n: number, max = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}

/** SOL amount with sensible precision: 83 SOL, 4.21 SOL, 0.0031 SOL. */
export function fmtSol(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const d = a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 4 : 6;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: d })} SOL`;
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
  if (n >= 10_000) return `$${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Token price in SOL; these are tiny, so use a plain decimal with 3 significant figures. */
export function fmtPrice(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "—";
  const exp = Math.floor(Math.log10(p));
  const decimals = Math.min(14, Math.max(2, 2 - exp));
  return p.toFixed(decimals);
}

export const fmtPct = (ratio: number, d = 1) => `${(ratio * 100).toFixed(d)}%`;
export const fmtTokens = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(0);
