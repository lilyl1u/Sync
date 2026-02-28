/**
 * Segment Templates - Reusable level segment patterns
 *
 * These templates serve dual purposes:
 * 1. Procedural generation building blocks
 * 2. Training data for ML models to learn obstacle patterns
 *
 * ML Integration Notes:
 * - Each template is encoded with numerical features that ML models can learn
 * - Templates can be used to generate synthetic training data
 * - Feature vectors can be extracted for supervised/reinforcement learning
 */

import { LevelSegment, GameObject, GameObjectType, Vector2D } from '../types';

/**
 * Numerical feature encoding for ML training
 * These features describe a segment in a way ML models can process
 */
export interface SegmentFeatures {
  difficulty: number;           // 0-1 scale
  density: number;              // Obstacles per unit length
  verticalComplexity: number;   // Height variation measure
  gapFrequency: number;         // Number of gaps/jumps
  platformRatio: number;        // Platform coverage ratio
  obstacleTypes: number[];      // One-hot encoding of obstacle types
  rhythmPattern: number[];      // Temporal spacing pattern
}

/**
 * Template definition with ML-ready features
 */
export interface SegmentTemplate {
  name: string;
  difficulty: number;
  length: number;
  features: SegmentFeatures;
  generator: (startX: number, seed: number) => GameObject[];
}

/**
 * Generate a unique ID for game objects
 */
function generateId(prefix: string, index: number, seed: number): string {
  return `${prefix}_${seed}_${index}_${Date.now()}`;
}

