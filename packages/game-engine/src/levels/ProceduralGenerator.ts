/**
 * Procedural Generator - Algorithm-based level generation
 *
 * This module contains procedural algorithms for generating levels.
 * In the ML-ready architecture, these algorithms serve as:
 * 1. Baseline generation methods
 * 2. Fallback when ML models are unavailable
 * 3. Data augmentation for ML training
 *
 * The procedural approach uses mathematical rules and randomness,
 * while ML approaches will learn patterns from data.
 */

import {
  LevelSegment,
  GameObject,
  LevelGeneratorConfig,
  LevelConstraints,
} from '../types';
import {
  SegmentTemplate,
  getAllTemplates,
  getTemplatesByDifficulty,
} from './SegmentTemplates';

/**
 * Seeded random number generator for reproducible generation
 */
export class SeededRandom {
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

  choice<T>(array: T[]): T {
    return array[this.integer(0, array.length - 1)];
  }
}

/**
 * Procedural generation strategy interface
 * Different strategies can be swapped in/out
 */
export interface GenerationStrategy {
  name: string;
  generate(config: LevelGeneratorConfig, rng: SeededRandom): LevelSegment[];
}

/**
 * Template-based generation strategy
 * Selects and chains pre-made templates based on difficulty
 */
export class TemplateBasedStrategy implements GenerationStrategy {
  name = 'template_based';

  generate(config: LevelGeneratorConfig, rng: SeededRandom): LevelSegment[] {
    const segments: LevelSegment[] = [];
    let currentX = 0;
    const targetLength = config.length;

    // Calculate difficulty variance (allows some easier/harder sections)
    const difficultyVariance = 0.2;

    while (currentX < targetLength) {
      // Sample difficulty with some variance for variety
      const segmentDifficulty = Math.max(
        0,
        Math.min(
          1,
          config.difficulty + rng.range(-difficultyVariance, difficultyVariance)
        )
      );

      // Get appropriate templates for this difficulty
      const minDiff = Math.max(0, segmentDifficulty - 0.2);
      const maxDiff = Math.min(1, segmentDifficulty + 0.2);
      const suitableTemplates = getTemplatesByDifficulty(minDiff, maxDiff);

      if (suitableTemplates.length === 0) {
        // Fallback to all templates if no suitable ones found
        const template = rng.choice(getAllTemplates());
        const segment = this.createSegmentFromTemplate(
          template,
          currentX,
          rng.integer(0, 1000000)
        );
        segments.push(segment);
        currentX += segment.length;
      } else {
        // Choose a random suitable template
        const template = rng.choice(suitableTemplates);
        const segment = this.createSegmentFromTemplate(
          template,
          currentX,
          rng.integer(0, 1000000)
        );
        segments.push(segment);
        currentX += segment.length;
      }
    }

    return segments;
  }

  private createSegmentFromTemplate(
    template: SegmentTemplate,
    startX: number,
    seed: number
  ): LevelSegment {
    return {
      id: `segment_${seed}_${startX}`,
      startX,
      length: template.length,
      difficulty: template.difficulty,
      objects: template.generator(startX, seed),
      metadata: {
        templateName: template.name,
        generationMethod: 'template_based',
        features: template.features,
      },
    };
  }
}

/**
 * Noise-based procedural generation
 * Uses mathematical noise functions to create organic patterns
 * This simulates what an ML model might learn - continuous patterns
 */
export class NoiseBasedStrategy implements GenerationStrategy {
  name = 'noise_based';

  generate(config: LevelGeneratorConfig, rng: SeededRandom): LevelSegment[] {
    const segments: LevelSegment[] = [];
    const segmentLength = 150;
    const numSegments = Math.ceil(config.length / segmentLength);

    for (let i = 0; i < numSegments; i++) {
      const startX = i * segmentLength;
      const segment = this.generateNoiseSegment(
        startX,
        segmentLength,
        config,
        rng,
        i
      );
      segments.push(segment);
    }

    return segments;
  }

