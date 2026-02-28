/**
 * Simple energy-based onset/beat detector using the Web Audio API.
 * Decodes an audio file, computes short-window energy, then picks peaks
 * that exceed a local average by a threshold — these are the "beats".
 *
 * Returns an array of { time, intensity } objects.
 */

export interface DetectedBeat {
  /** Beat time in seconds */
  time: number;
  /** Normalised intensity 0-1 */
  intensity: number;
}

export interface BeatDetectorOptions {
  /** FFT / analysis window size in samples (default 1024) */
  windowSize?: number;
  /** How many windows to average for the local energy baseline (default 40) */
  localAverageWindow?: number;
  /** Multiplier: a window must exceed localAvg * threshold to count (default 1.4) */
  energyThreshold?: number;
  /** Minimum seconds between two detected beats (default 0.15) */
  minBeatGap?: number;
}

export async function detectBeats(
  audioBuffer: AudioBuffer,
  options: BeatDetectorOptions = {}
): Promise<DetectedBeat[]> {
  const {
    windowSize = 1024,
    localAverageWindow = 40,
    energyThreshold = 1.4,
    minBeatGap = 0.15,
  } = options;

  // Mix down to mono
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }

  // Compute RMS energy per window
  const numWindows = Math.floor(length / windowSize);
  const energies = new Float32Array(numWindows);
  let maxEnergy = 0;

  for (let w = 0; w < numWindows; w++) {
    let sum = 0;
    const start = w * windowSize;
    for (let i = 0; i < windowSize; i++) {
      const sample = mono[start + i];
      sum += sample * sample;
    }
    energies[w] = Math.sqrt(sum / windowSize);
    if (energies[w] > maxEnergy) maxEnergy = energies[w];
  }

  // Detect peaks: energy exceeds local average * threshold
  const beats: DetectedBeat[] = [];
  const halfLocal = Math.floor(localAverageWindow / 2);
  let lastBeatTime = -Infinity;

  for (let w = 0; w < numWindows; w++) {
    // Compute local average energy around this window
    const start = Math.max(0, w - halfLocal);
    const end = Math.min(numWindows, w + halfLocal);
    let localSum = 0;
    for (let j = start; j < end; j++) {
      localSum += energies[j];
    }
    const localAvg = localSum / (end - start);

    if (energies[w] > localAvg * energyThreshold && energies[w] > maxEnergy * 0.05) {
      const time = (w * windowSize) / audioBuffer.sampleRate;
      if (time - lastBeatTime >= minBeatGap) {
        beats.push({
          time,
          intensity: maxEnergy > 0 ? energies[w] / maxEnergy : 0,
        });
        lastBeatTime = time;
      }
    }
  }

  return beats;
}

/**
 * Load an audio file from a URL and decode it into an AudioBuffer.
 */
export async function loadAudioBuffer(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new AudioContext();
  const buffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();
  return buffer;
}
