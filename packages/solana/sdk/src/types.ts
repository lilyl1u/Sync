import { PublicKey } from '@solana/web3.js';

export interface Pool {
  authority: PublicKey;
  minBet: number;
  maxBet: number;
  houseEdge: number;
  totalWagered: number;
  totalPaidOut: number;
  bump: number;
}

export interface Bet {
  player: PublicKey;
  pool: PublicKey;
  amount: number;
  predictedTimeAlive: number;
  actualTimeAlive: number;
  settled: boolean;
  won: boolean;
  payout: number;
  timestamp: number;
  bump: number;
}

export interface PlaceBetParams {
  betAmount: number;
  predictedTimeAlive: number;
}

export interface SettleBetParams {
  actualTimeAlive: number;
}

export interface InitializePoolParams {
  minBet: number;
  maxBet: number;
  houseEdge: number;
}

export enum BetOutcome {
  PERFECT = 'PERFECT', // Within 100ms - 10x
  EXCELLENT = 'EXCELLENT', // Within 500ms - 5x
  GOOD = 'GOOD', // Within 1000ms - 2x
  BREAK_EVEN = 'BREAK_EVEN', // Within 2000ms - 1x
  LOSS = 'LOSS', // Beyond 2000ms - 0x
}

export interface BetResult {
  won: boolean;
  payout: number;
  outcome: BetOutcome;
  accuracy: number; // milliseconds difference
}
