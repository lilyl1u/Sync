import type { DetectedBeat } from './beatDetector';

export type GenreId = 'lofi' | 'neon' | 'chip' | 'breaks' | 'dream';
export type GenreChoice = GenreId | 'random';

export type GenreKit = {
  id: GenreId;
  label: string;
  blurb: string;
  bpmMin: number;
  bpmMax: number;
  subdivision: number;
  kickSteps: number[];
  snareSteps: number[];
  hatSteps: number[];
  chordMidi: number[][];
};

export const GENRE_KITS: GenreKit[] = [
  {
    id: 'lofi',
    label: 'Lo-fi',
    blurb: 'Slow dusty beat',
    bpmMin: 74,
    bpmMax: 84,
    subdivision: 2,
    kickSteps: [0, 9],
    snareSteps: [4, 12],
    hatSteps: [2, 6, 7, 10, 14],
    chordMidi: [
      [57, 60, 64, 67],
      [53, 57, 60, 65],
      [48, 52, 55, 60],
      [55, 59, 62, 67],
    ],
  },
  {
    id: 'neon',
    label: 'Neon',
    blurb: '80s night drive',
    bpmMin: 104,
    bpmMax: 118,
    subdivision: 2,
    kickSteps: [0, 4, 8, 12],
    snareSteps: [4, 12],
    hatSteps: [2, 6, 10, 14],
    chordMidi: [
      [45, 48, 52, 57],
      [43, 47, 50, 55],
      [41, 45, 48, 53],
      [43, 47, 50, 55],
    ],
  },
  {
    id: 'chip',
    label: '8-bit',
    blurb: 'Game-boy bleeps',
    bpmMin: 140,
    bpmMax: 160,
    subdivision: 4,
    kickSteps: [0, 8],
    snareSteps: [4, 12],
    hatSteps: [2, 6, 10, 14],
    chordMidi: [
      [72, 76, 79],
      [71, 74, 79],
      [69, 72, 76],
      [67, 71, 74],
    ],
  },
  {
    id: 'breaks',
    label: 'Breaks',
    blurb: 'Fast drums + bass',
    bpmMin: 162,
    bpmMax: 176,
    subdivision: 4,
    kickSteps: [0, 3, 6, 10],
    snareSteps: [4, 7, 12, 15],
    hatSteps: [1, 2, 5, 8, 9, 11, 13, 14],
    chordMidi: [
      [36, 43],
      [34, 41],
      [36, 39],
      [31, 38],
    ],
  },
  {
    id: 'dream',
    label: 'Dream',
    blurb: 'Soft pads, few hits',
    bpmMin: 60,
    bpmMax: 70,
    subdivision: 1,
    kickSteps: [0],
    snareSteps: [],
    hatSteps: [8],
    chordMidi: [
      [60, 64, 67, 71],
      [59, 62, 67, 71],
      [57, 60, 64, 69],
      [55, 59, 62, 67],
    ],
  },
];

export const GENRE_STORAGE_KEY = 'sync-genre-kit';

const LEGACY_GENRE: Record<string, GenreChoice> = {
  synthwave: 'neon',
  jungle: 'breaks',
  boss: 'chip',
  chill: 'dream',
  wave: 'neon',
};

export function parseStoredGenre(raw: string | null): GenreChoice | null {
  if (!raw) return null;
  if (raw === 'random' || GENRE_KITS.some((kit) => kit.id === raw)) {
    return raw as GenreChoice;
  }
  return LEGACY_GENRE[raw] ?? null;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveGenreKit(choice: GenreChoice, seed: number): GenreKit {
  if (choice !== 'random') {
    return GENRE_KITS.find((kit) => kit.id === choice) ?? GENRE_KITS[0];
  }
  const rng = mulberry32(seed ^ 0x9e3779b9);
  return GENRE_KITS[Math.floor(rng() * GENRE_KITS.length)];
}

export function kitBpm(kit: GenreKit, seed: number): number {
  const rng = mulberry32(seed ^ 0x85ebca6b);
  return Math.round(kit.bpmMin + rng() * (kit.bpmMax - kit.bpmMin));
}

export function beatsFromKit(kit: GenreKit, seed: number, durationSec = 180): DetectedBeat[] {
  const bpm = kitBpm(kit, seed);
  const rng = mulberry32(seed ^ 0xc2b2ae35);
  const stepSec = 60 / bpm / kit.subdivision;
  const stepsPerBar = 16;
  const barShift = Math.floor(rng() * 4) * 4;
  const beats: DetectedBeat[] = [];

  for (let t = 0, step = 0; t < durationSec; step += 1, t = step * stepSec) {
    const pos = (step + barShift) % stepsPerBar;
    let intensity = 0;
    if (kit.kickSteps.includes(pos)) intensity = Math.max(intensity, 0.95);
    if (kit.snareSteps.includes(pos)) intensity = Math.max(intensity, 0.8);
    if (kit.hatSteps.includes(pos) && rng() > 0.2) intensity = Math.max(intensity, 0.35);
    if (intensity > 0) beats.push({ time: t, intensity });
  }

  return beats;
}
