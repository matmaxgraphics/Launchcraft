# Deploying Launchcraft to Vercel

About 10 minutes. The app is a standard Next.js 16 project; a clean production build, every route, and a live upload through the production bundle were tested locally before writing this.

## 0. Push the latest code

From the project folder (the `origin` remote is already `matmaxgraphics/Launchcraft`):

```bash
git rm --cached tsconfig.tsbuildinfo      # a build artifact that shouldn't be tracked
git add -A
git commit -m "Prepare for Vercel: function durations, Node engine, smoke test, deploy docs"
git push
```

Check `git status` first and make sure nothing under `.keys/` or any `.env*` file is listed (they are gitignored).

## 1. Import the repo

1. Go to <https://vercel.com/new> and sign in (GitHub login is simplest).
2. **Import** `matmaxgraphics/Launchcraft`. (If it isn't listed, use *Adjust GitHub App Permissions* and grant access to that repo.)
3. Leave the defaults: Framework **Next.js**, Root Directory `./`, Build Command `next build`, Install Command default.
4. **Before pressing Deploy,** open **Environment Variables** and add the ones below.

## 2. Environment variables

Add each under **Settings → Environment Variables** (or in the import screen). Tick **Production** (and **Preview** if you want preview deployments to work too).

| Name | Needed for | Secret? | Value |
|---|---|---|---|
| `IRYS_UPLOADER_KEY` | Logo and metadata upload | **Yes (server only)** | The contents of `.keys/uploader.json`: one line like `[12,34,…]` (64 numbers). Copy it without displaying it: `Get-Content .keys\uploader.json -Raw \| Set-Clipboard`, then paste. |
| `ANTHROPIC_API_KEY` | AI Copilot answers | **Yes (server only)** | A key from <https://console.anthropic.com/>. Optional: leave it out and the AI box simply says it's off. |
| `COPILOT_MODEL` | Optional | No | Defaults to `claude-opus-5-5`. Set a cheaper model to lower cost. |
| `NEXT_PUBLIC_RPC_URL` | Optional, recommended | **No: it is public** | A devnet RPC URL. Leave unset to use the public endpoint (it rate-limits). It **must** be devnet; the app refuses anything else. |
| `NEXT_PUBLIC_SITE_URL` | Optional | No | Only if you add a custom domain (e.g. `https://launchcraft.xyz`); otherwise the share card uses Vercel's production URL automatically. |

Rules of thumb:

- **Never** put a secret under a name starting with `NEXT_PUBLIC_`; those are shipped to every visitor's browser. `NEXT_PUBLIC_RPC_URL` is meant to be public, so if your RPC provider puts an API key in the URL, restrict that key to your domain at the provider, or use the public endpoint.
- Mark the two secrets as **Sensitive** in Vercel so their values can't be read back in the dashboard.
- Environment variables take effect on the **next deployment**. After adding or changing any, press **Redeploy**.

### Funding the uploader

The uploader wallet pays for storage (about 0.00004 SOL per upload) and tops up its Irys balance in small steps. Check it:

```bash
npm run doctor
```

If it's low, send devnet SOL with `npx tsx spike/fund.ts <uploader address> 0.02` (the budget guard protects your main test wallet's reserve).

### A fresh key for the public deployment (recommended)

The key you paste into Vercel is readable by anyone with access to your Vercel project. It's a throwaway devnet key, but don't reuse it for anything else. For a clean separation, make one just for the deployment:

```bash
npx tsx spike/new-key.ts uploader-prod
npx tsx spike/fund.ts <printed address> 0.03
Get-Content .keys\uploader-prod.json -Raw | Set-Clipboard    # paste as IRYS_UPLOADER_KEY
```

## 3. Deploy and smoke-test

Press **Deploy**. When it finishes, open the URL, then run the smoke test against it:

```bash
npm run smoke -- https://YOUR-APP.vercel.app            # read-only, spends nothing
npm run smoke -- https://YOUR-APP.vercel.app --upload   # also does one real upload (~0.0001 devnet SOL)
```

It checks every page, the share image and icon, that the share card's `og:image` is an absolute URL (not localhost), which optional features are configured, and that the API guards reject bad input.

Then click through once by hand: Create → Fill with an example → CurveLab → Review, connect the **Burner wallet**, fund it from the faucet, and launch.

## 4. Finish the submission

1. Put the live URL, the repo URL and the video URL into the **TODO** rows of [`SUBMISSION.md`](SUBMISSION.md).
2. Optional: in the Vercel project, add your custom domain under *Settings → Domains*.

## Things to know about a public deployment

- **Rate limits are per server instance and in memory.** On Vercel's serverless functions that is a soft limit. For a hackathon demo that is fine; a real launch needs a shared store.
- **AI usage spends your Anthropic credit.** Set a monthly spend limit on the key in the Anthropic console before sharing the link.
- **Uploads spend devnet SOL,** which has no real value, but the uploader can run dry. The app degrades gracefully: the launch can proceed without a logo.
- **Devnet can be reset by Solana,** which would expire the proof links and any launches. `npm run doctor` checks them.
- **Browser wallets are per device.** The burner wallet lives in each visitor's own browser; nothing about it is stored on your server.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Build fails with a type error | Run `npm run typecheck` locally; fix, push. |
| `/api/upload` returns an empty **500** (smoke test: "Unexpected end of JSON input") | The function crashed while loading. Seen once: Turbopack's `serverExternalPackages` renames packages to hash-suffixed links inside `.next/node_modules`, which Vercel doesn't preserve. Fixed by not listing `@irys/*` there (see the note in `next.config.ts`) and loading Irys lazily. Don't re-add it. If a 500 ever recurs, open the deployment's **Logs** in Vercel and look for a "Cannot find module" line. |
| Logo upload says it isn't set up | `IRYS_UPLOADER_KEY` missing, malformed, or added after the last deploy (redeploy). It must be the raw JSON array. |
| "The uploader wallet is out of devnet SOL" | Fund it (see above). |
| AI box says "aren't set up" | `ANTHROPIC_API_KEY` missing or added without a redeploy. |
| AI box says the key was rejected | The key is wrong or revoked; replace it and redeploy. |
| Pages load but data never arrives | The public devnet RPC is throttling; set `NEXT_PUBLIC_RPC_URL` to a dedicated devnet endpoint and redeploy. |
| Share card shows no image | Open `/opengraph-image` directly; if that works, social sites cache aggressively, so re-share after a while or use their card validator. |
