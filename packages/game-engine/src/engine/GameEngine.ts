// Main game engine with game loop and state management
import { GameState, Player, GameObject, GameObjectType, Level, PhysicsConfig } from '../types';
import { PhysicsEngine } from './PhysicsEngine';
import { CollisionDetection } from './CollisionDetection';
import { InputHandler } from './InputHandler';
import { generateInfiniteChunk } from '../levels/InfiniteLevel';

export interface GameEngineConfig {
  canvasWidth: number;
  canvasHeight: number;
  playerSpeed: number; // Auto-run speed
  physicsConfig?: Partial<PhysicsConfig>;
  /** Initial seed for procedural chunk generation (VRF-verified terrain) */
  initialChunkSeed?: number;
}

export class GameEngine {
  private gameState: GameState;
  private physicsEngine: PhysicsEngine;
  private inputHandler: InputHandler;
  private config: GameEngineConfig;

  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private isRunning: boolean = false;

  // Infinite generation state
  private generatedUpToX: number = 0;
  private chunkSeed: number = 1;
  private static readonly CHUNK_SIZE = 800;
  private static readonly GENERATE_AHEAD = 3200; // Generate 3200px ahead of camera

  // Callbacks for rendering and events
  private onRenderCallback?: (state: GameState) => void;
  private onGameOverCallback?: (score: number) => void;
  private onScoreUpdateCallback?: (score: number) => void;

  constructor(initialLevel: Level, config: GameEngineConfig) {
    this.config = config;
    this.physicsEngine = new PhysicsEngine(config.physicsConfig);
    this.inputHandler = new InputHandler();
    this.chunkSeed = config.initialChunkSeed ?? 1;

    // Initialize game state
    this.gameState = this.createInitialState(initialLevel);

    // Track how far hand-placed content extends so procedural gen starts after it
    const maxObjX = initialLevel.segments.reduce((max, seg) => {
      const segMax = seg.objects.reduce((m, obj) => Math.max(m, obj.position.x + (obj.size?.x ?? 0)), 0);
      return Math.max(max, segMax);
    }, 0);
    this.generatedUpToX = maxObjX + 200;
  }

  /**
   * Create initial game state
   */
  private createInitialState(level: Level): GameState {
    const player: Player = {
      id: 'player',
      position: { x: 100, y: this.config.canvasHeight - 150 },
      velocity: { x: this.config.playerSpeed, y: 0 },
      size: { x: 30, y: 30 },
      type: GameObjectType.PLAYER,
      active: true,
      isJumping: false,
      isOnGround: false,
      health: 1,
      score: 0,
    };

    return {
      player,
      currentLevel: level,
      currentSegmentIndex: 0,
      gameObjects: this.loadVisibleObjects(level, 0),
      elapsedTime: 0,
      cameraOffset: 0,
      isPaused: false,
      isGameOver: false,
      score: 0,
    };
  }

