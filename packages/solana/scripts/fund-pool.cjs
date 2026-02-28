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
  console.log(`Usage:\n  npm run pool:fund -- <amount_lamports>\n\nExample:\n  npm run pool:fund -- 200000000\n\nEnv fallbacks:\n  FUND_AMOUNT_BASE_UNITS\n  ANCHOR_PROVIDER_URL / SOLANA_RPC_URL\n  ANCHOR_WALLET\n  GAMBLING_PROGRAM_ID`);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  const amountRawArg = process.argv[2];
  const amountRaw = amountRawArg || process.env.FUND_AMOUNT_BASE_UNITS;
  if (!amountRaw) {
    usage();
    throw new Error('Missing funding amount.');
  }
  parseU64String(amountRaw, 'fund amount');

  const { anchor, program, provider, programId, authority, rpcUrl } = buildProgram();

  const pool = derivePoolPda(authority, programId);
  const vault = deriveVaultPda(pool, programId);

  const existingPool = await provider.connection.getAccountInfo(pool);
  if (!existingPool) {
    throw new Error(
      `Pool PDA ${pool.toBase58()} does not exist. Run \`npm run pool:init\` first with the same authority wallet.`,
    );
  }

  const fundPool = resolveMethod(program.methods, 'fundPool', 'fund_pool');
  const signature = await fundPool(new anchor.BN(amountRaw))
    .accounts({
      pool,
      vault,
      authority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('Pool funded.');
  console.log(`Signature: ${signature}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Program: ${programId.toBase58()}`);
  console.log(`Authority: ${authority.toBase58()}`);
  console.log(`Pool PDA: ${pool.toBase58()}`);
  console.log(`Vault PDA: ${vault.toBase58()}`);
  console.log(`Amount: ${amountRaw} lamports`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
