// Axis-Aligned Bounding Box (AABB) collision detection system
import { GameObject, Vector2D, GameObjectType, isObstacleType } from '../types';

/** Padding for obstacle bounds - prevents jump-through on sides/bottom. No top padding on blocks so players can land on them. */
const OBSTACLE_SIDE_PADDING = 4;

/** Spike hitbox insets — shrink the AABB inward to approximate the triangle shape.
 *  Positive values = more forgiving (shrinks hitbox). */
const SPIKE_INSET_SIDES = 8;  // Generous: triangle is narrow near edges
const SPIKE_INSET_TOP = 12;   // Very generous: tip is thin, shouldn't kill on near-miss
const SPIKE_INSET_BOTTOM = 2; // Small: base of triangle is wide

function aabb(
  player: GameObject,
  left: number,
  right: number,
  top: number,
  bottom: number,
): boolean {
  if (left >= right || top >= bottom) return false;
  return (
    player.position.x < right &&
    player.position.x + player.size.x > left &&
    player.position.y < bottom &&
    player.position.y + player.size.y > top
  );
}

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
    const { x, y } = obstacle.position;
    const { x: w, y: h } = obstacle.size;

    if (obstacle.type === GameObjectType.OBSTACLE_BLOCK) {
      const p = OBSTACLE_SIDE_PADDING;
      return aabb(player, x - p, x + w + p, y, y + h + p);
    }

    if (obstacle.type === GameObjectType.OBSTACLE_SAW) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.38;
      const closestX = Math.max(player.position.x, Math.min(cx, player.position.x + player.size.x));
      const closestY = Math.max(player.position.y, Math.min(cy, player.position.y + player.size.y));
      const dx = cx - closestX;
      const dy = cy - closestY;
      return dx * dx + dy * dy < r * r;
    }

    if (obstacle.type === GameObjectType.OBSTACLE_HANGING) {
      return aabb(
        player,
        x + SPIKE_INSET_SIDES,
        x + w - SPIKE_INSET_SIDES,
        y + 2,
        y + h - SPIKE_INSET_TOP,
      );
    }

    if (obstacle.type === GameObjectType.OBSTACLE_DIAMOND) {
      return aabb(player, x + 7, x + w - 7, y + 8, y + h - 8);
    }

    return aabb(
      player,
      x + SPIKE_INSET_SIDES,
      x + w - SPIKE_INSET_SIDES,
      y + SPIKE_INSET_TOP,
      y + h - SPIKE_INSET_BOTTOM,
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
      if (isObstacleType(other.type)) {
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
