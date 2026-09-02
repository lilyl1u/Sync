"""
EDM Drum Pattern Generator using Machine Learning
Supports grid-based pattern representation, Markov chains, and RNN/LSTM models
"""

import numpy as np
import torch
import torch.nn as nn
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import IntEnum
import random


class DrumType(IntEnum):
    """Drum instrument types for EDM"""
    KICK = 0
    SNARE = 1
    CLAP = 2
    HIHAT_CLOSED = 3
    HIHAT_OPEN = 4
    CRASH = 5
    RIDE = 6
    TOM_HIGH = 7
    TOM_MID = 8
    TOM_LOW = 9
    PERCUSSION = 10

    @classmethod
    def get_midi_note(cls, drum_type: 'DrumType') -> int:
        """Get General MIDI drum note number"""
        mapping = {
            cls.KICK: 36,           # C1
            cls.SNARE: 38,          # D1
            cls.CLAP: 39,           # D#1
            cls.HIHAT_CLOSED: 42,   # F#1
            cls.HIHAT_OPEN: 46,     # A#1
            cls.CRASH: 49,          # C#2
            cls.RIDE: 51,           # D#2
            cls.TOM_HIGH: 50,       # D2
            cls.TOM_MID: 47,        # B1
            cls.TOM_LOW: 45,        # A1
            cls.PERCUSSION: 37,     # C#1 (side stick)
        }
        return mapping.get(drum_type, 36)


@dataclass
class DrumHit:
    """Represents a single drum hit"""
    step: int
    drum_type: DrumType
    velocity: int  # 0-127

    def __repr__(self):
        return f"DrumHit(step={self.step}, drum={DrumType(self.drum_type).name}, vel={self.velocity})"


class DrumPattern:
    """Grid-based drum pattern representation"""

    def __init__(self, steps: int = 16, num_drums: int = 11):
        """
        Initialize drum pattern

        Args:
            steps: Number of steps in the pattern (16 or 32 typical)
            num_drums: Number of different drum types
        """
        self.steps = steps
        self.num_drums = num_drums
        # Grid: [steps, num_drums], values are velocities (0-127)
        self.grid = np.zeros((steps, num_drums), dtype=np.int16)

    def add_hit(self, step: int, drum_type: DrumType, velocity: int = 100):
        """Add a drum hit to the pattern"""
        if 0 <= step < self.steps:
            self.grid[step, drum_type] = min(max(velocity, 0), 127)

    def remove_hit(self, step: int, drum_type: DrumType):
        """Remove a drum hit"""
        if 0 <= step < self.steps:
            self.grid[step, drum_type] = 0

    def get_hits(self) -> List[DrumHit]:
        """Get all drum hits in the pattern"""
        hits = []
        for step in range(self.steps):
            for drum_type in range(self.num_drums):
                velocity = self.grid[step, drum_type]
                if velocity > 0:
                    hits.append(DrumHit(step, DrumType(drum_type), velocity))
        return hits

    def to_binary(self) -> np.ndarray:
        """Convert to binary representation (hit/no hit)"""
        return (self.grid > 0).astype(np.float32)

    def to_normalized(self) -> np.ndarray:
        """Convert to normalized velocity values (0-1)"""
        return self.grid.astype(np.float32) / 127.0

    @classmethod
    def from_array(cls, array: np.ndarray) -> 'DrumPattern':
        """Create pattern from numpy array"""
        pattern = cls(steps=array.shape[0], num_drums=array.shape[1])
        pattern.grid = (array * 127).astype(np.int16)
        return pattern

    def __repr__(self):
        return f"DrumPattern(steps={self.steps}, hits={len(self.get_hits())})"

    def print_pattern(self, drum_types: Optional[List[DrumType]] = None):
        """Print ASCII visualization of the pattern"""
        if drum_types is None:
            drum_types = [DrumType.KICK, DrumType.SNARE, DrumType.HIHAT_CLOSED,
                         DrumType.HIHAT_OPEN, DrumType.CLAP]

        print(f"\nDrum Pattern ({self.steps} steps):")
        print("  " + "".join([f"{i:2d}" for i in range(self.steps)]))

        for drum_type in drum_types:
            name = DrumType(drum_type).name[:4]
            line = f"{name:4s} "
            for step in range(self.steps):
                velocity = self.grid[step, drum_type]
                if velocity > 100:
                    line += "X "
                elif velocity > 50:
                    line += "x "
                elif velocity > 0:
                    line += ". "
                else:
                    line += "- "
            print(line)


