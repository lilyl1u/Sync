"""
MIDI Utilities for Drum Pattern Generator
Handles MIDI conversion, tempo, swing, and humanization
"""

import numpy as np
from typing import List, Optional, Tuple
from dataclasses import dataclass
import random

try:
    import mido
    from mido import MidiFile, MidiTrack, Message, MetaMessage
    MIDO_AVAILABLE = True
except ImportError:
    MIDO_AVAILABLE = False
    print("Warning: mido not installed. MIDI export functionality will be limited.")

from .drum_pattern_generator import DrumPattern, DrumType, DrumHit


@dataclass
class MIDIConfig:
    """Configuration for MIDI export"""
    tempo: int = 120  # BPM
    ticks_per_beat: int = 480
    channel: int = 9  # MIDI channel 10 (index 9) is drums
    swing_amount: float = 0.0  # 0.0 = no swing, 0.5 = max swing
    humanize_timing: float = 0.0  # Amount of timing variation (0-1)
    humanize_velocity: float = 0.0  # Amount of velocity variation (0-1)


class DrumMIDIConverter:
    """Convert drum patterns to/from MIDI"""

    def __init__(self, config: Optional[MIDIConfig] = None):
        """Initialize converter with configuration"""
        self.config = config or MIDIConfig()

    def pattern_to_midi(self, pattern: DrumPattern, output_file: str,
                       bars: int = 1) -> bool:
        """
        Convert drum pattern to MIDI file

        Args:
            pattern: Drum pattern to convert
            output_file: Output MIDI file path
            bars: Number of times to repeat the pattern

        Returns:
            True if successful
        """
        if not MIDO_AVAILABLE:
            print("Error: mido library not available")
            return False

        # Create MIDI file
        mid = MidiFile(ticks_per_beat=self.config.ticks_per_beat)
        track = MidiTrack()
        mid.tracks.append(track)

        # Add tempo
        tempo_microseconds = mido.bpm2tempo(self.config.tempo)
        track.append(MetaMessage('set_tempo', tempo=tempo_microseconds))

        # Add track name
        track.append(MetaMessage('track_name', name='Drums'))

        # Calculate ticks per step
        # Assuming 16 steps = 1 bar = 4 beats in 4/4 time
        beats_per_bar = 4
        steps_per_beat = pattern.steps / beats_per_bar
        ticks_per_step = self.config.ticks_per_beat / steps_per_beat

        # Generate MIDI events for each bar
        for bar in range(bars):
            bar_offset = bar * pattern.steps

            # Get all hits and sort by step
            hits = pattern.get_hits()
            hits_by_step = {}
            for hit in hits:
                if hit.step not in hits_by_step:
                    hits_by_step[hit.step] = []
                hits_by_step[hit.step].append(hit)

            # Create note on/off events
            events = []

            for step in range(pattern.steps):
                if step in hits_by_step:
                    # Calculate timing
                    tick_time = self._calculate_tick_time(
                        step + bar_offset,
                        ticks_per_step
                    )

                    for hit in hits_by_step[step]:
                        note = DrumType.get_midi_note(hit.drum_type)
                        velocity = self._apply_humanization_velocity(hit.velocity)

                        # Note on
                        events.append((tick_time, 'on', note, velocity))

                        # Note off (short duration for drums)
                        note_off_time = tick_time + int(ticks_per_step * 0.1)
                        events.append((note_off_time, 'off', note, 0))

            # Sort events by time
            events.sort(key=lambda x: x[0])

            # Convert to MIDI messages with delta times
            current_tick = bar * pattern.steps * ticks_per_step
            for tick_time, event_type, note, velocity in events:
                delta = int(tick_time - current_tick)
                current_tick = tick_time

                if event_type == 'on':
                    track.append(Message('note_on',
                                       channel=self.config.channel,
                                       note=note,
                                       velocity=velocity,
                                       time=delta))
                else:
                    track.append(Message('note_off',
                                       channel=self.config.channel,
                                       note=note,
                                       velocity=velocity,
                                       time=delta))

        # Add end of track
        track.append(MetaMessage('end_of_track', time=0))

        # Save MIDI file
        try:
            mid.save(output_file)
            print(f"MIDI file saved: {output_file}")
            return True
        except Exception as e:
            print(f"Error saving MIDI file: {e}")
            return False

    def midi_to_pattern(self, midi_file: str, steps: int = 16) -> Optional[DrumPattern]:
        """
        Convert MIDI file to drum pattern

        Args:
            midi_file: Input MIDI file path
            steps: Number of steps in the pattern

        Returns:
            Drum pattern or None if failed
        """
        if not MIDO_AVAILABLE:
            print("Error: mido library not available")
            return None

        try:
            mid = MidiFile(midi_file)

            # Find drum track (channel 9)
            drum_notes = []
            current_tick = 0

            for track in mid.tracks:
                track_tick = 0
                for msg in track:
                    track_tick += msg.time

                    if msg.type == 'note_on' and msg.channel == 9 and msg.velocity > 0:
                        drum_notes.append((track_tick, msg.note, msg.velocity))

            if not drum_notes:
                print("No drum notes found in MIDI file")
                return None

            # Calculate ticks per step
            # Assuming first bar is the pattern
            max_tick = max(note[0] for note in drum_notes)
            ticks_per_step = max_tick / steps

            # Create pattern
            pattern = DrumPattern(steps=steps)

            for tick, note, velocity in drum_notes:
                # Find corresponding step
                step = int(tick / ticks_per_step)
                if step >= steps:
                    continue

                # Map MIDI note to drum type
                drum_type = self._midi_note_to_drum_type(note)
                if drum_type is not None:
                    pattern.add_hit(step, drum_type, velocity)

            return pattern

        except Exception as e:
            print(f"Error reading MIDI file: {e}")
            return None

    def _calculate_tick_time(self, step: int, ticks_per_step: float) -> int:
        """
        Calculate tick time with swing applied

        Args:
            step: Step number
            ticks_per_step: Ticks per step

        Returns:
            Adjusted tick time
        """
        base_tick = step * ticks_per_step

        # Apply swing to offbeat steps
        if self.config.swing_amount > 0 and step % 2 == 1:
            swing_offset = ticks_per_step * self.config.swing_amount * 0.5
            base_tick += swing_offset

        # Apply humanization (timing variation)
        if self.config.humanize_timing > 0:
            max_variation = ticks_per_step * self.config.humanize_timing * 0.1
            variation = random.uniform(-max_variation, max_variation)
            base_tick += variation

        return int(base_tick)

    def _apply_humanization_velocity(self, velocity: int) -> int:
        """
        Apply humanization to velocity

        Args:
            velocity: Original velocity

        Returns:
            Humanized velocity
        """
        if self.config.humanize_velocity > 0:
            max_variation = velocity * self.config.humanize_velocity * 0.3
            variation = random.uniform(-max_variation, max_variation)
            velocity = int(velocity + variation)

        return max(1, min(127, velocity))

    def _midi_note_to_drum_type(self, note: int) -> Optional[DrumType]:
        """
        Map MIDI note number to drum type

        Args:
            note: MIDI note number

        Returns:
            DrumType or None if not mapped
        """
        reverse_mapping = {
            36: DrumType.KICK,
            38: DrumType.SNARE,
            39: DrumType.CLAP,
            42: DrumType.HIHAT_CLOSED,
            46: DrumType.HIHAT_OPEN,
            49: DrumType.CRASH,
            51: DrumType.RIDE,
            50: DrumType.TOM_HIGH,
            47: DrumType.TOM_MID,
            45: DrumType.TOM_LOW,
            37: DrumType.PERCUSSION,
        }
        return reverse_mapping.get(note)


