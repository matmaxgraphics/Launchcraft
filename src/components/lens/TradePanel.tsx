"use client";

import { useEffect, useRef, useState } from "react";
import { WalletModal } from "../WalletButton";
import { explorerTx, getConnection } from "@/deploy/rpc";
import type { LaunchLive, LaunchStatic } from "@/lens/read";
import { executeSwap, previewSwap, type Side, type SwapPreview } from "@/lens/trade";
import { fmtNum, fmtPrice, fmtSol, fmtTokens } from "@/lib/fmt";
import { useWallet } from "@/wallet/WalletContext";

interface Props {
  st: LaunchStatic;
  live: LaunchLive;
  /** Wallet's balance of this token (whole tokens). */
  holdings: number;
  onTraded: () => void;
}

const BUY_CHIPS = [0.05, 0.1, 0.5, 1];
const GAS_RESERVE = 0.01; // SOL kept back for fees/rent when using Max

export function TradePanel({ st, live, holdings, onTraded }: Props) {
  const { wallet, balance, refreshBalance } = useWallet();
  const [side, setSide] = useState<Side>("buy");
  const [text, setText] = useState("0.1");
  const [preview, setPreview] = useState<SwapPreview | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<{ sig: string; side: Side; summary: string } | null>(null);
  const [modal, setModal] = useState(false);
  const liveRef = useRef(live);
  liveRef.current = live;

  const amount = Number(text);
  const complete = live.curveComplete || live.isMigrated;

  // Re-quote (debounced) whenever the inputs or the pool's reserve change.
  useEffect(() => {
    setPreview(null);
    setQuoteErr(null);
    if (!(amount > 0) || complete) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const p = await previewSwap(getConnection(), st, liveRef.current, side, amount);
        if (!cancelled) setPreview(p);
      } catch (e) {
        if (!cancelled) setQuoteErr(shorten(e));
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amount, side, st, live.quoteReserveSol, complete]);

  const insufficient = wallet && (side === "buy" ? balance != null && amount + GAS_RESERVE > balance : amount > holdings + 1e-9);

  async function submit() {
    if (!wallet || !preview) return;
    setBusy(true);
    setSendErr(null);
    setLastSig(null);
    try {
      const sig = await executeSwap(getConnection(), wallet, st, side, preview.amountIn, preview.minOut);
      setLastSig({
        sig,
        side,
        summary: side === "buy" ? `Bought ${fmtTokens(preview.amountOut)} for ${fmtSol(preview.amountIn)}` : `Sold ${fmtTokens(preview.amountIn)} for ${fmtSol(preview.amountOut)}`,
      });
      onTraded();
      refreshBalance();
    } catch (e) {
      setSendErr(shorten(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Trade on the curve</span>
        <span className="faint" style={{ fontSize: 12.5 }}>
          real devnet transactions
        </span>
      </div>

      <div className="seg" role="tablist" aria-label="Side">
        {(["buy", "sell"] as Side[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            className={`${side === s ? "on" : ""} ${s}`}
            onClick={() => {
              setSide(s);
              setText(s === "buy" ? "0.1" : holdings > 0 ? String(floor6(holdings / 2)) : "");
            }}
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {complete ? (
        <p className="muted" style={{ margin: "16px 0 0" }}>
          {live.isMigrated ? "Trading has moved to the Meteora DAMM v2 pool, so the curve no longer accepts trades." : "This curve is complete, so it no longer accepts trades. Migrate it to DAMM v2 above to open trading there."}
        </p>
      ) : (
        <>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="trade-amt">
              <span>{side === "buy" ? "You pay" : "You sell"}</span>
              <span className="faint mono" style={{ fontSize: 12 }}>
                {side === "buy" ? `Balance ${balance == null ? "…" : fmtSol(balance)}` : `Holding ${fmtTokens(holdings)}`}
              </span>
            </label>
            <div className="input-wrap">
              <input id="trade-amt" className="input mono has-suffix" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))} />
              <span className="suffix">{side === "buy" ? "SOL" : st.symbol ? `$${st.symbol}` : "tokens"}</span>
            </div>
          </div>

          <div className="preset-row" style={{ marginTop: 10 }}>
            {side === "buy" ? (
              <>
                {BUY_CHIPS.map((v) => (
                  <button key={v} className="chip" onClick={() => setText(String(v))}>
                    {v}
                  </button>
                ))}
                {balance != null && balance > GAS_RESERVE * 2 && (
                  <button className="chip" onClick={() => setText(String(floor6(balance - GAS_RESERVE)))}>
                    Max
                  </button>
                )}
              </>
            ) : (
              [0.25, 0.5, 1].map((p) => (
                <button key={p} className="chip" disabled={holdings <= 0} onClick={() => setText(String(floor6(holdings * p)))}>
                  {p * 100}%
                </button>
              ))
            )}
          </div>

          <div className="quote">
            {preview ? (
              <>
                <div className="kv">
                  <span className="k">You receive</span>
                  <span className="v">
                    {side === "buy" ? `${fmtTokens(preview.amountOut)} $${st.symbol ?? ""}` : fmtSol(preview.amountOut)}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Minimum (1% slippage)</span>
                  <span className="v">{side === "buy" ? fmtTokens(preview.minOut) : fmtSol(preview.minOut)}</span>
                </div>
                <div className="kv">
                  <span className="k">Fee</span>
                  <span className="v">{fmtSol(preview.feeSol)}</span>
                </div>
                <div className="kv">
                  <span className="k">Price after</span>
                  <span className="v">{fmtPrice(preview.priceAfter)} SOL</span>
                </div>
                {preview.unusedIn > 1e-9 && (
                  <p className="field-msg warning" style={{ marginTop: 8 }}>
                    Only {fmtNum(preview.amountIn, 4)} {side === "buy" ? "SOL" : "tokens"} fits before graduation; the rest stays in your wallet.
                  </p>
                )}
              </>
            ) : quoteErr ? (
              <p className="field-msg error" role="alert">
                {quoteErr}
              </p>
            ) : (
              <p className="faint" style={{ fontSize: 13, margin: 0 }}>
                {amount > 0 ? "Getting a quote…" : "Enter an amount to get a quote."}
              </p>
            )}
          </div>

          {!wallet ? (
            <button className="btn accent" style={{ width: "100%", marginTop: 14 }} onClick={() => setModal(true)}>
              Connect wallet to trade
            </button>
          ) : (
            <button className={`btn ${side === "buy" ? "accent" : ""}`} style={{ width: "100%", marginTop: 14 }} disabled={!preview || busy || !!insufficient} onClick={submit}>
              {busy ? "Waiting for wallet…" : insufficient ? (side === "buy" ? "Not enough SOL" : "Not enough tokens") : side === "buy" ? "Buy" : "Sell"}
            </button>
          )}
        </>
      )}

      {sendErr && (
        <p className="field-msg error" style={{ marginTop: 12 }} role="alert">
          {sendErr}
        </p>
      )}
      {lastSig && (
        <p className="field-msg" style={{ marginTop: 12, color: "var(--ok)" }} role="status">
          {lastSig.summary}.{" "}
          <a className="link-btn" href={explorerTx(lastSig.sig)} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        </p>
      )}
      {modal && <WalletModal onClose={() => setModal(false)} />}
    </div>
  );
}

const floor6 = (n: number) => Math.floor(n * 1e6) / 1e6;
const shorten = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return m.length > 200 ? m.slice(0, 200) + "…" : m;
};
