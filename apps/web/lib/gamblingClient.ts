'use client';

import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type TransactionSignature,
} from '@solana/web3.js';
import { gamblingIdl } from './gamblingIdl';
import {
  GAMBLING_PROGRAM_ID,
  assertSolanaClientConfig,
} from './solana';

type AnchorWalletLike = {
  publicKey: PublicKey | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
};

type InstructionBuilder = {
  accounts: (accounts: Record<string, PublicKey>) => {
    rpc: () => Promise<TransactionSignature>;
    instruction: () => Promise<TransactionInstruction>;
  };
};

type RpcCallBuilder = {
  accounts: (accounts: Record<string, PublicKey>) => {
    rpc: () => Promise<TransactionSignature>;
  };
};

type GamblingProgramClient = {
  methods: {
    startSession: () => InstructionBuilder;
    startSessionWithAmount: (amount: BN, payoutRate: BN) => InstructionBuilder;
    extract: (amount: BN) => RpcCallBuilder;
    recordDeath: () => InstructionBuilder;
    closeLegacySession: () => InstructionBuilder;
  };
  provider: AnchorProvider;
};

function toAnchorWallet(wallet: AnchorWalletLike): { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction>; signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>; signMessage: (msg: Uint8Array) => Promise<Uint8Array> } {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction as (tx: Transaction) => Promise<Transaction>,
    signAllTransactions:
      wallet.signAllTransactions ??
      (async (transactions: Transaction[]) =>
        Promise.all(transactions.map((tx) => wallet.signTransaction(tx)))),
    signMessage: async (message: Uint8Array) => {
      void message;
      throw new Error('signMessage not supported by this wallet');
    },
  } as { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction>; signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>; signMessage: (msg: Uint8Array) => Promise<Uint8Array> };
}

function getProgram(connection: Connection, wallet: AnchorWalletLike): GamblingProgramClient {
  const provider = new AnchorProvider(connection, toAnchorWallet(wallet) as never, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });

  const normalizedIdl = {
    ...(gamblingIdl as Record<string, unknown>),
    address: GAMBLING_PROGRAM_ID.toBase58(),
    metadata: {
      ...(((gamblingIdl as { metadata?: Record<string, unknown> }).metadata) ?? {}),
      address: GAMBLING_PROGRAM_ID.toBase58(),
    },
  };

  const program = new Program(normalizedIdl as object, provider);
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

/** Pool account layout: 8-byte discriminator, authority(32), buy_in(8), payout_rate(8), ... */
function decodePool(data: Buffer): { buyInBaseUnits: bigint; payoutRateBaseUnitsPerSecond: bigint } {
  const buyIn = data.readBigUInt64LE(8 + 32);
  const payoutRate = data.readBigUInt64LE(8 + 32 + 8);
  return { buyInBaseUnits: buyIn, payoutRateBaseUnitsPerSecond: payoutRate };
}

/** Session layout: disc(8), player(32), pool(32), started_at(8), last_claimed_at(8), buy_in_paid(8), payout_rate(8), bump(1) */
function decodeSession(data: Buffer): {
  startedAt: number;
  lastClaimedAt: number;
  buyInPaid: bigint;
  payoutRate: bigint;
} {
  const base = 8 + 32 + 32;
  const startedAt = Number(data.readBigInt64LE(base));
  const lastClaimedAt = Number(data.readBigInt64LE(base + 8));
  const buyInPaid = data.readBigUInt64LE(base + 16);
  const payoutRate = data.readBigUInt64LE(base + 24);
  return { startedAt, lastClaimedAt, buyInPaid, payoutRate };
}

export type PoolConfig = {
  buyInBaseUnits: bigint;
  payoutRateBaseUnitsPerSecond: bigint;
};

const LAMPORTS_PER_SOL = 1_000_000_000n;

