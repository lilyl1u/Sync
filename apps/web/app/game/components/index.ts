// Main exports for game components

export { GameCanvas } from './GameCanvas';
export { Player, PlayerRenderer } from './Player';
export { Obstacle, ObstacleRenderer, ObstacleFactory } from './Obstacle';
export { GameUI } from './UI/GameUI';
export { GameExample } from './GameExample';

// Re-export types for convenience
export type {
  GameObject,
  Player as PlayerType,
  Obstacle as ObstacleType,
  Platform,
  GameState,
  Vector2D,
  GameObjectType,
} from '../types';
