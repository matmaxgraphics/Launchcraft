# Demo walkthrough (about 4 minutes)

A script for recording or presenting Launchcraft live. The aim is one continuous story: *shape the curve, prove it, launch it, watch it graduate and migrate, collect.* Nothing here needs a wallet extension: the in-app burner wallet is enough.

## Pre-flight (do this before recording)

```bash
npm run doctor        # read-only: devnet RPC, wallet balances, optional keys, proof links
npm run dev           # http://localhost:3100
```

1. **Fund the burner.** Open the app, connect **Burner wallet (devnet)**, copy its address from the wallet menu, and fund it with about **0.25 SOL** (faucet.solana.com, or `npx tsx spike/fund.ts <address> 0.2`). The faucet only allows a request every few hours, so do this early.
2. **Stage the "graduation" scene** (so you don't wait on it live). Create a small launch and fill it to the top, but **do not migrate it**; you'll do that on camera:
   ```bash
   npx tsx spike/07-demo-graduation.ts 0.05 0.5 "Demo" DEMO
   ```
   It prints `OPEN IN LAUNCHLENS: /launch/<pool>`. Keep that address. (It costs about 0.15 SOL from the test wallet. After migrating on camera, most of it comes back with `npx tsx spike/12-positions.ts <pool> withdraw`, because that wallet owns the liquidity positions.)
3. **Optional: turn on the AI answers.** Put `ANTHROPIC_API_KEY` in `.env.local` and restart `npm run dev`. Skip this and the ask box just says how to enable it; the rest of the demo is unaffected.
4. **Clean slate.** In `/create`, use **Start over**. Set the browser window to about 1280×800 and close devtools.

## Script

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Landing | Let the curve draw itself. | "Launching on a bonding curve usually means filling in a config file and hoping. Launchcraft lets you *see* the economics first." |
| 0:15 | Landing → proof section | Scroll to **Proven on-chain**. | "Everything you're about to see ran on Solana devnet against Meteora's real programs; these are the receipts." |
| 0:30 | `/create` · Token | **Fill with an example**, then add a logo and description. | "A token name, a logo, a description. The logo uploads at launch, before any SOL is spent." |
| 0:50 | CurveLab | Click through the presets, then **drag across the bars** to paint a shape. Hover the curve. | "This is a real DBC curve: 16 price steps, and each bar is how much liquidity sits in that step. More liquidity means a given amount of SOL moves the price less." |
| 1:15 | CurveLab · Copilot | Click **Show me** on the "last four steps" readout. | "The Copilot explains my configuration in plain language, computed from the real curve math, not guessed." |
| 1:30 | CurveLab · Simulator | Buy 4, 12, 25 SOL. Point at the white dot and the progress bar. | "I can trade against it before deploying. Note progress is *SOL deposited*, not market cap, because that is what actually triggers graduation." |
| 2:00 | Fees & liquidity | Show the locked share. | "Meteora requires at least 10% of liquidity to be permanently locked, so the app enforces it." |
| 2:10 | Review → Deploy | Connect the burner, press **Launch on devnet**. Narrate the stages. | "Safety check, logo upload, two transactions, then it reads the live config back and confirms it matches my design." |
| 2:45 | LaunchLens (new pool) | Open LaunchLens. Buy 0.1 SOL. | "Now it's a live dashboard: price, progress, fees. This buy is a real transaction." |
| 3:05 | LaunchLens (staged pool) | Switch to the staged pool at 100%. Click **Migrate to DAMM v2**. | "This one filled its curve. Migration is permissionless: one signature creates the Meteora DAMM v2 pool." |
| 3:30 | Migrated card | Point at *matches graduation price*. | "It opened at exactly the graduation price, with the planned reserves." |
| 3:40 | Earnings & claims | Show the claim buttons and the position split. | "Creators and partners claim their fee share here and manage their liquidity; the locked share can never be withdrawn." |
| 3:50 | Copilot ask box *(if key set)* | Ask "Explain where this launch stands". | "And you can ask free-form questions. It only knows the numbers Launchcraft computed." |
| 4:00 | Landing | Back to the proof section. | "Design it, simulate it, launch it, and see it through graduation. All on Meteora DBC." |

## If something goes wrong on camera

- **Slow or failing RPC.** The public devnet RPC rate-limits. LaunchLens offers a *Try again* link after 15 s; set `NEXT_PUBLIC_RPC_URL` to a free devnet endpoint for a steadier take.
- **Low balance.** The Launch button disables under 0.05 SOL and the panel offers an airdrop link.
- **Faucet exhausted.** The landing page's proof links and the staged pools show the finished result; you can narrate over those.
- **Upload service down.** Skip the logo; the launch proceeds with a name-and-symbol placeholder.
- **Stale hot reload in dev.** If the page looks wrong after editing code, restart `npm run dev` (or demo from `npm run build && npm start -- -p 3100`).

## SOL cost of the full demo

| Item | SOL |
|---|---|
| Deploy the live launch | ~0.027 |
| Buy on it | 0.1 |
| Migrate the staged pool | ~0.024 |
| Network fees | ~0.005 |
| Staging the graduation scene | ~0.15 gross from the test wallet (mostly recoverable with `spike/12-positions.ts <pool> withdraw`) |

About **0.2 SOL** of burner balance covers the on-camera part; the staging script uses the main test wallet.
