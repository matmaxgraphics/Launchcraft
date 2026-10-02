import type { PublicKey, Transaction } from "@solana/web3.js";

/** The only wallet surface the app needs. Injected wallets and the devnet burner both implement it. */
export interface WalletHandle {
  id: string;
  name: string;
  kind: "injected" | "burner";
  publicKey: PublicKey;
  /** Returns the transaction with the wallet's signature added. Existing signatures are preserved. */
  signTransaction(tx: Transaction): Promise<Transaction>;
  disconnect(): Promise<void>;
}

export interface WalletOption {
  id: string;
  name: string;
  kind: "injected" | "burner";
  installed: boolean;
  installUrl?: string;
  connect(opts?: { silent?: boolean }): Promise<WalletHandle>;
}
