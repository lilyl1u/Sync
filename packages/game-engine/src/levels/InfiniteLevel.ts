/**
 * Infinite Level - Procedurally generates content as the player progresses
 * Solid continuous floor, red spikes only.
 */
import { Level, LevelSegment, GameObject, GameObjectType, Platform, Obstacle } from '../types';

const GROUND_Y = 500;
const CHUNK_SIZE = 800;
const FLOOR_EXTENSION = 500000;

function seededRandom(seed: number) {
  return function next(): number {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/** Distance over which difficulty ramps from easy to hard (world X) */
const RAMP_DISTANCE = 8000;

function generateChunkObstacles(startX: number, length: number, seed: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const rng = seededRandom(seed);
  // Start easy (generous spacing), ramp to hard (tighter spacing) as distance increases
  const progress = Math.min(1, startX / RAMP_DISTANCE);
  const minSpacing = Math.max(120, 320 - progress * 170);  // 320 -> 150
  const maxSpacing = Math.max(200, 520 - progress * 220);  // 520 -> 300

  let x = startX + 80;
  while (x < startX + length - 100) {
    const spacing = minSpacing + rng() * (maxSpacing - minSpacing);
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
