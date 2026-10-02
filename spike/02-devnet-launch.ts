/**
 * Launchcraft spike 2 (DEVNET ONLY): build curve -> createConfigAndPool -> read state back.
 * Uses a throwaway keypair stored in .keys/devnet.json (gitignored). Never put real funds in it.
 */
import fs from "node:fs";
import path from "node:path";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DynamicBondingCurveClient,
  MigratedCollectFeeMode,
  DammV2DynamicFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithLiquidityWeights,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
const KEY_FILE = path.join(process.cwd(), ".keys", "devnet.json");

function loadOrCreateKeypair(): Keypair {
  if (fs.existsSync(KEY_FILE)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEY_FILE, "utf8"))));
  }
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  const kp = Keypair.generate();
  fs.writeFileSync(KEY_FILE, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function ensureFunds(conn: Connection, kp: Keypair, minSol: number) {
  let bal = await conn.getBalance(kp.publicKey);
  console.log("balance:", bal / LAMPORTS_PER_SOL, "SOL");
  if (bal >= minSol * LAMPORTS_PER_SOL) return;
  for (const amt of [2, 1]) {
    try {
      console.log(`requesting airdrop of ${amt} SOL...`);
      const sig = await conn.requestAirdrop(kp.publicKey, amt * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig, "confirmed");
      bal = await conn.getBalance(kp.publicKey);
      console.log("balance:", bal / LAMPORTS_PER_SOL, "SOL");
      if (bal >= minSol * LAMPORTS_PER_SOL) return;
    } catch (e: any) {
      console.log("airdrop failed:", e.message?.slice(0, 120));
    }
  }
  console.log(`\nFund this address with devnet SOL (https://faucet.solana.com) then re-run:\n  ${kp.publicKey.toBase58()}`);
  process.exit(2);
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const payer = loadOrCreateKeypair();
  console.log("devnet wallet:", payer.publicKey.toBase58());
  await ensureFunds(conn, payer, 0.5);

  const client = DynamicBondingCurveClient.create(conn, "confirmed");

  const weights = Array.from({ length: 16 }, (_, i) => 1 + i * 0.25); // "gradual" preset
  const curveConfig = buildCurveWithLiquidityWeights({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 50_000_000,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: { startingFeeBps: 100, endingFeeBps: 100, numberOfPeriod: 0, totalDuration: 0 },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 50,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps25,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: DammV2DynamicFeeMode.Disabled,
        poolFeeBps: 25,
      },
    },
    liquidityDistribution: {
      // protocol rule: >=10% must be locked at day 1; the four values must sum to 100
      partnerPermanentLockedLiquidityPercentage: 10,
      partnerLiquidityPercentage: 40,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 50,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: 30,
    migrationMarketCap: 300,
    liquidityWeights: weights,
  } as any);

  const configKp = Keypair.generate();
  const baseMintKp = Keypair.generate();

  // FINDING: a 16-point curve + pool creation in ONE tx exceeds the 1232-byte limit,
  // so Launchcraft deploys in two transactions: (1) createConfig, (2) createPool.
  const configTx = await client.partner.createConfig({
    ...curveConfig,
    config: configKp.publicKey,
    feeClaimer: payer.publicKey,
    leftoverReceiver: payer.publicKey,
    quoteMint: WSOL,
    payer: payer.publicKey,
  } as any);
  console.log("sending createConfig...");
  const configSig = await sendAndConfirmTransaction(conn, configTx, [payer, configKp], {
    commitment: "confirmed",
  });
  console.log("config tx:", configSig);

  const poolTx = await client.creator.createPool({
    name: "Signal",
    symbol: "SIG",
    uri: "https://example.com/signal.json",
    payer: payer.publicKey,
    poolCreator: payer.publicKey,
    config: configKp.publicKey,
    baseMint: baseMintKp.publicKey,
  });
  console.log("sending createPool...");
  const sig = await sendAndConfirmTransaction(conn, poolTx, [payer, baseMintKp], {
    commitment: "confirmed",
  });
  console.log("pool tx:", sig);
  console.log(`explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // --- read it back (this is the LaunchLens data path) ---
  const poolInfo = await client.state.getPoolByBaseMint(baseMintKp.publicKey);
  if (!poolInfo) throw new Error("pool not found by base mint");
  const poolAddr = poolInfo.publicKey;
  console.log("\nconfig:", configKp.publicKey.toBase58());
  console.log("base mint:", baseMintKp.publicKey.toBase58());
  console.log("pool:", poolAddr.toBase58());

  const pool = (await client.state.getPool(poolAddr))?.poolState; // SDK wraps the account in { poolState }
  const threshold: BN = await client.state.getPoolMigrationQuoteThreshold(poolAddr);
  const quoteProgress = await client.state.getPoolQuoteTokenCurveProgress(poolAddr);
  const baseProgress = await client.state.getPoolBaseTokenCurveProgress(poolAddr);
  console.log("sqrtPrice:", pool?.sqrtPrice.toString());
  console.log("quoteReserve:", pool?.quoteReserve.toString());
  console.log("migrationQuoteThreshold (SOL):", threshold.toNumber() / 1e9);
  console.log("quote curve progress:", quoteProgress);
  console.log("base curve progress:", baseProgress);

  fs.mkdirSync("spike/out", { recursive: true });
  fs.writeFileSync(
    "spike/out/last-launch.json",
    JSON.stringify(
      { config: configKp.publicKey.toBase58(), baseMint: baseMintKp.publicKey.toBase58(), pool: poolAddr.toBase58(), tx: sig },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  if (e?.logs) console.error(e.logs.join("\n"));
  process.exit(1);
});
