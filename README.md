# Launchcraft

Design, simulate and launch a token on Meteora's Dynamic Bonding Curve (DBC).

```bash
npm run dev        # http://localhost:3100  (landing) and /create (the flow)
npm test           # 12 tests: validation + curve math cross-checked against the SDK's own quotes
npm run typecheck
```

## Layout

| Path | What |
|---|---|
| `src/launch/` | The product core. App-level `LaunchConfig`, presets, validation, curve math, simulator, and `toDbc.ts` (the only place that maps to Meteora SDK types). |
| `src/copilot/insights.ts` | Deterministic, factual Copilot readouts. Numbers always come from the real curve math. |
| `src/components/` | CurveLab (chart + 16 liquidity bars), simulator, Copilot panel, the four steps. |
| `spike/` | Throwaway scripts that proved the SDK path. `02` deploys to **devnet** with a disposable key in `.keys/` (gitignored). |

## DBC facts confirmed on devnet (see spike/)

- The curve is always 16 geometric price steps, edited as 16 liquidity weights.
- Graduation SOL is derived from the curve shape; it is not an input.
- At least 10% of migrated liquidity must be locked at day 1; the four liquidity shares sum to 100.
- Weighted curves need a `leftover` token buffer (the app defaults to 5%).
- Config and pool creation must be two transactions (one is over the 1232-byte limit).

## Deploying (devnet)

The Review step deploys for real: `createConfig` then `createPool` (two wallet signatures), then reads the live
config back and compares its graduation threshold with the design ("Verified on-chain").

- **Wallets:** Phantom, Solflare, Backpack (injected providers, no extra deps) or a **burner wallet** (throwaway key in this browser, devnet only).
- **Cost:** about 0.027 SOL per launch. Get devnet SOL from https://faucet.solana.com, or use the burner/wallet menu's airdrop.
- **Safety:** `assertDevnet` checks the RPC's genesis hash before anything is sent. A non-devnet endpoint is refused, so no real SOL can be spent.
- **Retry:** if the pool step fails after the config landed, "Retry pool creation" reuses the on-chain config instead of paying for a second one.
- **Records:** launches are remembered in this browser (`src/deploy/records.ts`) for LaunchLens.
- `npx tsx spike/04-deploy-via-lib.ts` runs the same deploy engine headless with the `.keys/devnet.json` keypair. `spike/fund.ts <addr> [sol]` sends devnet SOL from it.

## Status

Built: Create flow, simulator, Copilot (rule-based), wallet + devnet deployment.
Not yet built: LaunchLens (live pool dashboard), real trading against a deployed pool, LLM-backed Copilot, metadata/logo upload.
# Launchcraft
