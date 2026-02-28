/**
 * Infinite Level - Procedurally generates content as the player progresses
 * Solid continuous floor, obstacles (spikes, blocks) generated on demand
 */
import { Level, LevelSegment, GameObject, GameObjectType, Platform, Obstacle } from '../types';

const GROUND_Y = 500;
const CHUNK_SIZE = 800;
const INITIAL_LENGTH = 6000;
const FLOOR_EXTENSION = 500000;

function seededRandom(seed: number) {
  return function next(): number {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// 11 seconds at 300px/s = 3300 - significantly more spread out after this
const EASIER_AFTER_X = 3300;
const BLOCK_WIDTH = 50;
const BLOCK_HEIGHT = 50;

function generateChunkObstacles(startX: number, length: number, seed: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const rng = seededRandom(seed);
  const isPast11Sec = startX >= EASIER_AFTER_X;

  // After 11 sec: much wider spacing (400-600px between shapes)
  const minSpacing = isPast11Sec ? 400 : 200;
  const maxSpacing = isPast11Sec ? 600 : 320;
  const blockChance = isPast11Sec ? 0.5 : 0.35;

  let x = startX + 80;
  while (x < startX + length - 100) {
    const spacing = minSpacing + rng() * (maxSpacing - minSpacing);

    if (rng() < blockChance) {
      obstacles.push({
        id: `inf-block-${startX}-${x}`,
        position: { x, y: GROUND_Y - BLOCK_HEIGHT },
        velocity: { x: 0, y: 0 },
        size: { x: BLOCK_WIDTH, y: BLOCK_HEIGHT },
        type: GameObjectType.OBSTACLE_BLOCK,
        active: true,
        damage: 1,
      });
      x += spacing + BLOCK_WIDTH;
    } else {
      obstacles.push({
        id: `inf-spike-${startX}-${x}`,
        position: { x, y: GROUND_Y - 30 },
        velocity: { x: 0, y: 0 },
        size: { x: 30, y: 30 },
        type: GameObjectType.OBSTACLE_SPIKE,
        active: true,
        damage: 1,
      });
      x += spacing + 30;
    }
  }

  return obstacles;
}

export function createInfiniteLevel(): Level {
  const platforms: Platform[] = [];
  const obstacles: Obstacle[] = [];

  platforms.push({
    id: 'solid-floor',
    position: { x: 0, y: GROUND_Y },
    velocity: { x: 0, y: 0 },
    size: { x: FLOOR_EXTENSION, y: 50 },
    type: GameObjectType.PLATFORM,
    active: true,
    width: FLOOR_EXTENSION,
  });

  const easySpikes = [500, 950, 1450, 2000];
  easySpikes.forEach((x, i) => {
    obstacles.push({
      id: `easy-spike-${i}`,
      position: { x, y: GROUND_Y - 30 },
      velocity: { x: 0, y: 0 },
      size: { x: 30, y: 30 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage: 1,
    });
  });

  const blockXPositions = [800, 1300, 1900, 2600, 3300, 4000, 4700, 5400, 6100, 6800, 7500];
  blockXPositions.forEach((x, i) => {
    obstacles.push({
      id: `block-${i}`,
      position: { x, y: GROUND_Y - 50 },
      velocity: { x: 0, y: 0 },
      size: { x: 50, y: 50 },
      type: GameObjectType.OBSTACLE_BLOCK,
      active: true,
      damage: 1,
    });
  });

  const mediumSpikes = [1100, 1700, 2400, 3100, 3800, 4500, 5200, 5900, 6600];
  mediumSpikes.forEach((x, i) => {
    obstacles.push({
      id: `medium-spike-${i}`,
      position: { x, y: GROUND_Y - 30 },
      velocity: { x: 0, y: 0 },
      size: { x: 30, y: 30 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage: 1,
    });
  });

  const allObjects = [...platforms, ...obstacles];

  const segment: LevelSegment = {
    id: 'segment-initial',
    startX: 0,
    length: 8000,
    difficulty: 0.5,
    objects: allObjects,
  };

  return {
    id: 'infinite-level',
    name: 'Infinite Run',
    segments: [segment],
    totalLength: FLOOR_EXTENSION,
    difficulty: 0.5,
    generatedBy: 'procedural',
  };
}

export function generateInfiniteChunk(
  startX: number,
  length: number,
  seed: number
): Obstacle[] {
  return generateChunkObstacles(startX, length, seed);
}
