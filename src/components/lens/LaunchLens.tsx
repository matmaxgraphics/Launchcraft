"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "../AppHeader";
import { AskBox } from "../AskBox";
import { liveContext } from "@/copilot/context";
import { CurveChart } from "../CurveChart";
import { EarningsPanel } from "./EarningsPanel";
import { MigrationPanel } from "./MigrationPanel";
import { TradePanel } from "./TradePanel";
import { fetchDammInfo, type DammInfo } from "@/lens/migrate";
import { explorerAddress, explorerTx, getConnection, shortAddr } from "@/deploy/rpc";
import { lensReads, relTime, statusOf } from "@/lens/insights";
import { fetchActivity, fetchLaunchLive, fetchLaunchStatic, fetchTokenBalance, fetchTokenImage, parseAddress, type ActivityRow, type LaunchLive, type LaunchStatic } from "@/lens/read";
import { fmtNum, fmtPct, fmtPrice, fmtSol, fmtTokens, fmtUsd } from "@/lib/fmt";
import { useWallet } from "@/wallet/WalletContext";
import { PublicKey } from "@solana/web3.js";

const POLL_MS = 6000;
const SOLUSD_KEY = "launchcraft:solusd:v1";

export function LaunchLens({ poolAddress }: { poolAddress: string }) {
  const { wallet } = useWallet();
  const [st, setSt] = useState<LaunchStatic | null>(null);
  const [live, setLive] = useState<LaunchLive | null>(null);
  const [damm, setDamm] = useState<DammInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [holdings, setHoldings] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [solUsd, setSolUsd] = useState(150);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  const stRef = useRef<LaunchStatic | null>(null);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(SOLUSD_KEY));
      if (v > 0) setSolUsd(v);
    } catch {}
  }, []);
  const saveUsd = (n: number) => {
    setSolUsd(n);
    try {
      localStorage.setItem(SOLUSD_KEY, String(n));
    } catch {}
  };

  // static read, once per address
  useEffect(() => {
    let cancelled = false;
    setSt(null);
    setLive(null);
    setError(null);
    const pk = parseAddress(poolAddress);
    if (!pk) {
      setError("That doesn't look like a valid Solana address.");
      return;
    }
    fetchLaunchStatic(getConnection(), pk)
      .then((s) => {
        if (cancelled) return;
        stRef.current = s;
        setSt(s);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [poolAddress, attempt]);

  // The logo comes from the metadata JSON; it never blocks the dashboard, and failing just means no image.
  useEffect(() => {
    setLogoUrl(null);
    if (!st) return;
    let cancelled = false;
    fetchTokenImage(st.metadataUri).then((u) => !cancelled && setLogoUrl(u));
    return () => {
      cancelled = true;
    };
  }, [st]);

  // The public devnet RPC can stall; after a while offer a retry instead of an endless spinner.
  useEffect(() => {
    setSlow(false);
    if (st || error) return;
    const t = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(t);
  }, [st, error, attempt]);

  const refresh = useCallback(async () => {
    const s = stRef.current;
    if (!s) return;
    try {
      const conn = getConnection();
      const [l, a, h] = await Promise.all([
        fetchLaunchLive(conn, s),
        fetchActivity(conn, new PublicKey(s.pool)),
        wallet ? fetchTokenBalance(conn, wallet.publicKey, new PublicKey(s.baseMint)) : Promise.resolve(0),
      ]);
      setLive(l);
      setActivity(a);
      setHoldings(h);
      setError(null);
      // once graduated, also read the DAMM v2 pool the liquidity moved into
      if (l.isMigrated) fetchDammInfo(conn, s).then(setDamm).catch(() => {});
      else setDamm(null);
    } catch (e) {
      // keep the last good data on screen; surface only if we have nothing yet
      setError((prev) => prev ?? (e instanceof Error ? e.message : String(e)));
    }
  }, [wallet]);

  // live polling (paused while the tab is hidden), plus a 1s ticker for "updated Ns ago"
  useEffect(() => {
    if (!st) return;
    refresh();
    const iv = setInterval(() => !document.hidden && refresh(), POLL_MS);
    const onVis = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [st, refresh]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const reads = useMemo(() => (st && live ? lensReads(st, live, damm) : []), [st, live, damm]);
  const status = live ? statusOf(live) : null;
  const sim = useMemo(() => (live ? { quoteSol: live.quoteReserveSol, tokensSold: live.tokensSold } : null), [live]);

  /* ---------------- error / loading ---------------- */
  if (error && !st) {
    return (
      <>
        <AppHeader />
        <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
          <div className="card" style={{ maxWidth: 560 }}>
            <div className="card-title">Can&apos;t open this launch</div>
            <p className="muted">{error}</p>
            <p className="faint" style={{ fontSize: 13 }}>
              LaunchLens reads Solana devnet pools created with Meteora&apos;s Dynamic Bonding Curve.
            </p>
            <Link href="/launches" className="btn">
              ← My launches
            </Link>
          </div>
        </div>
      </>
    );
  }
  if (!st || !live || !sim || !status) {
    return (
      <>
        <AppHeader />
        <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
          <div role="status">
            <p className="muted" style={{ margin: 0 }}>
              <i className="spin" style={{ display: "inline-block", marginRight: 10, verticalAlign: "middle" }} />
              Reading the pool from devnet…
            </p>
            {slow && (
              <p className="faint" style={{ margin: "12px 0 0", fontSize: 13.5 }}>
                This is taking longer than usual; the public devnet RPC may be slow.{" "}
                <button className="link-btn" onClick={() => setAttempt((a) => a + 1)}>
                  Try again
                </button>
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  const title = st.name ?? "Unnamed token";
  const holdingsSol = holdings * live.price;

  return (
    <>
      <AppHeader />
      <div className="layout">
        <main className="col-main">
          <div className="eyebrow">LaunchLens</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", margin: "6px 0 4px" }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="token-logo" src={logoUrl} alt={`${title} logo`} referrerPolicy="no-referrer" />
            )}
            <h1 className="page-title" style={{ margin: 0 }}>
              {title} {st.symbol && <span className="faint mono" style={{ fontSize: "0.6em" }}>${st.symbol}</span>}
            </h1>
            <span className={`status ${status}`}>
              <i /> {status === "live" ? "Live" : status === "complete" ? "Curve complete" : "Graduated"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }} className="faint">
            <span className="mono" style={{ fontSize: 12.5 }}>
              pool {shortAddr(st.pool, 5)}
            </span>
            <button
              className="link-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(st.pool);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                } catch {}
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <a className="link-btn" href={explorerAddress(st.pool)} target="_blank" rel="noreferrer">
              Explorer ↗
            </a>
            <span style={{ marginLeft: "auto", fontSize: 12.5 }}>
              updated {Math.max(0, Math.round((now - live.updatedAt) / 1000))}s ago · SOL ≈ $
              <input
                aria-label="SOL price in USD (display only)"
                className="mono"
                style={{ width: 42, background: "none", border: 0, color: "var(--text-2)", outline: "none" }}
                value={solUsd}
                inputMode="decimal"
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                  if (Number.isFinite(n)) saveUsd(n);
                }}
              />
            </span>
          </div>

          {/* hero */}
          <div className="card hero-card">
            <div className="eyebrow">Market cap</div>
            <div className="big mono">
              {fmtSol(live.marketCapSol)} <span className="faint" style={{ fontSize: "0.5em" }}>{fmtUsd(live.marketCapSol * solUsd)}</span>
            </div>
            <div className="muted mono" style={{ fontSize: 13.5 }}>
              {fmtPrice(live.price)} SOL per token
            </div>

            <div style={{ marginTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span className="muted">Progress to graduation</span>
                <span className="mono">{fmtPct(live.progress, live.progress < 0.1 ? 2 : 1)}</span>
              </div>
              <div className={`progress lg ${live.curveComplete ? "done" : ""}`} role="progressbar" aria-valuenow={Math.round(live.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${Math.max(live.progress > 0 ? 0.6 : 0, live.progress * 100)}%` }} />
                {[25, 50, 75].map((t) => (
                  <b key={t} style={{ left: `${t}%` }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: 8 }} className="faint mono">
                <span>{fmtNum(live.quoteReserveSol, 4)} SOL deposited</span>
                <span>{fmtNum(st.thresholdSol, 2)} SOL to graduate</span>
              </div>
            </div>
          </div>

          <div className="metrics" style={{ margin: "16px 0" }}>
            <div className="metric">
              <div className="k">Tokens sold</div>
              <div className="v">{fmtPct(live.tokensSold / st.supply, 2)}</div>
              <div className="s">{fmtTokens(live.tokensSold)} of {fmtTokens(st.supply)}</div>
            </div>
            <div className="metric">
              <div className="k">Fees paid by traders</div>
              <div className="v">{fmtSol(live.fees.totalTradingSol)}</div>
              <div className="s">{fmtNum(st.feeBps / 100, 2)}% per trade</div>
            </div>
            <div className="metric">
              <div className="k">Starting market cap</div>
              <div className="v">{fmtSol(st.startMarketCapSol)}</div>
              <div className="s">{fmtNum(live.marketCapSol / st.startMarketCapSol, 2)}× now</div>
            </div>
            <div className="metric">
              <div className="k">Your holdings</div>
              <div className="v">{wallet ? fmtTokens(holdings) : "—"}</div>
              <div className="s">{wallet ? `≈ ${fmtSol(holdingsSol)}` : "connect a wallet"}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">Where you are on the curve</span>
              <span className="faint" style={{ fontSize: 12.5 }}>
                the white dot is the live position
              </span>
            </div>
            <CurveChart curve={st.curve} sim={sim} solUsd={solUsd} />
          </div>

          {(live.curveComplete || live.isMigrated) && (
            <div style={{ marginTop: 16 }}>
              <MigrationPanel st={st} live={live} damm={damm} onChanged={refresh} />
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <TradePanel st={st} live={live} holdings={holdings} onTraded={refresh} />
          </div>

          <div style={{ marginTop: 16 }}>
            <EarningsPanel st={st} live={live} onChanged={refresh} />
          </div>
        </main>

        <div className="col-side">
          <aside className="copilot" aria-label="LaunchLens readout">
            <div className="copilot-head">
              <span className="copilot-dot" />
              <b>LaunchLens reads</b>
              <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>
                from the chain
              </span>
            </div>
            {reads.map((r) => (
              <div className="insight" key={r.id}>
                <p style={r.tone === "ok" ? { color: "var(--text)" } : r.tone === "warn" ? { color: "var(--warn)" } : undefined}>{r.text}</p>
                {r.why && <div className="why">{r.why}</div>}
              </div>
            ))}
            <AskBox
              getContext={() => liveContext(st, live, damm, reads.map((r) => r.text))}
              suggestions={["Summarize where this launch stands", "How far is it from graduating?", "Who earns what from the fees?"]}
            />
            <div className="copilot-foot">Readouts describe on-chain state. They aren&apos;t financial advice or predictions.</div>
          </aside>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-head">
              <span className="card-title">Activity</span>
              <span className="faint" style={{ fontSize: 12.5 }}>latest {activity.length}</span>
            </div>
            {activity.length === 0 && <p className="faint" style={{ margin: 0, fontSize: 13 }}>No transactions yet.</p>}
            {activity.map((a, i) => (
              <div className="activity-row" key={a.signature}>
                <span className={`dot ${a.ok ? "ok" : "bad"}`} />
                <a className="link-btn mono" href={explorerTx(a.signature)} target="_blank" rel="noreferrer">
                  {shortAddr(a.signature, 5)} ↗
                </a>
                <span className="faint" style={{ marginLeft: "auto", fontSize: 12.5 }}>
                  {i === activity.length - 1 && activity.length >= 12 ? "" : relTime(a.blockTime, now)}
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-head">
              <span className="card-title">On-chain</span>
            </div>
            {[
              ["Token mint", st.baseMint],
              ["Config", st.config],
              ["Creator", st.creator],
            ].map(([k, v]) => (
              <div className="kv" key={k}>
                <span className="k">{k}</span>
                <a className="v link-btn" href={explorerAddress(v)} target="_blank" rel="noreferrer">
                  {shortAddr(v, 5)} ↗
                </a>
              </div>
            ))}
            <div className="kv">
              <span className="k">Creator fee share</span>
              <span className="v">{st.creatorFeeSharePct}%</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
