/**
 * Solana blockchain-related types for Geometry Dash
 */

export interface WalletConnection {
  publicKey: string;
  isConnected: boolean;
  balance: number;
}

export interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: NFTAttribute[];
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface GameNFT {
  mintAddress: string;
  owner: string;
  metadata: NFTMetadata;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  level?: number;
  createdAt: Date;
}

export interface Transaction {
  signature: string;
  type: 'mint' | 'transfer' | 'reward' | 'purchase';
  amount: number;
  from: string;
  to: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface TokenReward {
  amount: number;
  reason: 'level_complete' | 'achievement' | 'high_score' | 'daily_bonus';
  timestamp: Date;
  transactionSignature?: string;
}

export interface MarketplaceListing {
  id: string;
  nftMintAddress: string;
  seller: string;
  price: number;
  currency: 'SOL' | 'USDC';
  listedAt: Date;
  status: 'active' | 'sold' | 'cancelled';
}
