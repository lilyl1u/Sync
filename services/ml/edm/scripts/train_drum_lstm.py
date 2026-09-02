#!/usr/bin/env python3
"""
Train LSTM model for drum pattern generation
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
import torch
import argparse
from pathlib import Path

from src.models.drum_pattern_generator import (
    DrumPattern, LSTMDrumGenerator
)
from src.models.drum_midi_utils import (
    PatternDataset, DrumMIDIConverter, MIDIConfig
)


def train_lstm_model(
    num_training_patterns: int = 200,
    augment: bool = True,
    epochs: int = 200,
    hidden_size: int = 128,
    num_layers: int = 2,
    lr: float = 0.001,
    save_path: Optional[str] = None
):
    """
    Train LSTM drum pattern generator

    Args:
        num_training_patterns: Number of patterns to generate for training
        augment: Whether to augment the training data
        epochs: Number of training epochs
        hidden_size: LSTM hidden size
        num_layers: Number of LSTM layers
        lr: Learning rate
        save_path: Path to save the model
    """
    print("\n" + "=" * 70)
    print("LSTM Drum Pattern Generator Training")
    print("=" * 70)

    # Create training dataset
    print(f"\n1. Creating {num_training_patterns} training patterns...")
    training_patterns = PatternDataset.create_training_patterns(num_training_patterns)

    # Data augmentation
    if augment:
        print("2. Augmenting training data...")
        augmented_patterns = []
        for i, pattern in enumerate(training_patterns):
            if i % 20 == 0:
                print(f"   Augmenting pattern {i}/{len(training_patterns)}...")
            augmented = PatternDataset.augment_pattern(pattern)
            augmented_patterns.extend(augmented)

        all_patterns = training_patterns + augmented_patterns
        print(f"   Total patterns after augmentation: {len(all_patterns)}")
    else:
        all_patterns = training_patterns
        print("2. Skipping data augmentation")

    # Initialize model
    print(f"\n3. Initializing LSTM model...")
    print(f"   Hidden size: {hidden_size}")
    print(f"   Num layers: {num_layers}")
    print(f"   Learning rate: {lr}")

    lstm_gen = LSTMDrumGenerator(
        num_drums=11,
        hidden_size=hidden_size,
        num_layers=num_layers
    )

    # Train model
    print(f"\n4. Training for {epochs} epochs...")
    lstm_gen.train(all_patterns, epochs=epochs, lr=lr)

    # Generate test patterns
    print("\n5. Generating test patterns...")
    test_temperatures = [0.5, 0.8, 1.0, 1.2, 1.5]

    for temp in test_temperatures:
        print(f"\nTemperature {temp}:")
        generated = lstm_gen.generate(steps=16, temperature=temp)
        generated.print_pattern()

    # Save model
    if save_path:
        print(f"\n6. Saving model to {save_path}...")
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        torch.save({
            'model_state_dict': lstm_gen.model.state_dict(),
            'hidden_size': hidden_size,
            'num_layers': num_layers,
            'num_drums': 11
        }, save_path)
        print("   Model saved successfully!")

        # Export some generated patterns to MIDI
        midi_dir = os.path.join(os.path.dirname(save_path), 'generated_midi')
        os.makedirs(midi_dir, exist_ok=True)

        print(f"\n7. Exporting generated patterns to {midi_dir}...")
        converter = DrumMIDIConverter(MIDIConfig(tempo=128, humanize_timing=0.1, humanize_velocity=0.15))

        for i, temp in enumerate([0.8, 1.0, 1.2]):
            pattern = lstm_gen.generate(steps=16, temperature=temp)
            midi_file = os.path.join(midi_dir, f'generated_temp_{temp}.mid')
            converter.pattern_to_midi(pattern, midi_file, bars=4)
            print(f"   ✓ Temperature {temp}: {midi_file}")

    print("\n" + "=" * 70)
    print("Training completed!")
    print("=" * 70)


def load_and_generate(model_path: str, num_patterns: int = 5, temperature: float = 1.0):
    """
    Load trained model and generate patterns

    Args:
        model_path: Path to saved model
        num_patterns: Number of patterns to generate
        temperature: Sampling temperature
    """
    print(f"\nLoading model from {model_path}...")

    # Load model
    checkpoint = torch.load(model_path)

    lstm_gen = LSTMDrumGenerator(
        num_drums=checkpoint['num_drums'],
        hidden_size=checkpoint['hidden_size'],
        num_layers=checkpoint['num_layers']
    )
    lstm_gen.model.load_state_dict(checkpoint['model_state_dict'])

    print(f"Generating {num_patterns} patterns (temperature={temperature})...\n")

    # Generate patterns
    for i in range(num_patterns):
        print(f"\nPattern {i+1}:")
        pattern = lstm_gen.generate(steps=16, temperature=temperature)
        pattern.print_pattern()


if __name__ == "__main__":
    from typing import Optional

    parser = argparse.ArgumentParser(description='Train LSTM drum pattern generator')
    parser.add_argument('--patterns', type=int, default=200,
                       help='Number of training patterns to generate')
    parser.add_argument('--no-augment', action='store_true',
                       help='Disable data augmentation')
    parser.add_argument('--epochs', type=int, default=200,
                       help='Number of training epochs')
    parser.add_argument('--hidden-size', type=int, default=128,
                       help='LSTM hidden size')
    parser.add_argument('--layers', type=int, default=2,
                       help='Number of LSTM layers')
    parser.add_argument('--lr', type=float, default=0.001,
                       help='Learning rate')
    parser.add_argument('--save', type=str, default=None,
                       help='Path to save trained model')
    parser.add_argument('--load', type=str, default=None,
                       help='Load and test existing model')
    parser.add_argument('--generate', type=int, default=5,
                       help='Number of patterns to generate (when loading)')
    parser.add_argument('--temperature', type=float, default=1.0,
                       help='Sampling temperature (when loading)')

    args = parser.parse_args()

    if args.load:
        # Load and generate
        load_and_generate(args.load, args.generate, args.temperature)
    else:
        # Train new model
        if args.save is None:
            args.save = '/tmp/drum_patterns/models/drum_lstm.pt'

        train_lstm_model(
            num_training_patterns=args.patterns,
            augment=not args.no_augment,
            epochs=args.epochs,
            hidden_size=args.hidden_size,
            num_layers=args.layers,
            lr=args.lr,
            save_path=args.save
        )
