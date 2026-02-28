/**
 * LevelGenerator - ML-Ready Level Generation System
 *
 * ARCHITECTURE OVERVIEW:
 * ======================
 * This is the main interface for level generation with a pluggable architecture
 * that supports both procedural algorithms and ML models.
 *
 * DESIGN PRINCIPLES:
 * 1. Strategy Pattern: Different generation methods (procedural, ML) implement
 *    a common interface
 * 2. Feature Extraction: All generated content includes numerical features that
 *    ML models can learn from
 * 3. Reproducibility: Seed-based generation ensures consistent outputs
 * 4. Modularity: Easy to swap procedural generation with ML models
 *
 * ML INTEGRATION ROADMAP:
 * =======================
 * Phase 1 (Current): Procedural generation with feature extraction
 * Phase 2: Collect gameplay data (player actions, success/failure, time)
 * Phase 3: Train ML models on collected data
 * Phase 4: Deploy ML models alongside procedural generation
 * Phase 5: A/B test and gradually replace procedural with ML
 *
 * SUPPORTED ML APPROACHES:
 * ========================
 * 1. Supervised Learning:
 *    - Input: difficulty, style, player skill level
 *    - Output: segment features (density, complexity, obstacle types)
 *    - Model: Neural network regression
 *
 * 2. Reinforcement Learning:
 *    - Agent learns to generate segments that match target difficulty
 *    - Reward: based on player completion rate, engagement time
 *    - Model: PPO or DQN
 *
 * 3. Generative Models:
 *    - VAE/GAN for generating novel segment patterns
 *    - Input: latent vector + difficulty
 *    - Output: segment structure
 *
 * 4. Sequence Models:
 *    - LSTM/Transformer to generate coherent sequences of segments
 *    - Learns temporal patterns and difficulty curves
 */

import {
  Level,
  LevelSegment,
  LevelGeneratorConfig,
  GameObject,
} from '../types';
import {
  ProceduralGenerator,
  SeededRandom,
  applyConstraints,
  analyzeSegmentDifficulty,
} from './ProceduralGenerator';
import { getAllTemplates, extractFeatureVector } from './SegmentTemplates';

/**
 * ML Model output interface
 * This defines what we expect from ML models
 */
export interface MLModelOutput {
  // Predicted segment features (normalized 0-1)
  features: {
    difficulty: number;
    density: number;           // Obstacles per unit length
    verticalComplexity: number; // Height variation
    gapFrequency: number;      // Number of gaps
    platformRatio: number;     // Platform coverage
    obstacleTypes: number[];   // Distribution of obstacle types [spike, block, gap]
  };

  // Optional: Direct obstacle predictions
  obstacles?: Array<{
    type: 'spike' | 'block' | 'platform';
    x: number;                 // Relative position in segment
    y: number;                 // Height
    confidence: number;        // Model confidence (0-1)
  }>;

  // Model metadata
  modelVersion?: string;
  confidence?: number;
  latencyMs?: number;
}

/**
 * Training data structure for ML models
 */
export interface TrainingExample {
  // Input features
  input: {
    targetDifficulty: number;
    segmentIndex: number;      // Position in level
    previousSegmentFeatures?: number[];
    playerSkillLevel?: number;
    style?: string;
  };

  // Output/Label
  output: {
    segmentFeatures: number[];
    objects: Array<{
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };

  // Gameplay metrics (for reinforcement learning)
  metrics?: {
    playerCompleted: boolean;
    attempts: number;
    completionTime: number;
    deathPositions: number[];
  };
}

/**
 * Main LevelGenerator class with ML-ready architecture
 */
export class LevelGenerator {
  private proceduralGenerator: ProceduralGenerator;
  private mlModel: MLModelInterface | null;
  private trainingData: TrainingExample[];

  constructor() {
    this.proceduralGenerator = new ProceduralGenerator();
    this.mlModel = null;
    this.trainingData = [];
  }

  // ============================================================================
  // PUBLIC API - Level Generation
  // ============================================================================

