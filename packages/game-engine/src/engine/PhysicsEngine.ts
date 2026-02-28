// Physics simulation system for the game
import { GameObject, Player, PhysicsConfig, Vector2D, GameObjectType } from '../types';
import { CollisionDetection } from './CollisionDetection';

export class PhysicsEngine {
  private config: PhysicsConfig;

  constructor(config?: Partial<PhysicsConfig>) {
    // Default physics configuration (tuned for Geometry Dash-like gameplay)
    this.config = {
      gravity: 2800, // pixels per second squared
      jumpForce: -680, // Fixed height - any tap clears 1 block (50px)
      maxVelocity: { x: 400, y: 1200 }, // pixels per second
      friction: 0.8,
      ...config,
    };
  }

  /**
   * Get the current physics configuration
   */
  getConfig(): PhysicsConfig {
    return { ...this.config };
  }

  /**
   * Update physics configuration
   */
  updateConfig(config: Partial<PhysicsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Apply gravity to an object
   * @param obj The game object
   * @param deltaTime Time elapsed since last update (in seconds)
   */
  applyGravity(obj: GameObject, deltaTime: number): void {
    obj.velocity.y += this.config.gravity * deltaTime;

    // Clamp to max velocity
    if (obj.velocity.y > this.config.maxVelocity.y) {
      obj.velocity.y = this.config.maxVelocity.y;
    }
  }

  /**
   * Update object position based on velocity
   * @param obj The game object
   * @param deltaTime Time elapsed since last update (in seconds)
   */
  updatePosition(obj: GameObject, deltaTime: number): void {
    obj.position.x += obj.velocity.x * deltaTime;
    obj.position.y += obj.velocity.y * deltaTime;
  }

  /**
   * Make the player jump - fixed height, any tap (even 0.1ms) clears 1 block (50px)
   */
  jump(player: Player): void {
    if (player.isOnGround && !player.isJumping) {
      player.velocity.y = this.config.jumpForce;
      player.isJumping = true;
      player.isOnGround = false;
    }
  }

  /**
   * Set the player's horizontal velocity (auto-run)
   * @param player The player object
   * @param speed Speed in pixels per second
   */
  setPlayerRunSpeed(player: Player, speed: number): void {
    player.velocity.x = Math.min(speed, this.config.maxVelocity.x);
  }

  /**
   * Update player physics state
   * @param player The player object
   * @param platforms List of platform objects
   * @param deltaTime Time elapsed since last update (in seconds)
   * @param floorY Optional - ground surface Y (player bottom clamped to never go below this)
   */
  updatePlayer(
    player: Player,
    platforms: GameObject[],
    deltaTime: number,
    floorY?: number
  ): void {
    // Apply gravity
    this.applyGravity(player, deltaTime);

    // Update position
    this.updatePosition(player, deltaTime);

    // Prevent jumping through platforms from below
    if (player.velocity.y < 0) {
      for (const platform of platforms) {
        if (!platform.active) continue;
        if (!CollisionDetection.checkAABBCollision(player, platform)) continue;

        const platformBottom = platform.position.y + platform.size.y;
        if (player.position.y + player.size.y > platformBottom) {
          player.position.y = platformBottom;
          player.velocity.y = 0;
        }
      }
    }

    // Prevent falling through floors - resolve penetration when player has dropped into a platform
    if (player.velocity.y >= 0) {
      const playerBottom = player.position.y + player.size.y;
      // Sort by platform top (ascending) so we snap to the highest platform we've penetrated
      const sortedPlatforms = [...platforms].sort(
        (a, b) => a.position.y - b.position.y
      );
      for (const platform of sortedPlatforms) {
        if (!platform.active) continue;

        const platformTop = platform.position.y;
        const horizontalOverlap =
          player.position.x + player.size.x > platform.position.x &&
          player.position.x < platform.position.x + platform.size.x;

        // Player has fallen into/through the platform (bottom penetrated past top)
        if (horizontalOverlap && playerBottom > platformTop) {
          player.position.y = platformTop - player.size.y;
          player.velocity.y = 0;
          break; // Resolve one platform per frame
        }
      }
    }

    // Check ground collision only when falling/stationary — never when rising,
    // otherwise the tolerance window snaps the player back down mid-jump.
    if (player.velocity.y >= 0) {
      const wasOnGround = player.isOnGround;
      player.isOnGround = CollisionDetection.isOnGround(player, platforms, 12);

      if (player.isOnGround) {
        const groundPlatform = this.findGroundPlatform(player, platforms);
        if (groundPlatform) {
          player.position.y = groundPlatform.position.y - player.size.y;
          player.velocity.y = 0;
          player.isJumping = false;
        }
      } else if (wasOnGround && !player.isOnGround) {
        player.isJumping = false;
      }
    } else {
      player.isOnGround = false;
    }

    // Hard floor clamp - keep player above floor at all times (failsafe)
    if (floorY !== undefined) {
      const playerBottom = player.position.y + player.size.y;
      if (playerBottom > floorY) {
        player.position.y = floorY - player.size.y;
        player.velocity.y = 0;
        player.isOnGround = true;
        player.isJumping = false;
      }
    }

    // Apply friction to horizontal movement (optional)
    // player.velocity.x *= this.config.friction;
  }

  /**
   * Find the platform the player is standing on
   * @param player The player object
   * @param platforms List of platform objects
   * @returns The platform object or null
   */
  private findGroundPlatform(player: Player, platforms: GameObject[]): GameObject | null {
    const bottomY = player.position.y + player.size.y;

    for (const platform of platforms) {
      if (!platform.active) continue;

      const platformTop = platform.position.y;
      const horizontalOverlap =
        player.position.x + player.size.x > platform.position.x &&
        player.position.x < platform.position.x + platform.size.x;

      if (horizontalOverlap && Math.abs(bottomY - platformTop) <= 12) {
        return platform;
      }
    }

    return null;
  }

  /**
   * Handle collision response for the player
   * @param player The player object
   * @param collidedObject The object the player collided with
   * @returns true if the collision was fatal
   */
  handlePlayerCollision(player: Player, collidedObject: GameObject): boolean {
    switch (collidedObject.type) {
      case GameObjectType.OBSTACLE_SPIKE:
        player.health = 0;
        return true;

      case GameObjectType.OBSTACLE_BLOCK:
        // Landing on top of a block is safe - treat like a platform
        const playerBottom = player.position.y + player.size.y;
        const blockTop = collidedObject.position.y;
        const landingTolerance = 18; // Forgiving window for landing
        const isLandingOnTop =
          playerBottom >= blockTop - 4 &&
          playerBottom <= blockTop + landingTolerance &&
          player.velocity.y >= -150; // Falling or just landed (allow slight upward at peak)
        if (isLandingOnTop) {
          return false; // Not fatal - physics will snap player on top
        }
        player.health = 0;
        return true;

      case GameObjectType.PLATFORM:
        // Platform collision handled in updatePlayer
        return false;

      case GameObjectType.PORTAL:
        // Portal logic (can be extended later)
        return false;

      default:
        return false;
    }
  }

  /**
   * Reset player physics state
   * @param player The player object
   */
  resetPlayer(player: Player): void {
    player.velocity = { x: 0, y: 0 };
    player.isJumping = false;
    player.isOnGround = false;
  }

  /**
   * Check if an object is out of bounds
   * @param obj The game object
   * @param bounds The game bounds
   * @returns true if object is out of bounds
   */
  isOutOfBounds(obj: GameObject, bounds: { width: number; height: number }): boolean {
    return (
      obj.position.y > bounds.height || // Fell off the bottom
      obj.position.y + obj.size.y < 0 || // Above the screen
      obj.position.x + obj.size.x < 0 // Left of the screen
    );
  }
}
