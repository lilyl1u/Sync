// Main game engine with game loop and state management
import { GameState, Player, GameObject, GameObjectType, Level, PhysicsConfig } from '../types';
import { PhysicsEngine } from './PhysicsEngine';
import { CollisionDetection } from './CollisionDetection';
import { InputHandler } from './InputHandler';

export interface GameEngineConfig {
  canvasWidth: number;
  canvasHeight: number;
  playerSpeed: number; // Auto-run speed
  physicsConfig?: Partial<PhysicsConfig>;
}

export class GameEngine {
  private gameState: GameState;
  private physicsEngine: PhysicsEngine;
  private inputHandler: InputHandler;
  private config: GameEngineConfig;

  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private isRunning: boolean = false;

  // Callbacks for rendering and events
  private onRenderCallback?: (state: GameState) => void;
  private onGameOverCallback?: (score: number) => void;
  private onScoreUpdateCallback?: (score: number) => void;

  constructor(initialLevel: Level, config: GameEngineConfig) {
    this.config = config;
    this.physicsEngine = new PhysicsEngine(config.physicsConfig);
    this.inputHandler = new InputHandler();

    // Initialize game state
    this.gameState = this.createInitialState(initialLevel);
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
  private update(deltaTime: number): void {
    if (this.gameState.isGameOver) return;

    // Handle input
    this.handleInput();

    if (this.gameState.isPaused) return;

    // Update player physics
    const platforms = this.gameState.gameObjects.filter(
      (obj) => obj.type === GameObjectType.PLATFORM && obj.active
    );

    this.physicsEngine.updatePlayer(this.gameState.player, platforms, deltaTime);

    // Maintain player's forward speed
    this.physicsEngine.setPlayerRunSpeed(this.gameState.player, this.config.playerSpeed);

    // Update camera to follow player
    this.updateCamera();

    // Load/unload objects based on camera position
    this.updateVisibleObjects();

    // Check collisions
    this.checkCollisions();

    // Check if player fell out of bounds
    if (
      this.physicsEngine.isOutOfBounds(this.gameState.player, {
        width: this.config.canvasWidth,
        height: this.config.canvasHeight,
      })
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

    // Remove objects that are too far behind
    this.gameState.gameObjects = this.gameState.gameObjects.filter((obj) => {
      const relativeX = obj.position.x - this.gameState.cameraOffset;
      return relativeX > unloadDistance;
    });

    // Load new objects ahead
    const existingIds = new Set(this.gameState.gameObjects.map((obj) => obj.id));
    const newObjects = this.loadVisibleObjects(
      this.gameState.currentLevel,
      this.gameState.cameraOffset
    ).filter((obj) => !existingIds.has(obj.id));

    this.gameState.gameObjects.push(...newObjects);
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
