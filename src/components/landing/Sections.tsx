import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export const STATS: [string, string][] = [
  ["16", "price steps you shape"],
  ["2", "transactions to launch"],
  ["0%", "quote drift, preview vs. real"],
  ["1", "signature to migrate"],
];

export const BUILT_ON = ["Meteora DBC", "Meteora DAMM v2", "Solana", "Irys", "Claude"];

/* ---------- little illustrations: decorative, not live data ---------- */

function MiniBars() {
  const h = [6, 8, 10, 12, 16, 20, 26, 34, 44, 58, 74, 60, 40, 28, 18, 12];
  return (
    <svg viewBox="0 0 320 90" className="lp-art" aria-hidden>
      {h.map((v, i) => (
        <rect key={i} x={i * 20 + 2} y={90 - v} width="15" height={v} rx="3" fill={i === 10 ? "#8f7cff" : "#2a2840"} />
      ))}
    </svg>
  );
}

function MiniSim() {
  return (
    <svg viewBox="0 0 320 90" className="lp-art" aria-hidden>
      <defs>
        <linearGradient id="ms" x1="0" x2="1">
          <stop offset="0" stopColor="#8f7cff" />
          <stop offset="1" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <path d="M0 82 C80 80 140 74 190 58 S270 18 320 6" fill="none" stroke="url(#ms)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="190" x2="190" y1="0" y2="90" stroke="#2c2c33" strokeDasharray="3 4" />
      <circle cx="190" cy="58" r="5" fill="#4ade80" />
      <circle cx="190" cy="58" r="11" fill="#4ade80" opacity=".15" />
    </svg>
  );
}

function MiniCopilot() {
  return (
    <div className="lp-art lp-chat" aria-hidden>
      <span>“Half the SOL to graduate is absorbed in the last four steps.”</span>
      <span className="dim">Show me →</span>
    </div>
  );
}

function MiniDeploy() {
  return (
    <div className="lp-art lp-steps" aria-hidden>
      {["Upload logo + metadata", "Create config", "Create pool", "Verify on-chain"].map((t) => (
        <span key={t}>
          <i>✓</i> {t}
        </span>
      ))}
    </div>
  );
}

function MiniLens() {
  return (
    <div className="lp-art lp-kv" aria-hidden>
      {[
        ["Price", "live"],
        ["Progress", "% to graduate"],
        ["Holdings", "yours"],
      ].map(([k, v]) => (
        <span key={k}>
          <em>{k}</em>
          <b>{v}</b>
        </span>
      ))}
    </div>
  );
}

function MiniSplit() {
  return (
    <div className="lp-art" aria-hidden>
      <div className="lp-split">
        <i style={{ flex: 20, background: "#3a3a44" }} />
        <i style={{ flex: 40, background: "#8f7cff" }} />
        <i style={{ flex: 40, background: "#4ade80" }} />
      </div>
      <div className="lp-split-l">
        <span>20% protocol</span>
        <span>40% creator</span>
        <span>40% partner</span>
      </div>
    </div>
  );
}

const FEATURES: { eyebrow: string; title: string; text: string; art: React.ReactNode; wide?: boolean }[] = [
  {
    eyebrow: "Design",
    title: "CurveLab",
    text: "Paint liquidity across 16 geometric price steps, or start from Flat, Gradual, Balanced or Accelerated. The SOL needed to graduate recomputes as you drag.",
    art: <MiniBars />,
    wide: true,
  },
  {
    eyebrow: "Simulate",
    title: "Trade before you launch",
    text: "Buy and sell against your curve with the real quote math. Progress tracks SOL deposited, which is what actually triggers graduation.",
    art: <MiniSim />,
  },
  {
    eyebrow: "Understand",
    title: "Launch Copilot",
    text: "Factual readouts computed from your config, with a Show me highlight on the chart. Optional AI answers, grounded only in those numbers.",
    art: <MiniCopilot />,
  },
  {
    eyebrow: "Launch",
    title: "Verified deploy",
    text: "Logo first, then config and pool in two transactions. The live threshold is read back and checked against your design.",
    art: <MiniDeploy />,
  },
  {
    eyebrow: "Observe",
    title: "LaunchLens",
    text: "Open any devnet DBC pool: price, market cap, progress, fees and your holdings, with a live dot on the designed curve. Trade right there.",
    art: <MiniLens />,
  },
  {
    eyebrow: "Earn",
    title: "Fees and positions",
    text: "Creators and partners claim trading fees and manage their DAMM v2 liquidity, with a confirmation before anything irreversible.",
    art: <MiniSplit />,
    wide: true,
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="lp-section" aria-labelledby="feat-h">
      <div className="eyebrow">Everything in one studio</div>
      <h2 id="feat-h">From a rough idea to a live market, without leaving the page.</h2>
      <p className="muted lp-sub">Six tools that share one source of truth: your launch configuration, mapped straight onto Meteora&apos;s SDK.</p>
      <div className="lp-bento">
        {FEATURES.map((f) => (
          <article key={f.title} className={`lp-feature${f.wide ? " wide" : ""}`}>
            <div className="eyebrow">{f.eyebrow}</div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
            {f.art}
          </article>
        ))}
      </div>
    </section>
  );
}

