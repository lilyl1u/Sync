import { PublicKey } from "@solana/web3.js";

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

const poolAuthorityPubkeyValue =
  process.env.NEXT_PUBLIC_POOL_AUTHORITY_PUBKEY ??
  process.env.NEXT_PUBLIC_HOUSE_PUBKEY;

const gamblingProgramIdValue =
  process.env.NEXT_PUBLIC_GAMBLING_PROGRAM_ID ??
  "8FgvLWN1vADqi4YnkwvzLp3sESgUtpSWL1EKoHqSQGsg";

export const BUYIN_BASE_UNITS = BigInt(
  process.env.NEXT_PUBLIC_BUYIN_BASE_UNITS ?? "5000000",
);

export const POOL_AUTHORITY_PUBKEY = poolAuthorityPubkeyValue
  ? new PublicKey(poolAuthorityPubkeyValue)
  : null;

export const GAMBLING_PROGRAM_ID = new PublicKey(gamblingProgramIdValue);

export const PAYOUT_RATE_BASE_UNITS_PER_SECOND = BigInt(
  process.env.NEXT_PUBLIC_PAYOUT_RATE_BASE_UNITS_PER_SECOND ?? "100000",
);

export function assertSolanaClientConfig(): {
  poolAuthorityPubkey: PublicKey;
} {
  if (!POOL_AUTHORITY_PUBKEY) {
    throw new Error("Missing NEXT_PUBLIC_POOL_AUTHORITY_PUBKEY (or NEXT_PUBLIC_HOUSE_PUBKEY)");
  }

  return {
    poolAuthorityPubkey: POOL_AUTHORITY_PUBKEY,
  };
}
