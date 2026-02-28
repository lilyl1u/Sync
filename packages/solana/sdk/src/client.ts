import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import {
  Pool,
  Bet,
  PlaceBetParams,
  SettleBetParams,
  InitializePoolParams,
  BetOutcome,
  BetResult,
} from './types';

export class GamblingClient {
  private program: Program;
  private provider: AnchorProvider;
  private connection: Connection;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    wallet: any,
    programId: PublicKey,
    idl: Idl
  ) {
    this.connection = connection;
    this.programId = programId;
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    this.program = new Program(idl, programId, this.provider);
  }

  /**
   * Derive the PDA for a pool
   */
  async getPoolPDA(authority: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), authority.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive the PDA for a pool vault
   */
  async getPoolVaultPDA(poolPubkey: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), poolPubkey.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive the PDA for a bet
   */
  async getBetPDA(
    poolPubkey: PublicKey,
    player: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('bet'), poolPubkey.toBuffer(), player.toBuffer()],
      this.programId
    );
  }

  /**
   * Initialize a new gambling pool
   */
  async initializePool(params: InitializePoolParams): Promise<string> {
    const authority = this.provider.wallet.publicKey;
    const [poolPDA] = await this.getPoolPDA(authority);
    const [vaultPDA] = await this.getPoolVaultPDA(poolPDA);

    const tx = await this.program.methods
      .initializePool(
        new BN(params.minBet),
        new BN(params.maxBet),
        params.houseEdge
      )
      .accounts({
        pool: poolPDA,
        authority: authority,
        poolVault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Place a bet on predicted survival time
   */
  async placeBet(
    poolPubkey: PublicKey,
    params: PlaceBetParams
  ): Promise<string> {
    const player = this.provider.wallet.publicKey;
    const [betPDA] = await this.getBetPDA(poolPubkey, player);
    const [vaultPDA] = await this.getPoolVaultPDA(poolPubkey);

    const tx = await this.program.methods
      .placeBet(new BN(params.betAmount), new BN(params.predictedTimeAlive))
      .accounts({
        bet: betPDA,
        pool: poolPubkey,
        player: player,
        poolVault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Settle a bet after game completion
   */
  async settleBet(
    poolPubkey: PublicKey,
    params: SettleBetParams
  ): Promise<string> {
    const player = this.provider.wallet.publicKey;
    const [betPDA] = await this.getBetPDA(poolPubkey, player);
    const [vaultPDA] = await this.getPoolVaultPDA(poolPubkey);

    const tx = await this.program.methods
      .settleBet(new BN(params.actualTimeAlive))
      .accounts({
        bet: betPDA,
        pool: poolPubkey,
        player: player,
        poolVault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Fetch pool data
   */
  async getPool(poolPubkey: PublicKey): Promise<Pool> {
    const poolData = await this.program.account.pool.fetch(poolPubkey);
    return {
      authority: poolData.authority,
      minBet: poolData.minBet.toNumber(),
      maxBet: poolData.maxBet.toNumber(),
      houseEdge: poolData.houseEdge,
      totalWagered: poolData.totalWagered.toNumber(),
      totalPaidOut: poolData.totalPaidOut.toNumber(),
      bump: poolData.bump,
    };
  }

  /**
   * Fetch bet data
   */
  async getBet(betPubkey: PublicKey): Promise<Bet> {
    const betData = await this.program.account.bet.fetch(betPubkey);
    return {
      player: betData.player,
      pool: betData.pool,
      amount: betData.amount.toNumber(),
      predictedTimeAlive: betData.predictedTimeAlive.toNumber(),
      actualTimeAlive: betData.actualTimeAlive.toNumber(),
      settled: betData.settled,
      won: betData.won,
      payout: betData.payout.toNumber(),
      timestamp: betData.timestamp.toNumber(),
      bump: betData.bump,
    };
  }

  /**
   * Calculate bet outcome based on accuracy
   */
  calculateBetOutcome(
    predictedTime: number,
    actualTime: number,
    betAmount: number,
    houseEdge: number
  ): BetResult {
    const diff = Math.abs(predictedTime - actualTime);
    let outcome: BetOutcome;
    let multiplier: number;

    if (diff <= 100) {
      outcome = BetOutcome.PERFECT;
      multiplier = 10;
    } else if (diff <= 500) {
      outcome = BetOutcome.EXCELLENT;
      multiplier = 5;
    } else if (diff <= 1000) {
      outcome = BetOutcome.GOOD;
      multiplier = 2;
    } else if (diff <= 2000) {
      outcome = BetOutcome.BREAK_EVEN;
      multiplier = 1;
    } else {
      outcome = BetOutcome.LOSS;
      multiplier = 0;
    }

    const won = multiplier > 0;
    const grossPayout = betAmount * multiplier;
    const houseFee = (grossPayout * houseEdge) / 10000;
    const payout = Math.max(0, grossPayout - houseFee);

    return {
      won,
      payout,
      outcome,
      accuracy: diff,
    };
  }

  /**
   * Convert SOL to lamports
   */
  solToLamports(sol: number): number {
    return sol * LAMPORTS_PER_SOL;
  }

  /**
   * Convert lamports to SOL
   */
  lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }
}
