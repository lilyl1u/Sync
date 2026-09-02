"""
MIDI Feature Extraction

This module provides utilities for extracting features from MIDI files
for music genre classification and generation tasks.
"""

import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import pretty_midi
import warnings

warnings.filterwarnings('ignore')


class MIDIFeatureExtractor:
    """Extract features from MIDI files for ML models"""

    def __init__(self, fs: int = 100):
        """
        Initialize feature extractor

        Args:
            fs: Sampling frequency for piano roll (frames per second)
        """
        self.fs = fs

    def extract_features(self, midi_path: Path) -> Optional[Dict]:
        """
        Extract comprehensive features from a MIDI file

        Args:
            midi_path: Path to MIDI file

        Returns:
            Dictionary of features or None if extraction fails
        """
        try:
            midi_data = pretty_midi.PrettyMIDI(str(midi_path))

            features = {
                # Basic metadata
                'file_path': str(midi_path),
                'total_time': midi_data.get_end_time(),

                # Tempo features
                'tempo_changes': len(midi_data.get_tempo_changes()[0]),
                'avg_tempo': self._get_average_tempo(midi_data),

                # Instrument features
                'num_instruments': len(midi_data.instruments),
                'is_drum': any(inst.is_drum for inst in midi_data.instruments),

                # Note statistics
                'total_notes': sum(len(inst.notes) for inst in midi_data.instruments),
                'note_density': self._calculate_note_density(midi_data),

                # Pitch statistics
                'pitch_range': self._calculate_pitch_range(midi_data),
                'avg_pitch': self._calculate_avg_pitch(midi_data),
                'pitch_std': self._calculate_pitch_std(midi_data),

                # Rhythm features
                'avg_note_duration': self._calculate_avg_note_duration(midi_data),
                'note_duration_std': self._calculate_note_duration_std(midi_data),

                # Velocity features
                'avg_velocity': self._calculate_avg_velocity(midi_data),
                'velocity_std': self._calculate_velocity_std(midi_data),

                # Time signature
                'time_signatures': len(midi_data.time_signature_changes),

                # Key signature
                'key_signatures': len(midi_data.key_signature_changes),
                'key': self._get_key(midi_data),
                'mode': self._get_mode(midi_data),
            }

            return features

        except Exception as e:
            print(f"Error processing {midi_path}: {e}")
            return None

    def _get_average_tempo(self, midi_data: pretty_midi.PrettyMIDI) -> float:
        """Calculate average tempo"""
        tempo_change_times, tempos = midi_data.get_tempo_changes()
        if len(tempos) == 0:
            return 120.0  # Default tempo
        return float(np.mean(tempos))

    def _calculate_note_density(self, midi_data: pretty_midi.PrettyMIDI) -> float:
        """Calculate notes per second"""
        total_time = midi_data.get_end_time()
        if total_time == 0:
            return 0.0
        total_notes = sum(len(inst.notes) for inst in midi_data.instruments)
        return total_notes / total_time

    def _calculate_pitch_range(self, midi_data: pretty_midi.PrettyMIDI) -> int:
        """Calculate pitch range (max - min pitch)"""
        all_pitches = []
        for instrument in midi_data.instruments:
            if not instrument.is_drum:
                all_pitches.extend([note.pitch for note in instrument.notes])

        if not all_pitches:
            return 0

        return max(all_pitches) - min(all_pitches)

    def _calculate_avg_pitch(self, midi_data: pretty_midi.PrettyMIDI) -> float:
        """Calculate average pitch"""
        all_pitches = []
        for instrument in midi_data.instruments:
            if not instrument.is_drum:
                all_pitches.extend([note.pitch for note in instrument.notes])

        if not all_pitches:
            return 0.0

        return float(np.mean(all_pitches))

    def _calculate_pitch_std(self, midi_data: pretty_midi.PrettyMIDI) -> float:
        """Calculate pitch standard deviation"""
        all_pitches = []
        for instrument in midi_data.instruments:
            if not instrument.is_drum:
                all_pitches.extend([note.pitch for note in instrument.notes])

        if not all_pitches:
            return 0.0

        return float(np.std(all_pitches))

    def _calculate_avg_note_duration(self, midi_data: pretty_midi.PrettyMIDI) -> float:
        """Calculate average note duration"""
        durations = []
        for instrument in midi_data.instruments:
            for note in instrument.notes:
                durations.append(note.end - note.start)

        if not durations:
            return 0.0

        return float(np.mean(durations))

    def _calculate_note_duration_std(self, midi_data: pretty_midi.PrettyMIDI) -> float:
        """Calculate note duration standard deviation"""
        durations = []
        for instrument in midi_data.instruments:
            for note in instrument.notes:
                durations.append(note.end - note.start)

        if not durations:
            return 0.0

        return float(np.std(durations))

    def _calculate_avg_velocity(self, midi_data: pretty_midi.PrettyMIDI) -> float:
        """Calculate average note velocity"""
        velocities = []
        for instrument in midi_data.instruments:
            velocities.extend([note.velocity for note in instrument.notes])

        if not velocities:
            return 0.0

        return float(np.mean(velocities))

    def _calculate_velocity_std(self, midi_data: pretty_midi.PrettyMIDI) -> float:
        """Calculate velocity standard deviation"""
        velocities = []
        for instrument in midi_data.instruments:
            velocities.extend([note.velocity for note in instrument.notes])

        if not velocities:
            return 0.0

        return float(np.std(velocities))

    def _get_key(self, midi_data: pretty_midi.PrettyMIDI) -> int:
        """
        Get the key of the MIDI file (0-11 for C, C#, D, ..., B)
        Returns the first key signature or estimates from pitch distribution
        """
        if midi_data.key_signature_changes:
            # Get first key signature (0-11 for C, C#, D, ..., B)
            return midi_data.key_signature_changes[0].key_number % 12

        # Estimate key from pitch distribution (Krumhansl-Schmuckler algorithm simplified)
        all_pitches = []
        for instrument in midi_data.instruments:
            if not instrument.is_drum:
                all_pitches.extend([note.pitch % 12 for note in instrument.notes])

        if not all_pitches:
            return 0  # Default to C

        # Count pitch class occurrences
        pitch_counts = np.zeros(12)
        for pitch in all_pitches:
            pitch_counts[pitch] += 1

        # Normalize
        if pitch_counts.sum() > 0:
            pitch_counts = pitch_counts / pitch_counts.sum()

        # Major key profiles (simplified Krumhansl-Kessler)
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        major_profile = major_profile / major_profile.sum()

        # Find best correlation
        best_key = 0
        best_corr = -1
        for key in range(12):
            shifted_profile = np.roll(major_profile, key)
            corr = np.corrcoef(pitch_counts, shifted_profile)[0, 1]
            if corr > best_corr:
                best_corr = corr
                best_key = key

        return best_key

    def _get_mode(self, midi_data: pretty_midi.PrettyMIDI) -> int:
        """
        Get the mode of the MIDI file (0=minor, 1=major)
        Estimates from pitch distribution and intervals
        """
        all_pitches = []
        for instrument in midi_data.instruments:
            if not instrument.is_drum:
                all_pitches.extend([note.pitch % 12 for note in instrument.notes])

        if not all_pitches:
            return 1  # Default to major

        # Count pitch class occurrences
        pitch_counts = np.zeros(12)
        for pitch in all_pitches:
            pitch_counts[pitch] += 1

        if pitch_counts.sum() == 0:
            return 1

        # Normalize
        pitch_counts = pitch_counts / pitch_counts.sum()

        # Major and minor profiles (simplified Krumhansl-Kessler)
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

        major_profile = major_profile / major_profile.sum()
        minor_profile = minor_profile / minor_profile.sum()

        # Find best match for each profile across all keys
        best_major_corr = -1
        best_minor_corr = -1

        for key in range(12):
            major_shifted = np.roll(major_profile, key)
            minor_shifted = np.roll(minor_profile, key)

            major_corr = np.corrcoef(pitch_counts, major_shifted)[0, 1]
            minor_corr = np.corrcoef(pitch_counts, minor_shifted)[0, 1]

            best_major_corr = max(best_major_corr, major_corr)
            best_minor_corr = max(best_minor_corr, minor_corr)

        # Return 1 for major, 0 for minor
        return 1 if best_major_corr > best_minor_corr else 0


