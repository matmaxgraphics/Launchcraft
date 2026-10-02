"use client";

import { useEffect, useRef, useState } from "react";
import { Field, NumInput, pick } from "../Field";
import { uploadAvailable } from "@/upload/client";
import { MAX_DESCRIPTION_CHARS, MAX_IMAGE_BYTES, sniffImage } from "@/upload/validate";
import type { StepProps } from "./types";

export function TokenStep({ config, update, issues, logo, setLogo }: StepProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    uploadAvailable().then(setAvailable);
  }, []);

  // preview from the in-memory File; revoke the object URL when it changes
  useEffect(() => {
    if (!logo) return setPreview(null);
    const url = URL.createObjectURL(logo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  async function chooseFile(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) return setLogoError(`That image is ${(file.size / 1024).toFixed(0)} KB; the limit is ${MAX_IMAGE_BYTES / 1024} KB.`);
    // trust the bytes, not the file name or declared type
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!sniffImage(head)) return setLogoError("Use a PNG, JPEG, GIF or WebP image.");
    setLogo(file);
  }

  const manualUri = config.token.metadataUri.trim().length > 0;

  return (
    <div className="fade-up">
      <div className="eyebrow">Step 1 of 4</div>
      <h1 className="page-title">Name your token</h1>
      <p className="page-sub">
        The basics. Everything about how it trades comes next.{" "}
        <button
          className="link-btn"
          onClick={() =>
            update((c) => {
              c.token.name = "Signal";
              c.token.symbol = "SIG";
              c.token.description = "An example token for exploring Launchcraft on Solana devnet.";
            })
          }
        >
          Fill with an example
        </button>
      </p>

      <div className="card">
        <div className="grid-2">
          <Field label="Name" issue={pick(issues, "token.name")} hint="Shown in wallets and explorers.">
            {({ id, invalid }) => (
              <input
                id={id}
                className={`input ${invalid ? "err" : ""}`}
                placeholder="Signal"
                maxLength={40}
                value={config.token.name}
                onChange={(e) => update((c) => void (c.token.name = e.target.value))}
              />
            )}
          </Field>
          <Field label="Symbol" issue={pick(issues, "token.symbol")} hint="Up to 10 characters.">
            {({ id, invalid }) => (
              <input
                id={id}
                className={`input mono ${invalid ? "err" : ""}`}
                placeholder="SIG"
                maxLength={12}
                value={config.token.symbol}
                onChange={(e) => update((c) => void (c.token.symbol = e.target.value.toUpperCase()))}
              />
            )}
          </Field>
        </div>
        <hr className="hr" />
        <div className="grid-2">
          <Field label="Total supply" issue={pick(issues, "token.supply")} hint="Whole tokens. 1,000,000,000 is a common choice.">
            {({ id, invalid }) => <NumInput id={id} value={config.token.supply} invalid={invalid} onChange={(n) => update((c) => void (c.token.supply = Math.round(n)))} />}
          </Field>
          <div className="field">
            <label>Quote asset</label>
            <div className="input" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#9945ff,#14f195)" }} />
              SOL
              <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>
                fixed in v1
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Logo &amp; description</span>
          <span className="faint" style={{ fontSize: 12.5 }}>
            what wallets and explorers show
          </span>
        </div>

        <div className="logo-row">
          <div
            className={`dropzone ${drag ? "over" : ""} ${preview ? "has" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void chooseFile(e.dataTransfer.files?.[0]);
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your token logo" />
            ) : (
              <span className="faint" style={{ fontSize: 12, textAlign: "center", padding: 8 }}>
                Drop an image
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn sm" disabled={manualUri || available === false} onClick={() => input.current?.click()}>
                {logo ? "Change image" : "Choose image"}
              </button>
              {logo && (
                <button className="btn sm ghost" onClick={() => setLogo(null)}>
                  Remove
                </button>
              )}
              <input
                ref={input}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/gif,image/webp"
                data-testid="logo-input"
                onChange={(e) => {
                  void chooseFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="faint" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
              {available === false
                ? "Logo upload isn't set up on this server. Paste a hosted metadata URI below instead."
                : manualUri
                  ? "You've pasted a metadata URI, so the logo upload is skipped."
                  : logo
                    ? `${logo.name} · ${(logo.size / 1024).toFixed(0)} KB · uploaded when you launch, so it always matches your final name.`
                    : `PNG, JPEG, GIF or WebP up to ${MAX_IMAGE_BYTES / 1024} KB. Square works best.`}
            </p>
            {logoError && (
              <p className="field-msg error" style={{ marginTop: 6 }} role="alert">
                {logoError}
              </p>
            )}
          </div>
        </div>

        <hr className="hr" />
        <div className="field">
          <label htmlFor="token-desc">
            <span>Description</span>
            <span className="faint mono" style={{ fontSize: 12 }}>
              {config.token.description.length}/{MAX_DESCRIPTION_CHARS}
            </span>
          </label>
          <textarea
            id="token-desc"
            className="input"
            rows={3}
            maxLength={MAX_DESCRIPTION_CHARS}
            placeholder="One or two sentences about the token."
            value={config.token.description}
            onChange={(e) => update((c) => void (c.token.description = e.target.value))}
          />
        </div>

        <details style={{ marginTop: 16 }}>
          <summary>Advanced · use my own metadata URI</summary>
          <div style={{ marginTop: 12 }}>
            <Field label="Metadata URI" issue={pick(issues, "token.metadataUri")} hint="Points to JSON you host yourself (name, symbol, image). When set, the logo upload is skipped.">
              {({ id }) => (
                <input
                  id={id}
                  className="input mono"
                  placeholder="https://…/token.json"
                  value={config.token.metadataUri}
                  onChange={(e) => update((c) => void (c.token.metadataUri = e.target.value))}
                />
              )}
            </Field>
          </div>
        </details>
        <hr className="hr" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["SPL token", "6 decimals", "No mint authority", "Metadata immutable"].map((t) => (
            <span key={t} className="chip" style={{ cursor: "default" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
