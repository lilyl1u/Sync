import { NextRequest, NextResponse } from 'next/server';
import { Midi } from '@tonejs/midi';

const LOFI_MODAL_API_URL = 'https://michellee-wang--lofi-generator-api.modal.run'.replace(/\/$/, '');

export interface GenerateLofiResponse {
  beats: number[];
  intensities: number[];
  midiBase64: string;
  notesGenerated: number;
  weightsUsed: string;
}

/**
 * Parse MIDI bytes and extract note onset times + velocities (for intensities).
 * Each unique onset time becomes a beat; intensity = normalised velocity.
 */
function midiToBeats(midiBytes: ArrayBuffer): { beats: number[]; intensities: number[] } {
  const midi = new Midi(midiBytes);
  const onsetMap = new Map<number, number>(); // time -> max velocity at that time

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      const time = note.time;
      const velocity = note.velocity; // 0-1 in @tonejs/midi
      const existing = onsetMap.get(time) ?? 0;
      onsetMap.set(time, Math.max(existing, velocity));
    }
  }

  const times = Array.from(onsetMap.keys()).sort((a, b) => a - b);
  const beats = times;
  const maxVel = Math.max(...Array.from(onsetMap.values()), 0.01);
  const intensities = times.map((t) => onsetMap.get(t)! / maxVel);

  return { beats, intensities };
}

export async function POST(request: NextRequest) {
  console.log('[generate-lofi] POST received');
  try {
    let weights: string | undefined;
    let length = 200;
    let temperature = 0.8;

    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      weights = body.weights;
      length = body.length ?? 200;
      temperature = body.temperature ?? 0.8;
    }
    console.log('[generate-lofi] weights:', weights ?? '(will fetch)', 'length:', length, 'temperature:', temperature);

    if (!weights) {
      console.log('[generate-lofi] Fetching list_checkpoints from', LOFI_MODAL_API_URL);
      const listRes = await fetch(`${LOFI_MODAL_API_URL}/list_checkpoints`);
      const list = (await listRes.json()) as { checkpoints?: string[] };
      const checkpoints = list.checkpoints ?? [];
      console.log('[generate-lofi] list_checkpoints status:', listRes.status, 'checkpoints count:', checkpoints.length);
      if (checkpoints.length === 0) {
        console.log('[generate-lofi] No checkpoints, returning 503');
        return NextResponse.json(
          { error: 'No model checkpoints available on Modal' },
          { status: 503 }
        );
      }
      weights = checkpoints[0];
      console.log('[generate-lofi] Using weights:', weights);
    }

    // Always call Modal /generate (no caching) — each game session gets fresh beats. With landing-page warm-up this is fast.
    console.log('[generate-lofi] Calling Modal generate', { weights, length, temperature });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(`${LOFI_MODAL_API_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weights, length, temperature }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    console.log('[generate-lofi] Modal generate response status:', res.status, 'ok:', res.ok);

    if (!res.ok) {
      const err = await res.text();
      console.log('[generate-lofi] Modal error body:', err?.slice(0, 300));
      return NextResponse.json(
        { error: `Modal API error: ${res.status}`, detail: err },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      midi_base64?: string;
      midiBase64?: string;
      notes_generated?: number;
      notesGenerated?: number;
      weights_used?: string;
      weightsUsed?: string;
      error?: string;
    };

    console.log('[generate-lofi] Modal data keys:', Object.keys(data), 'midi_base64:', !!data.midi_base64, 'midiBase64:', !!data.midiBase64, 'error:', data.error);

    if (data.error) {
      console.log('[generate-lofi] Modal data.error:', data.error);
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    const midiBase64 = data.midi_base64 ?? data.midiBase64;
    if (!midiBase64 || typeof midiBase64 !== 'string') {
      console.log('[generate-lofi] No midiBase64 in response');
      return NextResponse.json(
        { error: 'Modal API did not return midi_base64' },
        { status: 502 }
      );
    }
    console.log('[generate-lofi] midiBase64 length:', midiBase64.length);

    const binary = atob(midiBase64);
    const midiBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) midiBytes[i] = binary.charCodeAt(i);
    const { beats, intensities } = midiToBeats(midiBytes.buffer);
    console.log('[generate-lofi] midiToBeats result: beats count:', beats.length, 'intensities count:', intensities.length);

    const response: GenerateLofiResponse = {
      beats,
      intensities,
      midiBase64,
      notesGenerated: data.notes_generated ?? data.notesGenerated ?? beats.length,
      weightsUsed: data.weights_used ?? data.weightsUsed ?? weights ?? '',
    };

    console.log('[generate-lofi] Returning 200, beats:', beats.length);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log('[generate-lofi] Caught error:', message, err);
    return NextResponse.json(
      { error: 'Failed to generate lofi', detail: message },
      { status: 500 }
    );
  }
}