const STEPS: [string, string][] = [
  ["Design", "Shape the curve"],
  ["Simulate", "Try real trades"],
  ["Launch", "Two transactions"],
  ["Trade", "Buy and sell live"],
  ["Graduate", "Hit the threshold"],
  ["Migrate", "One signature"],
  ["Claim", "Fees and liquidity"],
];

export function Lifecycle() {
  return (
    <section id="how" className="lp-section" aria-labelledby="how-h">
      <div className="eyebrow">The whole lifecycle</div>
      <h2 id="how-h">Seven steps, and the app covers every one.</h2>
      <ol className="lp-timeline">
        {STEPS.map(([t, d], i) => (
          <li key={t}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <b>{t}</b>
            <span className="muted">{d}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const SHOTS = [
  { src: "/shots/03-curvelab.jpg", alt: "CurveLab with draggable liquidity bars", cap: "CurveLab: paint the shape, watch the graduation target move." },
  { src: "/shots/05-simulator.jpg", alt: "The trade simulator", cap: "Simulator: real quotes against your curve, before you sign anything." },
  { src: "/shots/08-lens-migrated.jpg", alt: "LaunchLens showing a pool migrated to DAMM v2", cap: "LaunchLens: a graduated pool, now live on Meteora DAMM v2." },
];

export function Showcase() {
  return (
    <section className="lp-section" aria-labelledby="shots-h">
      <div className="eyebrow">See it</div>
      <h2 id="shots-h">The real interface, running on devnet.</h2>
      <div className="lp-shots">
        {SHOTS.map((s) => (
          <figure key={s.src} className="lp-shot">
            <div className="lp-frame">
              <i />
              <i />
              <i />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.src} alt={s.alt} loading="lazy" />
            <figcaption>{s.cap}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const TRUST: [string, string][] = [
  ["Devnet only, enforced", "The RPC's genesis hash is checked before any transaction. A non-devnet endpoint is refused, so no real SOL can be spent."],
  ["Verified on-chain", "After deploying, the live graduation threshold is read back and compared with your design. Drift is flagged."],
  ["Grounded AI", "The Copilot only sees numbers Launchcraft computed. It gives no advice or predictions, and user text can't break out of its data block."],
  ["Confirm before irreversible", "Withdrawals show amounts and effects first. A permanently locked share can never be withdrawn, and the app says so."],
];

export function Trust() {
  return (
    <section className="lp-section" aria-labelledby="trust-h">
      <div className="eyebrow">Safety and trust</div>
      <h2 id="trust-h">Built to be checked, not just believed.</h2>
      <div className="lp-trust">
        {TRUST.map(([t, d]) => (
          <div key={t}>
            <b>{t}</b>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQ: [string, string][] = [
  ["Is this real money?", "No. Launchcraft runs on Solana devnet only and refuses any other network. You need devnet SOL from the public faucet, or the built-in burner wallet."],
  ["What is a Dynamic Bonding Curve?", "Meteora's DBC prices a token along a curve as people buy it. When enough SOL has been deposited the pool graduates and can migrate to a Meteora DAMM v2 pool. Launchcraft lets you design that curve visually."],
  ["Which wallets work?", "A built-in burner wallet was used for every test. Phantom, Solflare and Backpack are supported through their browser providers but have not been exercised live yet."],
  ["Do I need an AI key?", "No. The rule-based Copilot readouts always work. Free-form AI questions turn on when the server has an Anthropic key."],
  ["What does a launch cost?", "About 0.027 SOL of devnet to deploy and about 0.024 SOL to migrate. A small curve can go all the way through graduation on roughly 0.2 SOL."],
];

export function Faq() {
  return (
    <section className="lp-section lp-narrow" aria-labelledby="faq-h">
      <div className="eyebrow">Questions</div>
      <h2 id="faq-h">Good to know.</h2>
      <div className="lp-faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="lp-cta">
      <h2>Shape your first curve.</h2>
      <p className="muted">It takes a minute, and nothing is spent until you press deploy.</p>
      <div className="hero-cta">
        <Link href="/create" className="btn primary">
          Create a launch →
        </Link>
        <Link href="/launches" className="btn ghost">
          My launches
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="brand">
        <BrandMark /> Launchcraft
      </div>
      <nav aria-label="Footer">
        <Link href="/create">Create</Link>
        <Link href="/launches">My launches</Link>
        <a href="https://github.com/matmaxgraphics/Launchcraft" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
        <a href="https://docs.meteora.ag/" target="_blank" rel="noreferrer">
          Meteora docs ↗
        </a>
      </nav>
      <span className="faint">Devnet only · Built for the Meteora DBC track</span>
    </footer>
  );
}
