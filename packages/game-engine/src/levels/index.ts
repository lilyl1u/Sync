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
import { LevelGeneratorConfig, Level } from '../types';

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
