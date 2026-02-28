'use client';

import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionSignature,
} from '@solana/web3.js';
import { gamblingIdl } from './gamblingIdl';
import {
  BUYIN_BASE_UNITS,
  GAMBLING_PROGRAM_ID,
  PAYOUT_RATE_BASE_UNITS_PER_SECOND,
  assertSolanaClientConfig,
} from './solana';

type AnchorWalletLike = {
  publicKey: PublicKey | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
};

type RpcCallBuilder = {
  accounts: (accounts: Record<string, PublicKey>) => {
    rpc: () => Promise<TransactionSignature>;
  };
};

type GamblingProgramClient = {
  methods: {
    startSession: () => RpcCallBuilder;
    extract: () => RpcCallBuilder;
    recordDeath: () => RpcCallBuilder;
  };
};

function toAnchorWallet(wallet: AnchorWalletLike) {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions:
      wallet.signAllTransactions ??
      (async (transactions: Transaction[]) =>
        Promise.all(transactions.map((tx) => wallet.signTransaction(tx)))),
    signMessage: async (message: Uint8Array) => {
      void message;
      throw new Error('signMessage not supported by this wallet');
    },
  };
}

function getProgram(connection: Connection, wallet: AnchorWalletLike): GamblingProgramClient {
  const idlAddress =
    (gamblingIdl as { address?: string; metadata?: { address?: string } }).address ??
    (gamblingIdl as { metadata?: { address?: string } }).metadata?.address;
  if (idlAddress && idlAddress !== GAMBLING_PROGRAM_ID.toBase58()) {
    throw new Error(
      `IDL/program id mismatch: IDL=${idlAddress} ENV=${GAMBLING_PROGRAM_ID.toBase58()}. Rebuild/copy IDL or fix NEXT_PUBLIC_GAMBLING_PROGRAM_ID.`,
    );
  }

  const provider = new AnchorProvider(connection, toAnchorWallet(wallet), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });

  const program = new Program(gamblingIdl as unknown as Parameters<typeof Program>[0], provider);
  return program as unknown as GamblingProgramClient;
}

function derivePoolPda(authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), authority.toBuffer()],
    GAMBLING_PROGRAM_ID,
  )[0];
}

function deriveVaultPda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), pool.toBuffer()],
    GAMBLING_PROGRAM_ID,
  )[0];
}

function deriveSessionPda(pool: PublicKey, player: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('session'), pool.toBuffer(), player.toBuffer()],
    GAMBLING_PROGRAM_ID,
  )[0];
}

function getRunAccounts(player: PublicKey) {
  const { poolAuthorityPubkey } = assertSolanaClientConfig();
  const pool = derivePoolPda(poolAuthorityPubkey);
  const vault = deriveVaultPda(pool);
  const session = deriveSessionPda(pool, player);
  return { pool, vault, session };
}

export async function startSessionOnChain({
  connection,
  wallet,
}: {
  connection: Connection;
  wallet: AnchorWalletLike;
}): Promise<TransactionSignature> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(connection, wallet);
  const { pool, vault, session } = getRunAccounts(wallet.publicKey);
  const [poolInfo, vaultInfo] = await Promise.all([
    connection.getAccountInfo(pool),
    connection.getAccountInfo(vault),
  ]);
  if (!poolInfo) {
    const { poolAuthorityPubkey } = assertSolanaClientConfig();
    throw new Error(
      `Pool not initialized for authority ${poolAuthorityPubkey.toBase58()} (expected PDA ${pool.toBase58()}). Run pool:init with that authority wallet.`,
    );
  }
  if (!vaultInfo) {
    throw new Error(
      `Vault PDA ${vault.toBase58()} not found. Re-run pool:init for this program/authority.`,
    );
  }

  // If a previous run did not settle cleanly, the session PDA may still exist.
  // Close it first so startSession can re-init the account.
  const existingSession = await connection.getAccountInfo(session);
  if (existingSession) {
    await program.methods
      .recordDeath()
      .accounts({
        pool,
        vault,
        session,
        player: wallet.publicKey,
      })
      .rpc();
  }

  return program.methods
    .startSession()
    .accounts({
      pool,
      vault,
      session,
      player: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function extractOnChain({
  connection,
  wallet,
}: {
  connection: Connection;
  wallet: AnchorWalletLike;
}): Promise<TransactionSignature> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(connection, wallet);
  const { pool, vault, session } = getRunAccounts(wallet.publicKey);

  return program.methods
    .extract()
    .accounts({
      pool,
      vault,
      session,
      player: wallet.publicKey,
    })
    .rpc();
}

export async function recordDeathOnChain({
  connection,
  wallet,
}: {
  connection: Connection;
  wallet: AnchorWalletLike;
}): Promise<TransactionSignature> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(connection, wallet);
  const { pool, vault, session } = getRunAccounts(wallet.publicKey);

  return program.methods
    .recordDeath()
    .accounts({
      pool,
      vault,
      session,
      player: wallet.publicKey,
    })
    .rpc();
}

export function estimatePayoutBaseUnits(durationSeconds: number): bigint {
  const wholeSeconds = Math.max(0, Math.floor(durationSeconds));
  const winnings = PAYOUT_RATE_BASE_UNITS_PER_SECOND * BigInt(wholeSeconds);
  return BUYIN_BASE_UNITS + winnings;
}
