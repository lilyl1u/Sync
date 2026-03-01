/**
 * Preload game audio/beats so the game page can show "Ready to play" immediately
 * when the user navigates from the landing page. Call preloadGameAssets() as soon
 * as the landing page is ready (e.g. from Hero mount).
 */

import type { DetectedBeat } from './beatDetector';

const LOFI_API = '/api/generate-lofi';
const LOFI_TIMEOUT_MS = 20000; // Reduced timeout for faster fallback

function syntheticBeats(): DetectedBeat[] {
  const beats: DetectedBeat[] = [];
  for (let t = 0; t < 120; t += 0.5) {
    beats.push({ time: t, intensity: 0.7 });
  }
  return beats;
}

export interface PreloadedGameAssets {
  beats: DetectedBeat[];
  midiBase64: string | null;
}

let cached: PreloadedGameAssets | null = null;
let preloadPromise: Promise<PreloadedGameAssets> | null = null;

/**
 * Load beats + optional MIDI (LOFI API or synthetic fallback). Safe to call
 * multiple times; subsequent calls resolve immediately with cached result.
 */
export function preloadGameAssets(): Promise<PreloadedGameAssets> {
  if (cached) return Promise.resolve(cached);
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async (): Promise<PreloadedGameAssets> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOFI_TIMEOUT_MS);
      try {
        const lofiRes = await fetch(LOFI_API, { method: 'POST', signal: controller.signal });
        clearTimeout(timeoutId);
        if (lofiRes.ok) {
          const data = await lofiRes.json();
          const beats: DetectedBeat[] = (data.beats as number[]).map((time: number, i: number) => ({
            time,
            intensity: (data.intensities as number[])?.[i] ?? 0.5,
          }));
          if (beats.length > 0) {
            cached = { beats, midiBase64: data.midiBase64 ?? null };
            return cached;
          }
        }
      } catch {
        clearTimeout(timeoutId);
      }
    } catch {
      // fall through to synthetic
    }
    cached = { beats: syntheticBeats(), midiBase64: null };
    return cached;
  })();

  return preloadPromise;
}

/**
 * Return preloaded assets if preload has completed. Null if preload not started or not yet finished.
 */
export function getPreloadedAssets(): PreloadedGameAssets | null {
  return cached;
}