class MarkovDrumGenerator:
    """Markov chain-based drum pattern generator"""

    def __init__(self, order: int = 1):
        """
        Initialize Markov chain generator

        Args:
            order: Order of Markov chain (1 = first-order, 2 = second-order, etc.)
        """
        self.order = order
        self.transitions: Dict[tuple, Dict[int, int]] = {}

    def train(self, patterns: List[DrumPattern], drum_type: DrumType):
        """
        Train Markov model on drum patterns for a specific drum type

        Args:
            patterns: List of drum patterns
            drum_type: Which drum to learn patterns for
        """
        for pattern in patterns:
            # Extract binary sequence for this drum
            sequence = (pattern.grid[:, drum_type] > 0).astype(int).tolist()

            # Build transition matrix
            for i in range(len(sequence) - self.order):
                # Get state (previous notes)
                state = tuple(sequence[i:i+self.order])
                # Get next note
                next_note = sequence[i+self.order]

                if state not in self.transitions:
                    self.transitions[state] = {0: 0, 1: 0}
                self.transitions[state][next_note] += 1

    def generate(self, steps: int, drum_type: DrumType, seed: Optional[List[int]] = None) -> np.ndarray:
        """
        Generate a drum pattern

        Args:
            steps: Number of steps to generate
            drum_type: Which drum to generate for
            seed: Initial state (optional)

        Returns:
            Binary array of hits
        """
        if not self.transitions:
            # No training data, return random pattern
            return np.random.choice([0, 1], size=steps, p=[0.7, 0.3])

        # Initialize with seed or random state
        if seed is None:
            seed = [0] * self.order

        sequence = list(seed[-self.order:])

        for _ in range(steps - len(sequence)):
            state = tuple(sequence[-self.order:])

            if state in self.transitions:
                # Get probabilities for next note
                counts = self.transitions[state]
                total = sum(counts.values())
                if total > 0:
                    probs = {k: v/total for k, v in counts.items()}
                    next_note = np.random.choice(list(probs.keys()), p=list(probs.values()))
                else:
                    next_note = 0
            else:
                # Unknown state, use most common transition
                next_note = 0

            sequence.append(next_note)

        return np.array(sequence[:steps])


class DrumLSTM(nn.Module):
    """LSTM model for drum pattern generation"""

    def __init__(self, num_drums: int = 11, hidden_size: int = 128, num_layers: int = 2):
        """
        Initialize LSTM model

        Args:
            num_drums: Number of drum types
            hidden_size: Hidden state size
            num_layers: Number of LSTM layers
        """
        super().__init__()
        self.num_drums = num_drums
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.lstm = nn.LSTM(
            input_size=num_drums,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2 if num_layers > 1 else 0
        )

        # Output layer for each drum (binary classification)
        self.output = nn.Linear(hidden_size, num_drums)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x, hidden=None):
        """
        Forward pass

        Args:
            x: Input tensor [batch, seq_len, num_drums]
            hidden: Hidden state (optional)

        Returns:
            Output tensor [batch, seq_len, num_drums], hidden state
        """
        lstm_out, hidden = self.lstm(x, hidden)
        output = self.sigmoid(self.output(lstm_out))
        return output, hidden

    def init_hidden(self, batch_size: int, device: str = 'cpu'):
        """Initialize hidden state"""
        h0 = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(device)
        c0 = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(device)
        return (h0, c0)


