
"use client";

import { Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BUYIN_BASE_UNITS, GAME_TOKEN_MINT, HOUSE_PUBKEY } from "./solana";

export async function buyIn({ connection, wallet }) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");

  const player = wallet.publicKey;
  const house = HOUSE_PUBKEY;

  const playerAta = getAssociatedTokenAddressSync(GAME_TOKEN_MINT, player);
  const houseAta = getAssociatedTokenAddressSync(GAME_TOKEN_MINT, house);

  const tx = new Transaction();

  const info = await connection.getAccountInfo(houseAta);
  if (!info) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        player,
        houseAta,
        house,
        GAME_TOKEN_MINT
      )
    );
  }

  tx.add(
    createTransferInstruction(
      playerAta,
      houseAta,
      player,
      Number(BUYIN_BASE_UNITS)
    )
  );

  tx.feePayer = player;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig);

  return sig;
}
