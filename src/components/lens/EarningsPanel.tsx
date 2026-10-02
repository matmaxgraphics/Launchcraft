"use client";

import { useCallback, useEffect, useState } from "react";
import { WalletModal } from "../WalletButton";
import { explorerAddress, explorerTx, getConnection, shortAddr } from "@/deploy/rpc";
import { claimFees, claimOptions, MIN_CLAIM_SOL, type ClaimRole } from "@/lens/claim";
import { claimPositionFees, fetchPositions, withdrawUnlocked, type PositionView } from "@/lens/positions";
import type { LaunchLive, LaunchStatic } from "@/lens/read";
import { fmtPct, fmtSol, fmtTokens } from "@/lib/fmt";
import { useWallet } from "@/wallet/WalletContext";

interface Props {
  st: LaunchStatic;
  live: LaunchLive;
  onChanged: () => void;
}

/** Everything the creator / partner can collect: trading fees on the curve, and (after graduation) DAMM v2 positions. */
export function EarningsPanel({ st, live, onChanged }: Props) {
  const { wallet, refreshBalance } = useWallet();
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string; sig: string } | null>(null);
  const [positions, setPositions] = useState<PositionView[] | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);

  const me = wallet?.publicKey.toBase58() ?? null;
  const opts = claimOptions(st, live, me);

  const loadPositions = useCallback(async () => {
    if (!wallet || !live.isMigrated) return setPositions(null);
    try {
      setPositions(await fetchPositions(getConnection(), st, wallet.publicKey));
    } catch {
      setPositions([]);
    }
  }, [wallet, live.isMigrated, st]);

  // refresh positions on connect and whenever the pool state ticks over
  useEffect(() => {
    loadPositions();
  }, [loadPositions, live.updatedAt]);

  async function run(key: string, label: string, fn: () => Promise<string>) {
    setBusy(key);
    setError(null);
    setDone(null);
    try {
      const sig = await fn();
      setDone({ label, sig });
      onChanged();
      refreshBalance();
      await loadPositions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setConfirmWithdraw(null);
    }
  }

  const noFeesYet = live.fees.totalTradingSol === 0;
  const hasAnything = !noFeesYet || live.isMigrated;
  if (!hasAnything) return null;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Earnings &amp; claims</span>
        <span className="faint" style={{ fontSize: 12.5 }}>
          only the right wallet can sign each claim
        </span>
      </div>

      {/* ---- trading fees on the curve ---- */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        Trading fees
      </div>
      {opts.map((o) => {
        const enough = o.amountSol >= MIN_CLAIM_SOL;
        return (
          <div className="claim-row" key={o.role}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ textTransform: "capitalize" }}>{o.role} share</b>
              <div className="faint mono" style={{ fontSize: 12 }}>
                {o.canClaim ? "your wallet" : shortAddr(o.claimant, 4)}
              </div>
            </div>
            <span className="mono">{fmtSol(o.amountSol)}</span>
            {o.canClaim ? (
              <button
                className="btn sm accent"
                disabled={!enough || busy !== null}
                onClick={() => run(`fee-${o.role}`, `Claimed the ${o.role} fee share`, () => claimFees(getConnection(), wallet!, st, o.role as ClaimRole))}
              >
                {busy === `fee-${o.role}` ? "Waiting…" : enough ? "Claim" : "Nothing to claim"}
              </button>
            ) : (
              <span className="faint" style={{ fontSize: 12.5, minWidth: 92, textAlign: "right" }}>
                not your share
              </span>
            )}
          </div>
        );
      })}
      <div className="claim-row">
        <div style={{ flex: 1 }}>
          <b>Protocol share</b>
          <div className="faint" style={{ fontSize: 12 }}>
            Meteora&apos;s cut of each fee
          </div>
        </div>
        <span className="mono">{fmtSol(live.fees.protocolSol)}</span>
        <span className="faint" style={{ fontSize: 12.5, minWidth: 92, textAlign: "right" }}>
          not claimable
        </span>
      </div>

      {/* ---- DAMM v2 positions ---- */}
      {live.isMigrated && (
        <>
          <hr className="hr" />
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Liquidity positions on DAMM v2
          </div>
          {!wallet ? (
            <button className="btn" onClick={() => setModal(true)}>
              Connect wallet to see your positions
            </button>
          ) : positions == null ? (
            <p className="muted" style={{ margin: 0 }}>
              Looking for your positions…
            </p>
          ) : positions.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              This wallet holds no liquidity position in the pool. Migration sent the two position NFTs to the creator and partner wallets.
            </p>
          ) : (
            positions.map((p) => {
              const hasFees = p.feeSol > 0 || p.feeTokens > 0;
              return (
                <div className="position" key={p.position}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <a className="link-btn mono" href={explorerAddress(p.position)} target="_blank" rel="noreferrer">
                      Position {shortAddr(p.position, 4)} ↗
                    </a>
                    <span className="faint" style={{ fontSize: 12.5 }}>
                      {fmtPct(p.poolShare, 1)} of the pool
                    </span>
                  </div>
                  <div className="split" role="img" aria-label={`${fmtPct(p.unlockedFrac, 0)} unlocked, ${fmtPct(p.lockedFrac, 0)} locked`}>
                    <i style={{ width: `${p.unlockedFrac * 100}%` }} />
                    <b style={{ width: `${p.lockedFrac * 100}%` }} />
                  </div>
                  <div className="kv">
                    <span className="k">Unlocked ({fmtPct(p.unlockedFrac, 0)})</span>
                    <span className="v">
                      ≈ {fmtTokens(p.unlockedTokens)} + {fmtSol(p.unlockedSol)}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">Permanently locked ({fmtPct(p.lockedFrac, 0)})</span>
                    <span className="v">stays in the pool</span>
                  </div>
                  <div className="kv">
                    <span className="k">Unclaimed fees</span>
                    <span className="v">{hasFees ? `${fmtTokens(p.feeTokens)} + ${fmtSol(p.feeSol)}` : "none yet"}</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn sm"
                      disabled={!hasFees || busy !== null}
                      onClick={() => run(`pf-${p.position}`, "Claimed the position's fees", () => claimPositionFees(getConnection(), wallet, st, p))}
                    >
                      {busy === `pf-${p.position}` ? "Waiting…" : "Claim fees"}
                    </button>
                    {p.canWithdraw && confirmWithdraw !== p.position && (
                      <button className="btn sm ghost" disabled={busy !== null} onClick={() => setConfirmWithdraw(p.position)}>
                        Withdraw unlocked liquidity…
                      </button>
                    )}
                  </div>

                  {confirmWithdraw === p.position && (
                    <div className="warn-box" role="alertdialog" aria-label="Confirm withdrawal">
                      <b>Remove this liquidity from the pool?</b>
                      <p style={{ margin: "6px 0 10px", fontSize: 13.5 }}>
                        You&apos;ll receive about {fmtTokens(p.unlockedTokens)} tokens and {fmtSol(p.unlockedSol)}. Traders will have that much less liquidity to trade against, and the price can move more per trade. This
                        can&apos;t be undone from here.
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn sm primary" disabled={busy !== null} onClick={() => run(`wd-${p.position}`, "Withdrew the unlocked liquidity", () => withdrawUnlocked(getConnection(), wallet, st, p))}>
                          {busy === `wd-${p.position}` ? "Waiting…" : "Withdraw"}
                        </button>
                        <button className="btn sm ghost" disabled={busy !== null} onClick={() => setConfirmWithdraw(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {!wallet && !live.isMigrated && (
        <button className="btn" style={{ marginTop: 12 }} onClick={() => setModal(true)}>
          Connect wallet to claim
        </button>
      )}

      {done && (
        <p className="field-msg" style={{ marginTop: 12, color: "var(--ok)" }} role="status">
          {done.label}.{" "}
          <a className="link-btn" href={explorerTx(done.sig)} target="_blank" rel="noreferrer">
            Transaction ↗
          </a>
        </p>
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
