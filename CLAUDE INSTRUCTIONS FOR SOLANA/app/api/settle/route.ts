
import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
const MINT = new PublicKey(process.env.NEXT_PUBLIC_GAME_TOKEN_MINT);
const RATE = 100000n;

function loadHouse() {
  if (process.env.HOUSE_SECRET_KEY_JSON)
    return Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(process.env.HOUSE_SECRET_KEY_JSON))
    );
  if (process.env.HOUSE_SECRET_KEY_BASE58)
    return Keypair.fromSecretKey(
      bs58.decode(process.env.HOUSE_SECRET_KEY_BASE58)
    );
  throw new Error("Missing house key");
}

export async function POST(req) {
  const { playerPubkey, durationSeconds } = await req.json();

  const player = new PublicKey(playerPubkey);
  const payout = RATE * BigInt(durationSeconds);

  const conn = new Connection(RPC);
  const house = loadHouse();

  const houseAta = getAssociatedTokenAddressSync(MINT, house.publicKey);
  const playerAta = getAssociatedTokenAddressSync(MINT, player);

  const tx = new Transaction();

  const info = await conn.getAccountInfo(playerAta);
  if (!info) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        house.publicKey,
        playerAta,
        player,
        MINT
      )
    );
  }

  tx.add(
    createTransferInstruction(
      houseAta,
      playerAta,
      house.publicKey,
      Number(payout)
    )
  );

  tx.feePayer = house.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(house);

  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig);

  return NextResponse.json({ sig });
}
