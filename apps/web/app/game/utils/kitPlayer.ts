import * as Tone from 'tone';
import { kitBpm, type GenreKit, mulberry32 } from './genreKits';

type KitHandle = {
  nodes: Tone.ToneAudioNode[];
  parts: Tone.Part[];
  players: Tone.Player[];
};

type ChordHit = { time: number; chord: number[] };
type NoteHit = { time: number; note: number };

let active: KitHandle | null = null;
let startToken = 0;

function midiNote(n: number): string {
  return Tone.Frequency(n, 'midi').toNote();
}

function sineKickBuffer(sampleRate: number, seconds = 0.32): AudioBuffer {
  const length = Math.floor(sampleRate * seconds);
  const buffer = Tone.getContext().createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 14);
    const freq = 48 + 90 * Math.exp(-t * 22);
    const click = Math.exp(-t * 90) * Math.sin(2 * Math.PI * 1200 * t) * 0.12;
    data[i] = Math.sin(2 * Math.PI * freq * t) * env + click;
  }
  return buffer;
}

function noiseHitBuffer(
  sampleRate: number,
  seconds: number,
  decay: number,
  highpass = false,
): AudioBuffer {
  const length = Math.floor(sampleRate * seconds);
  const buffer = Tone.getContext().createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const white = Math.random() * 2 - 1;
    const hp = highpass ? white - prev : white;
    prev = white;
    data[i] = hp * Math.exp(-t * decay);
  }
  return buffer;
}

function makePlayer(buffer: AudioBuffer, dest: Tone.ToneAudioNode, volumeDb: number): Tone.Player {
  const player = new Tone.Player(buffer).connect(dest);
  player.fadeOut = 0.01;
  player.volume.value = volumeDb;
  return player;
}

function disposeActive(): void {
  if (active) {
    for (const part of active.parts) {
      part.stop();
      part.dispose();
    }
    for (const player of active.players) player.dispose();
    for (const node of active.nodes) node.dispose();
    active = null;
  }
  try {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().swing = 0;
  } catch {
    /* ignore */
  }
}

export function stopGenreKit(): void {
  startToken += 1;
  disposeActive();
}

function drumPart(
  kit: GenreKit,
  onHit: (time: number, kind: 'kick' | 'snare' | 'hat') => void,
): Tone.Part {
  const step = Tone.Time('16n').toSeconds();
  const events: Array<{ time: number; kind: 'kick' | 'snare' | 'hat' }> = [];
  for (const s of kit.kickSteps) events.push({ time: s * step, kind: 'kick' });
  for (const s of kit.snareSteps) events.push({ time: s * step, kind: 'snare' });
  for (const s of kit.hatSteps) events.push({ time: s * step, kind: 'hat' });
  const part = new Tone.Part((time, value: { time: number; kind: 'kick' | 'snare' | 'hat' }) => {
    onHit(time, value.kind);
  }, events);
  part.loop = true;
  part.loopEnd = '1m';
  return part;
}

function transportTime(bars: number, quarters = 0, sixteenths = 0): number {
  return (
    bars * Tone.Time('1m').toSeconds() +
    quarters * Tone.Time('4n').toSeconds() +
    sixteenths * Tone.Time('16n').toSeconds()
  );
}

function buildMaster(): {
  limiter: Tone.Limiter;
  compressor: Tone.Compressor;
  master: Tone.Gain;
  eq: Tone.EQ3;
} {
  const limiter = new Tone.Limiter(-1.2).toDestination();
  const compressor = new Tone.Compressor({
    threshold: -16,
    ratio: 3,
    attack: 0.01,
    release: 0.18,
  }).connect(limiter);
  const eq = new Tone.EQ3(-1, 0, -5).connect(compressor);
  const master = new Tone.Gain(0.78).connect(eq);
  return { limiter, compressor, master, eq };
}

