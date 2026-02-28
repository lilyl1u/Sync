/**
 * User-related types for Geometry Dash
 */

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  walletAddress?: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  level: number;
  experience: number;
  totalScore: number;
  gamesPlayed: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserStats {
  userId: string;
  highestScore: number;
  totalPlayTime: number;
  levelsCompleted: number;
  perfectRuns: number;
  averageScore: number;
  lastPlayedAt: Date;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  lastUpdated: Date;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'alltime';
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  avatar?: string;
}
