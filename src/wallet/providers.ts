import { Keypair, PublicKey, type Transaction } from "@solana/web3.js";
import type { WalletHandle, WalletOption } from "./types";

/* ---------- injected wallets (no dependencies: they all expose a Phantom-style provider) ---------- */

interface InjectedProvider {
  publicKey?: { toString(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: { toString(): string } } | void>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
}

type Win = Window & {
  phantom?: { solana?: InjectedProvider & { isPhantom?: boolean } };
  solflare?: InjectedProvider & { isSolflare?: boolean };
  backpack?: InjectedProvider & { isBackpack?: boolean };
};

const win = () => (typeof window === "undefined" ? undefined : (window as Win));

function injected(id: string, name: string, installUrl: string, get: (w: Win) => InjectedProvider | undefined): WalletOption {
  return {
    id,
    name,
    kind: "injected",
    installed: !!(win() && get(win()!)),
    installUrl,
    async connect(opts) {
      const p = win() && get(win()!);
      if (!p) throw new Error(`${name} isn't installed in this browser.`);
      const res = await p.connect(opts?.silent ? { onlyIfTrusted: true } : undefined);
      const key = (res && res.publicKey) || p.publicKey;
      if (!key) throw new Error(`${name} didn't return an account.`);
      return {
        id,
        name,
        kind: "injected",
        publicKey: new PublicKey(key.toString()),
        signTransaction: (tx) => p.signTransaction(tx),
        disconnect: () => p.disconnect(),
      };
    },
  };
}

/* ---------- burner wallet: a throwaway devnet keypair kept in this browser ---------- */

const BURNER_KEY = "launchcraft:burner:v1";

function loadBurner(): Keypair | null {
  try {
    const raw = localStorage.getItem(BURNER_KEY);
    return raw ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw))) : null;
  } catch {
    return null;
  }
}
export const hasBurner = () => !!loadBurner();

function burnerHandle(kp: Keypair): WalletHandle {
  return {
    id: "burner",
    name: "Burner wallet",
    kind: "burner",
    publicKey: kp.publicKey,
    // partialSign keeps any signatures already on the transaction
    signTransaction: async (tx) => {
      tx.partialSign(kp);
      return tx;
    },
    disconnect: async () => {},
  };
}

const burnerOption: WalletOption = {
  id: "burner",
  name: "Burner wallet (devnet)",
  kind: "burner",
  installed: true,
  async connect(opts) {
    let kp = loadBurner();
    if (!kp) {
      if (opts?.silent) throw new Error("No burner wallet yet.");
      kp = Keypair.generate();
      try {
        localStorage.setItem(BURNER_KEY, JSON.stringify(Array.from(kp.secretKey)));
      } catch {
        throw new Error("Couldn't store a burner wallet in this browser (storage is blocked).");
      }
    }
    return burnerHandle(kp);
  },
};

export function forgetBurner() {
  try {
    localStorage.removeItem(BURNER_KEY);
  } catch {}
}

export function listWalletOptions(): WalletOption[] {
  return [
    injected("phantom", "Phantom", "https://phantom.app/download", (w) => (w.phantom?.solana?.isPhantom ? w.phantom.solana : undefined)),
    injected("solflare", "Solflare", "https://solflare.com/download", (w) => (w.solflare?.isSolflare ? w.solflare : undefined)),
    injected("backpack", "Backpack", "https://backpack.app/download", (w) => (w.backpack?.isBackpack ? w.backpack : undefined)),
    burnerOption,
  ];
}

export { burnerHandle };
