// Simple test level for Geometry Dash clone
import { Level, LevelSegment, GameObject, GameObjectType, Platform, Obstacle } from '../types';

export function createTestLevel(): Level {
  const platforms: Platform[] = [];
  const obstacles: Obstacle[] = [];

  // GROUND LEVEL: y = 500 (player can stand here)
  // PLAYER: 30px tall, stands at y = 470 when on ground
  // MAX JUMP HEIGHT: ~100px, can reach y = 370

  // Single solid floor - no gaps, no seams, impossible to fall through
  platforms.push({
    id: 'solid-floor',
    position: { x: 0, y: 500 },
    velocity: { x: 0, y: 0 },
    size: { x: 6000, y: 50 },
    type: GameObjectType.PLATFORM,
    active: true,
    width: 6000,
  });

  // DIFFICULTY PROGRESSION: Easy → Medium → Hard

  // SECTION 1: Easy (x: 0-1500) - Single obstacles, well spaced
  const easySpikes = [500, 800];
  easySpikes.forEach((x, i) => {
    obstacles.push({
      id: `easy-spike-${i}`,
      position: { x, y: 470 },
      velocity: { x: 0, y: 0 },
      size: { x: 30, y: 30 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage: 1,
    });
  });

  // SECTION 2: Medium (x: 1500-3500) - Closer spacing, some blocks
  const mediumSpikes = [1700, 1950, 2300];
  mediumSpikes.forEach((x, i) => {
    obstacles.push({
      id: `medium-spike-${i}`,
      position: { x, y: 470 },
      velocity: { x: 0, y: 0 },
      size: { x: 30, y: 30 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage: 1,
    });
  });

  const mediumBlocks = [
    { x: 2100, y: 450 },
    { x: 2800, y: 445 },
  ];
  mediumBlocks.forEach((pos, i) => {
    obstacles.push({
      id: `medium-block-${i}`,
      position: pos,
      velocity: { x: 0, y: 0 },
      size: { x: 50, y: 50 },
      type: GameObjectType.OBSTACLE_BLOCK,
      active: true,
      damage: 1,
    });
  });

  // SECTION 3: Hard (x: 3300+) - More spread out after ~11 second mark
  const hardSpikes = [3600, 4200, 4800, 5400, 6000];
  hardSpikes.forEach((x, i) => {
    obstacles.push({
      id: `hard-spike-${i}`,
      position: { x, y: 470 },
      velocity: { x: 0, y: 0 },
      size: { x: 30, y: 30 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage: 1,
    });
  });

  const hardBlocks = [
    { x: 3900, y: 445 },
    { x: 4500, y: 440 },
    { x: 5100, y: 445 },
    { x: 5700, y: 450 },
  ];
  hardBlocks.forEach((pos, i) => {
    obstacles.push({
      id: `hard-block-${i}`,
      position: pos,
      velocity: { x: 0, y: 0 },
      size: { x: 50, y: 50 },
      type: GameObjectType.OBSTACLE_BLOCK,
      active: true,
      damage: 1,
    });
  });

  // Add some elevated platforms for variety (all reachable with jumps)
  const elevatedPlatforms = [
    { x: 650, y: 410 },
    { x: 1900, y: 400 },
    { x: 3200, y: 415 },
    { x: 4600, y: 405 },
  ];
  elevatedPlatforms.forEach((pos, i) => {
    platforms.push({
      id: `elevated-${i}`,
      position: pos,
      velocity: { x: 0, y: 0 },
      size: { x: 140, y: 25 },
      type: GameObjectType.PLATFORM,
      active: true,
      width: 140,
    });
  });

  const allObjects = [...platforms, ...obstacles];

  const segment: LevelSegment = {
    id: 'segment-1',
    startX: 0,
    length: 6000,
    difficulty: 0.5,
    objects: allObjects,
  };

  return {
    id: 'test-level-1',
    name: 'Test Level',
    segments: [segment],
    totalLength: 6000,
    difficulty: 0.5,
    generatedBy: 'manual',
  };
}
