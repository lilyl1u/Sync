import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Gambling } from "../target/types/gambling";
import { expect } from "chai";

describe("gambling", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Gambling as Program<Gambling>;

  it("initializes a pool", async () => {
    const [poolPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), poolPda.toBuffer()],
      program.programId
    );

    const buyIn = 1e9; // 1 SOL in lamports
    const payoutRate = 1e7; // 0.01 SOL per second

    await program.methods
      .initializePool(new anchor.BN(buyIn), new anchor.BN(payoutRate))
      .accounts({
        pool: poolPda,
        vault: vaultPda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const pool = await program.account.pool.fetch(poolPda);
    expect(pool.authority.toString()).to.equal(provider.wallet.publicKey.toString());
    expect(pool.buyInBaseUnits.toString()).to.equal(buyIn.toString());
    expect(pool.payoutRateBaseUnitsPerSecond.toString()).to.equal(payoutRate.toString());
  });
});
