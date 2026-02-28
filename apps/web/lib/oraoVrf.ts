'use client';

import { AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Orao } from '@orao-network/solana-vrf';
import { Buffer } from 'buffer';

type AnchorWalletLike = {
  publicKey: PublicKey | null;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
};

function toAnchorWallet(wallet: AnchorWalletLike): {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>;
} {
  if (!wallet.publicKey) throw new Error('Wallet not connected');
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction as (tx: Transaction) => Promise<Transaction>,
    signAllTransactions:
      wallet.signAllTransactions ??
      (async (txs: Transaction[]) => Promise.all(txs.map((tx) => wallet.signTransaction(tx)))),
    signMessage: async () => {
      throw new Error('signMessage not supported');
    },
  } as never;
}

export interface VrfResult {
  seed: number;
  requestTx: string;
}

const VRF_TIMEOUT_MS = 60_000;

/**
 * Request ORAO VRF randomness and wait for fulfillment.
 * Returns a numeric seed suitable for terrain generation.
 */
export async function requestAndWaitFulfilled(
  connection: Connection,
  wallet: AnchorWalletLike
): Promise<VrfResult> {
  const provider = new AnchorProvider(connection, toAnchorWallet(wallet) as never, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });

  const vrf = new Orao(provider);

  const requestBuilder = await vrf.request();
  const [seedBytes, requestTx] = await requestBuilder.rpc();

  const fulfilled = await withTimeout(
    vrf.waitFulfilled(seedBytes, 'confirmed'),
    VRF_TIMEOUT_MS,
    'VRF fulfillment timed out. Please try again.'
  );

  const randomness = fulfilled.randomness;
  if (!randomness || randomness.length < 8) {
    throw new Error('Invalid VRF fulfillment: insufficient randomness');
  }

  const buf = Buffer.from(randomness);
  const seedBig = buf.readBigUInt64LE(0);
  const seed = Number(seedBig % BigInt(Number.MAX_SAFE_INTEGER));

  return {
    seed: seed > 0 ? seed : 1,
    requestTx,
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
