"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection } from "@/deploy/rpc";
import { listWalletOptions } from "./providers";
import type { WalletHandle, WalletOption } from "./types";

interface WalletState {
  wallet: WalletHandle | null;
  /** Devnet balance in SOL, null while unknown. */
  balance: number | null;
  options: WalletOption[];
  connecting: boolean;
  error: string | null;
  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  /** Devnet-only faucet request for the connected wallet. */
  airdrop: (sol?: number) => Promise<void>;
  clearError: () => void;
}

const Ctx = createContext<WalletState | null>(null);
const LAST_KEY = "launchcraft:wallet:last";

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <WalletProvider>");
  return v;
}

function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/reject|denied|cancel|4001/i.test(m)) return "Connection request was declined.";
  return m;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletHandle | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet extensions inject after load, so detect on mount and again shortly after.
  useEffect(() => {
    setOptions(listWalletOptions());
    const t = setTimeout(() => setOptions(listWalletOptions()), 800);
    return () => clearTimeout(t);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!wallet) return setBalance(null);
    try {
      setBalance((await getConnection().getBalance(wallet.publicKey, "confirmed")) / LAMPORTS_PER_SOL);
    } catch {
      /* RPC hiccup: keep the last known balance */
    }
  }, [wallet]);

  // Refresh on connect, every 12s while connected, and whenever the tab regains focus (e.g. back from a faucet).
  useEffect(() => {
    refreshBalance();
    if (!wallet) return;
    const iv = setInterval(refreshBalance, 12_000);
    const onFocus = () => refreshBalance();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshBalance, wallet]);

  const connect = useCallback(async (id: string) => {
    setConnecting(true);
    setError(null);
    try {
      const opt = listWalletOptions().find((o) => o.id === id);
      if (!opt) throw new Error("Unknown wallet.");
      const handle = await opt.connect();
      setWallet(handle);
      try {
        localStorage.setItem(LAST_KEY, id);
      } catch {}
    } catch (e) {
      setError(friendly(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  // Silent re-connect of the last wallet (only succeeds if the user already trusted this site).
  useEffect(() => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_KEY);
    } catch {}
    if (!last) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const opt = listWalletOptions().find((o) => o.id === last);
        if (opt?.installed) {
          const h = await opt.connect({ silent: true });
          if (!cancelled) setWallet(h);
        }
      } catch {
        /* not trusted yet: user connects manually */
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await wallet?.disconnect();
    } catch {}
    setWallet(null);
    setBalance(null);
    try {
      localStorage.removeItem(LAST_KEY);
    } catch {}
  }, [wallet]);

  const airdrop = useCallback(
    async (sol = 1) => {
      if (!wallet) return;
      setError(null);
      try {
        const c = getConnection();
        const sig = await c.requestAirdrop(wallet.publicKey, sol * LAMPORTS_PER_SOL);
        await c.confirmTransaction(sig, "confirmed");
        await refreshBalance();
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        setError(/429|limit|too many/i.test(m) ? "The devnet faucet is rate-limited right now. Use faucet.solana.com instead." : "Airdrop failed: " + m.slice(0, 140));
      }
    },
    [wallet, refreshBalance],
  );

  const value = useMemo<WalletState>(
    () => ({ wallet, balance, options, connecting, error, connect, disconnect, refreshBalance, airdrop, clearError: () => setError(null) }),
    [wallet, balance, options, connecting, error, connect, disconnect, refreshBalance, airdrop],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