  /**
   * Generate a complete level using current best method
   * Automatically chooses between procedural and ML if available
   */
  generate(config: LevelGeneratorConfig): Level {
    const generationMethod = this.selectGenerationMethod(config);

    let segments: LevelSegment[];

    if (generationMethod === 'ml' && this.mlModel) {
      segments = this.generateWithML(config);
    } else {
      segments = this.generateProcedural(config);
    }

    // Apply constraints if specified
    if (config.constraints) {
      segments = applyConstraints(segments, config.constraints);
    }

    // Post-process segments
    segments = this.postProcessSegments(segments, config);

    // Create level object
    const level: Level = {
      id: this.generateLevelId(config),
      name: this.generateLevelName(config),
      segments,
      totalLength: segments.reduce((sum, seg) => sum + seg.length, 0),
      difficulty: config.difficulty,
      generatedBy: generationMethod,
      mlModelVersion: this.mlModel?.getVersion(),
    };

    // Record for training if enabled
    if (this.isTrainingEnabled()) {
      this.recordGenerationForTraining(config, level);
    }

    return level;
  }

  /**
   * Generate level using procedural algorithms
   * This is the baseline/fallback method
   */
  generateProcedural(config: LevelGeneratorConfig): LevelSegment[] {
    // Choose strategy based on style
    const strategy = this.selectProceduralStrategy(config.style);

    return this.proceduralGenerator.generate(config, strategy);
  }

  /**
   * Generate level using ML model
   *
   * HOW TO INTEGRATE YOUR ML MODEL:
   * ================================
   * 1. Implement the MLModelInterface (see below)
   * 2. Load your trained model in the implementation
   * 3. Register it: levelGenerator.setMLModel(yourModel)
   * 4. The generator will automatically use it when available
   *
   * EXAMPLE ML MODEL INTEGRATION:
   * ```typescript
   * class MyMLModel implements MLModelInterface {
   *   async predict(config: LevelGeneratorConfig): Promise<MLModelOutput> {
   *     // 1. Prepare input features
   *     const input = [
   *       config.difficulty,
   *       config.style === 'classic' ? 1 : 0,
   *       config.style === 'modern' ? 1 : 0,
   *       config.style === 'extreme' ? 1 : 0,
   *     ];
   *
   *     // 2. Call your ML model (TensorFlow.js, ONNX, API, etc.)
   *     const output = await this.model.predict(input);
   *
   *     // 3. Return structured output
   *     return {
   *       features: {
   *         difficulty: output[0],
   *         density: output[1],
   *         verticalComplexity: output[2],
   *         gapFrequency: output[3],
   *         platformRatio: output[4],
   *         obstacleTypes: [output[5], output[6], output[7]],
   *       },
   *     };
   *   }
   * }
   *
   * const model = new MyMLModel();
   * await model.load('/models/level-generator-v1.onnx');
   * levelGenerator.setMLModel(model);
   * ```
   */
  generateWithML(config: LevelGeneratorConfig): LevelSegment[] {
    if (!this.mlModel) {
      console.warn('ML model not available, falling back to procedural');
      return this.generateProcedural(config);
    }

    const segments: LevelSegment[] = [];
    const segmentLength = 150;
    const numSegments = Math.ceil(config.length / segmentLength);
    const seed = config.seed ?? Math.floor(Math.random() * 1000000);

    for (let i = 0; i < numSegments; i++) {
      const startX = i * segmentLength;

      // Call ML model for this segment
      const modelOutput = this.mlModel.predictSync({
        difficulty: config.difficulty,
        segmentIndex: i,
        totalSegments: numSegments,
        previousSegmentFeatures:
          i > 0 ? this.extractSegmentFeatures(segments[i - 1]) : undefined,
        style: config.style,
      });

      // Convert ML output to actual segment
      const segment = this.convertMLOutputToSegment(
        modelOutput,
        startX,
        segmentLength,
        seed + i
      );

      segments.push(segment);
    }

    return segments;
  }