class PatternModifier:
    """Modify drum patterns with tempo, swing, and humanization"""

    @staticmethod
    def apply_swing(pattern: DrumPattern, swing_amount: float = 0.5) -> DrumPattern:
        """
        Apply swing to pattern by delaying offbeat hits

        Args:
            pattern: Original pattern
            swing_amount: Amount of swing (0-1)

        Returns:
            Pattern with swing (note: grid positions stay same,
            actual swing is applied during MIDI export)
        """
        # Note: True swing is applied during MIDI export
        # This function can create a "quantized swing" effect
        # by shifting offbeat hits

        if swing_amount == 0:
            return pattern

        swung = DrumPattern(steps=pattern.steps)

        for hit in pattern.get_hits():
            # Keep on-beat hits in place
            if hit.step % 2 == 0:
                swung.add_hit(hit.step, hit.drum_type, hit.velocity)
            else:
                # Delay offbeat hits slightly (shift to next grid position)
                # Only if swing is significant and won't go out of bounds
                if swing_amount > 0.3 and hit.step + 1 < pattern.steps:
                    # Reduce velocity slightly for swung notes
                    new_velocity = int(hit.velocity * 0.9)
                    swung.add_hit(hit.step + 1, hit.drum_type, new_velocity)
                else:
                    swung.add_hit(hit.step, hit.drum_type, hit.velocity)

        return swung

    @staticmethod
    def humanize(pattern: DrumPattern, timing_variation: float = 0.1,
                velocity_variation: float = 0.2) -> DrumPattern:
        """
        Humanize pattern by adding subtle variations

        Args:
            pattern: Original pattern
            timing_variation: Amount of timing variation (not applied to grid)
            velocity_variation: Amount of velocity variation (0-1)

        Returns:
            Humanized pattern
        """
        humanized = DrumPattern(steps=pattern.steps)

        for hit in pattern.get_hits():
            # Vary velocity
            if velocity_variation > 0:
                max_var = int(hit.velocity * velocity_variation)
                variation = random.randint(-max_var, max_var)
                new_velocity = max(20, min(127, hit.velocity + variation))
            else:
                new_velocity = hit.velocity

            # Note: Timing variation is applied during MIDI export
            humanized.add_hit(hit.step, hit.drum_type, new_velocity)

        return humanized

    @staticmethod
    def change_tempo(original_tempo: int, new_tempo: int,
                    original_pattern: DrumPattern) -> DrumPattern:
        """
        Adjust pattern for tempo change (stretches/compresses pattern)

        Args:
            original_tempo: Original tempo in BPM
            new_tempo: New tempo in BPM
            original_pattern: Pattern at original tempo

        Returns:
            Adjusted pattern (note: this doesn't change the grid,
            tempo is applied during MIDI export)
        """
        # Tempo change is handled during MIDI export
        # This returns the same pattern
        # You could implement pattern stretching/compression here if needed
        return original_pattern


