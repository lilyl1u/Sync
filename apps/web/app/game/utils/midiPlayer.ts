/**
 * Play MIDI in the browser using Tone.js.
 * Parses base64 MIDI and schedules notes via Tone.Synth.
 */
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

let midiPlayerInstance: {
  synth: Tone.PolySynth;
  scheduledId: number;
} | null = null;

function getMidiPlayer() {
  if (!midiPlayerInstance) {
    const synth = new Tone.PolySynth().toDestination();
    midiPlayerInstance = {
      synth,
      scheduledId: 0,
    };
  }
  return midiPlayerInstance;
}

/** Convert MIDI note number to note name (e.g. 60 -> "C4") */
function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = names[midi % 12];
  return `${name}${octave}`;
}

/** volume 0–1 (e.g. 0.5 for 50% when layering with audio.mp4) */
export async function playMidi(midiBase64: string, volume = 1): Promise<void> {
  console.log('[playMidi] called, midiBase64 length:', midiBase64?.length, 'volume:', volume);
  try {
    console.log('[playMidi] Tone.start()...');
    await Tone.start();
    console.log('[playMidi] Tone.start() done, context state:', (Tone.getContext() as { rawContext?: AudioContext })?.rawContext?.state);

    const { synth } = getMidiPlayer();
    synth.releaseAll();
    synth.toDestination();
    synth.volume.value = volume <= 0 ? -Infinity : 20 * Math.log10(volume);

    const bytes = Uint8Array.from(atob(midiBase64), (c) => c.charCodeAt(0));
    console.log('[playMidi] Decoded MIDI bytes:', bytes.length);
    const midi = new Midi(bytes.buffer);
    console.log('[playMidi] Midi tracks:', midi.tracks.length);

    const now = Tone.now();
    let noteCount = 0;
    for (const track of midi.tracks) {
      for (const note of track.notes) {
        const noteName = midiToNoteName(note.midi);
        synth.triggerAttackRelease(
          noteName,
          note.duration,
          now + note.time,
          note.velocity
        );
        noteCount++;
      }
    }
    console.log('[playMidi] Scheduled notes:', noteCount, 'Tone.now():', now);
  } catch (e) {
    console.log('[playMidi] Error:', e);
    throw e;
  }
}

export function stopMidi(): void {
  const player = midiPlayerInstance;
  if (player) {
    player.synth.releaseAll();
    // Disconnect so any already-scheduled notes are inaudible
    player.synth.disconnect();
  }
}

export function pauseMidi(): void {
  const raw = (Tone.getContext() as { rawContext?: AudioContext }).rawContext;
  if (raw?.suspend) raw.suspend();
}

export function resumeMidi(): void {
  const raw = (Tone.getContext() as { rawContext?: AudioContext }).rawContext;
  if (raw?.resume) raw.resume();
}