/**
 * Seeded random number generator (for reproducibility)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  integer(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

// ============================================================================
// BASIC TEMPLATES (Difficulty 0.1 - 0.3)
// ============================================================================

export const FLAT_GROUND_SPIKE: SegmentTemplate = {
  name: 'flat_ground_spike',
  difficulty: 0.1,
  length: 100,
  features: {
    difficulty: 0.1,
    density: 0.3,
    verticalComplexity: 0.1,
    gapFrequency: 0,
    platformRatio: 1.0,
    obstacleTypes: [1, 0, 0], // [spike, block, gap]
    rhythmPattern: [0, 0, 1, 0, 0, 1], // Regular spacing
  },
  generator: (startX: number, seed: number): GameObject[] => {
    const rng = new SeededRandom(seed);
    const objects: GameObject[] = [];
    const groundY = 500;
    const segmentLength = 100;

    // Ground platform
    objects.push({
      id: generateId('platform', 0, seed),
      position: { x: startX, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: segmentLength, y: 20 },
      type: GameObjectType.PLATFORM,
      active: true,
    });

    // Simple spike pattern
    const spikePositions = [30, 60];
    spikePositions.forEach((offset, idx) => {
      objects.push({
        id: generateId('spike', idx, seed),
        position: { x: startX + offset, y: groundY - 20 },
        velocity: { x: 0, y: 0 },
        size: { x: 15, y: 20 },
        type: GameObjectType.OBSTACLE_SPIKE,
        active: true,
      });
    });

    return objects;
  },
};

export const SIMPLE_GAP: SegmentTemplate = {
  name: 'simple_gap',
  difficulty: 0.2,
  length: 120,
  features: {
    difficulty: 0.2,
    density: 0.1,
    verticalComplexity: 0.2,
    gapFrequency: 1,
    platformRatio: 0.7,
    obstacleTypes: [0, 0, 1], // Gap-based
    rhythmPattern: [1, 0, 0, 0, 1],
  },
  generator: (startX: number, seed: number): GameObject[] => {
    const objects: GameObject[] = [];
    const groundY = 500;
    const gapWidth = 40;
    const platformWidth = 40;

    // Left platform
    objects.push({
      id: generateId('platform', 0, seed),
      position: { x: startX, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: platformWidth, y: 20 },
      type: GameObjectType.PLATFORM,
      active: true,
    });

    // Right platform
    objects.push({
      id: generateId('platform', 1, seed),
      position: { x: startX + platformWidth + gapWidth, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: platformWidth, y: 20 },
      type: GameObjectType.PLATFORM,
      active: true,
    });

    return objects;
  },
};

// ============================================================================
// INTERMEDIATE TEMPLATES (Difficulty 0.4 - 0.6)
// ============================================================================

export const STAIRCASE_BLOCKS: SegmentTemplate = {
  name: 'staircase_blocks',
  difficulty: 0.4,
  length: 150,
  features: {
    difficulty: 0.4,
    density: 0.5,
    verticalComplexity: 0.6,
    gapFrequency: 0,
    platformRatio: 0.8,
    obstacleTypes: [0, 1, 0], // Block-based
    rhythmPattern: [1, 1, 1, 1, 1],
  },
  generator: (startX: number, seed: number): GameObject[] => {
    const objects: GameObject[] = [];
    const groundY = 500;
    const blockSize = 30;
    const steps = 5;

    // Ground platform
    objects.push({
      id: generateId('platform', 0, seed),
      position: { x: startX, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: 150, y: 20 },
      type: GameObjectType.PLATFORM,
      active: true,
    });

    // Staircase blocks
    for (let i = 0; i < steps; i++) {
      objects.push({
        id: generateId('block', i, seed),
        position: {
          x: startX + 20 + i * blockSize,
          y: groundY - 20 - (i + 1) * blockSize
        },
        velocity: { x: 0, y: 0 },
        size: { x: blockSize, y: blockSize },
        type: GameObjectType.OBSTACLE_BLOCK,
        active: true,
      });
    }

    return objects;
  },
};

export const SPIKE_RHYTHM: SegmentTemplate = {
  name: 'spike_rhythm',
  difficulty: 0.5,
  length: 160,
  features: {
    difficulty: 0.5,
    density: 0.7,
    verticalComplexity: 0.3,
    gapFrequency: 0,
    platformRatio: 1.0,
    obstacleTypes: [1, 0, 0], // Spike-heavy
    rhythmPattern: [1, 0, 1, 1, 0, 1], // Syncopated rhythm
  },
  generator: (startX: number, seed: number): GameObject[] => {
    const rng = new SeededRandom(seed);
    const objects: GameObject[] = [];
    const groundY = 500;

    // Ground platform
    objects.push({
      id: generateId('platform', 0, seed),
      position: { x: startX, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: 160, y: 20 },
      type: GameObjectType.PLATFORM,
      active: true,
    });

    // Rhythmic spike pattern - short-short-long pattern
    const pattern = [20, 40, 60, 80, 120, 140];
    pattern.forEach((offset, idx) => {
      objects.push({
        id: generateId('spike', idx, seed),
        position: { x: startX + offset, y: groundY - 20 },
        velocity: { x: 0, y: 0 },
        size: { x: 15, y: 20 },
        type: GameObjectType.OBSTACLE_SPIKE,
        active: true,
      });
    });

    return objects;
  },
};

export const PLATFORM_JUMPS: SegmentTemplate = {
  name: 'platform_jumps',
  difficulty: 0.6,
  length: 180,
  features: {
    difficulty: 0.6,
    density: 0.4,
    verticalComplexity: 0.7,
    gapFrequency: 3,
    platformRatio: 0.5,
    obstacleTypes: [0, 0, 1], // Gap-heavy
    rhythmPattern: [1, 0, 0, 1, 0, 0],
  },
  generator: (startX: number, seed: number): GameObject[] => {
    const rng = new SeededRandom(seed);
    const objects: GameObject[] = [];
    const groundY = 500;

    // Multiple platforms at varying heights
    const platforms = [
      { x: 0, y: 0, width: 40 },
      { x: 60, y: -30, width: 30 },
      { x: 110, y: -60, width: 35 },
      { x: 160, y: -30, width: 40 },
    ];

    platforms.forEach((plat, idx) => {
      objects.push({
        id: generateId('platform', idx, seed),
        position: { x: startX + plat.x, y: groundY + plat.y },
        velocity: { x: 0, y: 0 },
        size: { x: plat.width, y: 20 },
        type: GameObjectType.PLATFORM,
        active: true,
      });

      // Add spike on some platforms
      if (rng.next() > 0.5) {
        objects.push({
          id: generateId('spike', idx, seed),
          position: { x: startX + plat.x + plat.width / 2, y: groundY + plat.y - 20 },
          velocity: { x: 0, y: 0 },
          size: { x: 15, y: 20 },
          type: GameObjectType.OBSTACLE_SPIKE,
          active: true,
        });
      }
    });

    return objects;
  },
};

// ============================================================================
// ADVANCED TEMPLATES (Difficulty 0.7 - 1.0)
// ============================================================================

export const MIXED_OBSTACLES: SegmentTemplate = {
  name: 'mixed_obstacles',
  difficulty: 0.7,
  length: 200,
  features: {
    difficulty: 0.7,
    density: 0.8,
    verticalComplexity: 0.8,
    gapFrequency: 2,
    platformRatio: 0.6,
    obstacleTypes: [0.5, 0.5, 0.3], // Mixed
    rhythmPattern: [1, 1, 0, 1, 0, 1],
  },
  generator: (startX: number, seed: number): GameObject[] => {
    const rng = new SeededRandom(seed);
    const objects: GameObject[] = [];
    const groundY = 500;

    // Main platform
    objects.push({
      id: generateId('platform', 0, seed),
      position: { x: startX, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: 80, y: 20 },
      type: GameObjectType.PLATFORM,
      active: true,
    });

    // Blocks and spikes on ground
    objects.push({
      id: generateId('block', 0, seed),
      position: { x: startX + 30, y: groundY - 20 },
      velocity: { x: 0, y: 0 },
      size: { x: 25, y: 25 },
      type: GameObjectType.OBSTACLE_BLOCK,
      active: true,
    });

    objects.push({
      id: generateId('spike', 0, seed),
      position: { x: startX + 60, y: groundY - 20 },
      velocity: { x: 0, y: 0 },
      size: { x: 15, y: 20 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
    });

    // Gap
    // Elevated platform
    objects.push({
      id: generateId('platform', 1, seed),
      position: { x: startX + 120, y: groundY - 40 },
      velocity: { x: 0, y: 0 },
      size: { x: 50, y: 20 },
      type: GameObjectType.PLATFORM,
      active: true,
    });

    // Spike on elevated platform
    objects.push({
      id: generateId('spike', 1, seed),
      position: { x: startX + 145, y: groundY - 60 },
      velocity: { x: 0, y: 0 },
      size: { x: 15, y: 20 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
    });

    // Final platform
    objects.push({
      id: generateId('platform', 2, seed),
      position: { x: startX + 180, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: 50, y: 20 },
      type: GameObjectType.PLATFORM,
      active: true,
    });

    return objects;
  },
};

export const EXTREME_CHALLENGE: SegmentTemplate = {
  name: 'extreme_challenge',
  difficulty: 0.9,
  length: 250,
  features: {
    difficulty: 0.9,
    density: 1.0,
    verticalComplexity: 1.0,
    gapFrequency: 4,
    platformRatio: 0.4,
    obstacleTypes: [0.7, 0.6, 0.5], // All types heavily used
    rhythmPattern: [1, 1, 1, 0, 1, 1],
  },
  generator: (startX: number, seed: number): GameObject[] => {
    const rng = new SeededRandom(seed);
    const objects: GameObject[] = [];
    const groundY = 500;

    // Create a complex multi-level challenge
    const platformConfigs = [
      { x: 0, y: 0, width: 30, hasSpike: false, hasBlock: true },
      { x: 50, y: -50, width: 25, hasSpike: true, hasBlock: false },
      { x: 95, y: -100, width: 20, hasSpike: true, hasBlock: false },
      { x: 135, y: -70, width: 25, hasSpike: false, hasBlock: true },
      { x: 180, y: -40, width: 30, hasSpike: true, hasBlock: false },
      { x: 230, y: 0, width: 35, hasSpike: false, hasBlock: false },
    ];

    platformConfigs.forEach((config, idx) => {
      // Platform
      objects.push({
        id: generateId('platform', idx, seed),
        position: { x: startX + config.x, y: groundY + config.y },
        velocity: { x: 0, y: 0 },
        size: { x: config.width, y: 20 },
        type: GameObjectType.PLATFORM,
        active: true,
      });

      // Spike
      if (config.hasSpike) {
        objects.push({
          id: generateId('spike', idx, seed),
          position: {
            x: startX + config.x + config.width / 2,
            y: groundY + config.y - 20
          },
          velocity: { x: 0, y: 0 },
          size: { x: 15, y: 20 },
          type: GameObjectType.OBSTACLE_SPIKE,
          active: true,
        });
      }

      // Block
      if (config.hasBlock) {
        objects.push({
          id: generateId('block', idx, seed),
          position: {
            x: startX + config.x + 5,
            y: groundY + config.y - 25
          },
          velocity: { x: 0, y: 0 },
          size: { x: 20, y: 25 },
          type: GameObjectType.OBSTACLE_BLOCK,
          active: true,
        });
      }
    });

    return objects;
  },
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/**
 * All available templates organized by difficulty
 * ML models can use this for training data generation
 */