function solToLamports(solAmount: number): bigint {
  if (!Number.isFinite(solAmount) || solAmount <= 0) {
    throw new Error('SOL amount must be a positive number');
  }
  return BigInt(Math.round(solAmount * Number(LAMPORTS_PER_SOL)));
}

export async function fetchPoolConfig(connection: Connection): Promise<PoolConfig> {
  const { poolAuthorityPubkey } = assertSolanaClientConfig();
  const pool = derivePoolPda(poolAuthorityPubkey);
  const info = await connection.getAccountInfo(pool);
  if (!info?.data) {
    throw new Error(`Pool not found. Run pool:init first.`);
  }
  return decodePool(Buffer.from(info.data));
}

/**
 * Compute the exact duration and payout the program will use for extract.
 * Uses the session's per-session payout rate (falls back to pool rate for legacy sessions).
 */
export async function getExtractParams(
  connection: Connection,
  player: PublicKey,
  clientDurationSeconds: number,
): Promise<{ durationSeconds: number; payoutBaseUnits: bigint }> {
  const { pool, session } = getRunAccounts(player);
  const [poolInfo, sessionInfo] = await Promise.all([
    connection.getAccountInfo(pool),
    connection.getAccountInfo(session),
  ]);
  if (!poolInfo?.data) throw new Error('Pool not found');
  if (!sessionInfo?.data) throw new Error('No active session');

  const poolConfig = decodePool(Buffer.from(poolInfo.data));
  const sessionData = decodeSession(Buffer.from(sessionInfo.data));
  const rate = sessionData.payoutRate > 0n
    ? sessionData.payoutRate
    : poolConfig.payoutRateBaseUnitsPerSecond;

  let blockTime: number | null = null;
  const slot = await connection.getSlot('confirmed');
  for (let i = 0; i < 10 && slot - i >= 0; i++) {
    blockTime = await connection.getBlockTime(slot - i);
    if (blockTime != null) break;
  }
  if (blockTime == null) throw new Error('Could not get block time');

  const maxElapsed = Math.max(0, blockTime - sessionData.lastClaimedAt);
  const durationSeconds = Math.min(
    Math.max(0, Math.floor(clientDurationSeconds)),
    maxElapsed,
  );
  const winnings = rate * BigInt(durationSeconds);
  const payoutBaseUnits = sessionData.buyInPaid + winnings;

  return { durationSeconds, payoutBaseUnits };
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

  // If a previous run did not settle cleanly (death or refresh), the session PDA may still exist.
  // Combine recordDeath + startSession into one transaction so the user sees a single Phantom popup.
  const existingSession = await connection.getAccountInfo(session);
  const recordDeathAccounts = { pool, vault, session, player: wallet.publicKey };
  const startSessionAccounts = {
    pool,
    vault,
    session,
    player: wallet.publicKey,
    systemProgram: SystemProgram.programId,
  };

  const NEW_SESSION_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1;

  if (existingSession) {
    const isLegacy = existingSession.data.length !== NEW_SESSION_SIZE;
    const closeIx = isLegacy
      ? await program.methods
          .closeLegacySession()
          .accounts(recordDeathAccounts)
          .instruction()
      : await program.methods
          .recordDeath()
          .accounts(recordDeathAccounts)
          .instruction();
    const startSessionIx = await program.methods
      .startSession()
      .accounts(startSessionAccounts)
      .instruction();
    const tx = new Transaction().add(closeIx, startSessionIx);
    return program.provider.sendAndConfirm(tx);
  }

  return program.methods
    .startSession()
    .accounts(startSessionAccounts)
    .rpc();
}

