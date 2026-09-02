#!/usr/bin/env python3
"""
EDM Drum Pattern Generator - Comprehensive Example
Demonstrates all features: pattern generation, ML models, MIDI export, etc.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
import random
from src.models.drum_pattern_generator import (
    DrumPattern, DrumType, EDMPatternLibrary, PatternVariation,
    MarkovDrumGenerator, LSTMDrumGenerator
)
from src.models.drum_midi_utils import (
    DrumMIDIConverter, MIDIConfig, PatternModifier, PatternDataset
)


def demo_basic_patterns():
    """Demonstrate basic pattern generation"""
    print("\n" + "=" * 70)
    print("DEMO 1: Basic Pattern Generation")
    print("=" * 70)

    # Four-on-the-floor
    print("\n1. Four-on-the-floor kick pattern:")
    kick = EDMPatternLibrary.four_on_floor(steps=16, accent_every=4)
    kick.print_pattern([DrumType.KICK])
    print(f"Total hits: {len(kick.get_hits())}")

    # Syncopated hi-hat
    print("\n2. Syncopated hi-hat pattern:")
    hihat = EDMPatternLibrary.syncopated_hihat(steps=16, density=0.8)
    hihat.print_pattern([DrumType.HIHAT_CLOSED, DrumType.HIHAT_OPEN])

    # Snare/clap
    print("\n3. Snare and clap pattern:")
    snare = EDMPatternLibrary.snare_clap_pattern(steps=16)
    snare.print_pattern([DrumType.SNARE, DrumType.CLAP])

    # Full EDM pattern
    print("\n4. Combined EDM pattern:")
    full_pattern = EDMPatternLibrary.combine_patterns(kick, hihat, snare)
    full_pattern.print_pattern()

    return full_pattern


def demo_edm_patterns():
    """Demonstrate EDM-specific patterns"""
    print("\n" + "=" * 70)
    print("DEMO 2: EDM-Specific Patterns")
    print("=" * 70)

    # Build-up
    print("\n1. Build-up pattern (32 steps):")
    buildup = EDMPatternLibrary.build_up_pattern(steps=32)
    buildup.print_pattern([DrumType.KICK, DrumType.SNARE, DrumType.HIHAT_CLOSED, DrumType.CRASH])

    # Drop
    print("\n2. Drop pattern (high energy):")
    drop = EDMPatternLibrary.drop_pattern(steps=16)
    drop.print_pattern()

    # Breakbeat
    print("\n3. Breakbeat variation:")
    breakbeat = EDMPatternLibrary.breakbeat(steps=16)
    breakbeat.print_pattern()

    return buildup, drop, breakbeat


def demo_pattern_variations():
    """Demonstrate pattern variations"""
    print("\n" + "=" * 70)
    print("DEMO 3: Pattern Variations")
    print("=" * 70)

    # Create base pattern
    base = EDMPatternLibrary.combine_patterns(
        EDMPatternLibrary.four_on_floor(16),
        EDMPatternLibrary.syncopated_hihat(16),
        EDMPatternLibrary.snare_clap_pattern(16)
    )

    print("\n1. Base pattern:")
    base.print_pattern()

    # Add fills
    print("\n2. With fills:")
    with_fills = PatternVariation.add_fills(base, fill_probability=0.5)
    with_fills.print_pattern([DrumType.KICK, DrumType.SNARE, DrumType.TOM_HIGH,
                              DrumType.TOM_MID, DrumType.TOM_LOW])

    # Velocity variation
    print("\n3. Velocity variation:")
    varied = PatternVariation.velocity_variation(base, variation_amount=0.3)
    print("Velocity ranges:")
    for hit in varied.get_hits()[:5]:
        print(f"  {hit}")

    # Shifted pattern
    print("\n4. Shifted pattern (2 steps):")
    shifted = PatternVariation.shift_pattern(base, shift=2)
    shifted.print_pattern()

    # Reversed pattern
    print("\n5. Reversed pattern:")
    reversed_pattern = PatternVariation.reverse_pattern(base)
    reversed_pattern.print_pattern()

    return with_fills, varied


def demo_markov_generation():
    """Demonstrate Markov chain generation"""
    print("\n" + "=" * 70)
    print("DEMO 4: Markov Chain Generation")
    print("=" * 70)

    # Create training data
    print("\n1. Training Markov models...")
    training_patterns = []
    for _ in range(20):
        pattern = EDMPatternLibrary.combine_patterns(
            EDMPatternLibrary.four_on_floor(16),
            EDMPatternLibrary.syncopated_hihat(16, density=random.uniform(0.6, 0.9)),
            EDMPatternLibrary.snare_clap_pattern(16)
        )
        training_patterns.append(pattern)

    # Train separate models for each drum
    kick_markov = MarkovDrumGenerator(order=2)
    hihat_markov = MarkovDrumGenerator(order=2)
    snare_markov = MarkovDrumGenerator(order=1)

    kick_markov.train(training_patterns, DrumType.KICK)
    hihat_markov.train(training_patterns, DrumType.HIHAT_CLOSED)
    snare_markov.train(training_patterns, DrumType.SNARE)

    print(f"Trained on {len(training_patterns)} patterns")

    # Generate new patterns
    print("\n2. Generating new patterns with Markov chains:")
    for i in range(3):
        generated = DrumPattern(steps=16)

        # Generate each drum separately
        kick_seq = kick_markov.generate(16, DrumType.KICK)
        hihat_seq = hihat_markov.generate(16, DrumType.HIHAT_CLOSED)
        snare_seq = snare_markov.generate(16, DrumType.SNARE)

        # Add to pattern
        for step in range(16):
            if kick_seq[step]:
                generated.add_hit(step, DrumType.KICK, 110)
            if hihat_seq[step]:
                generated.add_hit(step, DrumType.HIHAT_CLOSED, random.randint(70, 100))
            if snare_seq[step]:
                generated.add_hit(step, DrumType.SNARE, 105)

        print(f"\nGenerated pattern {i+1}:")
        generated.print_pattern()


def demo_lstm_generation():
    """Demonstrate LSTM generation"""
    print("\n" + "=" * 70)
    print("DEMO 5: LSTM-based Generation")
    print("=" * 70)

    # Create training dataset
    print("\n1. Creating training dataset...")
    training_patterns = PatternDataset.create_training_patterns(num_patterns=50)

    # Augment data
    print("2. Augmenting training data...")
    augmented_patterns = []
    for pattern in training_patterns[:10]:
        augmented_patterns.extend(PatternDataset.augment_pattern(pattern))

    all_patterns = training_patterns + augmented_patterns
    print(f"Total training patterns: {len(all_patterns)}")

    # Train LSTM model
    print("\n3. Training LSTM model...")
    lstm_gen = LSTMDrumGenerator(num_drums=11, hidden_size=64, num_layers=2)

    # Use smaller subset for quick demo
    lstm_gen.train(all_patterns[:30], epochs=50, lr=0.001)

    # Generate patterns
    print("\n4. Generating patterns with LSTM:")
    for i in range(3):
        temperature = 0.8 if i == 0 else 1.0 if i == 1 else 1.2
        print(f"\nGenerated pattern {i+1} (temperature={temperature}):")

        generated = lstm_gen.generate(steps=16, temperature=temperature)
        generated.print_pattern()


def demo_midi_export():
    """Demonstrate MIDI export"""
    print("\n" + "=" * 70)
    print("DEMO 6: MIDI Export")
    print("=" * 70)

    # Create pattern
    pattern = EDMPatternLibrary.combine_patterns(
        EDMPatternLibrary.four_on_floor(16),
        EDMPatternLibrary.syncopated_hihat(16),
        EDMPatternLibrary.snare_clap_pattern(16)
    )

    print("\nExporting pattern to MIDI files...")

    output_dir = "/tmp/drum_patterns"
    os.makedirs(output_dir, exist_ok=True)

    # Export with different configurations
    configs = [
        ("straight", MIDIConfig(tempo=128)),
        ("swing", MIDIConfig(tempo=128, swing_amount=0.3)),
        ("humanized", MIDIConfig(tempo=128, humanize_timing=0.15, humanize_velocity=0.2)),
        ("groovy", MIDIConfig(tempo=128, swing_amount=0.25, humanize_timing=0.1, humanize_velocity=0.15)),
    ]

    for name, config in configs:
        converter = DrumMIDIConverter(config)
        output_file = f"{output_dir}/drums_{name}.mid"
        success = converter.pattern_to_midi(pattern, output_file, bars=4)
        if success:
            print(f"  ✓ {name}: {output_file}")

    # Different patterns
    print("\nExporting different EDM patterns...")
    patterns_to_export = [
        ("buildup", EDMPatternLibrary.build_up_pattern(32)),
        ("drop", EDMPatternLibrary.drop_pattern(16)),
        ("breakbeat", EDMPatternLibrary.breakbeat(16)),
    ]

    for name, pattern in patterns_to_export:
        converter = DrumMIDIConverter(MIDIConfig(tempo=128))
        output_file = f"{output_dir}/drums_{name}.mid"
        success = converter.pattern_to_midi(pattern, output_file, bars=4)
        if success:
            print(f"  ✓ {name}: {output_file}")


def demo_complete_workflow():
    """Demonstrate complete workflow: generate, modify, and export"""
    print("\n" + "=" * 70)
    print("DEMO 7: Complete Workflow - EDM Track Structure")
    print("=" * 70)

    output_dir = "/tmp/drum_patterns"
    os.makedirs(output_dir, exist_ok=True)

    # Create a simple EDM track structure
    print("\n1. Creating EDM track structure...")

    # Intro (minimal)
    intro = EDMPatternLibrary.combine_patterns(
        EDMPatternLibrary.four_on_floor(16),
        EDMPatternLibrary.syncopated_hihat(16, density=0.5)
    )
    print("\nIntro pattern:")
    intro.print_pattern()

    # Verse (add snare)
    verse = EDMPatternLibrary.combine_patterns(
        EDMPatternLibrary.four_on_floor(16),
        EDMPatternLibrary.syncopated_hihat(16, density=0.7),
        EDMPatternLibrary.snare_clap_pattern(16)
    )
    print("\nVerse pattern:")
    verse.print_pattern()

    # Build-up
    buildup = EDMPatternLibrary.build_up_pattern(32)
    print("\nBuild-up pattern:")
    buildup.print_pattern([DrumType.KICK, DrumType.SNARE, DrumType.HIHAT_CLOSED, DrumType.CRASH])

    # Drop (maximum energy)
    drop = EDMPatternLibrary.drop_pattern(16)
    drop = PatternVariation.add_fills(drop, fill_probability=0.3)
    print("\nDrop pattern:")
    drop.print_pattern()

    # Export all sections
    print("\n2. Exporting all sections to MIDI...")
    config = MIDIConfig(tempo=128, humanize_timing=0.1, humanize_velocity=0.15)
    converter = DrumMIDIConverter(config)

    sections = [
        ("intro", intro, 8),
        ("verse", verse, 8),
        ("buildup", buildup, 4),
        ("drop", drop, 16),
    ]

    for name, pattern, bars in sections:
        output_file = f"{output_dir}/section_{name}.mid"
        converter.pattern_to_midi(pattern, output_file, bars=bars)
        print(f"  ✓ {name}: {output_file} ({bars} bars)")


def demo_pattern_analysis():
    """Demonstrate pattern analysis"""
    print("\n" + "=" * 70)
    print("DEMO 8: Pattern Analysis")
    print("=" * 70)

    patterns = [
        ("Four-on-floor", EDMPatternLibrary.four_on_floor(16)),
        ("Breakbeat", EDMPatternLibrary.breakbeat(16)),
        ("Build-up", EDMPatternLibrary.build_up_pattern(16)),
        ("Drop", EDMPatternLibrary.drop_pattern(16)),
    ]

    for name, pattern in patterns:
        hits = pattern.get_hits()

        # Calculate statistics
        total_hits = len(hits)
        drum_counts = {}
        velocity_sum = {}

        for hit in hits:
            drum_name = DrumType(hit.drum_type).name
            drum_counts[drum_name] = drum_counts.get(drum_name, 0) + 1
            velocity_sum[drum_name] = velocity_sum.get(drum_name, 0) + hit.velocity

        print(f"\n{name}:")
        print(f"  Total hits: {total_hits}")
        print(f"  Density: {total_hits / pattern.steps:.2f} hits/step")
        print(f"  Drums used:")

        for drum_name in sorted(drum_counts.keys()):
            count = drum_counts[drum_name]
            avg_vel = velocity_sum[drum_name] / count
            print(f"    - {drum_name}: {count} hits, avg velocity: {avg_vel:.1f}")


def main():
    """Run all demonstrations"""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 68 + "║")
    print("║" + "  EDM DRUM PATTERN GENERATOR - COMPREHENSIVE DEMONSTRATION".center(68) + "║")
    print("║" + " " * 68 + "║")
    print("╚" + "=" * 68 + "╝")

    demos = [
        ("Basic Patterns", demo_basic_patterns),
        ("EDM-Specific Patterns", demo_edm_patterns),
        ("Pattern Variations", demo_pattern_variations),
        ("Markov Chain Generation", demo_markov_generation),
        ("LSTM-based Generation", demo_lstm_generation),
        ("MIDI Export", demo_midi_export),
        ("Complete Workflow", demo_complete_workflow),
        ("Pattern Analysis", demo_pattern_analysis),
    ]

    print("\nAvailable demonstrations:")
    for i, (name, _) in enumerate(demos, 1):
        print(f"  {i}. {name}")

    print("\nOptions:")
    print("  - Press Enter to run all demos")
    print("  - Enter demo number (1-8) to run specific demo")
    print("  - Enter 'q' to quit")

    choice = input("\nYour choice: ").strip()

    if choice.lower() == 'q':
        print("Goodbye!")
        return

    if choice == '':
        # Run all demos
        for name, demo_func in demos:
            try:
                demo_func()
            except Exception as e:
                print(f"\nError in {name}: {e}")
                import traceback
                traceback.print_exc()
    elif choice.isdigit() and 1 <= int(choice) <= len(demos):
        # Run specific demo
        name, demo_func = demos[int(choice) - 1]
        try:
            demo_func()
        except Exception as e:
            print(f"\nError in {name}: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("Invalid choice!")
        return

    print("\n" + "=" * 70)
    print("DEMONSTRATION COMPLETE")
    print("=" * 70)
    print("\nGenerated MIDI files are saved in: /tmp/drum_patterns/")
    print("\nYou can import these MIDI files into your DAW for further editing.")
    print("\nKey features demonstrated:")
    print("  ✓ Grid-based pattern representation (16/32 steps)")
    print("  ✓ Multiple drum types (kick, snare, hi-hat, etc.)")
    print("  ✓ Velocity and accent patterns")
    print("  ✓ Markov chain generation")
    print("  ✓ LSTM/RNN generation")
    print("  ✓ EDM-specific patterns (four-on-floor, build-ups, drops)")
    print("  ✓ Pattern variations and fills")
    print("  ✓ MIDI export with swing and humanization")
    print("  ✓ Data augmentation for training")
    print("\n")


if __name__ == "__main__":
    # Set random seed for reproducibility
    random.seed(42)
    np.random.seed(42)

    main()
