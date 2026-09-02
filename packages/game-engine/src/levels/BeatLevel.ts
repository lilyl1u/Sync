/**
 * Beat-synced Level - Generates mixed obstacles from audio beat timestamps.
 * Each beat time maps to an X position: x = beatTime * playerSpeed.
 */
import { Level, LevelSegment, GameObjectType, Platform, Obstacle } from '../types';

const GROUND_Y = 500;
const FLOOR_EXTENSION = 500000;

export interface BeatLevelConfig {
  beats: number[];
  playerSpeed: number;
  intensities?: number[];
  placementChance?: number;
  minGapSeconds?: number;
  seed?: number;
}

export type HazardKind = 'spike' | 'saw' | 'diamond' | 'hanging' | 'block';

function seededRandom(seed: number) {
  return function next(): number {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function makeHazard(id: string, x: number, kind: HazardKind): Obstacle {
  const base = {
    id,
    position: { x, y: GROUND_Y - 30 },
    velocity: { x: 0, y: 0 },
    size: { x: 30, y: 30 },
    type: GameObjectType.OBSTACLE_SPIKE,
    active: true,
    damage: 1,
  };

  if (kind === 'saw') {
    return {
      ...base,
      position: { x, y: GROUND_Y - 36 },
      size: { x: 36, y: 36 },
      type: GameObjectType.OBSTACLE_SAW,
    };
  }
  if (kind === 'diamond') {
    return {
      ...base,
      position: { x, y: GROUND_Y - 38 },
      size: { x: 28, y: 38 },
      type: GameObjectType.OBSTACLE_DIAMOND,
    };
  }
  if (kind === 'hanging') {
    return {
      ...base,
      position: { x, y: GROUND_Y - 140 },
      size: { x: 34, y: 74 },
      type: GameObjectType.OBSTACLE_HANGING,
    };
  }
  if (kind === 'block') {
    return {
      ...base,
      position: { x, y: GROUND_Y - 40 },
      size: { x: 40, y: 40 },
      type: GameObjectType.OBSTACLE_BLOCK,
    };
  }
  return base;
}

export function pickHazardKind(rng: () => number, beatTime: number, lastKind: HazardKind | null): HazardKind {
  if (beatTime < 6) return 'spike';
  const roll = rng();
  let kind: HazardKind;
  if (roll < 0.28) kind = 'spike';
  else if (roll < 0.48) kind = 'saw';
  else if (roll < 0.66) kind = 'diamond';
  else if (roll < 0.82) kind = 'hanging';
  else kind = 'block';

  if (lastKind === 'hanging' && kind === 'hanging') return 'spike';
  if (lastKind === 'block' && kind === 'hanging') return 'saw';
  return kind;
}

function generateObstaclesFromBeats(config: BeatLevelConfig): Obstacle[] {
  const {
    beats,
    playerSpeed,
    intensities,
    placementChance = 0.4,
    minGapSeconds = 0.3,
    seed = 42,
  } = config;

  const rng = seededRandom(seed);
  const obstacles: Obstacle[] = [];
  let lastPlacedTime = -Infinity;
  let lastKind: HazardKind | null = null;

  for (let i = 0; i < beats.length; i++) {
    const beatTime = beats[i];
    if (beatTime < 1.5) continue;
    const kindPreview = pickHazardKind(rng, beatTime, lastKind);
    const gap = kindPreview === 'hanging' || lastKind === 'block' ? Math.max(minGapSeconds, 0.42) : minGapSeconds;
    if (beatTime - lastPlacedTime < gap) continue;

    const intensity = intensities ? intensities[i] ?? 0.5 : 0.5;
    const adjustedChance = placementChance + intensity * 0.2;
    if (rng() > adjustedChance) continue;

    const kind = kindPreview;
    const x = beatTime * playerSpeed;
    obstacles.push(makeHazard(`beat-${kind}-${i}`, x, kind));
    lastPlacedTime = beatTime;
    lastKind = kind;
  }

  return obstacles;
}

export function createBeatLevel(config: BeatLevelConfig): Level {
  const maxBeatTime = config.beats.length > 0
    ? config.beats[config.beats.length - 1]
    : 60;
  const totalLength = Math.max(maxBeatTime * config.playerSpeed + 2000, FLOOR_EXTENSION);

  const floor: Platform = {
    id: 'solid-floor',
    position: { x: 0, y: GROUND_Y },
    velocity: { x: 0, y: 0 },
    size: { x: totalLength, y: 50 },
    type: GameObjectType.PLATFORM,
    active: true,
    width: totalLength,
  };

  const obstacles = generateObstaclesFromBeats(config);

  const segment: LevelSegment = {
    id: 'beat-segment',
    startX: 0,
    length: totalLength,
    difficulty: 0.5,
    objects: [floor, ...obstacles],
  };

  return {
    id: 'beat-level',
    name: 'Beat Level',
    segments: [segment],
    totalLength,
    difficulty: 0.5,
    generatedBy: 'procedural',
  };
}
