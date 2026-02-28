/**
 * Level Generation System - Main Exports
 *
 * This module provides a complete, ML-ready level generation system for
 * a Geometry Dash clone.
 *
 * QUICK START:
 * ============
 * ```typescript
 * import { LevelGenerator } from '@/game/levels';
 *
 * const generator = new LevelGenerator();
 *
 * const level = generator.generate({
 *   difficulty: 0.5,
 *   length: 1000,
 *   seed: 12345,
 *   style: 'classic',
 * });
 * ```
 *
 * ARCHITECTURE:
 * =============
 * - LevelGenerator: Main interface, handles both procedural and ML generation
 * - ProceduralGenerator: Algorithm-based generation (baseline)
 * - SegmentTemplates: Reusable building blocks with ML-ready features
 *
 * ML INTEGRATION:
 * ===============
 * 1. Implement MLModelInterface
 * 2. Train your model on collected gameplay data
 * 3. Register: generator.setMLModel(yourModel)
 * 4. Generate: generator.generate(config) - automatically uses ML
 */

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export { LevelGenerator, StubMLModel } from './LevelGenerator';
export type { MLModelInterface, MLModelOutput, TrainingExample } from './LevelGenerator';

// ============================================================================
// TEST LEVEL
// ============================================================================

export { createTestLevel } from './TestLevel';

// ============================================================================
// PROCEDURAL GENERATION
// ============================================================================

export {
  ProceduralGenerator,
  SeededRandom,
  TemplateBasedStrategy,
  NoiseBasedStrategy,
  WaveBasedStrategy,
  applyConstraints,
  analyzeSegmentDifficulty,
} from './ProceduralGenerator';
export type { GenerationStrategy } from './ProceduralGenerator';

// ============================================================================
// SEGMENT TEMPLATES
// ============================================================================

export {
  FLAT_GROUND_SPIKE,
  SIMPLE_GAP,
  STAIRCASE_BLOCKS,
  SPIKE_RHYTHM,
  PLATFORM_JUMPS,
  MIXED_OBSTACLES,
  EXTREME_CHALLENGE,
  TEMPLATE_REGISTRY,
  getAllTemplates,
  getTemplatesByDifficulty,
  extractFeatureVector,
  generateTrainingData,
} from './SegmentTemplates';
export type { SegmentTemplate, SegmentFeatures } from './SegmentTemplates';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { LevelGenerator } from './LevelGenerator';
import {
  LevelGeneratorConfig,
  Level,
  LevelSegment,
  Platform,
  Obstacle,
  GameObjectType,
} from '../types';

/**
 * Create a default level generator instance
 */
export function createLevelGenerator(): LevelGenerator {
  return new LevelGenerator();
}

/**
 * Quick generate function for simple use cases
 */
export function generateLevel(
  difficulty: number,
  length: number,
  seed?: number
): Level {
  const generator = new LevelGenerator();
  return generator.generate({
    difficulty,
    length,
    seed,
    style: 'classic',
  });
}

/**
 * Convenience helper used by the web app.
 *
 * Creates a simple manual level:
 * - Flat ground the player can safely spawn on
 * - Exactly three spikes, evenly spaced along the course
 */
export function createInfiniteLevel(): Level {
  const platforms: Platform[] = [];
  const obstacles: Obstacle[] = [];

  // Ground: continuous platform under the player and spikes
  // Player is 30px tall, stands at y = 470 when on ground (platform top at y = 450)
  // Platform size.y = 50, so place its origin at y = 500
  const groundLength = 3000;

  platforms.push({
    id: 'ground-0',
    position: { x: 0, y: 500 },
    velocity: { x: 0, y: 0 },
    size: { x: groundLength, y: 50 },
    type: GameObjectType.PLATFORM,
    active: true,
    width: groundLength,
  });

  // Three spikes, evenly spaced along the ground, all after the spawn point
  const spikePositions = [800, 1600, 2400];

  spikePositions.forEach((x, i) => {
    obstacles.push({
      id: `spike-${i}`,
      position: { x, y: 470 },
      velocity: { x: 0, y: 0 },
      size: { x: 30, y: 30 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage: 1,
    });
  });

  const objects = [...platforms, ...obstacles];

  const segment: LevelSegment = {
    id: 'segment-simple-1',
    startX: 0,
    length: groundLength,
    difficulty: 0.3,
    objects,
  };

  return {
    id: 'simple-level-3-spikes',
    name: 'Three Spikes',
    segments: [segment],
    totalLength: groundLength,
    difficulty: 0.3,
    generatedBy: 'manual',
  };
}

/**
 * Generate a level with ML if model is provided
 */
export function generateLevelWithML(
  config: LevelGeneratorConfig,
  model?: any
): Level {
  const generator = new LevelGenerator();

  if (model) {
    generator.setMLModel(model);
  }

  return generator.generate(config);
}

/**
 * Batch generate multiple levels (useful for testing/training data)
 */
export function generateLevelBatch(
  baseConfig: LevelGeneratorConfig,
  count: number
): Level[] {
  const generator = new LevelGenerator();
  const levels: Level[] = [];

  for (let i = 0; i < count; i++) {
    const config = {
      ...baseConfig,
      seed: (baseConfig.seed ?? 0) + i,
    };

    levels.push(generator.generate(config));
  }

  return levels;
}

/**
 * Generate levels across difficulty spectrum (for playtesting)
 */
export function generateDifficultySpectrum(
  length: number = 1000,
  steps: number = 5
): Level[] {
  const generator = new LevelGenerator();
  const levels: Level[] = [];

  for (let i = 0; i < steps; i++) {
    const difficulty = i / (steps - 1); // 0.0 to 1.0

    levels.push(
      generator.generate({
        difficulty,
        length,
        seed: i,
        style: 'classic',
      })
    );
  }

  return levels;
}

// ============================================================================
// DEFAULT INSTANCE
// ============================================================================

/**
 * Singleton instance for convenience
 * Use this if you don't need multiple generators
 */
export const defaultLevelGenerator = new LevelGenerator();
