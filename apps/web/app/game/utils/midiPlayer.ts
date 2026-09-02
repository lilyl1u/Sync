/**
 * Play LSTM MIDI as a single melody line through a kit-matched voice.
 * Full-dump PolySynth chords on top of the kit is what made runs sound broken.
 */
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import type { GenreId } from './genreKits';

type MelodyNote = { time: number; duration: number; midi: number; velocity: number };

type MidiHandle = {
  nodes: Tone.ToneAudioNode[];
  parts: Tone.Part[];
};

let midiHandle: MidiHandle | null = null;

function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

function extractMelody(midi: Midi): MelodyNote[] {
  const all: MelodyNote[] = [];
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      if (note.midi < 50 || note.midi > 86) continue;
      all.push({
        time: note.time,
        duration: Math.min(Math.max(note.duration, 0.09), 0.85),
        midi: note.midi,
        velocity: Math.min(0.55, note.velocity * 0.5),
      });
    }
  }
  all.sort((a, b) => a.time - b.time || b.midi - a.midi);
  const out: MelodyNote[] = [];
  for (const note of all) {
    const prev = out[out.length - 1];
    if (prev && note.time - prev.time < 0.1) {
      if (note.midi > prev.midi) out[out.length - 1] = note;
      continue;
    }
    out.push(note);
  }
  return out.slice(0, 360);
}

function makeVoice(kitId: GenreId, dest: Tone.ToneAudioNode): Tone.Synth | Tone.FMSynth | Tone.AMSynth {
  if (kitId === 'lofi') {
    const synth = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 1.4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.015, decay: 0.35, sustain: 0.15, release: 0.45 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.05, release: 0.25 },
    }).connect(dest);
    synth.volume.value = -12;
    return synth;
  }
  if (kitId === 'neon') {
    const synth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.18, sustain: 0.25, release: 0.3 },
    }).connect(dest);
    synth.volume.value = -16;
    return synth;
  }
  if (kitId === 'chip') {
    const synth = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0.1, release: 0.05 },
    }).connect(dest);
    synth.volume.value = -15;
    return synth;
  }
  if (kitId === 'breaks') {
    const synth = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 2,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0.05, release: 0.1 },
    }).connect(dest);
    synth.volume.value = -14;
    return synth;
  }
  const synth = new Tone.AMSynth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.08, decay: 0.4, sustain: 0.4, release: 1.2 },
  }).connect(dest);
  synth.volume.value = -14;
  return synth;
}

export function stopMidi(): void {
  if (!midiHandle) return;
  for (const part of midiHandle.parts) {
    part.stop();
    part.dispose();
  }
  for (const node of midiHandle.nodes) node.dispose();
  midiHandle = null;
}

export async function scheduleMidiMelody(midiBase64: string, kitId: GenreId): Promise<void> {
  stopMidi();
  const bytes = Uint8Array.from(atob(midiBase64), (c) => c.charCodeAt(0));
  const midi = new Midi(bytes.buffer);
  const notes = extractMelody(midi);
  if (notes.length === 0) return;

  const limiter = new Tone.Limiter(-1.5).toDestination();
  const filter = new Tone.Filter(kitId === 'dream' ? 1800 : 2400, 'lowpass').connect(limiter);
  const voice = makeVoice(kitId, filter);
  const nodes: Tone.ToneAudioNode[] = [limiter, filter, voice];

  if (kitId === 'dream' || kitId === 'lofi') {
    const reverb = new Tone.Reverb({ decay: kitId === 'dream' ? 4 : 1.6, wet: kitId === 'dream' ? 0.4 : 0.18 });
    await reverb.generate();
    filter.disconnect();
    filter.connect(reverb);
    reverb.connect(limiter);
    nodes.push(reverb);
  }

  if (kitId === 'neon') {
    const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.18 }).connect(filter);
    voice.disconnect();
    voice.connect(delay);
    nodes.push(delay);
  }

  const part = new Tone.Part((time, note: MelodyNote) => {
    voice.triggerAttackRelease(midiToNoteName(note.midi), note.duration, time, note.velocity);
  }, notes);
  part.start(0);

  midiHandle = { nodes, parts: [part] };
}

/** @deprecated volume ignored; kit-matched melody is scheduled on the transport */
export async function playMidi(midiBase64: string, _volume = 1, kitId: GenreId = 'lofi'): Promise<void> {
  await Tone.start();
  await scheduleMidiMelody(midiBase64, kitId);
}

export function pauseMidi(): void {
  try {
    Tone.getTransport().pause();
  } catch {
    /* ignore */
  }
}

export function resumeMidi(): void {
  try {
    Tone.getTransport().start();
  } catch {
    /* ignore */
  }
}
