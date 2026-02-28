import { PublicKey } from '@solana/web3.js';

export interface Pool {
  authority: PublicKey;
  buyInBaseUnits: number;
  payoutRateBaseUnitsPerSecond: number;
  poolBump: number;
  vaultBump: number;
  totalSessionsStarted: number;
  totalBuyInsCollected: number;
  totalPayouts: number;
}

export interface Session {
  player: PublicKey;
  pool: PublicKey;
  startedAt: number;
  lastClaimedAt: number;
  buyInPaid: number;
  bump: number;
}

export interface InitializePoolParams {
  buyInBaseUnits: number;
  payoutRateBaseUnitsPerSecond: number;
}
