/**
 * Game-related types for Geometry Dash
 */

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface PlayerState {
  position: Position;
  velocity: Velocity;
  isJumping: boolean;
  isOnGround: boolean;
  health: number;
  score: number;
}

export interface Obstacle {
  id: string;
  type: 'spike' | 'block' | 'platform' | 'moving';
  position: Position;
  width: number;
  height: number;
  isActive: boolean;
}

export interface Level {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  obstacles: Obstacle[];
  length: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameState {
  player: PlayerState;
  currentLevel: Level;
  isPaused: boolean;
  gameTime: number;
  highScore: number;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  controlScheme: 'keyboard' | 'touch' | 'mouse';
}
