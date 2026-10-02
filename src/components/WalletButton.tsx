"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { shortAddr } from "@/deploy/rpc";
import { useWallet } from "@/wallet/WalletContext";

export function WalletModal({ onClose }: { onClose: () => void }) {
  const { options, connect, connecting, error, clearError, wallet } = useWallet();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // close once connected
  useEffect(() => {
    if (wallet) onClose();
  }, [wallet, onClose]);

  // Portal to <body>: an ancestor with a transform would otherwise become the containing block for position: fixed.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-up" role="dialog" aria-modal="true" aria-label="Connect a wallet">
        <div className="card-head" style={{ marginBottom: 6 }}>
          <span className="card-title">Connect a wallet</span>
          <button className="link-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: 13.5 }}>
          Launchcraft deploys to <b>Solana devnet</b>. Nothing here uses real funds.
        </p>

        <div className="wallet-list">
          {options.map((o) => (
            <button
              key={o.id}
              className="wallet-row"
              disabled={connecting || (!o.installed && o.kind === "injected")}
              onClick={() => {
                clearError();
                connect(o.id);
              }}
            >
              <span className={`wallet-ic ${o.id}`}>{o.name[0]}</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                {o.name}
                {o.kind === "burner" && <span className="faint" style={{ display: "block", fontSize: 12 }}>Throwaway key stored in this browser. Good for demos.</span>}
              </span>
              {o.kind === "injected" && !o.installed ? (
                <a className="link-btn" href={o.installUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  Install
                </a>
              ) : (
                <span className="faint" style={{ fontSize: 12 }}>{o.kind === "injected" ? "Detected" : "Create"}</span>
              )}
            </button>
          ))}
        </div>
        {error && (
          <p className="field-msg error" style={{ marginTop: 12 }} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function WalletButton() {
  const { wallet, balance, disconnect, airdrop, error, clearError } = useWallet();
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!wallet) {
    return (
      <>
        <button className="btn sm" onClick={() => setModal(true)}>
          Connect wallet
        </button>
        {modal && <WalletModal onClose={() => setModal(false)} />}
      </>
    );
  }

  const addr = wallet.publicKey.toBase58();
  return (
    <div style={{ position: "relative" }}>
      <button className="btn sm wallet-pill" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
        <span className="net-dot" style={{ background: "var(--ok)" }} />
        <span className="mono">{shortAddr(addr)}</span>
        <span className="faint mono">{balance == null ? "…" : `${balance.toFixed(3)} SOL`}</span>
      </button>
      {menu && (
        <div className="menu fade-up" role="menu" onMouseLeave={() => setMenu(false)}>
          <div className="faint" style={{ fontSize: 12, padding: "2px 10px 6px" }}>
            {wallet.name} · devnet
          </div>
          <button
            role="menuitem"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(addr);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              } catch {}
            }}
          >
            {copied ? "Copied ✓" : "Copy address"}
          </button>
          <button role="menuitem" onClick={() => airdrop(1)}>
            Request 1 devnet SOL
          </button>
          <a role="menuitem" href="https://faucet.solana.com" target="_blank" rel="noreferrer">
            Open faucet.solana.com
          </a>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
          {error && (
            <p className="field-msg error" style={{ padding: "6px 10px 2px", margin: 0 }} onClick={clearError}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
