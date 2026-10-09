# Path to mainnet

Launchcraft runs on Solana **devnet only** today, and that is enforced in code. This page is the plan for changing that: what is already mainnet-ready, what has to change, and in what order. It is a plan, not a claim. Nothing below has been done on mainnet.

## What carries over unchanged

The product logic is network-agnostic, because it only talks to Meteora's SDKs:

- **Curve design, simulation and validation** (`src/launch/`) are pure functions, checked against the SDK in tests.
- **Deploy, trade, migrate and claim** (`src/deploy/`, `src/lens/`) use the same DBC and DAMM v2 program calls on any cluster. Each was proven on devnet end to end.
- **Verification after deploy** (read the live config back and compare it with the design) is exactly what a mainnet user needs most.

## What has to change

| Area | Today (devnet) | For mainnet |
|---|---|---|
| **Network guard** | `assertDevnet` refuses any RPC whose genesis hash isn't devnet's. | Make the cluster an explicit setting. Keep the genesis-hash check, but compare against the *configured* cluster, so a mismatched RPC is still refused. Show the network prominently and require a deliberate confirmation before the first mainnet transaction. |
| **RPC** | Public devnet endpoint, which rate-limits. | A paid or dedicated mainnet RPC with a server-side key, behind a proxy route so the key is never shipped to browsers. |
| **Logo storage** | A small server wallet pays Irys devnet (about 0.00004 SOL per upload). | Mainnet Irys costs real money. Either the creator pays at upload time (preferred), or uploads are gated behind a signed-in session with quotas. Never leave a funded server key open to the public. |
| **Rate limits** | In-memory, per server instance. | A shared store (for example Redis) so limits hold across serverless instances. |
| **Program and config addresses** | Devnet program IDs and migration-fee config keys. | Mainnet program IDs, and the migration fee tiers re-checked against mainnet values. Today only the 0.25% tier was exercised. |
| **Quote token** | SOL. | Keep SOL first. Other quote tokens (for example for stock or RWA pairs) need their own validation and minimums. |
| **Wallets** | The in-app burner wallet was used throughout. | Real-wallet testing with Phantom, Solflare and Backpack. The code exists but was never run live. Remove or clearly gate the burner wallet on mainnet. |
| **Secrets** | Env vars on a hosted account. | Per-environment keys, a spend limit on any AI key, and key rotation. |

## What must happen before real money

1. **Independent security review** of the transaction-building code and the upload route. Anything that signs or moves funds deserves outside eyes.
2. **A rehearsal on mainnet with tiny amounts**: one launch, one buy, one graduation of a deliberately small curve, one migration, one fee claim. The devnet script that stages this already exists (`spike/07-demo-graduation.ts`).
3. **Failure handling review**: partial deploys (config landed, pool did not) are already recoverable with Retry. Confirm the same on mainnet under real congestion and fee conditions.
4. **Legal and compliance review.** Helping people launch tradable tokens can be regulated, and the answer depends on where the operator and the users are. This is a business decision, not a code task, and it comes before any public launch.

## Rollout order

1. **Private beta, mainnet, allow-listed wallets**, small caps on curve size, with the guard and confirmations above.
2. **Open the studio**, but keep creator-paid storage and per-wallet limits.
3. **Presets and tooling** (Meteora's listing mentions a config preset marketplace and developer tooling): publish well-tested curve presets such as Flat, Gradual and Long, and expose the curve-design and simulation core as a library so other launchpads can embed it.
4. **Asset classes beyond memes**, for example launch shapes tuned to thinly traded or newly tokenized assets, using the same curve designer and simulator.

## Revenue note

Meteora's fee split gives a *partner* a share of trading fees. In our devnet test it was 40% creator and 40% partner at a 1% fee, with 20% to the protocol. A hosted Launchcraft that acts as the partner would earn that share on pools launched through it. That is a possible model, not something built or proven.

## Honest summary

The hard part, a correct and verified path through the entire DBC and DAMM v2 lifecycle, is done and tested on devnet. The remaining work is mostly operational and trust-related (keys, storage costs, review, compliance), not new Meteora integration. That is why this page lists a rehearsal and a review before any public mainnet launch.
