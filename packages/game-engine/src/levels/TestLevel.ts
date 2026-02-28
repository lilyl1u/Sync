// Simple test level for Geometry Dash clone
import { Level, LevelSegment, GameObject, GameObjectType, Platform, Obstacle } from '../types';

export function createTestLevel(): Level {
  const platforms: Platform[] = [];
  const obstacles: Obstacle[] = [];

  // GROUND LEVEL: y = 500 (player can stand here)
  // PLAYER: 30px tall, stands at y = 470 when on ground
  // MAX JUMP HEIGHT: ~100px, can reach y = 370

  // Create continuous ground platforms
  for (let i = 0; i < 60; i++) {
    // Skip some sections to create gaps
    const isGap = (i >= 12 && i < 14) || (i >= 25 && i < 28) || (i >= 40 && i < 43);

    if (!isGap) {
      platforms.push({
        id: `platform-${i}`,
        position: { x: i * 100, y: 500 },
        velocity: { x: 0, y: 0 },
        size: { x: 100, y: 50 },
        type: GameObjectType.PLATFORM,
        active: true,
        width: 100,
      });
    }
  }

  // Add platforms to cross gaps (elevated slightly)
  const gapPlatforms = [
    { x: 1250, y: 420, width: 150 }, // Cross first gap
    { x: 2600, y: 400, width: 180 }, // Cross second gap
    { x: 4100, y: 410, width: 160 }, // Cross third gap
  ];
  gapPlatforms.forEach((config, i) => {
    platforms.push({
      id: `gap-platform-${i}`,
      position: { x: config.x, y: config.y },
      velocity: { x: 0, y: 0 },
      size: { x: config.width, y: 30 },
      type: GameObjectType.PLATFORM,
      active: true,
      width: config.width,
    });
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

  // SECTION 3: Hard (x: 3500-6000) - Tight spacing, multiple obstacles
  const hardSpikes = [3600, 3850, 4200, 4550, 5000];
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
    { x: 3700, y: 445 },
    { x: 4000, y: 440 },
    { x: 4400, y: 445 },
    { x: 4800, y: 450 },
    { x: 5300, y: 440 },
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
