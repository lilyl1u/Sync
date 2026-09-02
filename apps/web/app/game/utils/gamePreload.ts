/**
 * 3-deep queue of LSTM MIDI clips. Never blocks gameplay: runs pop a clip if
 * one is ready, otherwise they use the genre kit only. Background fetches
 * keep the queue topped up.
 */

import type { DetectedBeat } from './beatDetector';

const LOFI_API = '/api/generate-lofi';
const LOFI_TIMEOUT_MS = 25000;
const QUEUE_SIZE = 3;

export interface QueuedMidi {
  beats: DetectedBeat[];
  midiBase64: string;
}

const queue: QueuedMidi[] = [];
let inFlight = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeMidiQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function midiQueueSize(): number {
  return queue.length;
}

async function fetchOneClip(): Promise<QueuedMidi | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOFI_TIMEOUT_MS);
  try {
    const res = await fetch(LOFI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ length: 200, temperature: 0.85 }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const times = data.beats as number[] | undefined;
    const midiBase64 = data.midiBase64 as string | undefined;
    if (!times?.length || !midiBase64) return null;
    return {
      midiBase64,
      beats: times.map((time: number, i: number) => ({
        time,
        intensity: (data.intensities as number[])?.[i] ?? 0.5,
      })),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function launchFetch(): void {
  if (queue.length + inFlight >= QUEUE_SIZE) return;
  inFlight += 1;
  notify();
  void fetchOneClip()
    .then((clip) => {
      if (clip && queue.length < QUEUE_SIZE) queue.push(clip);
    })
    .finally(() => {
      inFlight -= 1;
      notify();
      if (queue.length + inFlight < QUEUE_SIZE) launchFetch();
    });
}

/** Keep up to 3 LSTM clips ready. Safe to call often. */
export function fillMidiQueue(): void {
  while (queue.length + inFlight < QUEUE_SIZE) launchFetch();
}

/** Pop one clip for this run (or null) and refill in the background. */
export function takeMidiForRun(): QueuedMidi | null {
  const clip = queue.shift() ?? null;
  notify();
  fillMidiQueue();
  return clip;
}

/** @deprecated Use fillMidiQueue — kept so landing/duels keep warming Modal. */
export function preloadGameAssets(): Promise<void> {
  fillMidiQueue();
  return Promise.resolve();
}
