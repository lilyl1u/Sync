
import { PublicKey } from "@solana/web3.js";

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const GAME_TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_GAME_TOKEN_MINT!
);

export const BUYIN_BASE_UNITS = BigInt(
  process.env.NEXT_PUBLIC_BUYIN_BASE_UNITS ?? "0"
);

export const HOUSE_PUBKEY = process.env.NEXT_PUBLIC_HOUSE_PUBKEY
  ? new PublicKey(process.env.NEXT_PUBLIC_HOUSE_PUBKEY)
  : null;