  private generateNoiseSegment(
    startX: number,
    length: number,
    config: LevelGeneratorConfig,
    rng: SeededRandom,
    index: number
  ): LevelSegment {
    const objects: GameObject[] = [];
    const groundY = 500;

    // Create base platform
    objects.push({
      id: `platform_noise_${index}_${startX}`,
      position: { x: startX, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: length, y: 20 },
      type: 'platform' as any,
      active: true,
    });

    // Use perlin-like noise to determine obstacle placement
    const obstacleCount = Math.floor(config.difficulty * 10 + rng.range(0, 3));

    for (let j = 0; j < obstacleCount; j++) {
      const xOffset = (j / obstacleCount) * length + rng.range(-10, 10);
      const noiseValue = this.noise(startX + xOffset, index);

      // Decide obstacle type based on noise value
      if (noiseValue < 0.33) {
        // Spike
        objects.push({
          id: `spike_noise_${index}_${j}`,
          position: { x: startX + xOffset, y: groundY - 20 },
          velocity: { x: 0, y: 0 },
          size: { x: 15, y: 20 },
          type: 'obstacle_spike' as any,
          active: true,
        });
      } else if (noiseValue < 0.66) {
        // Block
        const blockHeight = 20 + config.difficulty * 30;
        objects.push({
          id: `block_noise_${index}_${j}`,
          position: { x: startX + xOffset, y: groundY - blockHeight },
          velocity: { x: 0, y: 0 },
          size: { x: 25, y: blockHeight },
          type: 'obstacle_block' as any,
          active: true,
        });
      }
      // else: gap (no obstacle)
    }

    // Calculate feature metrics for this segment
    const spikeCount = objects.filter(o => o.type === 'obstacle_spike').length;
    const blockCount = objects.filter(o => o.type === 'obstacle_block').length;
    const density = (spikeCount + blockCount) / length;

    return {
      id: `segment_noise_${index}_${startX}`,
      startX,
      length,
      difficulty: config.difficulty,
      objects,
      metadata: {
        generationMethod: 'noise_based',
        features: {
          difficulty: config.difficulty,
          density,
          verticalComplexity: config.difficulty * 0.6,
          gapFrequency: 0,
          platformRatio: 1.0,
          obstacleTypes: [spikeCount / 10, blockCount / 10, 0],
        },
      },
    };
  }

  /**
   * Simple noise function (simplified Perlin noise)
   * Returns value between 0 and 1
   */
  private noise(x: number, seed: number): number {
    const n = Math.sin(x * 0.01 + seed) * Math.cos(x * 0.02 - seed);
    return (n + 1) / 2; // Normalize to 0-1
  }
}

/**
 * Wave-based generation strategy
 * Creates rhythmic patterns similar to music-synced levels
 */
export class WaveBasedStrategy implements GenerationStrategy {
  name = 'wave_based';

  generate(config: LevelGeneratorConfig, rng: SeededRandom): LevelSegment[] {
    const segments: LevelSegment[] = [];
    const segmentLength = 120;
    const numSegments = Math.ceil(config.length / segmentLength);

    // Define wave parameters based on difficulty
    const frequency = 0.5 + config.difficulty * 1.5; // Higher difficulty = higher frequency
    const amplitude = config.difficulty;

    for (let i = 0; i < numSegments; i++) {
      const startX = i * segmentLength;
      const segment = this.generateWaveSegment(
        startX,
        segmentLength,
        frequency,
        amplitude,
        i,
        rng
      );
      segments.push(segment);
    }

    return segments;
  }

  private generateWaveSegment(
    startX: number,
    length: number,
    frequency: number,
    amplitude: number,
    index: number,
    rng: SeededRandom
  ): LevelSegment {
    const objects: GameObject[] = [];
    const groundY = 500;

    // Base platform
    objects.push({
      id: `platform_wave_${index}_${startX}`,
      position: { x: startX, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: length, y: 20 },
      type: 'platform' as any,
      active: true,
    });

    // Generate obstacles in wave pattern
    const obstacleSpacing = 20;
    const numObstacles = Math.floor(length / obstacleSpacing);

    for (let i = 0; i < numObstacles; i++) {
      const xOffset = i * obstacleSpacing;
      const waveValue = Math.sin((startX + xOffset) * frequency * 0.01);

      // Wave determines if obstacle appears (threshold based on amplitude)
      if (Math.abs(waveValue) > (1 - amplitude)) {
        const obstacleType = waveValue > 0 ? 'spike' : 'block';

        if (obstacleType === 'spike') {
          objects.push({
            id: `spike_wave_${index}_${i}`,
            position: { x: startX + xOffset, y: groundY - 20 },
            velocity: { x: 0, y: 0 },
            size: { x: 15, y: 20 },
            type: 'obstacle_spike' as any,
            active: true,
          });
        } else {
          objects.push({
            id: `block_wave_${index}_${i}`,
            position: { x: startX + xOffset, y: groundY - 25 },
            velocity: { x: 0, y: 0 },
            size: { x: 20, y: 25 },
            type: 'obstacle_block' as any,
            active: true,
          });
        }
      }
    }

    return {
      id: `segment_wave_${index}_${startX}`,
      startX,
      length,
      difficulty: amplitude,
      objects,
      metadata: {
        generationMethod: 'wave_based',
        waveFrequency: frequency,
        waveAmplitude: amplitude,
      },
    };
  }
}