  /**
   * Load game objects that are currently visible or near the player
   */
  private loadVisibleObjects(level: Level, cameraOffset: number): GameObject[] {
    const loadDistance = this.config.canvasWidth * 2; // Load objects 2 screens ahead
    const objects: GameObject[] = [];

    for (const segment of level.segments) {
      // Check if segment is in visible range
      if (
        segment.startX + segment.length >= cameraOffset &&
        segment.startX <= cameraOffset + loadDistance
      ) {
        objects.push(...segment.objects.filter((obj) => obj.active));
      }
    }

    return objects;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop(this.lastFrameTime);
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main game loop using requestAnimationFrame
   */
  private gameLoop(currentTime: number): void {
    if (!this.isRunning) return;

    // Calculate delta time (in seconds)
    const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1); // Cap at 100ms
    this.lastFrameTime = currentTime;

    // Update game state
    this.update(deltaTime);

    // Render
    if (this.onRenderCallback) {
      this.onRenderCallback(this.gameState);
    }

    // Request next frame
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  /**
   * Update game state
   */
  /** Ground surface Y - player bottom must never go below this. Matches level design. */
  private static readonly GROUND_Y = 500;

  private update(deltaTime: number): void {
    if (this.gameState.isGameOver) return;

    // CRITICAL: Floor clamp FIRST - fix any bad state from previous frame immediately
    const player = this.gameState.player;
    const playerBottom = player.position.y + player.size.y;
    if (playerBottom > GameEngine.GROUND_Y) {
      player.position.y = GameEngine.GROUND_Y - player.size.y;
      player.velocity.y = 0;
      player.isOnGround = true;
      player.isJumping = false;
    }

    // Handle input
    this.handleInput();

    if (this.gameState.isPaused) return;

    // Track active run duration in seconds for payout logic.
    this.gameState.elapsedTime += deltaTime;

    // Update player physics
    const levelPlatforms = this.gameState.gameObjects.filter(
      (obj) => obj.type === GameObjectType.PLATFORM && obj.active
    );

    // Permanent safety floor - prevents falling through (never unloaded, spans entire level)
    const safetyFloor: GameObject = {
      id: '__safety_floor__',
      position: { x: -5000, y: GameEngine.GROUND_Y },
      velocity: { x: 0, y: 0 },
      size: { x: 20000, y: 50 },
      type: GameObjectType.PLATFORM,
      active: true,
    };
    const platforms = [safetyFloor, ...levelPlatforms];

    // floorY = ground surface - player bottom clamped to never go below this
    this.physicsEngine.updatePlayer(
      this.gameState.player,
      platforms,
      deltaTime,
      GameEngine.GROUND_Y
    );

    // Maintain player's forward speed
    this.physicsEngine.setPlayerRunSpeed(this.gameState.player, this.config.playerSpeed);

    // Update camera to follow player
    this.updateCamera();

    // Load/unload objects based on camera position
    this.updateVisibleObjects();

    // Check collisions
    this.checkCollisions();

    // Check out of bounds - only die from going off left or above; never from falling
    // Final floor clamp (belt and suspenders)
    if (player.position.y + player.size.y > GameEngine.GROUND_Y) {
      player.position.y = GameEngine.GROUND_Y - player.size.y;
      player.velocity.y = 0;
      player.isOnGround = true;
      player.isJumping = false;
    }
    // Only trigger game over for left/above bounds, not falling
    if (
      player.position.x + player.size.x < 0 ||
      player.position.y + player.size.y < 0
    ) {
      this.handleGameOver();
    }

    // Update score
    if (this.gameState.player.score !== this.gameState.score) {
      this.gameState.score = this.gameState.player.score;
      if (this.onScoreUpdateCallback) {
        this.onScoreUpdateCallback(this.gameState.score);
      }
    }
  }

  /**
   * Handle player input
   */
  private handleInput(): void {
    const input = this.inputHandler.getInputState();

    // Jump
    if (input.jump) {
      this.physicsEngine.jump(this.gameState.player);
    }

    // Restart
    if (this.inputHandler.consumeAction('restart')) {
      this.restart();
    }

    // Pause
    if (this.inputHandler.consumeAction('pause')) {
      this.togglePause();
    }
  }

  /**
   * Update camera position to follow player
   */
  private updateCamera(): void {
    const playerScreenX = this.gameState.player.position.x - this.gameState.cameraOffset;
    const targetScreenX = this.config.canvasWidth * 0.3; // Keep player at 30% of screen width

    if (playerScreenX > targetScreenX) {
      this.gameState.cameraOffset += playerScreenX - targetScreenX;
    }
  }

  /**
   * Update visible objects based on camera position
   */
  private updateVisibleObjects(): void {
    const loadDistance = this.config.canvasWidth * 2;
    const unloadDistance = -this.config.canvasWidth;

    // Remove objects that are too far behind (never unload floor/platforms - prevents fall-through)
    this.gameState.gameObjects = this.gameState.gameObjects.filter((obj) => {
      if (obj.type === GameObjectType.PLATFORM) return true;
      const relativeX = obj.position.x - this.gameState.cameraOffset;
      return relativeX > unloadDistance;
    });

    // Load new objects ahead from pre-defined level segments
    const existingIds = new Set(this.gameState.gameObjects.map((obj) => obj.id));
    const newObjects = this.loadVisibleObjects(
      this.gameState.currentLevel,
      this.gameState.cameraOffset
    ).filter((obj) => !existingIds.has(obj.id));

    this.gameState.gameObjects.push(...newObjects);

    // Infinite procedural generation: create new chunks when player approaches
    // the frontier of generated content
    const horizonX = this.gameState.cameraOffset + GameEngine.GENERATE_AHEAD;
    while (this.generatedUpToX < horizonX) {
      const chunkObstacles = generateInfiniteChunk(
        this.generatedUpToX,
        GameEngine.CHUNK_SIZE,
        this.chunkSeed++
      );
      this.gameState.gameObjects.push(...chunkObstacles);
      this.generatedUpToX += GameEngine.CHUNK_SIZE;
    }
  }

  /**
   * Check and handle collisions
   */
  private checkCollisions(): void {
    const collisions = CollisionDetection.findCollisions(
      this.gameState.player,
      this.gameState.gameObjects
    );

    for (const obj of collisions) {
      const isFatal = this.physicsEngine.handlePlayerCollision(this.gameState.player, obj);
      if (isFatal) {
        this.handleGameOver();
        break;
      }
    }
  }

  /**
   * Handle game over
   */
  private handleGameOver(): void {
    this.gameState.isGameOver = true;
    this.gameState.player.health = 0;

    if (this.onGameOverCallback) {
      this.onGameOverCallback(this.gameState.score);
    }
  }

  /**
   * Restart the game
   */
  restart(): void {
    this.gameState = this.createInitialState(this.gameState.currentLevel);
    this.inputHandler.reset();

    // Reset infinite generation so procedural content starts fresh
    const level = this.gameState.currentLevel;
    const maxObjX = level.segments.reduce((max, seg) => {
      const segMax = seg.objects.reduce((m, obj) => Math.max(m, obj.position.x + (obj.size?.x ?? 0)), 0);
      return Math.max(max, segMax);
    }, 0);
    this.generatedUpToX = maxObjX + 200;
    this.chunkSeed = 1;
  }

  /**
   * Toggle pause state
   */
  togglePause(): void {
    this.gameState.isPaused = !this.gameState.isPaused;
  }

  /**
   * Pause the game
   */
  pause(): void {
    this.gameState.isPaused = true;
  }

  /**
   * Resume the game
   */
  resume(): void {
    this.gameState.isPaused = false;
  }

  /**
   * Get current game state (immutable copy)
   */
  getState(): GameState {
    return JSON.parse(JSON.stringify(this.gameState));
  }

  /**
   * Set render callback
   */
  onRender(callback: (state: GameState) => void): void {
    this.onRenderCallback = callback;
  }

  /**
   * Set game over callback
   */
  onGameOver(callback: (score: number) => void): void {
    this.onGameOverCallback = callback;
  }

  /**
   * Set score update callback
   */
  onScoreUpdate(callback: (score: number) => void): void {
    this.onScoreUpdateCallback = callback;
  }

  /**
   * Load a new level
   */
  loadLevel(level: Level): void {
    this.stop();
    this.gameState = this.createInitialState(level);
    this.start();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.inputHandler.destroy();
  }
}