export const TEMPLATE_REGISTRY = {
  easy: [FLAT_GROUND_SPIKE, SIMPLE_GAP],
  medium: [STAIRCASE_BLOCKS, SPIKE_RHYTHM, PLATFORM_JUMPS],
  hard: [MIXED_OBSTACLES],
  extreme: [EXTREME_CHALLENGE],
};

/**
 * Get all templates as a flat array
 */
export function getAllTemplates(): SegmentTemplate[] {
  return [
    ...TEMPLATE_REGISTRY.easy,
    ...TEMPLATE_REGISTRY.medium,
    ...TEMPLATE_REGISTRY.hard,
    ...TEMPLATE_REGISTRY.extreme,
  ];
}

/**
 * Get templates filtered by difficulty range
 */
export function getTemplatesByDifficulty(minDiff: number, maxDiff: number): SegmentTemplate[] {
  return getAllTemplates().filter(
    t => t.difficulty >= minDiff && t.difficulty <= maxDiff
  );
}

/**
 * Extract feature vector from a template (for ML training)
 * Returns a normalized feature array that can be fed to ML models
 */
export function extractFeatureVector(template: SegmentTemplate): number[] {
  const features = template.features;
  return [
    features.difficulty,
    features.density,
    features.verticalComplexity,
    features.gapFrequency,
    features.platformRatio,
    ...features.obstacleTypes,
    ...features.rhythmPattern,
  ];
}

/**
 * Generate synthetic training data from templates
 * Useful for creating datasets for ML model training
 */
export function generateTrainingData(
  template: SegmentTemplate,
  numSamples: number
): Array<{ features: number[]; template: string }> {
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    samples.push({
      features: extractFeatureVector(template),
      template: template.name,
    });
  }
  return samples;
}