/**
 * Main procedural generator class
 * Coordinates different generation strategies
 */
export class ProceduralGenerator {
  private strategies: Map<string, GenerationStrategy>;

  constructor() {
    this.strategies = new Map();
    this.registerStrategy(new TemplateBasedStrategy());
    this.registerStrategy(new NoiseBasedStrategy());
    this.registerStrategy(new WaveBasedStrategy());
  }

  /**
   * Register a new generation strategy
   */
  registerStrategy(strategy: GenerationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Generate level segments using specified strategy
   */
  generate(
    config: LevelGeneratorConfig,
    strategyName: string = 'template_based'
  ): LevelSegment[] {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown generation strategy: ${strategyName}`);
    }

    const seed = config.seed ?? Math.floor(Math.random() * 1000000);
    const rng = new SeededRandom(seed);

    return strategy.generate(config, rng);
  }

  /**
   * Generate using multiple strategies and blend results
   * This creates more diverse levels by mixing approaches
   */
  generateBlended(
    config: LevelGeneratorConfig,
    strategyWeights: { [key: string]: number } = {
      template_based: 0.7,
      noise_based: 0.2,
      wave_based: 0.1,
    }
  ): LevelSegment[] {
    const seed = config.seed ?? Math.floor(Math.random() * 1000000);
    const rng = new SeededRandom(seed);

    // Determine which strategy to use for each segment based on weights
    const totalWeight = Object.values(strategyWeights).reduce((a, b) => a + b, 0);
    const normalizedWeights = Object.entries(strategyWeights).map(([name, weight]) => ({
      name,
      weight: weight / totalWeight,
    }));

    // Calculate cumulative probabilities
    let cumulative = 0;
    const strategyRanges = normalizedWeights.map(({ name, weight }) => {
      const start = cumulative;
      cumulative += weight;
      return { name, start, end: cumulative };
    });

    // Select strategy based on random value
    const random = rng.next();
    const selectedStrategy = strategyRanges.find(
      range => random >= range.start && random < range.end
    );

    if (!selectedStrategy) {
      // Fallback to template_based
      return this.generate(config, 'template_based');
    }

    return this.generate(config, selectedStrategy.name);
  }

  /**
   * Get list of available strategies
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}

/**
 * Utility functions for procedural generation
 */

/**
 * Apply constraints to generated segments
 * Ensures generated content respects physical limits
 */
export function applyConstraints(
  segments: LevelSegment[],
  constraints?: LevelConstraints
): LevelSegment[] {
  if (!constraints) return segments;

  return segments.map(segment => ({
    ...segment,
    objects: segment.objects.filter(obj => {
      // Filter by max obstacle height
      if (
        constraints.maxObstacleHeight &&
        (obj.type === 'obstacle_block' || obj.type === 'obstacle_spike')
      ) {
        if (obj.size.y > constraints.maxObstacleHeight) {
          return false;
        }
      }

      // Filter by min platform width
      if (constraints.minPlatformWidth && obj.type === 'platform') {
        if (obj.size.x < constraints.minPlatformWidth) {
          return false;
        }
      }

      return true;
    }),
  }));
}

/**
 * Analyze segment difficulty based on object patterns
 * This can be used to validate generated content
 */
export function analyzeSegmentDifficulty(segment: LevelSegment): number {
  const objects = segment.objects;

  const spikeCount = objects.filter(o => o.type === 'obstacle_spike').length;
  const blockCount = objects.filter(o => o.type === 'obstacle_block').length;
  const platformCount = objects.filter(o => o.type === 'platform').length;

  // Calculate metrics
  const obstacleDensity = (spikeCount + blockCount) / segment.length;
  const platformCoverage = platformCount > 0 ? 1 : 0;

  // Weighted difficulty score
  const difficulty =
    obstacleDensity * 0.6 +
    (1 - platformCoverage) * 0.2 +
    (blockCount / Math.max(spikeCount + blockCount, 1)) * 0.2;

  return Math.min(1, difficulty);
}
