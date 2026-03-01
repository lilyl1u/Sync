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

export default function LofiPage() {
  const [state, setState] = useState<GenState>({
    status: 'info',
    message: 'Generating beat on load...',
  });
  const stopMidiRef = useRef<(() => void) | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

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
          startBgMp4();
          const stop = await playMidiInPage(midiBase64, MIDI_VOLUME);
          stopMidiRef.current = stop;
        } catch (playErr) {
          console.warn('Auto-play failed (click Play to start):', playErr);
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
    handleStop(); // stop any current playback first
    try {
      startBgMp4();
      const stop = await playMidiInPage(state.midiBase64, MIDI_VOLUME);
      stopMidiRef.current = stop;
    } catch (e) {
      console.error('Play failed:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setPlayError(msg);
    }
  }, [state.midiBase64, handleStop, startBgMp4]);

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-[#e0e0e0] flex flex-col items-center py-8 px-4">
      <audio
        ref={bgAudioRef}
        src={LOFI_BG_MP4}
        loop
        playsInline
        className="hidden"
        aria-hidden
      />
      <h1 className="text-3xl text-[#e94560] mb-1">Lo-fi Hip-Hop Generator</h1>
      <p className="text-[#7a7a9e] mb-8 text-sm">LSTM · Modal · Generate on load</p>

      <div className="w-full max-w-[520px] space-y-6">
        <div className="bg-[#16213e] border border-[#0f3460] rounded-xl p-6">
          <h2 className="text-lg text-[#e94560] mb-4">Generated Beat</h2>
          <div
            className={`rounded-lg p-4 text-sm ${
              state.status === 'info'
                ? 'bg-[#0f3460] text-[#a0c4ff]'
                : state.status === 'ok'
                  ? 'bg-[#0a3d2a] text-[#90ee90]'
                  : state.status === 'err'
                    ? 'bg-[#3d0a0a] text-[#ff9090]'
                    : 'bg-[#0f3460] text-[#a0c4ff]'
            }`}
          >
            {state.message}
            {state.status === 'ok' && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePlay()}
                    className="px-4 py-2 bg-[#0f3460] text-[#a0c4ff] rounded-md text-sm hover:bg-[#1a4a80]"
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleStop()}
                    className="px-4 py-2 bg-[#0f3460] text-[#a0c4ff] rounded-md text-sm hover:bg-[#1a4a80]"
                  >
                    Stop
                  </button>
                  {state.downloadUrl && state.fileName && (
                    <a
                      href={state.downloadUrl}
                      download={state.fileName}
                      className="px-4 py-2 bg-[#0f3460] text-[#a0c4ff] rounded-md text-sm hover:bg-[#1a4a80] inline-block"
                    >
                      Download MIDI
                    </a>
                  )}
                </div>
                {playError && (
                  <p className="text-xs text-[#ff9090]">Audio: {playError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[#7a7a9e] text-xs max-w-[520px] leading-relaxed">
          Same API as the game: <code className="bg-[#0f3460] px-1.5 py-0.5 rounded text-[0.78rem]">POST /api/generate-lofi</code> is called automatically when this page loads.
        </p>

        <div className="flex justify-center">
          <Link
            href="/game"
            className="px-6 py-2.5 bg-[#e94560] text-white font-semibold rounded-lg hover:bg-[#c73650] transition-colors"
          >
            Play game with this beat →
          </Link>
        </div>
      </div>
    </div>
  );
}
