import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { InitializePoolParams, Pool, Session } from './types';

export class GamblingClient {
  private program: Program;
  private provider: AnchorProvider;
  private programId: PublicKey;

  constructor(connection: Connection, wallet: any, programId: PublicKey, idl: Idl) {
    this.programId = programId;
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });
    this.program = new Program(idl, programId, this.provider);
  }

  getPoolPDA(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), authority.toBuffer()],
      this.programId,
    );
  }

  getVaultPDA(pool: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), pool.toBuffer()],
      this.programId,
    );
  }

  getSessionPDA(pool: PublicKey, player: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('session'), pool.toBuffer(), player.toBuffer()],
      this.programId,
    );
  }

  async initializePool(params: InitializePoolParams): Promise<string> {
    const authority = this.provider.wallet.publicKey;
    const [pool] = this.getPoolPDA(authority);
    const [vault] = this.getVaultPDA(pool);

    return this.program.methods
      .initializePool(
        new BN(params.buyInBaseUnits),
        new BN(params.payoutRateBaseUnitsPerSecond),
      )
      .accounts({
        pool,
        vault,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async fundPool(authority: PublicKey, amount: number): Promise<string> {
    const [pool] = this.getPoolPDA(authority);
    const [vault] = this.getVaultPDA(pool);

    return this.program.methods
      .fundPool(new BN(amount))
      .accounts({
        pool,
        vault,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async startSession(authority: PublicKey): Promise<string> {
    const player = this.provider.wallet.publicKey;
    const [pool] = this.getPoolPDA(authority);
    const [vault] = this.getVaultPDA(pool);
    const [session] = this.getSessionPDA(pool, player);

    return this.program.methods
      .startSession()
      .accounts({
        pool,
        vault,
        session,
        player,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async extract(authority: PublicKey): Promise<string> {
    const player = this.provider.wallet.publicKey;
    const [pool] = this.getPoolPDA(authority);
    const [vault] = this.getVaultPDA(pool);
    const [session] = this.getSessionPDA(pool, player);

    return this.program.methods
      .extract()
      .accounts({
        pool,
        vault,
        session,
        player,
      })
      .rpc();
  }

  async recordDeath(authority: PublicKey): Promise<string> {
    const player = this.provider.wallet.publicKey;
    const [pool] = this.getPoolPDA(authority);
    const [vault] = this.getVaultPDA(pool);
    const [session] = this.getSessionPDA(pool, player);

    return this.program.methods
      .recordDeath()
      .accounts({
        pool,
        vault,
        session,
        player,
      })
      .rpc();
  }

  async getPool(poolPubkey: PublicKey): Promise<Pool> {
    const poolData = await this.program.account.pool.fetch(poolPubkey);
    return {
      authority: poolData.authority,
      buyInBaseUnits: poolData.buyInBaseUnits.toNumber(),
      payoutRateBaseUnitsPerSecond: poolData.payoutRateBaseUnitsPerSecond.toNumber(),
      poolBump: poolData.poolBump,
      vaultBump: poolData.vaultBump,
      totalSessionsStarted: poolData.totalSessionsStarted.toNumber(),
      totalBuyInsCollected: poolData.totalBuyInsCollected.toNumber(),
      totalPayouts: poolData.totalPayouts.toNumber(),
    };
  }

  async getSession(sessionPubkey: PublicKey): Promise<Session> {
    const sessionData = await this.program.account.session.fetch(sessionPubkey);
    return {
      player: sessionData.player,
      pool: sessionData.pool,
      startedAt: sessionData.startedAt.toNumber(),
      lastClaimedAt: sessionData.lastClaimedAt.toNumber(),
      buyInPaid: sessionData.buyInPaid.toNumber(),
      bump: sessionData.bump,
    };
  }

  estimatePayout(durationSeconds: number, payoutRateBaseUnitsPerSecond: number): number {
    return Math.max(0, Math.floor(durationSeconds)) * payoutRateBaseUnitsPerSecond;
  }

  solToLamports(sol: number): number {
    return sol * LAMPORTS_PER_SOL;
  }

  lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }
}