class PatternDataset:
    """Dataset utilities for training ML models"""

    @staticmethod
    def create_training_patterns(num_patterns: int = 100) -> List[DrumPattern]:
        """
        Create a dataset of training patterns

        Args:
            num_patterns: Number of patterns to generate

        Returns:
            List of drum patterns
        """
        from .drum_pattern_generator import EDMPatternLibrary

        patterns = []

        for i in range(num_patterns):
            # Mix different pattern types
            pattern_type = i % 5

            if pattern_type == 0:
                # Four-on-the-floor
                kick = EDMPatternLibrary.four_on_floor(16)
                hihat = EDMPatternLibrary.syncopated_hihat(16)
                snare = EDMPatternLibrary.snare_clap_pattern(16)
                pattern = EDMPatternLibrary.combine_patterns(kick, hihat, snare)

            elif pattern_type == 1:
                # Breakbeat
                pattern = EDMPatternLibrary.breakbeat(16)

            elif pattern_type == 2:
                # Build-up
                pattern = EDMPatternLibrary.build_up_pattern(16)

            elif pattern_type == 3:
                # Drop
                pattern = EDMPatternLibrary.drop_pattern(16)

            else:
                # Random combination
                kick = EDMPatternLibrary.four_on_floor(16)
                hihat = EDMPatternLibrary.syncopated_hihat(16, density=random.uniform(0.5, 0.9))
                pattern = EDMPatternLibrary.combine_patterns(kick, hihat)

            patterns.append(pattern)

        return patterns

    @staticmethod
    def augment_pattern(pattern: DrumPattern) -> List[DrumPattern]:
        """
        Data augmentation: create variations of a pattern

        Args:
            pattern: Original pattern

        Returns:
            List of augmented patterns
        """
        from .drum_pattern_generator import PatternVariation

        augmented = [pattern]

        # Velocity variations
        for _ in range(2):
            varied = PatternVariation.velocity_variation(pattern,
                                                        variation_amount=random.uniform(0.1, 0.3))
            augmented.append(varied)

        # Shifted versions
        for shift in [-2, -1, 1, 2]:
            shifted = PatternVariation.shift_pattern(pattern, shift)
            augmented.append(shifted)

        # With fills
        with_fills = PatternVariation.add_fills(pattern, fill_probability=0.4)
        augmented.append(with_fills)

        return augmented

    @staticmethod
    def patterns_to_arrays(patterns: List[DrumPattern]) -> Tuple[np.ndarray, np.ndarray]:
        """
        Convert patterns to numpy arrays for training

        Args:
            patterns: List of patterns

        Returns:
            Tuple of (binary_arrays, velocity_arrays)
        """
        binary_arrays = []
        velocity_arrays = []

        for pattern in patterns:
            binary_arrays.append(pattern.to_binary())
            velocity_arrays.append(pattern.to_normalized())

        return np.array(binary_arrays), np.array(velocity_arrays)


