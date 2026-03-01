/**
 * Beat-synced Level - Generates obstacles from audio beat timestamps.
 * Each beat time maps to an X position: x = beatTime * playerSpeed.
 * Red spikes only.
 */
import { Level, LevelSegment, GameObject, GameObjectType, Platform, Obstacle } from '../types';

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

function seededRandom(seed: number) {
  return function next(): number {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
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

  for (let i = 0; i < beats.length; i++) {
    const beatTime = beats[i];
    if (beatTime < 1.5) continue;
    if (beatTime - lastPlacedTime < minGapSeconds) continue;

    const intensity = intensities ? intensities[i] ?? 0.5 : 0.5;
    const adjustedChance = placementChance + intensity * 0.2;
    if (rng() > adjustedChance) continue;

    const x = beatTime * playerSpeed;
    obstacles.push({
      id: `beat-spike-${i}`,
      position: { x, y: GROUND_Y - 30 },
      velocity: { x: 0, y: 0 },
      size: { x: 30, y: 30 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage: 1,
    });
    lastPlacedTime = beatTime;
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