  /**
   * Hybrid generation: Use ML for some segments, procedural for others
   * Useful for A/B testing and gradual ML rollout
   */
  generateHybrid(
    config: LevelGeneratorConfig,
    mlRatio: number = 0.5
  ): LevelSegment[] {
    if (!this.mlModel) {
      return this.generateProcedural(config);
    }

    const seed = config.seed ?? Math.floor(Math.random() * 1000000);
    const rng = new SeededRandom(seed);

    const segmentLength = 150;
    const numSegments = Math.ceil(config.length / segmentLength);
    const segments: LevelSegment[] = [];

    for (let i = 0; i < numSegments; i++) {
      const startX = i * segmentLength;

      // Randomly choose between ML and procedural
      const useML = rng.next() < mlRatio;

      if (useML) {
        const modelOutput = this.mlModel.predictSync({
          difficulty: config.difficulty,
          segmentIndex: i,
          totalSegments: numSegments,
          style: config.style,
        });

        const segment = this.convertMLOutputToSegment(
          modelOutput,
          startX,
          segmentLength,
          seed + i
        );
        segments.push(segment);
      } else {
        const proceduralSegments = this.proceduralGenerator.generate(
          {
            ...config,
            length: segmentLength,
            seed: seed + i,
          },
          'template_based'
        );
        segments.push(...proceduralSegments);
      }
    }

    return segments;
  }

  // ============================================================================
  // ML MODEL MANAGEMENT
  // ============================================================================

  /**
   * Register an ML model for level generation
   */
  setMLModel(model: MLModelInterface): void {
    this.mlModel = model;
    console.log(`ML model registered: ${model.getVersion()}`);
  }

  /**
   * Remove ML model (fall back to procedural)
   */
  removeMLModel(): void {
    this.mlModel = null;
  }

  /**
   * Check if ML model is available
   */
  hasMLModel(): boolean {
    return this.mlModel !== null;
  }

  // ============================================================================
  // TRAINING DATA COLLECTION
  // ============================================================================

  /**
   * Enable training data collection
   * Call this to start recording generated levels for ML training
   */
  enableTraining(): void {
    this.trainingData = [];
  }

  /**
   * Get collected training data
   */
  getTrainingData(): TrainingExample[] {
    return this.trainingData;
  }

  /**
   * Export training data to JSON for ML training pipeline
   */
  exportTrainingData(): string {
    return JSON.stringify(this.trainingData, null, 2);
  }