class LSTMDrumGenerator:
    """LSTM-based drum pattern generator"""

    def __init__(self, num_drums: int = 11, hidden_size: int = 128, num_layers: int = 2):
        """Initialize LSTM generator"""
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model = DrumLSTM(num_drums, hidden_size, num_layers).to(self.device)
        self.num_drums = num_drums

    def train(self, patterns: List[DrumPattern], epochs: int = 100, lr: float = 0.001):
        """
        Train LSTM model

        Args:
            patterns: List of drum patterns
            epochs: Number of training epochs
            lr: Learning rate
        """
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        criterion = nn.BCELoss()

        # Prepare training data
        X_train = []
        y_train = []

        for pattern in patterns:
            binary = pattern.to_binary()
            # Use pattern as both input and target (teacher forcing)
            X_train.append(binary)
            y_train.append(binary)

        X_train = np.array(X_train)
        y_train = np.array(y_train)

        X_tensor = torch.FloatTensor(X_train).to(self.device)
        y_tensor = torch.FloatTensor(y_train).to(self.device)

        self.model.train()
        for epoch in range(epochs):
            optimizer.zero_grad()

            # Forward pass
            output, _ = self.model(X_tensor)
            loss = criterion(output, y_tensor)

            # Backward pass
            loss.backward()
            optimizer.step()

            if (epoch + 1) % 10 == 0:
                print(f"Epoch [{epoch+1}/{epochs}], Loss: {loss.item():.4f}")

    def generate(self, steps: int = 16, temperature: float = 1.0,
                 seed: Optional[np.ndarray] = None) -> DrumPattern:
        """
        Generate a drum pattern

        Args:
            steps: Number of steps to generate
            temperature: Sampling temperature (higher = more random)
            seed: Initial pattern (optional)

        Returns:
            Generated drum pattern
        """
        self.model.eval()

        with torch.no_grad():
            if seed is None:
                # Start with empty pattern
                current = torch.zeros(1, 1, self.num_drums).to(self.device)
            else:
                current = torch.FloatTensor(seed).unsqueeze(0).to(self.device)

            generated = []
            hidden = self.model.init_hidden(1, self.device)

            for _ in range(steps):
                # Generate next step
                output, hidden = self.model(current, hidden)

                # Apply temperature
                probs = output[0, -1, :].cpu().numpy()
                probs = np.power(probs, 1.0 / temperature)
                probs = probs / np.sum(probs)

                # Sample from distribution
                next_step = (np.random.random(self.num_drums) < probs).astype(np.float32)
                generated.append(next_step)

                # Update current input
                current = torch.FloatTensor(next_step).unsqueeze(0).unsqueeze(0).to(self.device)

            # Create pattern from generated sequence
            pattern_array = np.array(generated)
            return DrumPattern.from_array(pattern_array)