function buildKit(kit: GenreKit, seed: number): KitHandle {
  const rng = mulberry32(seed ^ 0x27d4eb2f);
  const transpose = Math.floor(rng() * 3) - 1;
  const chords = kit.chordMidi.map((chord) => chord.map((n) => n + transpose));
  const nodes: Tone.ToneAudioNode[] = [];
  const parts: Tone.Part[] = [];
  const players: Tone.Player[] = [];
  const sr = Tone.getContext().sampleRate;

  const { limiter, compressor, master, eq } = buildMaster();
  const drumBus = new Tone.Gain(1).connect(master);
  const musicBus = new Tone.Gain(1).connect(master);
  nodes.push(limiter, compressor, eq, master, drumBus, musicBus);

  const kick = makePlayer(sineKickBuffer(sr), drumBus, kit.id === 'dream' ? -18 : -7);
  const snare = makePlayer(noiseHitBuffer(sr, 0.18, 22), drumBus, -11);
  const hat = makePlayer(noiseHitBuffer(sr, 0.05, 55, true), drumBus, -22);
  players.push(kick, snare, hat);

  const hitDrums = (time: number, kind: 'kick' | 'snare' | 'hat') => {
    if (kind === 'kick') kick.start(time);
    if (kind === 'snare') snare.start(time);
    if (kind === 'hat') hat.start(time);
  };

  if (kit.id === 'lofi') {
    Tone.getTransport().swing = 0.22;
    Tone.getTransport().swingSubdivision = '8n';
    const crush = new Tone.BitCrusher(12).connect(musicBus);
    crush.wet.value = 0.18;
    const lp = new Tone.Filter(2100, 'lowpass').connect(crush);
    const chorus = new Tone.Chorus({ frequency: 0.4, delayTime: 3.5, depth: 0.35, wet: 0.35 }).connect(lp);
    chorus.start();
    const vinyl = new Tone.Noise('brown');
    const vinylGain = new Tone.Gain(0.012).connect(master);
    vinyl.connect(vinylGain);
    vinyl.start();
    nodes.push(crush, lp, chorus, vinyl, vinylGain);

    const keys = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.1,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.45, sustain: 0.18, release: 0.9 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.05, release: 0.4 },
    }).connect(chorus);
    keys.maxPolyphony = 6;
    keys.volume.value = -14;
    const bass = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.22, sustain: 0.15, release: 0.25 },
      filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.2, baseFrequency: 120, octaves: 2.2 },
    }).connect(musicBus);
    bass.volume.value = -8;
    nodes.push(keys, bass);

    const keysPart = new Tone.Part((time, value: ChordHit) => {
      keys.triggerAttackRelease(value.chord.slice(0, 3).map(midiNote), '1n', time, 0.45);
    }, chords.map((chord, i) => ({ time: transportTime(i * 2), chord })));
    keysPart.loop = true;
    keysPart.loopEnd = '8m';
    parts.push(keysPart);
    const bassPart = new Tone.Part((time, value: NoteHit) => {
      bass.triggerAttackRelease(midiNote(value.note), '4n', time, 0.7);
    }, chords.flatMap((chord, i) => [
      { time: transportTime(i * 2), note: chord[0] - 12 },
      { time: transportTime(i * 2, 2), note: chord[0] - 12 },
    ]));
    bassPart.loop = true;
    bassPart.loopEnd = '8m';
    parts.push(bassPart, drumPart(kit, hitDrums));
  }

  if (kit.id === 'neon') {
    const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.16 }).connect(musicBus);
    const padFilter = new Tone.Filter(900, 'lowpass').connect(delay);
    nodes.push(delay, padFilter);

    const bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', frequency: 420, Q: 1.8 },
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.35, release: 0.2 },
      filterEnvelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.15, baseFrequency: 80, octaves: 2.8 },
    }).connect(musicBus);
    bass.volume.value = -11;
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.45, decay: 0.3, sustain: 0.65, release: 1.6 },
    }).connect(padFilter);
    pad.maxPolyphony = 5;
    pad.volume.value = -22;
    nodes.push(bass, pad);
    hat.volume.value = -26;

    const padPart = new Tone.Part((time, value: ChordHit) => {
      pad.triggerAttackRelease(value.chord.slice(0, 3).map(midiNote), '2m', time, 0.25);
    }, chords.map((chord, i) => ({ time: transportTime(i * 2), chord })));
    padPart.loop = true;
    padPart.loopEnd = '8m';
    parts.push(padPart);
    const bassPart = new Tone.Part((time, value: NoteHit) => {
      bass.triggerAttackRelease(midiNote(value.note), '4n', time, 0.75);
    }, chords.flatMap((chord, bar) => {
      const root = chord[0] - 12;
      return [
        { time: transportTime(bar * 2), note: root },
        { time: transportTime(bar * 2, 2), note: root },
        { time: transportTime(bar * 2 + 1), note: root + 7 },
        { time: transportTime(bar * 2 + 1, 2), note: root },
      ];
    }));
    bassPart.loop = true;
    bassPart.loopEnd = '8m';
    parts.push(bassPart, drumPart(kit, hitDrums));
  }

  if (kit.id === 'chip') {
    const lp = new Tone.Filter(3200, 'lowpass').connect(musicBus);
    const lead = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0.12, release: 0.04 },
    }).connect(lp);
    lead.volume.value = -16;
    const bass = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0.2, release: 0.06 },
    }).connect(musicBus);
    bass.volume.value = -12;
    nodes.push(lp, lead, bass);
    kick.volume.value = -12;
    snare.volume.value = -16;
    hat.volume.value = -24;

    const arpPattern = [0, 1, 2, 1, 0, 2, 3, 1];
    const step8 = Tone.Time('8n').toSeconds();
    const arpPart = new Tone.Part((time, value: NoteHit) => {
      lead.triggerAttackRelease(midiNote(value.note), '16n', time, 0.5);
    }, chords.flatMap((chord, bar) =>
      arpPattern.map((idx, i) => ({
        time: bar * Tone.Time('1m').toSeconds() + i * step8,
        note: chord[idx % chord.length],
      })),
    ));
    arpPart.loop = true;
    arpPart.loopEnd = '4m';
    parts.push(arpPart);
    const bassPart = new Tone.Part((time, value: NoteHit) => {
      bass.triggerAttackRelease(midiNote(value.note), '8n', time, 0.6);
    }, chords.flatMap((chord, i) => [
      { time: transportTime(i), note: chord[0] - 24 },
      { time: transportTime(i, 2), note: chord[0] - 24 },
    ]));
    bassPart.loop = true;
    bassPart.loopEnd = '4m';
    parts.push(bassPart, drumPart(kit, (time, kind) => {
      if (kind === 'hat') return;
      hitDrums(time, kind);
    }));
  }

  if (kit.id === 'breaks') {
    const sub = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.16, sustain: 0.1, release: 0.08 },
      filter: { type: 'lowpass', frequency: 180, Q: 0.8 },
    }).connect(musicBus);
    sub.volume.value = -6;
    const stab = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 },
      filter: { type: 'lowpass', frequency: 700, Q: 2 },
    }).connect(musicBus);
    stab.volume.value = -14;
    nodes.push(sub, stab);
    hat.volume.value = -20;
    kick.volume.value = -5;

    const bassPart = new Tone.Part((time, value: NoteHit) => {
      sub.triggerAttackRelease(midiNote(value.note), '8n', time, 0.85);
      stab.triggerAttackRelease(midiNote(value.note + 12), '16n', time, 0.35);
    }, chords.flatMap((chord, i) => [
      { time: transportTime(0, i), note: chord[0] },
      { time: transportTime(0, i, 2), note: chord[0] },
    ]));
    bassPart.loop = true;
    bassPart.loopEnd = '1m';
    parts.push(bassPart, drumPart(kit, hitDrums));
  }

  if (kit.id === 'dream') {
    const reverb = new Tone.Reverb({ decay: 4.5, wet: 0.38, preDelay: 0.04 }).connect(musicBus);
    const chorus = new Tone.Chorus({ frequency: 0.25, delayTime: 4, depth: 0.5, wet: 0.45 }).connect(reverb);
    chorus.start();
    const pad = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 1.4, decay: 0.6, sustain: 0.75, release: 2.8 },
      modulation: { type: 'sine' },
    }).connect(chorus);
    pad.maxPolyphony = 6;
    pad.volume.value = -16;
    const bell = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 2.2, sustain: 0, release: 1.6 },
    }).connect(reverb);
    bell.volume.value = -18;
    nodes.push(reverb, chorus, pad, bell);
    kick.volume.value = -22;
    snare.volume.value = -Infinity;
    hat.volume.value = -28;

    const padPart = new Tone.Part((time, value: ChordHit) => {
      pad.triggerAttackRelease(value.chord.slice(0, 4).map(midiNote), '2m', time, 0.35);
      bell.triggerAttackRelease(midiNote(value.chord[2] + 12), '2n', time, 0.25);
    }, chords.map((chord, i) => ({ time: transportTime(i * 2), chord })));
    padPart.loop = true;
    padPart.loopEnd = '8m';
    parts.push(padPart);
    parts.push(drumPart(kit, (time, kind) => {
      if (kind === 'kick') kick.start(time);
    }));
  }

  return { nodes, parts, players };
}

export async function startGenreKit(kit: GenreKit, seed: number): Promise<void> {
  const token = ++startToken;
  await Tone.start();
  if (token !== startToken) return;

  disposeActive();
  if (token !== startToken) return;

  Tone.getTransport().bpm.value = kitBpm(kit, seed);
  Tone.getTransport().swing = 0;
  const handle = buildKit(kit, seed);
  active = handle;
  for (const node of handle.nodes) {
    if (node instanceof Tone.Reverb) await node.generate();
  }
  if (token !== startToken) {
    disposeActive();
    return;
  }
  for (const part of handle.parts) part.start(0);
  if (token !== startToken) {
    disposeActive();
    return;
  }
  Tone.getTransport().start();
}

export function pauseGenreKit(): void {
  try {
    Tone.getTransport().pause();
  } catch {
    /* ignore */
  }
}

export function resumeGenreKit(): void {
  try {
    Tone.getTransport().start();
  } catch {
    /* ignore */
  }
}