export async function startSessionWithAmountOnChain({
  connection,
  wallet,
  amountBaseUnits,
  payoutRateBaseUnits,
}: {
  connection: Connection;
  wallet: AnchorWalletLike;
  amountBaseUnits: bigint;
  payoutRateBaseUnits: bigint;
}): Promise<TransactionSignature> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }
  if (amountBaseUnits <= 0n) {
    throw new Error('Invalid bet amount');
  }
  if (payoutRateBaseUnits <= 0n) {
    throw new Error('Invalid payout rate');
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
      `Pool not initialized for authority ${poolAuthorityPubkey.toBase58()} (expected PDA ${pool.toBase58()}).`,
    );
  }
  if (!vaultInfo) {
    throw new Error(`Vault PDA ${vault.toBase58()} not found.`);
  }

  const amountBN = new BN(amountBaseUnits.toString());
  const rateBN = new BN(payoutRateBaseUnits.toString());
  const startAccounts = { pool, vault, session, player: wallet.publicKey, systemProgram: SystemProgram.programId };

  const NEW_SESSION_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1; // disc + player + pool + started_at + last_claimed_at + buy_in_paid + payout_rate + bump

  const existingSession = await connection.getAccountInfo(session);
  if (existingSession) {
    const isLegacy = existingSession.data.length !== NEW_SESSION_SIZE;
    const closeIx = isLegacy
      ? await program.methods
          .closeLegacySession()
          .accounts({ pool, vault, session, player: wallet.publicKey })
          .instruction()
      : await program.methods
          .recordDeath()
          .accounts({ pool, vault, session, player: wallet.publicKey })
          .instruction();
    const startIx = await program.methods
      .startSessionWithAmount(amountBN, rateBN)
      .accounts(startAccounts)
      .instruction();
    const tx = new Transaction().add(closeIx, startIx);
    return program.provider.sendAndConfirm(tx);
  }

  return program.methods
    .startSessionWithAmount(amountBN, rateBN)
    .accounts(startAccounts)
    .rpc();
}

export async function extractOnChain({
  connection,
  wallet,
  payoutBaseUnits,
}: {
  connection: Connection;
  wallet: AnchorWalletLike;
  payoutBaseUnits: bigint;
}): Promise<TransactionSignature> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(connection, wallet);
  const { pool, vault, session } = getRunAccounts(wallet.publicKey);
  const amount = new BN(payoutBaseUnits.toString(10));

  return program.methods
    .extract(amount)
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

/**
 * Utility transfer for charging an exact amount in SOL to any target account.
 * Returns a single wallet-confirmed signature.
 */
export async function chargeSolToAccount({
  connection,
  wallet,
  destination,
  amountSol,
}: {
  connection: Connection;
  wallet: AnchorWalletLike;
  destination: PublicKey;
  amountSol: number;
}): Promise<TransactionSignature> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  const lamports = solToLamports(amountSol);
  if (lamports <= 0n) {
    throw new Error('Transfer amount must be greater than 0');
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: destination,
      lamports: Number(lamports),
    }),
  );

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

/** Earned this run only (starts at 0, increases by rate per second). Used for in-game display. */
export function estimateEarnedBaseUnits(
  durationSeconds: number,
  poolConfig?: PoolConfig,
): bigint {
  const wholeSeconds = Math.max(0, Math.floor(durationSeconds));
  const rate =
    poolConfig?.payoutRateBaseUnitsPerSecond ??
    BigInt(process.env.NEXT_PUBLIC_PAYOUT_RATE_BASE_UNITS_PER_SECOND ?? '100000');
  return rate * BigInt(wholeSeconds);
}

export function estimatePayoutBaseUnits(
  durationSeconds: number,
  poolConfig?: PoolConfig,
): bigint {
  const wholeSeconds = Math.max(0, Math.floor(durationSeconds));
  const { buyInBaseUnits, payoutRateBaseUnitsPerSecond } = poolConfig ?? {
    buyInBaseUnits: BigInt(process.env.NEXT_PUBLIC_BUYIN_BASE_UNITS ?? '5000000'),
    payoutRateBaseUnitsPerSecond: BigInt(
      process.env.NEXT_PUBLIC_PAYOUT_RATE_BASE_UNITS_PER_SECOND ?? '100000',
    ),
  };
  const winnings = payoutRateBaseUnitsPerSecond * BigInt(wholeSeconds);
  return buyInBaseUnits + winnings;
}