if __name__ == "__main__":
    from .drum_pattern_generator import EDMPatternLibrary

    print("MIDI Utilities Example\n")
    print("=" * 60)

    # Create a pattern
    kick = EDMPatternLibrary.four_on_floor(16)
    hihat = EDMPatternLibrary.syncopated_hihat(16)
    snare = EDMPatternLibrary.snare_clap_pattern(16)
    pattern = EDMPatternLibrary.combine_patterns(kick, hihat, snare)

    print("\nOriginal pattern:")
    pattern.print_pattern()

    # Export to MIDI with different configurations
    if MIDO_AVAILABLE:
        print("\n1. Exporting to MIDI (straight timing)...")
        config1 = MIDIConfig(tempo=128)
        converter1 = DrumMIDIConverter(config1)
        converter1.pattern_to_midi(pattern, "/tmp/drums_straight.mid", bars=4)

        print("\n2. Exporting to MIDI (with swing)...")
        config2 = MIDIConfig(tempo=128, swing_amount=0.3)
        converter2 = DrumMIDIConverter(config2)
        converter2.pattern_to_midi(pattern, "/tmp/drums_swing.mid", bars=4)

        print("\n3. Exporting to MIDI (humanized)...")
        config3 = MIDIConfig(tempo=128, humanize_timing=0.2, humanize_velocity=0.15)
        converter3 = DrumMIDIConverter(config3)
        converter3.pattern_to_midi(pattern, "/tmp/drums_humanized.mid", bars=4)

        print("\n4. Exporting to MIDI (swing + humanized)...")
        config4 = MIDIConfig(tempo=128, swing_amount=0.25,
                           humanize_timing=0.15, humanize_velocity=0.2)
        converter4 = DrumMIDIConverter(config4)
        converter4.pattern_to_midi(pattern, "/tmp/drums_groovy.mid", bars=4)
    else:
        print("\nMIDO not available - skipping MIDI export examples")

    # Pattern modifications
    print("\n5. Humanized pattern:")
    humanized = PatternModifier.humanize(pattern, velocity_variation=0.3)
    print(f"Original hits: {len(pattern.get_hits())}")
    print(f"Humanized hits: {len(humanized.get_hits())}")

    # Create training dataset
    print("\n6. Creating training dataset...")
    dataset = PatternDataset.create_training_patterns(num_patterns=20)
    print(f"Created {len(dataset)} training patterns")

    # Data augmentation
    print("\n7. Data augmentation:")
    augmented = PatternDataset.augment_pattern(pattern)
    print(f"Augmented from 1 pattern to {len(augmented)} patterns")

    print("\n" + "=" * 60)
    print("MIDI utilities examples completed!")
