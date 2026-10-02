"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "../AppHeader";
import { loadDeployments, type DeployRecord } from "@/deploy/records";
import { shortAddr } from "@/deploy/rpc";
import { parseAddress } from "@/lens/read";
import { relTime } from "@/lens/insights";

export function LaunchesList() {
  const router = useRouter();
  const [items, setItems] = useState<DeployRecord[] | null>(null);
  const [addr, setAddr] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setItems(loadDeployments()), []);

  return (
    <>
      <AppHeader active="launches" />
      <div className="layout" style={{ gridTemplateColumns: "1fr", maxWidth: 820 }}>
        <main className="col-main fade-up">
          <div className="eyebrow">LaunchLens</div>
          <h1 className="page-title">My launches</h1>
          <p className="page-sub">Launches you&apos;ve deployed from this browser. Open any to watch it live and trade against it.</p>

          <div className="card">
            <div className="card-head">
              <span className="card-title">Open by address</span>
            </div>
            <form
              style={{ display: "flex", gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                const pk = parseAddress(addr);
                if (!pk) return setErr("That doesn't look like a valid Solana address.");
                router.push(`/launch/${pk.toBase58()}`);
              }}
            >
              <input className="input mono" placeholder="Pool address (devnet)" value={addr} onChange={(e) => { setAddr(e.target.value); setErr(null); }} aria-label="Pool address" />
              <button className="btn primary" type="submit" disabled={!addr.trim()}>
                Open
              </button>
            </form>
            {err && <p className="field-msg error" style={{ marginTop: 10 }}>{err}</p>}
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">Deployed here</span>
              <span className="faint" style={{ fontSize: 12.5 }}>{items?.length ?? 0}</span>
            </div>
            {items && items.length === 0 && (
              <p className="muted" style={{ margin: 0 }}>
                Nothing yet. <Link className="link-btn" href="/create">Create your first launch →</Link>
              </p>
            )}
            {items?.map((r) => (
              <Link key={r.pool} href={`/launch/${r.pool}`} className="launch-row">
                <span className="wallet-ic burner">{(r.symbol || r.name || "?")[0]}</span>
                <span style={{ flex: 1 }}>
                  <b>{r.name}</b> <span className="faint mono">${r.symbol}</span>
                  <span className="faint mono" style={{ display: "block", fontSize: 12 }}>
                    pool {shortAddr(r.pool, 5)} · {relTime(Math.floor(r.createdAt / 1000))}
                  </span>
                </span>
                <span className="faint">Open →</span>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