  /**
   * Record gameplay metrics for a level (for reinforcement learning)
   */
  recordGameplayMetrics(
    levelId: string,
    metrics: {
      completed: boolean;
      attempts: number;
      completionTime: number;
      deathPositions: number[];
    }
  ): void {
    // Find corresponding training example and update metrics
    const example = this.trainingData.find(
      ex => (ex as any).levelId === levelId
    );

    if (example) {
      example.metrics = {
        playerCompleted: metrics.completed,
        attempts: metrics.attempts,
        completionTime: metrics.completionTime,
        deathPositions: metrics.deathPositions,
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private selectGenerationMethod(
    config: LevelGeneratorConfig
  ): 'procedural' | 'ml' {
    // Use ML if available and not explicitly disabled
    if (this.mlModel && !(config as any).forceProceduralMode) {
      return 'ml';
    }
    return 'procedural';
  }

  private selectProceduralStrategy(
    style?: 'classic' | 'modern' | 'extreme'
  ): string {
    switch (style) {
      case 'classic':
        return 'template_based';
      case 'modern':
        return 'noise_based';
      case 'extreme':
        return 'wave_based';
      default:
        return 'template_based';
    }
  }

  private postProcessSegments(
    segments: LevelSegment[],
    config: LevelGeneratorConfig
  ): LevelSegment[] {
    // Validate and adjust difficulty
    return segments.map(segment => ({
      ...segment,
      difficulty: this.validateDifficulty(
        segment.difficulty,
        config.difficulty
      ),
    }));
  }

  private validateDifficulty(
    segmentDifficulty: number,
    targetDifficulty: number
  ): number {
    // Ensure segment difficulty is within reasonable range of target
    const maxDeviation = 0.3;
    const minDiff = Math.max(0, targetDifficulty - maxDeviation);
    const maxDiff = Math.min(1, targetDifficulty + maxDeviation);

    return Math.max(minDiff, Math.min(maxDiff, segmentDifficulty));
  }

  private convertMLOutputToSegment(
    mlOutput: MLModelOutput,
    startX: number,
    length: number,
    seed: number
  ): LevelSegment {
    const objects: GameObject[] = [];
    const groundY = 500;

    // If model provides direct obstacle predictions, use them
    if (mlOutput.obstacles && mlOutput.obstacles.length > 0) {
      mlOutput.obstacles.forEach((obstacle, idx) => {
        objects.push({
          id: `ml_${obstacle.type}_${seed}_${idx}`,
          position: {
            x: startX + obstacle.x * length,
            y: groundY + obstacle.y,
          },
          velocity: { x: 0, y: 0 },
          size: {
            x: obstacle.type === 'spike' ? 15 : 25,
            y: obstacle.type === 'spike' ? 20 : 25,
          },
          type: `obstacle_${obstacle.type}` as any,
          active: true,
        });
      });
    } else {
      // Otherwise, use features to procedurally generate with ML guidance
      objects.push(...this.generateFromFeatures(mlOutput.features, startX, length, seed));
    }

    return {
      id: `segment_ml_${seed}_${startX}`,
      startX,
      length,
      difficulty: mlOutput.features.difficulty,
      objects,
      metadata: {
        generationMethod: 'ml',
        modelVersion: mlOutput.modelVersion,
        confidence: mlOutput.confidence,
        features: mlOutput.features,
      },
    };
  }

  private generateFromFeatures(
    features: MLModelOutput['features'],
    startX: number,
    length: number,
    seed: number
  ): GameObject[] {
    const objects: GameObject[] = [];
    const groundY = 500;
    const rng = new SeededRandom(seed);

    // Create base platform
    objects.push({
      id: `platform_ml_${seed}`,
      position: { x: startX, y: groundY },
      velocity: { x: 0, y: 0 },
      size: { x: length, y: 20 },
      type: 'platform' as any,
      active: true,
    });

    // Generate obstacles based on ML-predicted features
    const numObstacles = Math.floor(features.density * length);

    for (let i = 0; i < numObstacles; i++) {
      const xPos = startX + (i / numObstacles) * length + rng.range(-10, 10);

      // Choose obstacle type based on predicted distribution
      const typeRand = rng.next();
      const [spikeProb, blockProb] = features.obstacleTypes;

      if (typeRand < spikeProb) {
        objects.push({
          id: `spike_ml_${seed}_${i}`,
          position: { x: xPos, y: groundY - 20 },
          velocity: { x: 0, y: 0 },
          size: { x: 15, y: 20 },
          type: 'obstacle_spike' as any,
          active: true,
        });
      } else if (typeRand < spikeProb + blockProb) {
        const height = 20 + features.verticalComplexity * 40;
        objects.push({
          id: `block_ml_${seed}_${i}`,
          position: { x: xPos, y: groundY - height },
          velocity: { x: 0, y: 0 },
          size: { x: 25, y: height },
          type: 'obstacle_block' as any,
          active: true,
        });
      }
    }

    return objects;
  }

  private extractSegmentFeatures(segment: LevelSegment): number[] {
    if (segment.metadata?.features) {
      const f = segment.metadata.features;
      return [
        f.difficulty || 0,
        f.density || 0,
        f.verticalComplexity || 0,
        f.gapFrequency || 0,
        f.platformRatio || 0,
        ...(f.obstacleTypes || [0, 0, 0]),
      ];
    }

    // Fallback: analyze segment if features not available
    return [analyzeSegmentDifficulty(segment), 0, 0, 0, 0, 0, 0, 0];
  }

  private generateLevelId(config: LevelGeneratorConfig): string {
    const timestamp = Date.now();
    const seed = config.seed ?? 0;
    return `level_${timestamp}_${seed}`;
  }

  private generateLevelName(config: LevelGeneratorConfig): string {
    const difficultyName = this.getDifficultyName(config.difficulty);
    const styleName = config.style || 'classic';
    return `${styleName.charAt(0).toUpperCase() + styleName.slice(1)} ${difficultyName}`;
  }

  private getDifficultyName(difficulty: number): string {
    if (difficulty < 0.2) return 'Easy';
    if (difficulty < 0.4) return 'Normal';
    if (difficulty < 0.6) return 'Hard';
    if (difficulty < 0.8) return 'Expert';
    return 'Extreme';
  }

  private isTrainingEnabled(): boolean {
    return this.trainingData !== null;
  }

  private recordGenerationForTraining(
    config: LevelGeneratorConfig,
    level: Level
  ): void {
    level.segments.forEach((segment, idx) => {
      const example: TrainingExample = {
        input: {
          targetDifficulty: config.difficulty,
          segmentIndex: idx,
          previousSegmentFeatures:
            idx > 0
              ? this.extractSegmentFeatures(level.segments[idx - 1])
              : undefined,
          style: config.style,
        },
        output: {
          segmentFeatures: this.extractSegmentFeatures(segment),
          objects: segment.objects.map(obj => ({
            type: obj.type,
            x: obj.position.x,
            y: obj.position.y,
            width: obj.size.x,
            height: obj.size.y,
          })),
        },
      };

      this.trainingData.push(example);
    });
  }
}

// ============================================================================
// ML MODEL INTERFACE
// ============================================================================

/**
 * Interface that ML models must implement
 * This provides a contract for different ML implementations
 */
export interface MLModelInterface {
  /**
   * Synchronous prediction (for real-time generation)
   */
  predictSync(input: {
    difficulty: number;
    segmentIndex: number;
    totalSegments: number;
    previousSegmentFeatures?: number[];
    style?: string;
  }): MLModelOutput;

  /**
   * Asynchronous prediction (for batch generation)
   */
  predict(input: {
    difficulty: number;
    segmentIndex: number;
    totalSegments: number;
    previousSegmentFeatures?: number[];
    style?: string;
  }): Promise<MLModelOutput>;

  /**
   * Load model from file/URL
   */
  load(modelPath: string): Promise<void>;

  /**
   * Get model version
   */
  getVersion(): string;

  /**
   * Get model metadata
   */
  getMetadata(): {
    architecture: string;
    trainedOn: string;
    accuracy?: number;
    avgLatency?: number;
  };
}

/**
 * Example stub ML model for testing
 * Replace this with your actual ML implementation
 */
export class StubMLModel implements MLModelInterface {
  private version = 'stub-v1.0.0';
  private rng: SeededRandom;

  constructor() {
    this.rng = new SeededRandom(12345);
  }

  predictSync(input: any): MLModelOutput {
    // Stub: just return features based on input difficulty
    return {
      features: {
        difficulty: input.difficulty,
        density: input.difficulty * 0.8,
        verticalComplexity: input.difficulty * 0.6,
        gapFrequency: Math.floor(input.difficulty * 3),
        platformRatio: 1 - input.difficulty * 0.3,
        obstacleTypes: [
          input.difficulty * 0.6,
          input.difficulty * 0.4,
          input.difficulty * 0.2,
        ],
      },
      modelVersion: this.version,
      confidence: 0.75,
      latencyMs: 5,
    };
  }

  async predict(input: any): Promise<MLModelOutput> {
    return this.predictSync(input);
  }

  async load(modelPath: string): Promise<void> {
    console.log(`Stub model loaded from ${modelPath}`);
  }

  getVersion(): string {
    return this.version;
  }

  getMetadata() {
    return {
      architecture: 'stub',
      trainedOn: 'synthetic',
      accuracy: 0.75,
      avgLatency: 5,
    };
  }
}
