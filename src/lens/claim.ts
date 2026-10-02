/**
 * Claiming trading fees from a DBC pool. Each trade's fee is split between the protocol, the creator and the
 * partner (config owner). The creator and the partner each claim their own share by signing; the protocol's
 * share isn't claimable by them. Fees here are paid in the quote token (SOL).
 */
import BN from "bn.js";
import { PublicKey, type Connection } from "@solana/web3.js";
import { friendlyError, signSendConfirm } from "@/deploy/deploy";
import type { WalletHandle } from "@/wallet/types";
import { dbcClient, type LaunchLive, type LaunchStatic } from "./read";

/** u64::MAX: "claim everything that's available" for the max-amount caps. */
const U64_MAX = new BN("18446744073709551615");

export type ClaimRole = "creator" | "partner";

export interface ClaimOption {
  role: ClaimRole;
  /** The only wallet that can sign this claim. */
  claimant: string;
  amountSol: number;
  /** True when the connected wallet is the claimant. */
  canClaim: boolean;
}

/** What each role could claim right now, and whether `wallet` is the one allowed to. */
export function claimOptions(st: LaunchStatic, live: LaunchLive, wallet: string | null): ClaimOption[] {
  return [
    { role: "creator", claimant: st.creator, amountSol: live.fees.creatorSol, canClaim: wallet === st.creator },
    { role: "partner", claimant: st.feeClaimer, amountSol: live.fees.partnerSol, canClaim: wallet === st.feeClaimer },
  ];
}

/** Lamports that clear transaction fees. Claiming less than this isn't worth a signature. */
export const MIN_CLAIM_SOL = 0.00001;

export const claimableTotal = (opts: ClaimOption[]) => opts.filter((o) => o.canClaim).reduce((n, o) => n + o.amountSol, 0);

/** Claims one role's share. Returns the transaction signature. */
export async function claimFees(conn: Connection, wallet: WalletHandle, st: LaunchStatic, role: ClaimRole): Promise<string> {
  try {
    const client = dbcClient(conn);
    const pool = new PublicKey(st.pool);
    const common = { payer: wallet.publicKey, pool, maxBaseAmount: U64_MAX, maxQuoteAmount: U64_MAX };
    const tx =
      role === "creator"
        ? await client.creator.claimCreatorTradingFee({ ...common, creator: wallet.publicKey })
        : await client.partner.claimPartnerTradingFee({ ...common, feeClaimer: wallet.publicKey });
    return await signSendConfirm(conn, tx, wallet, []);
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
