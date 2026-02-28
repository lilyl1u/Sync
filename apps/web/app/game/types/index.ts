// Core type definitions for the modular Geometry Dash game

export interface Vector2D {
  x: number;
  y: number;
}

export interface GameObject {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  size: Vector2D;
  type: GameObjectType;
  active: boolean;
}

export enum GameObjectType {
  PLAYER = 'player',
  OBSTACLE_SPIKE = 'obstacle_spike',
  OBSTACLE_BLOCK = 'obstacle_block',
  PLATFORM = 'platform',
  PORTAL = 'portal',
  COLLECTIBLE = 'collectible',
}

export interface Player extends GameObject {
  isJumping: boolean;
  isOnGround: boolean;
  health: number;
  score: number;
}

export interface Obstacle extends GameObject {
  damage: number;
}

export interface Platform extends GameObject {
  width: number;
}

// Level generation types - designed for ML integration
export interface LevelSegment {
  id: string;
  startX: number;
  length: number;
  difficulty: number;
  objects: GameObject[];
  metadata?: Record<string, any>;
}

export interface Level {
  id: string;
  name: string;
  segments: LevelSegment[];
  totalLength: number;
  difficulty: number;
  generatedBy?: 'manual' | 'procedural' | 'ml';
  mlModelVersion?: string;
}

// ML-ready level generation interface
export interface LevelGeneratorConfig {
  difficulty: number;
  length: number;
  seed?: number;
  style?: 'classic' | 'modern' | 'extreme';
  constraints?: LevelConstraints;
}

export interface LevelConstraints {
  maxObstacleHeight?: number;
  minPlatformWidth?: number;
  maxGapSize?: number;
  obstacleFrequency?: number;
}

// Game state
export interface GameState {
  player: Player;
  currentLevel: Level;
  currentSegmentIndex: number;
  gameObjects: GameObject[];
  cameraOffset: number;
  isPaused: boolean;
  isGameOver: boolean;
  score: number;
}

// Physics configuration
export interface PhysicsConfig {
  gravity: number;
  jumpForce: number;
  maxVelocity: Vector2D;
  friction: number;
}

// Input state
export interface InputState {
  jump: boolean;
  restart: boolean;
  pause: boolean;
}
