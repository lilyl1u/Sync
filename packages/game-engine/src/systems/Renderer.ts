// Core rendering system for the Geometry Dash clone
// Handles canvas drawing, camera, and visual effects

import {
  GameObject,
  Player,
  Obstacle,
  Platform,
  GameObjectType,
  Vector2D,
  GameState,
} from '../types';

export interface RenderConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pixelRatio?: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  private pixelRatio: number;

  // Background parallax layers
  private starsImage: HTMLImageElement | null = null;
  private cloudsImage: HTMLImageElement | null = null;
  private backgroundOffset: number = 0;

  // Color palette - Geometry Dash inspired with HackIllinois purple theme
  private colors = {
    sky: '#1a1033',
    skyGradientTop: '#2d1b4e',
    skyGradientBottom: '#1a1033',
    ground: '#6b46c1',
    groundDark: '#553c9a',
    player: '#00f2ff',
    playerGlow: '#00d4ff',
    obstacle: '#ff006e',
    obstacleGlow: '#ff1a7f',
    platform: '#8b5cf6',
    platformGlow: '#a78bfa',
    collectible: '#fbbf24',
    portal: '#8b5cf6',
    particle: '#ffffff',
    star: '#ffefcf',
  };

  constructor(config: RenderConfig) {
    this.canvas = config.canvas;
    this.width = config.width;
    this.height = config.height;
    this.pixelRatio = config.pixelRatio || window.devicePixelRatio || 1;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = ctx;

    this.setupCanvas();
    this.loadBackgroundAssets();
  }

  private setupCanvas(): void {
    // Set canvas size accounting for device pixel ratio
    this.canvas.width = this.width * this.pixelRatio;
    this.canvas.height = this.height * this.pixelRatio;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Scale context to match device pixel ratio
    this.ctx.scale(this.pixelRatio, this.pixelRatio);

    // Enable image smoothing for better quality
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  private loadBackgroundAssets(): void {
    // Load stars
    this.starsImage = new Image();
    this.starsImage.src = '/assets/stars.svg';

    // Load clouds
    this.cloudsImage = new Image();
    this.cloudsImage.src = '/assets/clouds.svg';
  }

  public render(gameState: GameState): void {
    // Clear canvas
    this.clear();

    // Update background offset for parallax effect
    this.backgroundOffset = gameState.cameraOffset;

    // Draw layers from back to front
    this.drawBackground();
    this.drawParallaxStars(gameState.cameraOffset);
    this.drawParallaxClouds(gameState.cameraOffset);
    this.drawGround(gameState.cameraOffset);

    // Draw game objects relative to camera
    this.drawGameObjects(gameState);
    this.drawPlayer(gameState.player, gameState.cameraOffset);
  }

  private clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private drawBackground(): void {
    // Gradient sky background
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, this.colors.skyGradientTop);
    gradient.addColorStop(1, this.colors.skyGradientBottom);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawParallaxStars(cameraOffset: number): void {
    if (!this.starsImage || !this.starsImage.complete) return;

    // Parallax speed - slower than camera (depth effect)
    const parallaxSpeed = 0.2;
    const offset = -(cameraOffset * parallaxSpeed) % this.starsImage.width;

    this.ctx.globalAlpha = 0.7;

    // Draw stars tiled across the screen
    for (let x = offset - this.starsImage.width; x < this.width; x += this.starsImage.width) {
      this.ctx.drawImage(
        this.starsImage,
        x,
        0,
        this.starsImage.width,
        this.starsImage.height
      );
    }

    this.ctx.globalAlpha = 1.0;
  }

  private drawParallaxClouds(cameraOffset: number): void {
    if (!this.cloudsImage || !this.cloudsImage.complete) return;

    // Parallax speed - medium speed for mid-ground
    const parallaxSpeed = 0.4;
    const offset = -(cameraOffset * parallaxSpeed) % this.cloudsImage.width;

    this.ctx.globalAlpha = 0.5;

    // Draw clouds tiled across the screen
    for (let x = offset - this.cloudsImage.width; x < this.width; x += this.cloudsImage.width) {
      this.ctx.drawImage(
        this.cloudsImage,
        x,
        this.height * 0.15, // Position clouds in upper portion
        this.cloudsImage.width,
        this.cloudsImage.height * 0.6 // Scale down height
      );
    }

    this.ctx.globalAlpha = 1.0;
  }

  private drawGround(cameraOffset: number): void {
    const groundHeight = 100;
    const groundY = this.height - groundHeight;

    // Draw ground with pattern
    this.ctx.fillStyle = this.colors.ground;
    this.ctx.fillRect(0, groundY, this.width, groundHeight);

    // Add grid pattern to ground
    this.ctx.strokeStyle = this.colors.groundDark;
    this.ctx.lineWidth = 2;

    const gridSize = 50;
    const offset = cameraOffset % gridSize;

    // Vertical lines
    for (let x = -offset; x < this.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, groundY);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = groundY; y < this.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    // Top border glow
    this.ctx.strokeStyle = this.colors.platformGlow;
    this.ctx.lineWidth = 3;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = this.colors.platformGlow;
    this.ctx.beginPath();
    this.ctx.moveTo(0, groundY);
    this.ctx.lineTo(this.width, groundY);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  private drawGameObjects(gameState: GameState): void {
    const { gameObjects, cameraOffset } = gameState;

    gameObjects.forEach(obj => {
      if (!obj.active) return;

      // Only draw objects that are visible on screen
      const screenX = obj.position.x - cameraOffset;
      if (screenX < -obj.size.x - 100 || screenX > this.width + 100) {
        return;
      }

      switch (obj.type) {
        case GameObjectType.OBSTACLE_SPIKE:
        case GameObjectType.OBSTACLE_BLOCK:
          this.drawObstacle(obj as Obstacle, cameraOffset);
          break;
        case GameObjectType.PLATFORM:
          this.drawPlatform(obj as Platform, cameraOffset);
          break;
        case GameObjectType.COLLECTIBLE:
          this.drawCollectible(obj, cameraOffset);
          break;
        case GameObjectType.PORTAL:
          this.drawPortal(obj, cameraOffset);
          break;
      }
    });
  }

  private drawPlayer(player: Player, cameraOffset: number): void {
    const screenX = player.position.x - cameraOffset;
    const screenY = player.position.y;

    this.ctx.save();

    // Translate to player position
    this.ctx.translate(screenX + player.size.x / 2, screenY + player.size.y / 2);

    // Rotate based on velocity (adds dynamic feel)
    const rotation = player.velocity.y * 0.05;
    this.ctx.rotate(rotation);

    // Draw glow effect
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = this.colors.playerGlow;

    // Draw player as cube (Geometry Dash style)
    this.ctx.fillStyle = this.colors.player;
    this.ctx.fillRect(
      -player.size.x / 2,
      -player.size.y / 2,
      player.size.x,
      player.size.y
    );

    // Draw inner detail
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fillRect(
      -player.size.x / 2 + 5,
      -player.size.y / 2 + 5,
      player.size.x - 10,
      player.size.y - 10
    );

    // Draw border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      -player.size.x / 2,
      -player.size.y / 2,
      player.size.x,
      player.size.y
    );

    this.ctx.restore();

    // Draw trail effect when moving fast
    if (Math.abs(player.velocity.x) > 3) {
      this.drawPlayerTrail(screenX, screenY, player.size);
    }
  }

  private drawPlayerTrail(x: number, y: number, size: Vector2D): void {
    const trailLength = 3;

    for (let i = 0; i < trailLength; i++) {
      const alpha = 0.2 - (i * 0.05);
      const offset = (i + 1) * 10;

      this.ctx.fillStyle = `rgba(0, 242, 255, ${alpha})`;
      this.ctx.fillRect(
        x - offset,
        y,
        size.x,
        size.y
      );
    }
  }

  private drawObstacle(obstacle: Obstacle, cameraOffset: number): void {
    const screenX = obstacle.position.x - cameraOffset;
    const screenY = obstacle.position.y;

    this.ctx.save();

    if (obstacle.type === GameObjectType.OBSTACLE_SPIKE) {
      this.drawSpike(screenX, screenY, obstacle.size);
    } else {
      this.drawBlock(screenX, screenY, obstacle.size);
    }

    this.ctx.restore();
  }

  private drawSpike(x: number, y: number, size: Vector2D): void {
    // Draw glow
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = this.colors.obstacleGlow;

    // Draw triangle spike
    this.ctx.fillStyle = this.colors.obstacle;
    this.ctx.beginPath();
    this.ctx.moveTo(x + size.x / 2, y); // Top point
    this.ctx.lineTo(x + size.x, y + size.y); // Bottom right
    this.ctx.lineTo(x, y + size.y); // Bottom left
    this.ctx.closePath();
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = '#ff3399';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.shadowBlur = 0;
  }

  private drawBlock(x: number, y: number, size: Vector2D): void {
    // Draw glow
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = this.colors.obstacleGlow;

    // Draw block
    this.ctx.fillStyle = this.colors.obstacle;
    this.ctx.fillRect(x, y, size.x, size.y);

    // Draw pattern
    this.ctx.strokeStyle = '#ff3399';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + size.x, y + size.y);
    this.ctx.moveTo(x + size.x, y);
    this.ctx.lineTo(x, y + size.y);
    this.ctx.stroke();

    // Draw border
    this.ctx.strokeRect(x, y, size.x, size.y);

    this.ctx.shadowBlur = 0;
  }

  private drawPlatform(platform: Platform, cameraOffset: number): void {
    const screenX = platform.position.x - cameraOffset;
    const screenY = platform.position.y;

    // Draw glow
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = this.colors.platformGlow;

    // Draw platform
    this.ctx.fillStyle = this.colors.platform;
    this.ctx.fillRect(screenX, screenY, platform.width, platform.size.y);

    // Draw top highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.fillRect(screenX, screenY, platform.width, 5);

    // Draw border
    this.ctx.strokeStyle = this.colors.platformGlow;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(screenX, screenY, platform.width, platform.size.y);

    this.ctx.shadowBlur = 0;
  }

  private drawCollectible(obj: GameObject, cameraOffset: number): void {
    const screenX = obj.position.x - cameraOffset;
    const screenY = obj.position.y;
    const centerX = screenX + obj.size.x / 2;
    const centerY = screenY + obj.size.y / 2;
    const radius = obj.size.x / 2;

    // Pulsing effect
    const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 1;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(pulse, pulse);

    // Draw glow
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = this.colors.collectible;

    // Draw star/coin
    this.ctx.fillStyle = this.colors.collectible;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw inner detail
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
    this.ctx.shadowBlur = 0;
  }

  private drawPortal(obj: GameObject, cameraOffset: number): void {
    const screenX = obj.position.x - cameraOffset;
    const screenY = obj.position.y;

    // Animated portal effect
    const time = Date.now() * 0.001;

    this.ctx.save();

    // Draw outer glow
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = this.colors.portal;

    // Draw portal frame
    this.ctx.strokeStyle = this.colors.portal;
    this.ctx.lineWidth = 5;
    this.ctx.strokeRect(screenX, screenY, obj.size.x, obj.size.y);

    // Draw animated swirl inside
    this.ctx.globalAlpha = 0.5;
    const centerX = screenX + obj.size.x / 2;
    const centerY = screenY + obj.size.y / 2;

    for (let i = 0; i < 3; i++) {
      const angle = time + (i * Math.PI * 2 / 3);
      const x = centerX + Math.cos(angle) * 15;
      const y = centerY + Math.sin(angle) * 15;

      this.ctx.fillStyle = this.colors.portal;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
    this.ctx.shadowBlur = 0;
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.setupCanvas();
  }

  public destroy(): void {
    // Cleanup if needed
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
