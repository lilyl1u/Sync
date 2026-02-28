#!/usr/bin/env node

const { SystemProgram } = require('@solana/web3.js');
const {
  parseU64String,
  buildProgram,
  derivePoolPda,
  deriveVaultPda,
  resolveMethod,
} = require('./_common.cjs');

function usage() {
  console.log(`Usage:\n  npm run pool:init\n\nEnv overrides:\n  NEXT_PUBLIC_BUYIN_BASE_UNITS (default: 5000000)\n  NEXT_PUBLIC_PAYOUT_RATE_BASE_UNITS_PER_SECOND (default: 100000)\n  ANCHOR_PROVIDER_URL / SOLANA_RPC_URL\n  ANCHOR_WALLET\n  GAMBLING_PROGRAM_ID`);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  const buyInRaw = parseU64String(
    process.env.NEXT_PUBLIC_BUYIN_BASE_UNITS || '5000000',
    'NEXT_PUBLIC_BUYIN_BASE_UNITS',
  );
  const payoutRateRaw = parseU64String(
    process.env.NEXT_PUBLIC_PAYOUT_RATE_BASE_UNITS_PER_SECOND || '100000',
    'NEXT_PUBLIC_PAYOUT_RATE_BASE_UNITS_PER_SECOND',
  );

  const { anchor, program, provider, programId, authority, rpcUrl } = buildProgram();

  const pool = derivePoolPda(authority, programId);
  const vault = deriveVaultPda(pool, programId);

  const existingPool = await provider.connection.getAccountInfo(pool);
  if (existingPool) {
    console.log('Pool already initialized for this authority.');
    console.log(`RPC: ${rpcUrl}`);
    console.log(`Program: ${programId.toBase58()}`);
    console.log(`Authority: ${authority.toBase58()}`);
    console.log(`Pool PDA: ${pool.toBase58()}`);
    console.log(`Vault PDA: ${vault.toBase58()}`);
    return;
  }

  const initializePool = resolveMethod(program.methods, 'initializePool', 'initialize_pool');
  const signature = await initializePool(
    new anchor.BN(buyInRaw),
    new anchor.BN(payoutRateRaw),
  )
    .accounts({
      pool,
      vault,
      authority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('Pool initialized.');
  console.log(`Signature: ${signature}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Program: ${programId.toBase58()}`);
  console.log(`Authority: ${authority.toBase58()}`);
  console.log(`Pool PDA: ${pool.toBase58()}`);
  console.log(`Vault PDA: ${vault.toBase58()}`);
  console.log(`Buy-in: ${buyInRaw} lamports`);
  console.log(`Payout rate: ${payoutRateRaw} lamports/sec`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