def extract_midi_features(midi_path: Path, fs: int = 100) -> Optional[Dict]:
    """
    Convenience function to extract features from a MIDI file

    Args:
        midi_path: Path to MIDI file
        fs: Sampling frequency for piano roll

    Returns:
        Dictionary of features or None if extraction fails
    """
    extractor = MIDIFeatureExtractor(fs=fs)
    return extractor.extract_features(midi_path)


def create_pianoroll(
    midi_path: Path,
    fs: int = 100,
    pitch_range: Tuple[int, int] = (21, 109)
) -> Optional[np.ndarray]:
    """
    Create a piano roll representation of a MIDI file

    Args:
        midi_path: Path to MIDI file
        fs: Sampling frequency (frames per second)
        pitch_range: Tuple of (min_pitch, max_pitch) for the piano roll

    Returns:
        Piano roll array of shape (num_pitches, num_timesteps) or None if fails
    """
    try:
        midi_data = pretty_midi.PrettyMIDI(str(midi_path))

        # Get piano roll
        piano_roll = midi_data.get_piano_roll(fs=fs)

        # Crop to specified pitch range
        min_pitch, max_pitch = pitch_range
        piano_roll = piano_roll[min_pitch:max_pitch, :]

        return piano_roll

    except Exception as e:
        print(f"Error creating piano roll for {midi_path}: {e}")
        return None


def extract_sequence_features(
    midi_path: Path,
    max_length: int = 512
) -> Optional[Dict]:
    """
    Extract sequential features suitable for transformer models

    Args:
        midi_path: Path to MIDI file
        max_length: Maximum sequence length

    Returns:
        Dictionary with sequence features or None if fails
    """
    try:
        midi_data = pretty_midi.PrettyMIDI(str(midi_path))

        # Collect all notes with timing
        all_notes = []
        for instrument in midi_data.instruments:
            for note in instrument.notes:
                all_notes.append({
                    'pitch': note.pitch,
                    'velocity': note.velocity,
                    'start': note.start,
                    'end': note.end,
                    'duration': note.end - note.start,
                    'is_drum': instrument.is_drum
                })

        # Sort by start time
        all_notes.sort(key=lambda x: x['start'])

        # Truncate if too long
        if len(all_notes) > max_length:
            all_notes = all_notes[:max_length]

        # Convert to arrays
        pitches = np.array([n['pitch'] for n in all_notes])
        velocities = np.array([n['velocity'] for n in all_notes])
        durations = np.array([n['duration'] for n in all_notes])

        return {
            'pitches': pitches,
            'velocities': velocities,
            'durations': durations,
            'num_notes': len(all_notes),
        }

    except Exception as e:
        print(f"Error extracting sequence features for {midi_path}: {e}")
        return None
