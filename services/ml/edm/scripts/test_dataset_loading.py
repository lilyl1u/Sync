"""
Test Dataset Loading Logic Locally

Tests the MIDI loading and shape validation before deploying to Modal.
"""

import numpy as np
import sys
from pathlib import Path

# Mock torch for testing
class MockTensor:
    def __init__(self, data):
        self.data = np.array(data)
        self.shape = self.data.shape

    def __repr__(self):
        return f"Tensor(shape={self.shape})"

def test_midi_loading(midi_path: Path):
    """Test a single MIDI file with the exact logic from pretrain_model.py"""
    import pretty_midi
    import random

    try:
        midi_data = pretty_midi.PrettyMIDI(str(midi_path))
        # Get full piano roll (128 MIDI notes)
        full_piano_roll = midi_data.get_piano_roll(fs=4)

        print(f"  Original shape: {full_piano_roll.shape}")

        # Ensure we have at least 109 rows to safely slice [21:109]
        if full_piano_roll.shape[0] < 109:
            # Pad to 128 rows
            pad_rows = 128 - full_piano_roll.shape[0]
            full_piano_roll = np.pad(full_piano_roll, ((0, pad_rows), (0, 0)), mode='constant')
            print(f"  Padded to: {full_piano_roll.shape}")

        # Extract 88 piano keys (A0 to C8: MIDI notes 21-108)
        piano_roll = full_piano_roll[21:109, :]
        print(f"  After slicing [21:109]: {piano_roll.shape}")

        # Normalize to [0, 1]
        piano_roll = np.clip(piano_roll / 127.0, 0, 1)

        # Handle time dimension (ensure 512 frames)
        if piano_roll.shape[1] >= 512:
            start = random.randint(0, piano_roll.shape[1] - 512)
            piano_roll = piano_roll[:, start:start + 512]
        else:
            piano_roll = np.pad(piano_roll, ((0, 0), (0, 512 - piano_roll.shape[1])))

        print(f"  After time handling: {piano_roll.shape}")

        # Final safety check: ensure EXACTLY (88, 512)
        if piano_roll.shape[0] < 88:
            # Pad if too few rows
            piano_roll = np.pad(piano_roll, ((0, 88 - piano_roll.shape[0]), (0, 0)), mode='constant')
            print(f"  Padded pitch to 88: {piano_roll.shape}")
        elif piano_roll.shape[0] > 88:
            # Trim if too many rows (shouldn't happen but be safe)
            piano_roll = piano_roll[:88, :]
            print(f"  Trimmed pitch to 88: {piano_roll.shape}")

        if piano_roll.shape[1] < 512:
            piano_roll = np.pad(piano_roll, ((0, 0), (0, 512 - piano_roll.shape[1])), mode='constant')
            print(f"  Padded time to 512: {piano_roll.shape}")
        elif piano_roll.shape[1] > 512:
            piano_roll = piano_roll[:, :512]
            print(f"  Trimmed time to 512: {piano_roll.shape}")

        # Assert correct shape
        assert piano_roll.shape == (88, 512), f"Bad shape: {piano_roll.shape}"

        # Simulate torch tensor
        tensor = MockTensor(piano_roll[np.newaxis, :, :])
        print(f"  ✓ Final tensor shape: {tensor.shape}")
        return True, tensor.shape

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False, None


def main():
    """Test on sample MIDI files"""
    print("=" * 60)
    print("Testing Dataset Loading Logic")
    print("=" * 60)

    # Try to find some MIDI files to test
    test_paths = [
        Path("/Users/michellewang/sync/services/ml-service/test_midi"),
        Path.home() / "Downloads",
        Path.cwd(),
    ]

    midi_files = []
    for path in test_paths:
        if path.exists():
            midi_files.extend(list(path.glob("*.mid"))[:5])
        if len(midi_files) >= 5:
            break

    if not midi_files:
        print("\n⚠️  No MIDI files found for testing!")
        print("Please download a few MIDI files to test with.")
        print("You can get test files from: https://freemidi.org/")
        return

    print(f"\nTesting {len(midi_files)} MIDI files...\n")

    success_count = 0
    shapes = []

    for i, midi_file in enumerate(midi_files, 1):
        print(f"{i}. Testing: {midi_file.name}")
        success, shape = test_midi_loading(midi_file)
        if success:
            success_count += 1
            shapes.append(shape)
        print()

    print("=" * 60)
    print(f"Results: {success_count}/{len(midi_files)} successful")

    if success_count > 0:
        print(f"\nAll successful shapes: {set(shapes)}")
        if len(set(shapes)) == 1:
            print("✓ All shapes are consistent!")
        else:
            print("✗ WARNING: Inconsistent shapes detected!")

    if success_count == len(midi_files):
        print("\n✓ All tests passed! Ready to deploy to Modal.")
    else:
        print(f"\n✗ {len(midi_files) - success_count} files failed. Fix issues before deploying.")

if __name__ == "__main__":
    main()
