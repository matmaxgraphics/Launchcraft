"use client";

import Link from "next/link";
import { useState } from "react";
import { WalletModal } from "./WalletButton";
import { DeployError, deployLaunch, type DeployProgress, type DeployStage, type PartialDeploy } from "@/deploy/deploy";
import type { DeployRecord } from "@/deploy/records";
import { explorerAddress, explorerTx, MIN_DEPLOY_SOL, shortAddr } from "@/deploy/rpc";
import type { LaunchConfig } from "@/launch/config";
import type { BuildResult } from "@/launch/toDbc";
import { fmtSol } from "@/lib/fmt";
import { uploadLaunchMetadata } from "@/upload/client";
import { useWallet } from "@/wallet/WalletContext";

const STAGES: { id: DeployStage; label: string; sub: string }[] = [
  { id: "check", label: "Safety check", sub: "Confirms the network is devnet and the wallet can pay" },
  { id: "upload", label: "Upload logo", sub: "Stores your image and metadata permanently, before anything is spent" },
  { id: "config", label: "Create config", sub: "Signature 1 · writes your curve, fees and migration rules" },
  { id: "pool", label: "Create pool", sub: "Signature 2 · mints the token and opens trading" },
  { id: "verify", label: "Verify on-chain", sub: "Reads the live config back and compares it to your design" },
];

type Phase = "idle" | "running" | "done" | "error";

interface Props {
  config: LaunchConfig;
  build: BuildResult;
  /** The logo picked in the Token step, if any. Uploaded as the first stage of the launch. */
  logo: File | null;
}

