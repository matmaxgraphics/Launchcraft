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

## LaunchLens (`/launch/<pool>`, list at `/launches`)

Live dashboard for any devnet DBC pool, polled every 6s (paused while the tab is hidden):
market cap and price, graduation progress, tokens sold, fees, activity, your holdings, and the live position drawn on the designed curve.
A plain-language readout restates the chain state (e.g. "about 57.8 SOL more must be deposited").

- **Trading:** real buys and sells (`swap2`), quoted from the pool's live accounts with 1% slippage. Buys use `PartialFill` so a buy that would pass graduation fills only what fits.
- **Graduation:** progress tracks the quote reserve against the migration threshold, not market cap. Once complete, the program rejects every trade ("Pool is completed"), so the UI says so instead of offering a swap.
- **Migration to DAMM v2:** a completed pool shows a "Migrate to Meteora DAMM v2" card. It is **permissionless**: any connected wallet can run the single transaction (about 0.024 SOL of rent, one signature), which creates the DAMM v2 pool at the graduation price plus two position NFTs. The card previews the result before you sign, then LaunchLens shows the live DAMM v2 reserves, implied price and the position NFTs.
  - The protocol takes the migration fee (20 bps on devnet, read from the pool) from **both** the SOL and the tokens. Predicted vs actual on devnet: 227,784,041.25 vs 227,784,041.08 tokens, 0.113891969 vs 0.113891969 SOL.
  - **Leftover:** the supply held back at launch (the 5% buffer) can be sent to the config's leftover receiver with "Withdraw leftover". Anyone can pay the fee; the tokens always go to the receiver.
  - Not built: trading on the DAMM v2 pool itself, claiming the position NFTs' fees or liquidity, and claiming creator/partner trading fees.
- **Trust checks:** the live on-chain price is compared against the designed curve's math; the readout flags drift over 0.1%.
- Token name/symbol are read from the Metaplex metadata account. Works for any pool, not just ones deployed here.

Scripts: `spike/05-probe-accounts.ts <pool>` dumps raw account fields, `spike/06-trade-via-lib.ts <pool> [sol]` runs a real buy+sell headless
and compares quote vs result, `spike/07-demo-graduation.ts [startMcap gradMcap name symbol]` deploys a small-threshold launch (default ~0.23 SOL) and trades it to completion,
`spike/08-migrate.ts <pool>` migrates a completed pool to DAMM v2 and inspects the result, `spike/09-withdraw-leftover.ts <pool>` withdraws the leftover tokens.

## Status

Built: Create flow, simulator, Copilot (rule-based), wallet + devnet deployment, LaunchLens with live trading, DAMM v2 migration and leftover withdrawal.
Not yet built: trading on the DAMM v2 pool, fee/position claiming, LLM-backed Copilot, metadata/logo upload.
# Launchcraft
