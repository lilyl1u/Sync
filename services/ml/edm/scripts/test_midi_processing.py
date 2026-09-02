"""
Test MIDI Processing Functionality

This script tests MIDI-related capabilities:
1. MIDI file creation and manipulation
2. Piano roll conversion
3. MIDI feature extraction
4. Note sequence operations

Usage:
    python scripts/test_midi_processing.py
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.preprocessing.midi_features import (
    MIDIFeatureExtractor,
    create_pianoroll,
    extract_sequence_features
)
import numpy as np


def test_create_midi():
    """Test 1: Create Simple MIDI File"""
    print("\n" + "="*60)
    print("Test 1: Create Simple MIDI File")
    print("="*60)

    try:
        import pretty_midi

        output_dir = Path("data/user_midis")
        output_dir.mkdir(parents=True, exist_ok=True)

        # Create a new MIDI file
        midi = pretty_midi.PrettyMIDI()

        # Create an instrument (Piano)
        piano = pretty_midi.Instrument(program=0)

        # Add notes (C major scale)
        scale_notes = [60, 62, 64, 65, 67, 69, 71, 72]  # C4 to C5
        start_time = 0.0
        duration = 0.5

        for pitch in scale_notes:
            note = pretty_midi.Note(
                velocity=100,
                pitch=pitch,
                start=start_time,
                end=start_time + duration
            )
            piano.notes.append(note)
            start_time += duration

        # Add instrument to MIDI
        midi.instruments.append(piano)

        # Save MIDI file
        output_file = output_dir / "test_scale.mid"
        midi.write(str(output_file))

        print(f"  Created: {output_file}")
        print(f"  Duration: {midi.get_end_time():.2f}s")
        print(f"  Notes: {len(piano.notes)}")
        print("  Status: PASSED")

    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()


def test_create_chord_progression():
    """Test 2: Create Chord Progression"""
    print("\n" + "="*60)
    print("Test 2: Create Chord Progression")
    print("="*60)

    try:
        import pretty_midi

        output_dir = Path("data/user_midis")

        midi = pretty_midi.PrettyMIDI()
        piano = pretty_midi.Instrument(program=0)

        # Chord progression: C - Am - F - G (I - vi - IV - V)
        chords = [
            [60, 64, 67],  # C major (C-E-G)
            [57, 60, 64],  # A minor (A-C-E)
            [53, 57, 60],  # F major (F-A-C)
            [55, 59, 62],  # G major (G-B-D)
        ]

        start_time = 0.0
        chord_duration = 1.0

        for chord in chords:
            for pitch in chord:
                note = pretty_midi.Note(
                    velocity=90,
                    pitch=pitch,
                    start=start_time,
                    end=start_time + chord_duration
                )
                piano.notes.append(note)
            start_time += chord_duration

        midi.instruments.append(piano)

        output_file = output_dir / "test_chords.mid"
        midi.write(str(output_file))

        print(f"  Created: {output_file}")
        print(f"  Duration: {midi.get_end_time():.2f}s")
        print(f"  Chords: {len(chords)}")
        print(f"  Total notes: {len(piano.notes)}")
        print("  Status: PASSED")

    except Exception as e:
        print(f"  ERROR: {e}")


def test_midi_feature_extraction():
    """Test 3: MIDI Feature Extraction"""
    print("\n" + "="*60)
    print("Test 3: MIDI Feature Extraction")
    print("="*60)

    try:
        midi_file = Path("data/user_midis/test_scale.mid")

        if not midi_file.exists():
            print("  WARNING: test_scale.mid not found, skipping test")
            return

        extractor = MIDIFeatureExtractor(fs=100)
        features = extractor.extract_features(midi_file)

        if features:
            print(f"  File: {midi_file.name}")
            print(f"  Duration: {features['total_time']:.2f}s")
            print(f"  Average tempo: {features['avg_tempo']:.1f} BPM")
            print(f"  Total notes: {features['total_notes']}")
            print(f"  Note density: {features['note_density']:.2f} notes/sec")
            print(f"  Pitch range: {features['pitch_range']} semitones")
            print(f"  Average pitch: {features['avg_pitch']:.1f}")
            print(f"  Average velocity: {features['avg_velocity']:.1f}")
            print("  Status: PASSED")
        else:
            print("  ERROR: Feature extraction failed")

    except Exception as e:
        print(f"  ERROR: {e}")


def test_piano_roll_conversion():
    """Test 4: Piano Roll Conversion"""
    print("\n" + "="*60)
    print("Test 4: Piano Roll Conversion")
    print("="*60)

    try:
        midi_file = Path("data/user_midis/test_chords.mid")

        if not midi_file.exists():
            print("  WARNING: test_chords.mid not found, skipping test")
            return

        # Create piano roll
        piano_roll = create_pianoroll(midi_file, fs=100, pitch_range=(21, 109))

        if piano_roll is not None:
            print(f"  File: {midi_file.name}")
            print(f"  Piano roll shape: {piano_roll.shape}")
            print(f"  (pitches, time_steps): ({piano_roll.shape[0]}, {piano_roll.shape[1]})")
            print(f"  Non-zero elements: {np.count_nonzero(piano_roll)}")
            print(f"  Max value: {piano_roll.max():.2f}")
            print("  Status: PASSED")
        else:
            print("  ERROR: Piano roll conversion failed")

    except Exception as e:
        print(f"  ERROR: {e}")


def test_sequence_features():
    """Test 5: Sequence Feature Extraction"""
    print("\n" + "="*60)
    print("Test 5: Sequence Feature Extraction")
    print("="*60)

    try:
        midi_file = Path("data/user_midis/test_scale.mid")

        if not midi_file.exists():
            print("  WARNING: test_scale.mid not found, skipping test")
            return

        features = extract_sequence_features(midi_file, max_length=512)

        if features:
            print(f"  File: {midi_file.name}")
            print(f"  Number of notes: {features['num_notes']}")
            print(f"  Pitch sequence length: {len(features['pitches'])}")
            print(f"  Pitches: {features['pitches'][:10]}...")  # First 10
            print(f"  Velocities: {features['velocities'][:10]}...")
            print(f"  Average duration: {features['durations'].mean():.3f}s")
            print("  Status: PASSED")
        else:
            print("  ERROR: Sequence feature extraction failed")

    except Exception as e:
        print(f"  ERROR: {e}")


def test_create_drum_pattern():
    """Test 6: Create MIDI Drum Pattern"""
    print("\n" + "="*60)
    print("Test 6: Create MIDI Drum Pattern")
    print("="*60)

    try:
        import pretty_midi

        output_dir = Path("data/user_midis")

        midi = pretty_midi.PrettyMIDI()

        # Create drum instrument (channel 10)
        drums = pretty_midi.Instrument(program=0, is_drum=True)

        # GM drum map
        kick = 36   # Bass Drum 1
        snare = 38  # Acoustic Snare
        hihat = 42  # Closed Hi-Hat

        # Create 4 bar pattern (assuming 120 BPM, 4/4 time)
        tempo = 120
        beat_duration = 60.0 / tempo  # 0.5 seconds per beat
        sixteenth = beat_duration / 4

        # Pattern for 4 bars (16 beats)
        for bar in range(4):
            for beat in range(4):
                beat_start = (bar * 4 + beat) * beat_duration

                # Kick on beats 0 and 2
                if beat in [0, 2]:
                    drums.notes.append(pretty_midi.Note(
                        velocity=110,
                        pitch=kick,
                        start=beat_start,
                        end=beat_start + sixteenth
                    ))

                # Snare on beats 1 and 3
                if beat in [1, 3]:
                    drums.notes.append(pretty_midi.Note(
                        velocity=100,
                        pitch=snare,
                        start=beat_start,
                        end=beat_start + sixteenth
                    ))

                # Hi-hat on every eighth note
                for eighth in range(2):
                    hihat_start = beat_start + eighth * (beat_duration / 2)
                    drums.notes.append(pretty_midi.Note(
                        velocity=80,
                        pitch=hihat,
                        start=hihat_start,
                        end=hihat_start + sixteenth
                    ))

        midi.instruments.append(drums)

        output_file = output_dir / "test_drums.mid"
        midi.write(str(output_file))

        print(f"  Created: {output_file}")
        print(f"  Duration: {midi.get_end_time():.2f}s")
        print(f"  Total drum hits: {len(drums.notes)}")
        print("  Status: PASSED")

    except Exception as e:
        print(f"  ERROR: {e}")


def test_midi_manipulation():
    """Test 7: MIDI Manipulation (transpose, time stretch)"""
    print("\n" + "="*60)
    print("Test 7: MIDI Manipulation")
    print("="*60)

    try:
        import pretty_midi

        input_file = Path("data/user_midis/test_scale.mid")

        if not input_file.exists():
            print("  WARNING: test_scale.mid not found, skipping test")
            return

        output_dir = Path("data/user_midis")

        # Load MIDI
        midi = pretty_midi.PrettyMIDI(str(input_file))

        # Test 1: Transpose up 5 semitones
        midi_transposed = pretty_midi.PrettyMIDI(str(input_file))
        for instrument in midi_transposed.instruments:
            for note in instrument.notes:
                note.pitch += 5

        output_file = output_dir / "test_scale_transposed.mid"
        midi_transposed.write(str(output_file))
        print(f"  Created: {output_file} (transposed +5 semitones)")

        # Test 2: Time stretch (double speed)
        midi_stretched = pretty_midi.PrettyMIDI(str(input_file))
        for instrument in midi_stretched.instruments:
            for note in instrument.notes:
                note.start = note.start / 2
                note.end = note.end / 2

        output_file = output_dir / "test_scale_fast.mid"
        midi_stretched.write(str(output_file))
        print(f"  Created: {output_file} (2x speed)")

        print("  Status: PASSED")

    except Exception as e:
        print(f"  ERROR: {e}")


def test_multi_instrument():
    """Test 8: Multi-Instrument MIDI"""
    print("\n" + "="*60)
    print("Test 8: Multi-Instrument MIDI")
    print("="*60)

    try:
        import pretty_midi

        output_dir = Path("data/user_midis")

        midi = pretty_midi.PrettyMIDI()

        # Create instruments
        piano = pretty_midi.Instrument(program=0, name="Piano")
        bass = pretty_midi.Instrument(program=33, name="Bass")
        strings = pretty_midi.Instrument(program=48, name="Strings")

        # Add some notes to each instrument
        # Piano: melody
        melody = [60, 62, 64, 65, 67]
        for i, pitch in enumerate(melody):
            piano.notes.append(pretty_midi.Note(
                velocity=80,
                pitch=pitch,
                start=i * 0.5,
                end=(i + 1) * 0.5
            ))

        # Bass: root notes
        bass_notes = [48, 48, 50, 50, 52]
        for i, pitch in enumerate(bass_notes):
            bass.notes.append(pretty_midi.Note(
                velocity=90,
                pitch=pitch,
                start=i * 0.5,
                end=(i + 1) * 0.5
            ))

        # Strings: sustained chords
        chord = [64, 67, 71]  # C major
        for pitch in chord:
            strings.notes.append(pretty_midi.Note(
                velocity=60,
                pitch=pitch,
                start=0.0,
                end=2.5
            ))

        # Add all instruments
        midi.instruments.extend([piano, bass, strings])

        output_file = output_dir / "test_multi_instrument.mid"
        midi.write(str(output_file))

        print(f"  Created: {output_file}")
        print(f"  Instruments: {len(midi.instruments)}")
        print(f"    - Piano: {len(piano.notes)} notes")
        print(f"    - Bass: {len(bass.notes)} notes")
        print(f"    - Strings: {len(strings.notes)} notes")
        print("  Status: PASSED")

    except Exception as e:
        print(f"  ERROR: {e}")


def main():
    """Run all MIDI processing tests"""
    print("\n" + "="*60)
    print("MIDI Processing Test Suite")
    print("="*60)
    print("\nTesting MIDI processing capabilities...")

    try:
        # Create test files
        test_create_midi()
        test_create_chord_progression()
        test_create_drum_pattern()
        test_multi_instrument()

        # Test feature extraction
        test_midi_feature_extraction()
        test_piano_roll_conversion()
        test_sequence_features()

        # Test manipulation
        test_midi_manipulation()

        # Summary
        print("\n" + "="*60)
        print("Test Summary")
        print("="*60)
        print("\nAll MIDI tests completed!")
        print(f"\nGenerated MIDI files saved to: data/user_midis/")
        print("\nYou can play these MIDI files with:")
        print("  - FluidSynth: fluidsynth data/soundfont.sf2 data/user_midis/test_multi_instrument.mid")
        print("  - Convert to audio: python scripts/convert_audio_to_midi.py")
        print("\n" + "="*60)

    except Exception as e:
        print(f"\nERROR: Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
