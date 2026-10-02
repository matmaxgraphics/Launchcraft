import { ImageResponse } from "next/og";

export const alt = "Launchcraft: design, simulate and launch a token on Meteora's Dynamic Bonding Curve";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card shown when the link is posted anywhere: the product's one idea, a curve, drawn in its own palette. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #08080a 0%, #14121f 100%)",
          color: "#ececf0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 600 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="#121215" stroke="#2a2a31" />
            <path d="M4.5 18.5 C 9 18.5, 10.5 17, 12 13.2 S 15.5 6.2, 19.5 5.5" stroke="#8f7cff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Launchcraft
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>Shape the curve first.</div>
          <div style={{ fontSize: 32, color: "#a1a1ab", marginTop: 22, maxWidth: 900 }}>
            Design, simulate and launch a token on Meteora&apos;s Dynamic Bonding Curve, then trade, graduate and migrate it, all on Solana.
          </div>
        </div>

        <svg width="1056" height="120" viewBox="0 0 1056 120" fill="none">
          <path d="M0 112 C 220 110, 420 100, 600 78 S 900 20, 1056 6" stroke="#8f7cff" strokeWidth="6" strokeLinecap="round" />
          <circle cx="1056" cy="6" r="10" fill="#4ade80" />
        </svg>
      </div>
    ),
    size,
  );
}
