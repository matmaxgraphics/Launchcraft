# Submission write-up: Launchcraft

Copy-ready text for the Meteora DBC track listing. Items marked **TODO** need your input; nothing here invents a link.

## At a glance

| | |
|---|---|
| **Name** | Launchcraft |
| **Tagline** | Design it. Simulate it. Launch it. |
| **Track** | Meteora Dynamic Bonding Curve (Superteam Earn / Solana Global Hackathon) |
| **Repository** | **TODO**: repo URL |
| **Live demo** | **TODO**: deployed URL (see "Deploying" below) |
| **Demo video** | **TODO**: video URL (script in [`DEMO.md`](DEMO.md)) |
| **Network** | Solana devnet |
| **Stack** | Next.js 16, React 19, TypeScript, `@meteora-ag/dynamic-bonding-curve-sdk`, `@meteora-ag/cp-amm-sdk`, Irys, Claude API |

## Short description (about 60 words)

Launchcraft is a visual launch studio for Meteora's Dynamic Bonding Curve. Paint your token's price-discovery curve, simulate trades against it, get plain-language explanations, then deploy on-chain and watch it live. Trade the curve, graduate it, migrate it to Meteora DAMM v2 in one transaction, and claim fees and liquidity, all in one app, verified end to end on devnet.

## Long description

**The problem.** A DBC launch is configured with curve segments, liquidity weights, fee schedules, locks and a migration target. The economics depend on all of them together, and creators usually only learn what they built after it is live and irreversible.

**The idea.** Treat the curve as the product. Launchcraft lets a creator *see* and *feel* the economics before signing anything, then carries the same launch through its entire lifecycle on Meteora.

**What it does.**

1. **CurveLab.** A log-scale chart over 16 draggable liquidity bars (DBC's curve is 16 geometric price steps) with presets. Dragging recomputes the SOL needed to graduate live, from the real SDK builder.
2. **Simulator.** Buys and sells against the designed curve before deployment, with exact pricing from our curve math (cross-checked against the SDK's own quotes). Progress tracks SOL deposited, not market cap, because that is what actually triggers graduation.
3. **Launch Copilot.** Deterministic, factual readouts computed from the curve ("half the SOL needed to graduate is absorbed in the last four price steps") with *Show me* highlights, plus optional free-form AI questions answered by Claude from a grounded, injection-safe context.
4. **Deploy.** Two transactions (config, then pool), preceded by a logo/metadata upload so a failed upload costs nothing, followed by an on-chain read-back that confirms the live threshold matches the design.
5. **LaunchLens.** A live dashboard for any devnet DBC pool, with real buys and sells quoted from the pool's own accounts.
6. **Graduate, migrate, claim.** Once the curve completes, anyone can migrate it to a DAMM v2 pool in one permissionless transaction; creators and partners claim fees and manage their liquidity positions.

## Why it is a strong use of DBC

- **Depth.** It exercises the whole DBC lifecycle, not one call: curve builder, pre-pool quotes, config and pool creation, state reads, swaps, migration to DAMM v2, leftover withdrawal, fee claims, and DAMM v2 position management.
- **Correctness first.** Every number is checked against the chain. Planned vs actual at migration: 227,784,041.25 vs 227,784,041.08 tokens and 0.113891969 vs 0.113891969 SOL; quotes matched real swaps exactly; our curve math matched the on-chain price to ~1e-14%.
- **It surfaces what DBC makes hard.** It enforces the 10% minimum lock, explains that graduation is SOL-triggered and derived from the curve, handles the 1232-byte transaction limit with a two-transaction deploy and a safe retry, and shows the protocol's 0.2% migration fee on both sides *before* signing.
- **Product quality.** A coherent design system, a mobile layout, explicit loading and error states, destructive-action confirmation, and a `doctor` command for demo day.

## Verified on devnet

See the table in the [README](../README.md#proven-on-devnet) and the landing page's *Proven on-chain* section. Artifacts (open on the Solana explorer, `cluster=devnet`):

| Step | Pool or account |
|---|---|
| Deploy with a logo | `GoGRKMAfVKjThCFkgJq4e5BFuuDynTaspTiYN3axCHce` |
| Trading | `87kvyfuJyjJeT63g4VRCqRUihjp1ivYWrEBRFf4UUiKP` |
| Graduated | `GSgaHoQeWVEvC5LqhWjVGqkLrmG4w6dhZQr78Jm1st5s` |
| Its DAMM v2 pool | `HbL6HrdNkV3sosQGxiDufUH4DnC3uq8wuZMaqK5Bs4BH` |
| Full lifecycle, positions withdrawn | `Eh98sUsBPG7AhJPDqCteZ3WgLfhRuA8zVX87ePmQn16a` |

58 automated tests cover validation, curve math against the SDK, deploy safety (including the devnet-only guard), claims, uploads, and the AI prompt layer.

## Being straightforward about limits

- Devnet only; mainnet needs real storage, RPC and a security review.
- No swap UI for the *migrated* DAMM v2 pool (LaunchLens shows its reserves and your positions).
- Phantom, Solflare and Backpack support is implemented but was not exercised live (the in-app burner wallet was used throughout).
- The AI answers need an Anthropic API key and were covered by tests with a fake client plus a check of the no-key path, not a live call.
- Only the 0.25% migration fee tier was exercised.

## Deploying

Step-by-step guide with the exact environment variables: [`DEPLOY.md`](DEPLOY.md). The app also runs locally with `npm run build && npm start -- -p 3100`. A public deployment publishes it under your account and has cost implications, so keep these in mind:

- **Uploads spend devnet SOL** from the server-held uploader wallet (`IRYS_UPLOADER_KEY` env var), about 0.00004 SOL each. The route is rate-limited (in-memory; use a shared store behind a load balancer).
- **AI answers spend your Anthropic credit** (`ANTHROPIC_API_KEY`); questions are rate-limited to 30/hour per connection. Omit the key and the AI box simply explains it is off.
- **Set `NEXT_PUBLIC_RPC_URL`** to a free devnet RPC endpoint; the public one rate-limits under load. It must be devnet.
- Hosts such as Vercel need these set as environment variables (never commit them).
