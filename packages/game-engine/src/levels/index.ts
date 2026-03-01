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
export { generateInfiniteChunk } from './InfiniteLevel';
export { createBeatLevel } from './BeatLevel';
export type { BeatLevelConfig } from './BeatLevel';

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
 * Creates a long, handcrafted Geometry Dash-style course:
 * - Continuous ground (no terrain holes at spawn)
 * - Progressive difficulty curve
 * - Repeating rhythmic patterns that remain jumpable
 */
export function createInfiniteLevel(): Level {
  const platforms: Platform[] = [];
  const obstacles: Obstacle[] = [];
  const groundY = 500;
  const groundHeight = 50;
  const levelLength = 40000;
  const groundChunk = 400;

  let platformId = 0;
  let obstacleId = 0;

  const addGround = (x: number, width: number) => {
    platforms.push({
      id: `ground-${platformId++}`,
      position: { x, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: width, y: groundHeight },
      type: GameObjectType.PLATFORM,
      active: true,
      width,
    });
  };

  const addPlatform = (x: number, y: number, width: number, height = 20) => {
    platforms.push({
      id: `plat-${platformId++}`,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      size: { x: width, y: height },
      type: GameObjectType.PLATFORM,
      active: true,
      width,
    });
  };

  const addSpike = (x: number, y = groundY - 26, size = 26) => {
    obstacles.push({
      id: `spike-${obstacleId++}`,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      size: { x: size, y: size },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage: 1,
    });
  };

  const addBlock = (x: number, width = 42, height = 42) => {
    obstacles.push({
      id: `block-${obstacleId++}`,
      position: { x, y: groundY - height },
      velocity: { x: 0, y: 0 },
      size: { x: width, y: height },
      type: GameObjectType.OBSTACLE_BLOCK,
      active: true,
      damage: 1,
    });
  };

  // Continuous base terrain across the full run.
  for (let x = 0; x < levelLength; x += groundChunk) {
    addGround(x, Math.min(groundChunk, levelLength - x));
  }

  // Section A (intro): sparse single spikes, generous spacing.
  for (let x = 900; x < 5000; x += 540) {
    addSpike(x);
  }

  // Section B (rhythm): singles + doubles + low hops.
  for (let x = 5200; x < 15000; x += 900) {
    addSpike(x + 50);
    addSpike(x + 220);
    addBlock(x + 420, 40, 40);

    // Every other pattern adds a double for timing variety.
    if (((x / 900) & 1) === 0) {
      addSpike(x + 620);
      addSpike(x + 648);
    } else {
      addSpike(x + 650);
    }
  }

  // Section C (platform interplay): reachable elevated lanes and returns.
  for (let x = 15400; x < 28000; x += 1000) {
    addSpike(x + 60);
    addBlock(x + 220, 44, 44);
    addPlatform(x + 380, 430, 150, 20);
    addSpike(x + 420, 430 - 24, 24); // spike on elevated platform
    addSpike(x + 700);
  }

  // Section D (late game): denser but still fair spacing.
  for (let x = 28400; x < 39200; x += 780) {
    addSpike(x + 40);
    addSpike(x + 170);
    addBlock(x + 300, 46, 46);
    addSpike(x + 430);
    if (((x / 780) % 3) === 0) {
      addSpike(x + 458);
    }
  }

  const objects = [...platforms, ...obstacles].sort(
    (a, b) => a.position.x - b.position.x,
  );

  const segment: LevelSegment = {
    id: 'segment-course-1',
    startX: 0,
    length: levelLength,
    difficulty: 0.55,
    objects,
  };

  return {
    id: 'gd-course-playable-v1',
    name: 'Neon Circuit',
    segments: [segment],
    totalLength: levelLength,
    difficulty: 0.55,
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