export function DeployPanel({ config, build, logo }: Props) {
  // An upload happens only when there's a logo and the user hasn't supplied their own metadata URI.
  const willUpload = !!logo && config.token.metadataUri.trim() === "";
  const { wallet, balance, airdrop, refreshBalance } = useWallet();
  const [modal, setModal] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [done, setDone] = useState<Set<DeployStage>>(new Set());
  const [active, setActive] = useState<DeployStage | null>(null);
  const [failed, setFailed] = useState<DeployStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<PartialDeploy | undefined>();
  const [record, setRecord] = useState<DeployRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [airdropping, setAirdropping] = useState(false);

  const lowFunds = balance != null && balance < MIN_DEPLOY_SOL;
  const canLaunch = build.ok && !!wallet && !lowFunds && phase !== "running";

  function onProgress(p: DeployProgress) {
    if (p.status === "active") setActive(p.stage);
    else {
      setDone((d) => new Set(d).add(p.stage));
      setActive((a) => (a === p.stage ? null : a));
    }
  }

  async function launch() {
    if (!build.ok || !wallet) return;
    setPhase("running");
    setError(null);
    setFailed(null);
    setActive(null);
    // a retry after a pool failure skips the config step that already landed
    if (!partial) setDone(new Set());
    try {
      const r = await deployLaunch({
        config,
        build,
        wallet,
        resume: partial,
        onProgress,
        resolveUri: willUpload
          ? async () =>
              (
                await uploadLaunchMetadata({
                  file: logo!,
                  name: config.token.name.trim(),
                  symbol: config.token.symbol.trim(),
                  description: config.token.description,
                })
              ).metadataUri
          : undefined,
      });
      setRecord(r);
      setPartial(undefined);
      setPhase("done");
    } catch (e) {
      const err = e as DeployError;
      setError(err.message);
      setFailed(err.stage ?? null);
      setActive(null);
      setPartial(err.partial);
      setPhase("error");
    } finally {
      refreshBalance();
    }
  }

  function reset() {
    setPhase("idle");
    setRecord(null);
    setDone(new Set());
    setError(null);
    setFailed(null);
    setPartial(undefined);
  }

  /* ---------------- success ---------------- */
  if (phase === "done" && record) {
    return (
      <div className="card deploy-success fade-up">
        <div className="card-head">
          <span className="card-title" style={{ color: "var(--ok)" }}>
            Live on devnet
          </span>
          <span className="faint mono" style={{ fontSize: 12.5 }}>
            {record.name} · ${record.symbol}
          </span>
        </div>

        <div className={`verify ${record.verified ? "ok" : "bad"}`}>
          <span className="ic">{record.verified ? "✓" : "!"}</span>
          <div>
            <b>{record.verified ? "Verified on-chain" : "On-chain value differs from your design"}</b>
            <div className="muted" style={{ fontSize: 13.5 }}>
              Graduation threshold: designed {fmtSol(Number(record.expectedGraduationLamports) / 1e9)}, live {fmtSol(Number(record.onChainGraduationLamports) / 1e9)}.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="kv">
            <span className="k">Pool</span>
            <a className="v link-btn" href={explorerAddress(record.pool)} target="_blank" rel="noreferrer">
              {shortAddr(record.pool, 6)} ↗
            </a>
          </div>
          <div className="kv">
            <span className="k">Token mint</span>
            <a className="v link-btn" href={explorerAddress(record.baseMint)} target="_blank" rel="noreferrer">
              {shortAddr(record.baseMint, 6)} ↗
            </a>
          </div>
          <div className="kv">
            <span className="k">Config</span>
            <a className="v link-btn" href={explorerAddress(record.config)} target="_blank" rel="noreferrer">
              {shortAddr(record.config, 6)} ↗
            </a>
          </div>
          <div className="kv">
            <span className="k">Transactions</span>
            <span className="v">
              <a className="link-btn" href={explorerTx(record.configSig)} target="_blank" rel="noreferrer">
                config ↗
              </a>{" "}
              ·{" "}
              <a className="link-btn" href={explorerTx(record.poolSig)} target="_blank" rel="noreferrer">
                pool ↗
              </a>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(record.pool);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
          >
            {copied ? "Copied ✓" : "Copy pool address"}
          </button>
          <Link className="btn accent" href={`/launch/${record.pool}`}>
            Open LaunchLens →
          </Link>
          <a className="btn" href={explorerAddress(record.pool)} target="_blank" rel="noreferrer">
            Explorer ↗
          </a>
          <button className="btn ghost" onClick={reset}>
            Launch another
          </button>
        </div>
        <p className="faint" style={{ fontSize: 12.5, margin: "14px 0 0" }}>
          Saved in this browser. LaunchLens tracks it live, and anyone can trade this pool on devnet by its address.
        </p>
      </div>
    );
  }

  /* ---------------- idle / running / error ---------------- */
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Deploy</span>
        <span className="chip on" style={{ cursor: "default" }}>
          Solana devnet
        </span>
      </div>

      <div className="deploy-steps">
        {STAGES.filter((s) => s.id !== "upload" || willUpload).map((s, i) => {
          const state = failed === s.id ? "failed" : done.has(s.id) ? "done" : active === s.id ? "active" : "pending";
          return (
            <div key={s.id} className={`deploy-step ${state}`}>
              <span className="n">{state === "done" ? "✓" : state === "failed" ? "✕" : state === "active" ? <i className="spin" /> : i + 1}</span>
              <div>
                <b>{s.label}</b>
                <div className="muted" style={{ fontSize: 13.5 }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <hr className="hr" />

      {!wallet ? (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn accent" onClick={() => setModal(true)} disabled={!build.ok}>
            Connect wallet to launch
          </button>
          <span className="faint" style={{ fontSize: 12.5 }}>
            {build.ok ? "Phantom, Solflare, Backpack, or a throwaway burner wallet." : "Resolve the issues above first."}
          </span>
        </div>
      ) : (
        <>
          <div className="kv" style={{ paddingTop: 0 }}>
            <span className="k">Paying wallet</span>
            <span className="v">
              {shortAddr(wallet.publicKey.toBase58(), 5)} · {balance == null ? "…" : fmtSol(balance)}
            </span>
          </div>
          <div className="kv">
            <span className="k">Estimated cost</span>
            <span className="v">≈ 0.027 SOL (rent + fees, devnet)</span>
          </div>
          {lowFunds && (
            <div className="field-msg warning" style={{ marginTop: 10 }} role="alert">
              This wallet has under {MIN_DEPLOY_SOL} SOL on devnet.{" "}
              <button
                className="link-btn"
                disabled={airdropping}
                onClick={async () => {
                  setAirdropping(true);
                  await airdrop(1);
                  setAirdropping(false);
                }}
              >
                {airdropping ? "Requesting…" : "Request 1 devnet SOL"}
              </button>{" "}
              or use{" "}
              <a className="link-btn" href="https://faucet.solana.com" target="_blank" rel="noreferrer">
                faucet.solana.com
              </a>
              .
            </div>
          )}
          {!config.token.metadataUri.trim() && !logo && (
            <p className="faint" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
              No logo chosen, so a minimal placeholder (name and symbol only) is stored on-chain and wallets won&apos;t show an image. Go back to the Token step to add one.
            </p>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn accent" onClick={launch} disabled={!canLaunch}>
              {phase === "running" ? "Waiting for wallet…" : partial ? "Retry pool creation" : phase === "error" ? "Try again" : "Launch on devnet"}
            </button>
            {partial && <span className="faint" style={{ fontSize: 12.5 }}>Config is already on-chain; only the pool step will run.</span>}
          </div>
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
