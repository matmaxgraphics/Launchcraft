"use client";

import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { WalletButton } from "./WalletButton";

/** Header for the non-wizard pages (LaunchLens, My launches). The Create flow has its own stepper header. */
export function AppHeader({ active }: { active?: "create" | "launches" }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <BrandMark /> Launchcraft
      </Link>
      <nav className="stepper" aria-label="Main">
        <Link href="/create" className={`step-pill ${active === "create" ? "active" : ""}`}>
          <span className="t">Create</span>
        </Link>
        <Link href="/launches" className={`step-pill ${active === "launches" ? "active" : ""}`}>
          <span className="t">My launches</span>
        </Link>
      </nav>
      <span className="net-chip" style={{ marginRight: -8 }}>
        <span className="net-dot" /> devnet
      </span>
      <WalletButton />
    </header>
  );
}
