/**
 * Devnet SOL budget guard for the spike scripts. The public faucet is rate-limited (hours between requests),
 * so scripts that spend must declare roughly how much and refuse to dip below a protected reserve.
 *
 *   await assertBudget(conn, wallet.publicKey, 0.03, "claim fees");
 *
 * Reserve defaults to 0.25 SOL (enough for a full demo run: launch ~0.027 + migration ~0.024 + trades).
 * Override with LC_RESERVE_SOL, or bypass deliberately with LC_BUDGET_OVERRIDE=1.
 */
import { LAMPORTS_PER_SOL, type Connection, type PublicKey } from "@solana/web3.js";

export const DEFAULT_RESERVE_SOL = 0.25;

/**
 * `opts.reserve` overrides the default for wallets with a different purpose, e.g. the uploader wallet exists to be
 * spent down (reserve ~0.005) while the main test wallet protects the demo budget (reserve 0.25).
 */
export async function assertBudget(conn: Connection, who: PublicKey, spendSol: number, what: string, opts: { reserve?: number } = {}): Promise<number> {
  const reserve = opts.reserve ?? Number(process.env.LC_RESERVE_SOL ?? DEFAULT_RESERVE_SOL);
  const bal = (await conn.getBalance(who, "confirmed")) / LAMPORTS_PER_SOL;
  const after = bal - spendSol;
  console.log(`[budget] ${what}: spend ~${spendSol} SOL; balance ${bal.toFixed(4)} -> ~${after.toFixed(4)} (reserve ${reserve})`);
  if (after < reserve && process.env.LC_BUDGET_OVERRIDE !== "1") {
    throw new Error(
      `Budget guard: "${what}" would leave ~${after.toFixed(3)} SOL, below the ${reserve} SOL reserve. ` +
        `Fund ${who.toBase58()} from faucet.solana.com, lower LC_RESERVE_SOL, or set LC_BUDGET_OVERRIDE=1.`,
    );
  }
  return bal;
}
