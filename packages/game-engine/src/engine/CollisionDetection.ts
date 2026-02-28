// Axis-Aligned Bounding Box (AABB) collision detection system
import { GameObject, Vector2D, GameObjectType } from '../types';

/** Padding for obstacle bounds - prevents jump-through on sides/bottom. No top padding on blocks so players can land on them. */
const OBSTACLE_SIDE_PADDING = 4;

/** Spike hitbox insets — shrink the AABB inward to approximate the triangle shape.
 *  Positive values = more forgiving (shrinks hitbox). */
const SPIKE_INSET_SIDES = 8;  // Generous: triangle is narrow near edges
const SPIKE_INSET_TOP = 12;   // Very generous: tip is thin, shouldn't kill on near-miss
const SPIKE_INSET_BOTTOM = 2; // Small: base of triangle is wide

export class CollisionDetection {
  /**
   * Check if two game objects are colliding using AABB collision detection
   * @param a First game object
   * @param b Second game object
   * @returns true if objects are colliding
   */
  static checkAABBCollision(a: GameObject, b: GameObject): boolean {
    return (
      a.position.x < b.position.x + b.size.x &&
      a.position.x + a.size.x > b.position.x &&
      a.position.y < b.position.y + b.size.y &&
      a.position.y + a.size.y > b.position.y
    );
  }

  /**
   * Check collision with an obstacle. Uses asymmetric padding:
   * - OBSTACLE_BLOCK: padding on sides/bottom only (no top) so players can land on blocks
   * - OBSTACLE_SPIKE: full padding on all sides
   */
  static checkObstacleCollision(player: GameObject, obstacle: GameObject): boolean {
    if (obstacle.type === GameObjectType.OBSTACLE_BLOCK) {
      const p = OBSTACLE_SIDE_PADDING;
      const left = obstacle.position.x - p;
      const right = obstacle.position.x + obstacle.size.x + p;
      const top = obstacle.position.y; // No top padding - landable
      const bottom = obstacle.position.y + obstacle.size.y + p;
      return (
        player.position.x < right &&
        player.position.x + player.size.x > left &&
        player.position.y < bottom &&
        player.position.y + player.size.y > top
      );
    }
    const left = obstacle.position.x + SPIKE_INSET_SIDES;
    const right = obstacle.position.x + obstacle.size.x - SPIKE_INSET_SIDES;
    const top = obstacle.position.y + SPIKE_INSET_TOP;
    const bottom = obstacle.position.y + obstacle.size.y - SPIKE_INSET_BOTTOM;
    if (left >= right || top >= bottom) {
      return false;
    }
    return (
      player.position.x < right &&
      player.position.x + player.size.x > left &&
      player.position.y < bottom &&
      player.position.y + player.size.y > top
    );
  }

  /**
   * Check if a point is inside a game object
   * @param point The point to check
   * @param obj The game object
   * @returns true if point is inside object
   */
  static pointInObject(point: Vector2D, obj: GameObject): boolean {
    return (
      point.x >= obj.position.x &&
      point.x <= obj.position.x + obj.size.x &&
      point.y >= obj.position.y &&
      point.y <= obj.position.y + obj.size.y
    );
  }

  /**
   * Find all collisions between a game object and a list of objects
   * Uses expanded obstacle bounds for OBSTACLE_SPIKE and OBSTACLE_BLOCK to prevent jump-through.
   * @param obj The object to check collisions for
   * @param objects List of objects to check against
   * @returns Array of objects that are colliding with obj
   */
  static findCollisions(obj: GameObject, objects: GameObject[]): GameObject[] {
    return objects.filter((other) => {
      if (other.id === obj.id || !other.active) return false;
      if (
        other.type === GameObjectType.OBSTACLE_SPIKE ||
        other.type === GameObjectType.OBSTACLE_BLOCK
      ) {
        return this.checkObstacleCollision(obj, other);
      }
      return this.checkAABBCollision(obj, other);
    });
  }

  /**
   * Calculate the penetration depth of a collision
   * @param a First game object
   * @param b Second game object
   * @returns Vector representing penetration depth (positive means overlap)
   */
  static getPenetrationDepth(a: GameObject, b: GameObject): Vector2D {
    const overlapX = Math.min(
      a.position.x + a.size.x - b.position.x,
      b.position.x + b.size.x - a.position.x
    );

    const overlapY = Math.min(
      a.position.y + a.size.y - b.position.y,
      b.position.y + b.size.y - a.position.y
    );

    return { x: overlapX, y: overlapY };
  }

  /**
   * Check if an object is on the ground (standing on a platform)
   * @param obj The object to check
   * @param platforms List of platform objects
   * @param tolerance How close to be considered "on ground"
   * @returns true if object is on ground
   */
  static isOnGround(obj: GameObject, platforms: GameObject[], tolerance: number = 2): boolean {
    const bottomY = obj.position.y + obj.size.y;

    for (const platform of platforms) {
      if (!platform.active) continue;

      const platformTop = platform.position.y;
      const horizontalOverlap =
        obj.position.x + obj.size.x > platform.position.x &&
        obj.position.x < platform.position.x + platform.size.x;

      // Check if object's bottom is close to platform's top
      if (horizontalOverlap && Math.abs(bottomY - platformTop) <= tolerance) {
        return true;
      }
    }

    return false;
  }
}
