'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

const LOFI_API = '/api/generate-lofi';

/** Hardcoded background track (audio.mp4 in public/). Plays at 50% with generated MIDI at 50%. */
const LOFI_BG_MP4 = '/audio.mp4';

const MIDI_VOLUME = 0.5; // 50% when mixing with MP4
const BG_VOLUME = 0.5;

type StatusType = 'idle' | 'info' | 'ok' | 'err';

interface GenState {
  status: StatusType;
  message: string;
  notesGenerated?: number;
  weightsUsed?: string;
  downloadUrl?: string;
  fileName?: string;
  midiBase64?: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

/**
 * Self-contained MIDI playback using Tone + @tonejs/midi, loaded only in the browser.
 * volume 0–1 (e.g. 0.5 for 50%). Returns a stop function.
 */
async function playMidiInPage(midiBase64: string, volume = 1): Promise<() => void> {
  const [Tone, MidiMod] = await Promise.all([
    import('tone'),
    import('@tonejs/midi'),
  ]);
  const { Midi } = MidiMod;

  const synth = new Tone.PolySynth().toDestination();
  // Set MIDI to 50% when mixing with hardcoded MP4 (volume is linear 0–1, Tone uses dB)
  synth.volume.value = volume <= 0 ? -Infinity : 20 * Math.log10(volume);
  synth.releaseAll();

  const bytes = Uint8Array.from(atob(midiBase64), (c) => c.charCodeAt(0));
  const midi = new Midi(bytes.buffer);

  const tracks = midi.tracks ?? [];
  let noteCount = 0;
  for (const track of tracks) {
    noteCount += (track.notes ?? []).length;
  }
  if (noteCount === 0) {
    throw new Error('MIDI has no notes to play');
  }

  await Tone.start();

  const now = Tone.now();
  for (const track of tracks) {
    const notes = track.notes ?? [];
    for (const note of notes) {
      const noteName = midiToNoteName(note.midi);
      synth.triggerAttackRelease(
        noteName,
        note.duration,
        now + note.time,
        note.velocity ?? 0.8
      );
    }
  }

  return () => {
    synth.releaseAll();
    synth.disconnect();
  };
}

/** Preload Tone + Midi so first Play is fast (they're large chunks). */
function preloadAudioLibraries(): void {
  void Promise.all([import('tone'), import('@tonejs/midi')]);
}

export default function LofiPage() {
  const [state, setState] = useState<GenState>({
    status: 'info',
    message: 'Generating beat on load...',
  });
  const stopMidiRef = useRef<(() => void) | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playPending, setPlayPending] = useState(false);

  // Preload tone + @tonejs/midi on mount so first Play / auto-play is much faster
  useEffect(() => {
    preloadAudioLibraries();
  }, []);

  const startBgMp4 = useCallback(() => {
    const el = bgAudioRef.current;
    if (!el) return;
    el.volume = BG_VOLUME;
    el.play().catch(() => {});
  }, []);

  const stopBgMp4 = useCallback(() => {
    const el = bgAudioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState({ status: 'info', message: 'Generating... (first call may take 15–30s cold start).' });

      try {
        const res = await fetch(LOFI_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ length: 200, temperature: 0.8 }),
        });

        if (cancelled) return;

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const errMsg = data.error ?? data.detail ?? `HTTP ${res.status}`;
          setState({ status: 'err', message: `Error: ${errMsg}` });
          return;
        }

        if (data.error) {
          setState({ status: 'err', message: `Error: ${data.error}` });
          return;
        }

        const midiBase64 = data.midiBase64;
        if (!midiBase64) {
          setState({ status: 'err', message: 'No MIDI data returned.' });
          return;
        }

        const binary = atob(midiBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);

        setState({
          status: 'ok',
          message: `Generated ${data.notesGenerated ?? data.beats?.length ?? 0} notes using ${data.weightsUsed ?? 'default'} checkpoint.`,
          notesGenerated: data.notesGenerated,
          weightsUsed: data.weightsUsed,
          downloadUrl: url,
          fileName: 'lofi_output.mid',
          midiBase64,
        });

        // Auto-play when ready: hardcoded MP4 at 50% + generated MIDI at 50%
        try {
          setPlayPending(true);
          startBgMp4();
          const stop = await playMidiInPage(midiBase64, MIDI_VOLUME);
          stopMidiRef.current = stop;
        } catch (playErr) {
          console.warn('Auto-play failed (click Play to start):', playErr);
        } finally {
          setPlayPending(false);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState({ status: 'err', message: `Request failed: ${msg}` });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke object URL when it changes
  useEffect(() => {
    const url = state.downloadUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.downloadUrl]);

  // Stop MIDI and background MP4 on unmount
  useEffect(() => {
    return () => {
      stopMidiRef.current?.();
      stopMidiRef.current = null;
      stopBgMp4();
    };
  }, [stopBgMp4]);

  const [playError, setPlayError] = useState<string | null>(null);

  const handleStop = useCallback(() => {
    setPlayError(null);
    stopMidiRef.current?.();
    stopMidiRef.current = null;
    stopBgMp4();
  }, [stopBgMp4]);

  const handlePlay = useCallback(async () => {
    if (!state.midiBase64) return;
    setPlayError(null);
    setPlayPending(true);
    handleStop(); // stop any current playback first
    try {
      startBgMp4();
      const stop = await playMidiInPage(state.midiBase64, MIDI_VOLUME);
      stopMidiRef.current = stop;
    } catch (e) {
      console.error('Play failed:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setPlayError(msg);
    } finally {
      setPlayPending(false);
    }
  }, [state.midiBase64, handleStop, startBgMp4]);

  const cardClass = 'px-panel w-full max-w-[520px] p-6';
  const btnClass = 'px-btn px-btn-sea';

  return (
    <div className="page-arcade min-h-screen flex flex-col items-center py-8 px-4 pt-20">
      <audio ref={bgAudioRef} src={LOFI_BG_MP4} loop playsInline className="hidden" aria-hidden />
      <Link href="/" className="self-start px-kicker mb-6">
        ← Home
      </Link>
      <h1 className="px-title text-xl sm:text-2xl mb-2 text-center">LO-FI</h1>
      <p className="px-kicker mb-8" style={{ color: 'var(--px-gold)' }}>LSTM · Generate on load</p>

      <div className="w-full max-w-[520px] space-y-6">
        <div className={cardClass}>
          <h2 className="text-sm mb-4">Generated Beat</h2>
          <div
            className={`p-4 text-[10px] border-3 border-[var(--px-ink)] ${
              state.status === 'err' ? 'bg-[#ffd6d6]' : 'bg-white'
            }`}
          >
            {state.message}
            {state.status === 'ok' && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void handlePlay()} disabled={playPending} className={btnClass}>
                    {playPending ? 'Starting…' : 'Play'}
                  </button>
                  <button type="button" onClick={() => void handleStop()} className={btnClass}>Stop</button>
                  {state.downloadUrl && state.fileName && (
                    <a href={state.downloadUrl} download={state.fileName} className={`${btnClass} inline-block`}>Download MIDI</a>
                  )}
                </div>
                {playError && <p className="text-[10px] text-[#b42318] mt-2">Audio: {playError}</p>}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[9px] max-w-[520px] leading-relaxed text-[var(--px-navy)]">
          Same API as the game: <code className="bg-white px-1 border-2 border-[var(--px-ink)]">POST /api/generate-lofi</code> runs when this page loads.
        </p>

        <div className="flex justify-center">
          <Link href="/game" className="px-btn px-btn-start">
            Play game →
          </Link>
        </div>
      </div>
    </div>
  );
}
