import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

// A decorative back-loaded curve; the real one is drawn from the SDK in CurveLab.
const HERO_PATH =
  "M 0 250 C 120 248, 220 244, 330 230 S 520 190, 620 140 S 800 40, 1000 12";

export default function Landing() {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <BrandMark /> Launchcraft
        </div>
        <nav className="stepper" aria-label="Main">
          <Link href="/create" className="step-pill">
            <span className="t">Create</span>
          </Link>
          <Link href="/launches" className="step-pill">
            <span className="t">My launches</span>
          </Link>
        </nav>
        <span className="net-chip">
          <span className="net-dot" /> Built on Meteora DBC
        </span>
      </header>

      <section className="hero">
        <div className="eyebrow fade-up">Visual launch studio · Solana</div>
        <h1 className="fade-up" style={{ animationDelay: ".05s" }}>
          Don&apos;t launch blind.
          <br />
          <em>Shape the curve first.</em>
        </h1>
        <p className="lead fade-up" style={{ animationDelay: ".1s" }}>
          Design your token&apos;s price discovery, simulate real trades against it, understand every number, then deploy on
          Meteora&apos;s Dynamic Bonding Curve.
        </p>
        <div className="hero-cta fade-up" style={{ animationDelay: ".15s" }}>
          <Link href="/create" className="btn primary">
            Create a launch →
          </Link>
          <a className="btn ghost" href="#how">
            How it works
          </a>
        </div>
      </section>

      <div className="hero-curve" aria-hidden>
        <svg viewBox="0 0 1000 270" width="100%" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="hc" x1="0" x2="1">
              <stop offset="0" stopColor="#8f7cff" />
              <stop offset="1" stopColor="#4ade80" />
            </linearGradient>
            <linearGradient id="hf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8f7cff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#8f7cff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 17 }, (_, i) => (
            <line key={i} x1={(i * 1000) / 16} x2={(i * 1000) / 16} y1="0" y2="262" stroke="#1a1a1e" />
          ))}
          <path d={`${HERO_PATH} L 1000 262 L 0 262 Z`} fill="url(#hf)" />
          <path
            d={HERO_PATH}
            fill="none"
            stroke="url(#hc)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1}
            style={{ animation: "draw 1.8s .25s cubic-bezier(.3,.7,.2,1) forwards" }}
          />
          <circle cx="1000" cy="12" r="6" fill="#4ade80" />
          <circle cx="1000" cy="12" r="14" fill="#4ade80" opacity="0.15" />
        </svg>
      </div>

      <section id="how" className="pillars">
        {[
          ["01 · Design", "CurveLab", "Draw how liquidity is spread across 16 price steps. Start from a preset or paint your own."],
          ["02 · Simulate", "Try the launch", "Run buys and sells against your curve before a single transaction is signed."],
          ["03 · Understand", "Launch Copilot", "Plain-language, factual readouts of what your configuration actually does."],
          ["04 · Launch", "Deploy to Meteora", "Two transactions put your config and pool on-chain, then LaunchLens takes over."],
        ].map(([e, t, d]) => (
          <div key={t} className="pillar">
            <div className="eyebrow">{e}</div>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>
    </>
  );
}
