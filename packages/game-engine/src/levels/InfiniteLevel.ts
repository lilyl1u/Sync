/**
 * Infinite Level - Procedurally generates content as the player progresses
 * Solid continuous floor with mixed hazard types.
 */
import { Level, LevelSegment, GameObjectType, Platform, Obstacle } from '../types';
import { makeHazard, pickHazardKind, type HazardKind } from './BeatLevel';

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
  const progress = Math.min(1, startX / RAMP_DISTANCE);
  const minSpacing = Math.max(120, 320 - progress * 170);
  const maxSpacing = Math.max(200, 520 - progress * 220);

  let x = startX + 80;
  let lastKind: HazardKind | null = null;
  while (x < startX + length - 100) {
    const spacing = minSpacing + rng() * (maxSpacing - minSpacing);
    const kind = pickHazardKind(rng, x / 300, lastKind);
    obstacles.push(makeHazard(`inf-${kind}-${startX}-${Math.round(x)}`, x, kind));
    lastKind = kind;
    const extra = kind === 'hanging' || kind === 'block' ? 50 : 30;
    x += spacing + extra;
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

  const intro: Array<{ x: number; kind: HazardKind }> = [
    { x: 500, kind: 'spike' },
    { x: 950, kind: 'spike' },
    { x: 1450, kind: 'saw' },
    { x: 2000, kind: 'diamond' },
    { x: 2400, kind: 'block' },
    { x: 3100, kind: 'hanging' },
    { x: 3800, kind: 'saw' },
    { x: 4500, kind: 'spike' },
    { x: 5200, kind: 'diamond' },
    { x: 5900, kind: 'block' },
    { x: 6600, kind: 'hanging' },
  ];
  intro.forEach(({ x, kind }, i) => {
    obstacles.push(makeHazard(`intro-${kind}-${i}`, x, kind));
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
