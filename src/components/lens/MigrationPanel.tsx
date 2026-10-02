"use client";

import { useEffect, useState } from "react";
import { WalletModal } from "../WalletButton";
import { explorerAddress, explorerTx, getConnection, shortAddr } from "@/deploy/rpc";
import type { LaunchLive, LaunchStatic } from "@/lens/read";
import { loadMigration, migrateToDamm, MIGRATION_COST_SOL, MIGRATION_MIN_BALANCE_SOL, planMigration, withdrawLeftover, type DammInfo, type MigrationRecord } from "@/lens/migrate";
import { fmtNum, fmtPrice, fmtSol, fmtTokens } from "@/lib/fmt";
import { useWallet } from "@/wallet/WalletContext";

interface Props {
  st: LaunchStatic;
  live: LaunchLive;
  damm: DammInfo | null;
  onChanged: () => void;
}

export function MigrationPanel({ st, live, damm, onChanged }: Props) {
  const { wallet, balance, refreshBalance } = useWallet();
  const [busy, setBusy] = useState<"migrate" | "leftover" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rec, setRec] = useState<MigrationRecord | null>(null);
  const [leftoverSig, setLeftoverSig] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => setRec(loadMigration(st.pool)), [st.pool, live.isMigrated]);

  if (!live.curveComplete && !live.isMigrated) return null;

  const lowFunds = wallet != null && balance != null && balance < MIGRATION_MIN_BALANCE_SOL;

  async function doMigrate() {
    if (!wallet) return;
    setBusy("migrate");
    setError(null);
    try {
      setRec(await migrateToDamm(getConnection(), wallet, st));
      onChanged();
      refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function doLeftover() {
    if (!wallet) return;
    setBusy("leftover");
    setError(null);
    try {
      setLeftoverSig(await withdrawLeftover(getConnection(), wallet, st));
      onChanged();
      refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  /* ---------------- before migration ---------------- */
  if (!live.isMigrated) {
    const plan = planMigration(st, live.quoteReserveSol, live.migrationFeeBps);
    return (
      <div className="card migrate-card fade-up">
        <div className="card-head">
          <span className="card-title">Migrate to Meteora DAMM v2</span>
          <span className="chip on" style={{ cursor: "default" }}>
            ready
          </span>
        </div>
        <p className="muted" style={{ margin: "0 0 14px" }}>
          The curve is complete. One transaction creates a DAMM v2 pool at the graduation price and moves the liquidity into it. Anyone can run it; the payer only covers the rent.
        </p>
        <div className="kv">
          <span className="k">Pool opens at</span>
          <span className="v">{fmtPrice(live.price)} SOL per token</span>
        </div>
        <div className="kv">
          <span className="k">Liquidity moved in</span>
          <span className="v">
            {fmtTokens(plan.baseTokens)} tokens + {fmtSol(plan.quoteSol)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Protocol migration fee</span>
          <span className="v">
            {fmtNum(live.migrationFeeBps / 100, 2)}% of both sides ({fmtSol(plan.protocolFeeSol)} + {fmtTokens(plan.protocolFeeTokens)} tokens)
          </span>
        </div>
        <div className="kv">
          <span className="k">Permanently locked</span>
          <span className="v">{plan.lockedPct}% of the liquidity</span>
        </div>
        <div className="kv">
          <span className="k">Cost to you</span>
          <span className="v">≈ {MIGRATION_COST_SOL} SOL (rent) · 1 signature</span>
        </div>

        <div style={{ marginTop: 16 }}>
          {!wallet ? (
            <button className="btn accent" onClick={() => setModal(true)}>
              Connect wallet to migrate
            </button>
          ) : (
            <button className="btn accent" disabled={busy !== null || lowFunds} onClick={doMigrate}>
              {busy === "migrate" ? "Waiting for wallet…" : lowFunds ? `Need ${MIGRATION_MIN_BALANCE_SOL} SOL` : "Migrate to DAMM v2"}
            </button>
          )}
        </div>
        {error && (
          <p className="field-msg error" style={{ marginTop: 12 }} role="alert">
            {error}
          </p>
        )}
        {modal && <WalletModal onClose={() => setModal(false)} />}
      </div>
    );
  }

  /* ---------------- after migration ---------------- */
  const drift = damm?.exists && live.price > 0 ? Math.abs(damm.impliedPrice - live.price) / live.price : null;
  const showLeftover = st.leftoverTokens > 0;
  const receiverIsYou = wallet?.publicKey.toBase58() === st.leftoverReceiver;

  return (
    <div className="card migrate-card done fade-up">
      <div className="card-head">
        <span className="card-title" style={{ color: "var(--accent)" }}>
          Live on Meteora DAMM v2
        </span>
        {damm?.exists && (
          <a className="link-btn" href={explorerAddress(damm.pool)} target="_blank" rel="noreferrer">
            Pool ↗
          </a>
        )}
      </div>

      {damm?.exists ? (
        <>
          <div className="kv">
            <span className="k">Token reserve</span>
            <span className="v">{fmtTokens(damm.baseTokens)}</span>
          </div>
          <div className="kv">
            <span className="k">SOL reserve</span>
            <span className="v">{fmtSol(damm.quoteSol)}</span>
          </div>
          <div className="kv">
            <span className="k">Implied price</span>
            <span className="v">
              {fmtPrice(damm.impliedPrice)} SOL
              {drift != null && drift < 0.001 && <span style={{ color: "var(--ok)" }}> · matches graduation price</span>}
            </span>
          </div>
          <div className="kv">
            <span className="k">Pool address</span>
            <a className="v link-btn" href={explorerAddress(damm.pool)} target="_blank" rel="noreferrer">
              {shortAddr(damm.pool, 5)} ↗
            </a>
          </div>
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Reading the DAMM v2 pool…
        </p>
      )}

      {rec && (
        <>
          <div className="kv">
            <span className="k">Migration tx</span>
            <a className="v link-btn" href={explorerTx(rec.sig)} target="_blank" rel="noreferrer">
              {shortAddr(rec.sig, 5)} ↗
            </a>
          </div>
          <div className="kv">
            <span className="k">Position NFTs</span>
            <span className="v">
              {rec.positionNfts.map((n, i) => (
                <a key={n} className="link-btn" href={explorerAddress(n)} target="_blank" rel="noreferrer">
                  {i ? " · " : ""}
                  {shortAddr(n, 4)}
                </a>
              ))}
            </span>
          </div>
        </>
      )}
      <p className="faint" style={{ fontSize: 12.5, margin: "12px 0 0" }}>
        Trading now continues on DAMM v2. LaunchLens tracks the curve; a DAMM v2 trading view isn&apos;t built yet.
      </p>

      {showLeftover && (
        <>
          <hr className="hr" />
          {live.leftoverWithdrawn || leftoverSig ? (
            <div className="check ok" style={{ padding: 0 }}>
              <span className="ic">✓</span>
              <span>
                Leftover tokens (≈ {fmtTokens(st.leftoverTokens)}) were sent to {receiverIsYou ? "you" : shortAddr(st.leftoverReceiver, 4)}.
                {leftoverSig && (
                  <>
                    {" "}
                    <a className="link-btn" href={explorerTx(leftoverSig)} target="_blank" rel="noreferrer">
                      Transaction ↗
                    </a>
                  </>
                )}
              </span>
            </div>
          ) : (
            <>
              <div className="kv" style={{ paddingTop: 0 }}>
                <span className="k">Leftover tokens</span>
                <span className="v">≈ {fmtTokens(st.leftoverTokens)}</span>
              </div>
              <p className="muted" style={{ fontSize: 13.5, margin: "6px 0 12px" }}>
                Supply held back at launch. Withdrawing sends it to the config&apos;s leftover receiver ({receiverIsYou ? "your wallet" : shortAddr(st.leftoverReceiver, 4)}); anyone can pay the small fee.
              </p>
              {!wallet ? (
                <button className="btn" onClick={() => setModal(true)}>
                  Connect wallet
                </button>
              ) : (
                <button className="btn" disabled={busy !== null} onClick={doLeftover}>
                  {busy === "leftover" ? "Waiting for wallet…" : "Withdraw leftover"}
                </button>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p className="field-msg error" style={{ marginTop: 12 }} role="alert">
          {error}
        </p>
      )}
      {modal && <WalletModal onClose={() => setModal(false)} />}
    </div>
  );
}
