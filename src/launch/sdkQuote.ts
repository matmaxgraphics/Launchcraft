/**
 * Ground-truth quote straight from the Meteora SDK (fresh pool, no RPC). Used to cross-check our own
 * curve math in tests and, later, to label simulator output "matches Meteora's quote".
 */
import BN from "bn.js";
import { Connection } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import type { DbcConfigParameters } from "./toDbc";
import { sqrtToPrice } from "./curveMath";

// Creating a Connection does not open a network call; getQuoteFromInputAmount is pure math.
const client = DynamicBondingCurveClient.create(new Connection("https://api.devnet.solana.com"), "confirmed");

export function sdkQuoteBuy(params: DbcConfigParameters, solGross: number, slippageBps = 50) {
  const q = client.pool.getQuoteFromInputAmount({
    config: params as never,
    swapBaseForQuote: false,
    amountIn: new BN(Math.round(solGross * 1e9)),
    slippageBps,
  });
  return {
    tokensOut: Number(q.outputAmount.toString()) / 1e6,
    priceAfter: sqrtToPrice(BigInt(q.nextSqrtPrice.toString())),
    feeSol: (Number(q.tradingFee.toString()) + Number(q.protocolFee.toString())) / 1e9,
  };
}
