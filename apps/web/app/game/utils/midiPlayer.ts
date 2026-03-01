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

export async function playMidi(midiBase64: string): Promise<void> {
  const { synth } = getMidiPlayer();
  synth.sync().releaseAll();
  // Ensure output is connected (in case we were disconnected by stopMidi)
  synth.toDestination();

  const bytes = Uint8Array.from(atob(midiBase64), (c) => c.charCodeAt(0));
  const midi = new Midi(bytes.buffer);

  await Tone.start();

  const now = Tone.now();
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      const noteName = midiToNoteName(note.midi);
      synth.triggerAttackRelease(
        noteName,
        note.duration,
        now + note.time,
        note.velocity
      );
    }
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
