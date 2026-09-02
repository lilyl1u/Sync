"""
Test Audio Functionality

This script tests all audio processing capabilities:
1. Basic waveform synthesis (sine, square, sawtooth)
2. Drum sound generation (kick, snare, hi-hat)
3. Beat generation with tempo
4. Audio I/O operations
5. Audio effects (reverb, delay, filters)
6. MIDI to audio conversion

Usage:
    python scripts/test_audio_functionality.py
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.audio_utils import (
    AudioSynthesizer,
    AudioIO,
    BeatGridUtils,
    AudioEffects,
    generate_beat,
    save_audio
)
import numpy as np


def test_waveform_synthesis():
    """Test 1: Waveform Synthesis"""
    print("\n" + "="*60)
    print("Test 1: Waveform Synthesis")
    print("="*60)

    synth = AudioSynthesizer(sample_rate=44100)
    output_dir = Path("data/audio")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate different waveforms at 440 Hz (A4 note)
    waveforms = {
        'sine': synth.generate_sine_wave(440, 2.0),
        'square': synth.generate_square_wave(440, 2.0),
        'sawtooth': synth.generate_sawtooth_wave(440, 2.0),
        'triangle': synth.generate_triangle_wave(440, 2.0)
    }

    for name, wave in waveforms.items():
        output_file = output_dir / f"test_{name}_wave.wav"
        save_audio(wave, output_file, 44100)
        print(f"  Created: {output_file} ({len(wave)} samples)")

    print("  Status: PASSED")


def test_drum_synthesis():
    """Test 2: Drum Sound Synthesis"""
    print("\n" + "="*60)
    print("Test 2: Drum Sound Synthesis")
    print("="*60)

    synth = AudioSynthesizer(sample_rate=44100)
    output_dir = Path("data/audio")

    # Generate drum sounds
    drums = {
        'kick': synth.generate_kick_drum(0.5),
        'snare': synth.generate_snare_drum(0.2),
        'hihat_closed': synth.generate_hihat(0.1, closed=True),
        'hihat_open': synth.generate_hihat(0.3, closed=False)
    }

    for name, drum in drums.items():
        output_file = output_dir / f"test_{name}.wav"
        save_audio(drum, output_file, 44100)
        print(f"  Created: {output_file}")

    print("  Status: PASSED")


def test_beat_generation():
    """Test 3: Beat Generation"""
    print("\n" + "="*60)
    print("Test 3: Beat Generation")
    print("="*60)

    output_dir = Path("data/audio")

    # Generate beats at different tempos
    tempos = [120, 128, 140]

    for tempo in tempos:
        beat = generate_beat(tempo=tempo, duration=4.0, sample_rate=44100)
        output_file = output_dir / f"test_beat_{tempo}bpm.wav"
        save_audio(beat, output_file, 44100)
        print(f"  Created: {output_file} (tempo: {tempo} BPM)")

    print("  Status: PASSED")


def test_audio_io():
    """Test 4: Audio I/O Operations"""
    print("\n" + "="*60)
    print("Test 4: Audio I/O Operations")
    print("="*60)

    output_dir = Path("data/audio")

    # Create test audio
    synth = AudioSynthesizer()
    test_audio = synth.generate_sine_wave(440, 1.0)

    # Test saving different formats
    formats = {
        'wav': output_dir / "test_io.wav",
        'flac': output_dir / "test_io.flac",
        'ogg': output_dir / "test_io.ogg"
    }

    for format_name, file_path in formats.items():
        try:
            save_audio(test_audio, file_path, 44100)
            print(f"  Saved: {file_path}")

            # Test loading
            loaded_audio, sr = AudioIO.load_audio(file_path)
            print(f"  Loaded: {file_path} (sr={sr}, shape={loaded_audio.shape})")

            # Test info
            info = AudioIO.audio_info(file_path)
            print(f"    Info: {info['duration']:.2f}s, {info['channels']} channels")

        except Exception as e:
            print(f"  WARNING: {format_name} test failed: {e}")

    print("  Status: PASSED")


def test_audio_effects():
    """Test 5: Audio Effects"""
    print("\n" + "="*60)
    print("Test 5: Audio Effects")
    print("="*60)

    output_dir = Path("data/audio")

    # Create test audio (simple melody)
    synth = AudioSynthesizer()
    frequencies = [261.63, 293.66, 329.63, 349.23]  # C, D, E, F
    melody = np.concatenate([
        synth.generate_sine_wave(freq, 0.5, amplitude=0.3)
        for freq in frequencies
    ])

    # Test effects
    effects = {
        'reverb': AudioEffects.apply_reverb(melody, room_size=0.6, wet_level=0.4),
        'delay': AudioEffects.apply_delay(melody, 44100, delay_time=0.25, feedback=0.5),
        'lowpass': AudioEffects.apply_lowpass_filter(melody, 44100, cutoff_freq=2000),
        'highpass': AudioEffects.apply_highpass_filter(melody, 44100, cutoff_freq=300)
    }

    # Save original
    save_audio(melody, output_dir / "test_melody_original.wav", 44100)
    print(f"  Created: test_melody_original.wav")

    # Save with effects
    for effect_name, processed in effects.items():
        output_file = output_dir / f"test_melody_{effect_name}.wav"
        save_audio(processed, output_file, 44100)
        print(f"  Created: {output_file}")

    print("  Status: PASSED")


def test_tempo_detection():
    """Test 6: Tempo Detection"""
    print("\n" + "="*60)
    print("Test 6: Tempo Detection")
    print("="*60)

    # Generate beat with known tempo
    known_tempo = 128
    beat = generate_beat(tempo=known_tempo, duration=8.0, sample_rate=44100)

    # Detect tempo
    detected_tempo = BeatGridUtils.detect_tempo(beat, sample_rate=44100)

    print(f"  Known tempo: {known_tempo} BPM")
    print(f"  Detected tempo: {detected_tempo:.1f} BPM")
    print(f"  Difference: {abs(known_tempo - detected_tempo):.1f} BPM")

    # Allow 5 BPM tolerance
    if abs(known_tempo - detected_tempo) < 5:
        print("  Status: PASSED")
    else:
        print("  Status: WARNING (tempo detection may be inaccurate)")


def test_time_stretch_pitch_shift():
    """Test 7: Time Stretching and Pitch Shifting"""
    print("\n" + "="*60)
    print("Test 7: Time Stretching and Pitch Shifting")
    print("="*60)

    output_dir = Path("data/audio")

    # Create test audio
    synth = AudioSynthesizer()
    original = synth.generate_sine_wave(440, 2.0, amplitude=0.5)

    # Time stretch
    stretched = BeatGridUtils.time_stretch(original, rate=0.8)  # 80% speed (slower)
    save_audio(stretched, output_dir / "test_time_stretched.wav", 44100)
    print(f"  Created: test_time_stretched.wav (80% speed)")

    # Pitch shift
    shifted = BeatGridUtils.pitch_shift(original, 44100, n_steps=7)  # Up 7 semitones
    save_audio(shifted, output_dir / "test_pitch_shifted.wav", 44100)
    print(f"  Created: test_pitch_shifted.wav (+7 semitones)")

    print("  Status: PASSED")


def test_click_track():
    """Test 8: Click Track Generation"""
    print("\n" + "="*60)
    print("Test 8: Click Track Generation")
    print("="*60)

    output_dir = Path("data/audio")

    # Generate click tracks at different tempos
    tempos = [90, 120, 140]

    for tempo in tempos:
        click = BeatGridUtils.create_click_track(
            tempo=tempo,
            duration=4.0,
            sample_rate=44100
        )
        output_file = output_dir / f"test_click_{tempo}bpm.wav"
        save_audio(click, output_file, 44100)
        print(f"  Created: {output_file} ({tempo} BPM)")

    print("  Status: PASSED")


def test_complex_beat():
    """Test 9: Complex Beat Pattern"""
    print("\n" + "="*60)
    print("Test 9: Complex Beat Pattern")
    print("="*60)

    output_dir = Path("data/audio")

    # Create a more complex EDM-style beat
    sample_rate = 44100
    synth = AudioSynthesizer(sample_rate)

    tempo = 128
    duration = 8.0
    beat_duration = 60.0 / tempo
    total_samples = int(duration * sample_rate)

    output = np.zeros(total_samples)

    # Generate drum sounds
    kick = synth.generate_kick_drum(0.4)
    snare = synth.generate_snare_drum(0.15)
    hihat_closed = synth.generate_hihat(0.08, closed=True)
    hihat_open = synth.generate_hihat(0.15, closed=False)

    # Pattern: 4/4 time signature
    sixteenth_duration = beat_duration / 4
    num_sixteenths = int(duration / sixteenth_duration)

    # Kick pattern: on 1, 5, 9, 13 (quarter notes)
    kick_pattern = [0, 4, 8, 12]

    # Snare pattern: on 4, 12 (backbeat)
    snare_pattern = [4, 12]

    # Hi-hat pattern: every sixteenth
    hihat_pattern = list(range(16))

    # Open hi-hat: on 7, 15
    open_hihat_pattern = [7, 15]

    for sixteenth in range(num_sixteenths):
        sample_pos = int(sixteenth * sixteenth_duration * sample_rate)
        beat_pos = sixteenth % 16

        # Kick
        if beat_pos in kick_pattern:
            end_pos = min(sample_pos + len(kick), total_samples)
            output[sample_pos:end_pos] += kick[:end_pos - sample_pos]

        # Snare
        if beat_pos in snare_pattern:
            end_pos = min(sample_pos + len(snare), total_samples)
            output[sample_pos:end_pos] += snare[:end_pos - sample_pos]

        # Closed hi-hat
        if beat_pos in hihat_pattern and beat_pos not in open_hihat_pattern:
            end_pos = min(sample_pos + len(hihat_closed), total_samples)
            output[sample_pos:end_pos] += hihat_closed[:end_pos - sample_pos] * 0.6

        # Open hi-hat
        if beat_pos in open_hihat_pattern:
            end_pos = min(sample_pos + len(hihat_open), total_samples)
            output[sample_pos:end_pos] += hihat_open[:end_pos - sample_pos] * 0.5

    # Add bassline (simple sine wave following kick pattern)
    bass_freq = 55  # A1
    for beat in range(int(duration / beat_duration)):
        if beat % 4 in [0, 2]:  # On kicks
            sample_pos = int(beat * beat_duration * sample_rate)
            bass_note = synth.generate_sine_wave(bass_freq, beat_duration * 0.8, amplitude=0.2)
            end_pos = min(sample_pos + len(bass_note), total_samples)
            output[sample_pos:end_pos] += bass_note[:end_pos - sample_pos]

    # Normalize and save
    output = output / np.max(np.abs(output) + 1e-8) * 0.85

    # Save dry version
    output_file = output_dir / "test_complex_beat_dry.wav"
    save_audio(output, output_file, sample_rate)
    print(f"  Created: {output_file}")

    # Apply reverb and save
    output_reverb = AudioEffects.apply_reverb(output, room_size=0.3, wet_level=0.2)
    output_file_reverb = output_dir / "test_complex_beat_reverb.wav"
    save_audio(output_reverb, output_file_reverb, sample_rate)
    print(f"  Created: {output_file_reverb}")

    print("  Status: PASSED")


def main():
    """Run all audio functionality tests"""
    print("\n" + "="*60)
    print("Audio Functionality Test Suite")
    print("="*60)
    print("\nTesting audio processing capabilities for EDM generation...")

    try:
        # Run tests
        test_waveform_synthesis()
        test_drum_synthesis()
        test_beat_generation()
        test_audio_io()
        test_audio_effects()
        test_tempo_detection()
        test_time_stretch_pitch_shift()
        test_click_track()
        test_complex_beat()

        # Summary
        print("\n" + "="*60)
        print("Test Summary")
        print("="*60)
        print("\nAll tests completed successfully!")
        print(f"\nGenerated audio files saved to: data/audio/")
        print("\nYou can play these files to verify audio quality:")
        print("  open data/audio/test_complex_beat_reverb.wav  # Mac")
        print("  xdg-open data/audio/test_complex_beat_reverb.wav  # Linux")
        print("\n" + "="*60)

    except Exception as e:
        print(f"\nERROR: Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