class EDMPatternLibrary:
    """Library of common EDM drum patterns"""

    @staticmethod
    def four_on_floor(steps: int = 16, accent_every: int = 4) -> DrumPattern:
        """
        Generate four-on-the-floor kick pattern

        Args:
            steps: Number of steps
            accent_every: Accent every N beats
        """
        pattern = DrumPattern(steps=steps)

        # Kick on every quarter note (assuming 16th note steps)
        for i in range(0, steps, 4):
            velocity = 127 if (i // 4) % accent_every == 0 else 100
            pattern.add_hit(i, DrumType.KICK, velocity)

        return pattern

    @staticmethod
    def syncopated_hihat(steps: int = 16, density: float = 0.7) -> DrumPattern:
        """
        Generate syncopated hi-hat pattern

        Args:
            steps: Number of steps
            density: Probability of hits (0-1)
        """
        pattern = DrumPattern(steps=steps)

        # Closed hi-hat on every 8th note with variations
        for i in range(0, steps, 2):
            if random.random() < density:
                velocity = random.randint(60, 100)
                pattern.add_hit(i, DrumType.HIHAT_CLOSED, velocity)

        # Add offbeat closed hi-hats
        for i in range(1, steps, 4):
            if random.random() < density * 0.6:
                velocity = random.randint(40, 70)
                pattern.add_hit(i, DrumType.HIHAT_CLOSED, velocity)

        # Occasional open hi-hat
        for i in range(6, steps, 8):
            if random.random() < 0.4:
                pattern.add_hit(i, DrumType.HIHAT_OPEN, 80)

        return pattern

    @staticmethod
    def snare_clap_pattern(steps: int = 16) -> DrumPattern:
        """
        Generate snare/clap pattern (typically on 2 and 4)

        Args:
            steps: Number of steps
        """
        pattern = DrumPattern(steps=steps)

        # Snare/clap on beats 2 and 4 (assuming 4/4 time)
        for i in [4, 12]:  # Steps 4 and 12 in 16-step pattern
            pattern.add_hit(i, DrumType.SNARE, 110)
            pattern.add_hit(i, DrumType.CLAP, 90)

        return pattern

    @staticmethod
    def build_up_pattern(steps: int = 32) -> DrumPattern:
        """
        Generate build-up pattern (increasing density)

        Args:
            steps: Number of steps
        """
        pattern = DrumPattern(steps=steps)

        # Gradually increase drum density
        for i in range(steps):
            progress = i / steps

            # Add more hits as we progress
            if i % 4 == 0:
                pattern.add_hit(i, DrumType.KICK, int(80 + progress * 47))

            # Snare rolls get denser
            if i >= steps // 2:
                if i % 2 == 0:
                    velocity = int(60 + progress * 67)
                    pattern.add_hit(i, DrumType.SNARE, velocity)

            # Hi-hat density increases
            if random.random() < progress:
                pattern.add_hit(i, DrumType.HIHAT_CLOSED, int(40 + progress * 60))

        # Crash at the end
        pattern.add_hit(steps - 1, DrumType.CRASH, 127)

        return pattern

    @staticmethod
    def drop_pattern(steps: int = 16) -> DrumPattern:
        """
        Generate drop pattern (heavy and energetic)

        Args:
            steps: Number of steps
        """
        pattern = DrumPattern(steps=steps)

        # Heavy kick on every beat
        for i in range(0, steps, 4):
            pattern.add_hit(i, DrumType.KICK, 127)

        # Snare on 2 and 4
        pattern.add_hit(4, DrumType.SNARE, 120)
        pattern.add_hit(12, DrumType.SNARE, 120)

        # Dense hi-hats
        for i in range(steps):
            if i % 2 == 0:
                pattern.add_hit(i, DrumType.HIHAT_CLOSED, 100)

        # Crash on first beat
        pattern.add_hit(0, DrumType.CRASH, 120)

        return pattern

    @staticmethod
    def breakbeat(steps: int = 16) -> DrumPattern:
        """
        Generate breakbeat-style pattern

        Args:
            steps: Number of steps
        """
        pattern = DrumPattern(steps=steps)

        # Amen break inspired pattern
        kick_pattern = [0, 6, 11]
        snare_pattern = [4, 10, 12]
        hihat_pattern = [0, 2, 4, 6, 8, 10, 12, 14]

        for step in kick_pattern:
            if step < steps:
                pattern.add_hit(step, DrumType.KICK, random.randint(100, 120))

        for step in snare_pattern:
            if step < steps:
                pattern.add_hit(step, DrumType.SNARE, random.randint(90, 110))

        for step in hihat_pattern:
            if step < steps:
                velocity = random.randint(60, 100)
                pattern.add_hit(step, DrumType.HIHAT_CLOSED, velocity)

        return pattern

    @staticmethod
    def combine_patterns(*patterns: DrumPattern) -> DrumPattern:
        """
        Combine multiple patterns into one

        Args:
            *patterns: Variable number of patterns to combine

        Returns:
            Combined pattern
        """
        if not patterns:
            return DrumPattern()

        # Use the largest pattern size
        max_steps = max(p.steps for p in patterns)
        combined = DrumPattern(steps=max_steps)

        for pattern in patterns:
            for hit in pattern.get_hits():
                if hit.step < max_steps:
                    # Keep maximum velocity if multiple hits on same step
                    current_vel = combined.grid[hit.step, hit.drum_type]
                    new_vel = max(current_vel, hit.velocity)
                    combined.grid[hit.step, hit.drum_type] = new_vel

        return combined


class PatternVariation:
    """Generate variations of drum patterns"""

    @staticmethod
    def add_fills(pattern: DrumPattern, fill_probability: float = 0.3) -> DrumPattern:
        """
        Add fill variations to pattern

        Args:
            pattern: Original pattern
            fill_probability: Probability of adding fills

        Returns:
            Pattern with fills
        """
        varied = DrumPattern(steps=pattern.steps)
        varied.grid = pattern.grid.copy()

        # Add tom fills occasionally
        for step in range(pattern.steps - 4, pattern.steps):
            if random.random() < fill_probability:
                tom_type = random.choice([DrumType.TOM_HIGH, DrumType.TOM_MID, DrumType.TOM_LOW])
                varied.add_hit(step, tom_type, random.randint(80, 110))

        return varied

    @staticmethod
    def velocity_variation(pattern: DrumPattern, variation_amount: float = 0.2) -> DrumPattern:
        """
        Add velocity variations

        Args:
            pattern: Original pattern
            variation_amount: Amount of variation (0-1)

        Returns:
            Pattern with velocity variations
        """
        varied = DrumPattern(steps=pattern.steps)

        for hit in pattern.get_hits():
            # Add random variation to velocity
            variation = int(hit.velocity * variation_amount * (random.random() * 2 - 1))
            new_velocity = max(20, min(127, hit.velocity + variation))
            varied.add_hit(hit.step, hit.drum_type, new_velocity)

        return varied

    @staticmethod
    def shift_pattern(pattern: DrumPattern, shift: int) -> DrumPattern:
        """
        Shift pattern by a number of steps

        Args:
            pattern: Original pattern
            shift: Number of steps to shift (positive or negative)

        Returns:
            Shifted pattern
        """
        shifted = DrumPattern(steps=pattern.steps)
        shifted.grid = np.roll(pattern.grid, shift, axis=0)
        return shifted

    @staticmethod
    def reverse_pattern(pattern: DrumPattern) -> DrumPattern:
        """
        Reverse the pattern

        Args:
            pattern: Original pattern

        Returns:
            Reversed pattern
        """
        reversed_pattern = DrumPattern(steps=pattern.steps)
        reversed_pattern.grid = np.flip(pattern.grid, axis=0)
        return reversed_pattern


if __name__ == "__main__":
    # Example usage
    print("EDM Drum Pattern Generator Examples\n")
    print("=" * 60)

    # 1. Create basic patterns using the library
    print("\n1. Four-on-the-floor pattern:")
    kick_pattern = EDMPatternLibrary.four_on_floor(steps=16)
    kick_pattern.print_pattern()

    print("\n2. Syncopated hi-hat pattern:")
    hihat_pattern = EDMPatternLibrary.syncopated_hihat(steps=16)
    hihat_pattern.print_pattern()

    print("\n3. Snare/clap pattern:")
    snare_pattern = EDMPatternLibrary.snare_clap_pattern(steps=16)
    snare_pattern.print_pattern()

    print("\n4. Combined EDM pattern:")
    edm_pattern = EDMPatternLibrary.combine_patterns(
        kick_pattern, hihat_pattern, snare_pattern
    )
    edm_pattern.print_pattern()

    print("\n5. Build-up pattern:")
    buildup = EDMPatternLibrary.build_up_pattern(steps=32)
    buildup.print_pattern([DrumType.KICK, DrumType.SNARE, DrumType.HIHAT_CLOSED, DrumType.CRASH])

    print("\n6. Drop pattern:")
    drop = EDMPatternLibrary.drop_pattern(steps=16)
    drop.print_pattern()

    print("\n7. Breakbeat pattern:")
    breakbeat = EDMPatternLibrary.breakbeat(steps=16)
    breakbeat.print_pattern()

    # 2. Pattern variations
    print("\n8. Pattern with fills:")
    with_fills = PatternVariation.add_fills(edm_pattern)
    with_fills.print_pattern([DrumType.KICK, DrumType.SNARE, DrumType.HIHAT_CLOSED,
                              DrumType.TOM_HIGH, DrumType.TOM_LOW])

    print("\n9. Velocity variation:")
    varied = PatternVariation.velocity_variation(edm_pattern)
    print(f"Original pattern hits: {len(edm_pattern.get_hits())}")
    print(f"Varied pattern hits: {len(varied.get_hits())}")

    # 3. Markov chain generation
    print("\n10. Markov chain generation:")
    markov_gen = MarkovDrumGenerator(order=2)

    # Train on some patterns
    training_patterns = [
        EDMPatternLibrary.four_on_floor(16),
        EDMPatternLibrary.four_on_floor(16),
        EDMPatternLibrary.four_on_floor(16),
    ]

    markov_gen.train(training_patterns, DrumType.KICK)
    markov_pattern = DrumPattern(steps=16)
    kick_seq = markov_gen.generate(16, DrumType.KICK)

    for i, hit in enumerate(kick_seq):
        if hit:
            markov_pattern.add_hit(i, DrumType.KICK, 100)

    markov_pattern.print_pattern([DrumType.KICK])

    print("\n" + "=" * 60)
    print("Examples completed!")
