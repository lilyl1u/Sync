/**
 * Machine Learning-related types for Geometry Dash
 */

export interface MLPrediction {
  action: 'jump' | 'wait' | 'duck';
  confidence: number;
  timestamp: number;
}

export interface TrainingData {
  id: string;
  gameState: GameStateSnapshot;
  action: 'jump' | 'wait' | 'duck';
  reward: number;
  timestamp: Date;
}

export interface GameStateSnapshot {
  playerPosition: { x: number; y: number };
  playerVelocity: { x: number; y: number };
  nearbyObstacles: ObstacleSnapshot[];
  score: number;
  gameTime: number;
}

export interface ObstacleSnapshot {
  type: 'spike' | 'block' | 'platform' | 'moving';
  relativePosition: { x: number; y: number };
  dimensions: { width: number; height: number };
  distance: number;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingEpochs: number;
  lastTrainedAt: Date;
}

export interface AgentPerformance {
  gamesPlayed: number;
  averageScore: number;
  highestScore: number;
  successRate: number;
  averageReward: number;
  lastPlayedAt: Date;
}

export interface ReinforcementLearningConfig {
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  batchSize: number;
  replayBufferSize: number;
  targetUpdateFrequency: number;
}

export interface NeuralNetworkConfig {
  inputSize: number;
  hiddenLayers: number[];
  outputSize: number;
  activationFunction: 'relu' | 'sigmoid' | 'tanh';
  optimizer: 'adam' | 'sgd' | 'rmsprop';
}
