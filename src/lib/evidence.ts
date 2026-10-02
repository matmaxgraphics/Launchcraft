/**
 * Real Solana-devnet artifacts produced while building and testing Launchcraft. Shown on the landing page and
 * listed in docs/SUBMISSION.md. Devnet is occasionally reset by Solana, so these links can eventually expire;
 * `npm run doctor` re-checks that they still resolve.
 */
export interface Evidence {
  step: string;
  title: string;
  detail: string;
  kind: "address" | "tx";
  id: string;
}

export const EVIDENCE: Evidence[] = [
  {
    step: "01 · Deploy",
    title: "Pixel Pal ($PXL) with a logo",
    detail: "Config and pool created in two transactions; the logo and metadata were uploaded first and read back from the chain.",
    kind: "address",
    id: "GoGRKMAfVKjThCFkgJq4e5BFuuDynTaspTiYN3axCHce",
  },
  {
    step: "02 · Trade",
    title: "Signal ($SIG) trading on its curve",
    detail: "Real buys and sells; quotes matched the outcome exactly and our curve math matched the on-chain price.",
    kind: "address",
    id: "87kvyfuJyjJeT63g4VRCqRUihjp1ivYWrEBRFf4UUiKP",
  },
  {
    step: "03 · Graduate",
    title: "Demo Two ($TWO) at 100% of its threshold",
    detail: "One buy filled the curve to exactly 0.1141 SOL; after that the program rejects every trade (\"Pool is completed\").",
    kind: "address",
    id: "GSgaHoQeWVEvC5LqhWjVGqkLrmG4w6dhZQr78Jm1st5s",
  },
  {
    step: "04 · Migrate",
    title: "Its Meteora DAMM v2 pool",
    detail: "Opened at exactly the graduation price with 227.78M tokens and 0.1139 SOL, matching the plan to the digit.",
    kind: "address",
    id: "HbL6HrdNkV3sosQGxiDufUH4DnC3uq8wuZMaqK5Bs4BH",
  },
  {
    step: "05 · Claim",
    title: "Grad Test ($GRT): positions withdrawn",
    detail: "Launched, graduated, migrated and its liquidity position withdrawn, all from the app.",
    kind: "address",
    id: "Eh98sUsBPG7AhJPDqCteZ3WgLfhRuA8zVX87ePmQn16a",
  },
];

export const explorerUrl = (e: Evidence) => `https://explorer.solana.com/${e.kind === "tx" ? "tx" : "address"}/${e.id}?cluster=devnet`;
