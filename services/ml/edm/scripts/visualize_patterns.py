#!/usr/bin/env python3
"""
Advanced visualization for drum patterns
Creates visual representations and analysis
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import argparse

from src.models.drum_pattern_generator import (
    DrumPattern, DrumType, EDMPatternLibrary
)


class PatternVisualizer:
    """Visualize drum patterns"""

    def __init__(self):
        self.drum_colors = {
            DrumType.KICK: '#FF0000',
            DrumType.SNARE: '#0000FF',
            DrumType.CLAP: '#00FFFF',
            DrumType.HIHAT_CLOSED: '#FFFF00',
            DrumType.HIHAT_OPEN: '#FFA500',
            DrumType.CRASH: '#FF00FF',
            DrumType.RIDE: '#800080',
            DrumType.TOM_HIGH: '#00FF00',
            DrumType.TOM_MID: '#008000',
            DrumType.TOM_LOW: '#004000',
            DrumType.PERCUSSION: '#808080',
        }

    def plot_pattern(self, pattern: DrumPattern, title: str = "Drum Pattern",
                    show_velocity: bool = True, output_file: Optional[str] = None):
        """
        Create a visual plot of the drum pattern

        Args:
            pattern: Drum pattern to visualize
            title: Plot title
            show_velocity: Whether to show velocity as color intensity
            output_file: Path to save image (if None, displays plot)
        """
        fig, ax = plt.subplots(figsize=(16, 8))

        # Get active drum types
        active_drums = set()
        for hit in pattern.get_hits():
            active_drums.add(hit.drum_type)

        active_drums = sorted(list(active_drums))
        drum_names = [DrumType(d).name for d in active_drums]

        # Create grid
        for i, drum_type in enumerate(active_drums):
            for step in range(pattern.steps):
                velocity = pattern.grid[step, drum_type]

                if velocity > 0:
                    # Calculate color intensity based on velocity
                    if show_velocity:
                        alpha = velocity / 127.0
                    else:
                        alpha = 1.0

                    color = self.drum_colors.get(DrumType(drum_type), '#808080')

                    # Draw rectangle
                    rect = Rectangle((step, i), 1, 0.8,
                                   facecolor=color, alpha=alpha,
                                   edgecolor='black', linewidth=0.5)
                    ax.add_patch(rect)

        # Set up axes
        ax.set_xlim(0, pattern.steps)
        ax.set_ylim(0, len(active_drums))

        # Labels
        ax.set_xlabel('Step', fontsize=12)
        ax.set_ylabel('Drum Type', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')

        # Ticks
        ax.set_xticks(range(pattern.steps))
        ax.set_yticks(range(len(active_drums)))
        ax.set_yticklabels(drum_names)

        # Grid
        ax.grid(True, alpha=0.3)

        # Add beat markers (every 4 steps for 4/4 time)
        for beat in range(0, pattern.steps, 4):
            ax.axvline(x=beat, color='red', linestyle='--', alpha=0.5, linewidth=1)

        plt.tight_layout()

        if output_file:
            plt.savefig(output_file, dpi=150, bbox_inches='tight')
            print(f"Saved pattern visualization to: {output_file}")
            plt.close()
        else:
            plt.show()

    def plot_multiple_patterns(self, patterns: List[Tuple[str, DrumPattern]],
                              output_file: Optional[str] = None):
        """
        Plot multiple patterns in a grid

        Args:
            patterns: List of (name, pattern) tuples
            output_file: Path to save image
        """
        n_patterns = len(patterns)
        n_cols = min(2, n_patterns)
        n_rows = (n_patterns + n_cols - 1) // n_cols

        fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 4 * n_rows))

        if n_patterns == 1:
            axes = [axes]
        else:
            axes = axes.flatten()

        for idx, (name, pattern) in enumerate(patterns):
            ax = axes[idx]

            # Get active drum types
            active_drums = set()
            for hit in pattern.get_hits():
                active_drums.add(hit.drum_type)

            active_drums = sorted(list(active_drums))
            drum_names = [DrumType(d).name for d in active_drums]

            # Plot hits
            for i, drum_type in enumerate(active_drums):
                for step in range(pattern.steps):
                    velocity = pattern.grid[step, drum_type]

                    if velocity > 0:
                        alpha = velocity / 127.0
                        color = self.drum_colors.get(DrumType(drum_type), '#808080')

                        rect = Rectangle((step, i), 1, 0.8,
                                       facecolor=color, alpha=alpha,
                                       edgecolor='black', linewidth=0.5)
                        ax.add_patch(rect)

            # Configure axes
            ax.set_xlim(0, pattern.steps)
            ax.set_ylim(0, len(active_drums))
            ax.set_xlabel('Step')
            ax.set_ylabel('Drum')
            ax.set_title(name, fontweight='bold')
            ax.set_xticks(range(0, pattern.steps, 4))
            ax.set_yticks(range(len(active_drums)))
            ax.set_yticklabels([name[:4] for name in drum_names], fontsize=8)
            ax.grid(True, alpha=0.3)

            # Beat markers
            for beat in range(0, pattern.steps, 4):
                ax.axvline(x=beat, color='red', linestyle='--', alpha=0.3, linewidth=0.5)

        # Hide unused subplots
        for idx in range(n_patterns, len(axes)):
            axes[idx].set_visible(False)

        plt.tight_layout()

        if output_file:
            plt.savefig(output_file, dpi=150, bbox_inches='tight')
            print(f"Saved multiple patterns visualization to: {output_file}")
            plt.close()
        else:
            plt.show()

    def plot_pattern_heatmap(self, pattern: DrumPattern,
                            output_file: Optional[str] = None):
        """
        Create a heatmap visualization of the pattern

        Args:
            pattern: Drum pattern
            output_file: Output file path
        """
        fig, ax = plt.subplots(figsize=(14, 6))

        # Create velocity matrix
        velocity_matrix = pattern.grid.T.astype(float) / 127.0

        # Plot heatmap
        im = ax.imshow(velocity_matrix, cmap='hot', aspect='auto',
                      interpolation='nearest')

        # Labels
        ax.set_xlabel('Step', fontsize=12)
        ax.set_ylabel('Drum Type', fontsize=12)
        ax.set_title('Drum Pattern Heatmap (Velocity)', fontsize=14, fontweight='bold')

        # Ticks
        ax.set_xticks(range(pattern.steps))
        ax.set_yticks(range(pattern.num_drums))
        drum_names = [DrumType(i).name for i in range(pattern.num_drums)]
        ax.set_yticklabels(drum_names)

        # Colorbar
        cbar = plt.colorbar(im, ax=ax)
        cbar.set_label('Velocity (normalized)', rotation=270, labelpad=15)

        # Grid
        ax.set_xticks(np.arange(pattern.steps) - 0.5, minor=True)
        ax.set_yticks(np.arange(pattern.num_drums) - 0.5, minor=True)
        ax.grid(which='minor', color='gray', linestyle='-', linewidth=0.5, alpha=0.3)

        plt.tight_layout()

        if output_file:
            plt.savefig(output_file, dpi=150, bbox_inches='tight')
            print(f"Saved heatmap to: {output_file}")
            plt.close()
        else:
            plt.show()

    def plot_pattern_analysis(self, pattern: DrumPattern,
                             output_file: Optional[str] = None):
        """
        Create comprehensive analysis plots

        Args:
            pattern: Drum pattern
            output_file: Output file path
        """
        fig = plt.figure(figsize=(16, 10))
        gs = fig.add_gridspec(3, 2, hspace=0.3, wspace=0.3)

        # 1. Pattern grid
        ax1 = fig.add_subplot(gs[0, :])
        active_drums = set()
        for hit in pattern.get_hits():
            active_drums.add(hit.drum_type)
        active_drums = sorted(list(active_drums))

        for i, drum_type in enumerate(active_drums):
            for step in range(pattern.steps):
                velocity = pattern.grid[step, drum_type]
                if velocity > 0:
                    alpha = velocity / 127.0
                    color = self.drum_colors.get(DrumType(drum_type), '#808080')
                    rect = Rectangle((step, i), 1, 0.8,
                                   facecolor=color, alpha=alpha,
                                   edgecolor='black', linewidth=0.5)
                    ax1.add_patch(rect)

        ax1.set_xlim(0, pattern.steps)
        ax1.set_ylim(0, len(active_drums))
        ax1.set_xlabel('Step')
        ax1.set_ylabel('Drum Type')
        ax1.set_title('Pattern Grid', fontweight='bold')
        drum_names = [DrumType(d).name for d in active_drums]
        ax1.set_yticks(range(len(active_drums)))
        ax1.set_yticklabels(drum_names)
        ax1.grid(True, alpha=0.3)

        # 2. Density over time
        ax2 = fig.add_subplot(gs[1, 0])
        density = np.sum(pattern.grid > 0, axis=1)
        ax2.bar(range(pattern.steps), density, color='steelblue')
        ax2.set_xlabel('Step')
        ax2.set_ylabel('Number of Hits')
        ax2.set_title('Hit Density per Step', fontweight='bold')
        ax2.grid(True, alpha=0.3)

        # 3. Drum usage
        ax3 = fig.add_subplot(gs[1, 1])
        drum_hits = {}
        for hit in pattern.get_hits():
            drum_name = DrumType(hit.drum_type).name
            drum_hits[drum_name] = drum_hits.get(drum_name, 0) + 1

        if drum_hits:
            names = list(drum_hits.keys())
            values = list(drum_hits.values())
            colors = [self.drum_colors.get(DrumType[name], '#808080') for name in names]
            ax3.barh(names, values, color=colors)
            ax3.set_xlabel('Number of Hits')
            ax3.set_title('Drum Usage', fontweight='bold')
            ax3.grid(True, alpha=0.3, axis='x')

        # 4. Velocity distribution
        ax4 = fig.add_subplot(gs[2, 0])
        velocities = [hit.velocity for hit in pattern.get_hits()]
        if velocities:
            ax4.hist(velocities, bins=20, color='coral', edgecolor='black')
            ax4.set_xlabel('Velocity')
            ax4.set_ylabel('Frequency')
            ax4.set_title('Velocity Distribution', fontweight='bold')
            ax4.axvline(np.mean(velocities), color='red', linestyle='--',
                       label=f'Mean: {np.mean(velocities):.1f}')
            ax4.legend()
            ax4.grid(True, alpha=0.3)

        # 5. Average velocity per drum
        ax5 = fig.add_subplot(gs[2, 1])
        drum_velocities = {}
        drum_counts = {}

        for hit in pattern.get_hits():
            drum_name = DrumType(hit.drum_type).name
            drum_velocities[drum_name] = drum_velocities.get(drum_name, 0) + hit.velocity
            drum_counts[drum_name] = drum_counts.get(drum_name, 0) + 1

        if drum_velocities:
            avg_velocities = {name: drum_velocities[name] / drum_counts[name]
                            for name in drum_velocities}
            names = list(avg_velocities.keys())
            values = list(avg_velocities.values())
            colors = [self.drum_colors.get(DrumType[name], '#808080') for name in names]

            ax5.barh(names, values, color=colors)
            ax5.set_xlabel('Average Velocity')
            ax5.set_title('Average Velocity per Drum', fontweight='bold')
            ax5.grid(True, alpha=0.3, axis='x')
            ax5.set_xlim(0, 127)

        plt.suptitle('Drum Pattern Analysis', fontsize=16, fontweight='bold', y=0.995)

        if output_file:
            plt.savefig(output_file, dpi=150, bbox_inches='tight')
            print(f"Saved analysis to: {output_file}")
            plt.close()
        else:
            plt.show()


def main():
    from typing import List, Tuple, Optional

    parser = argparse.ArgumentParser(description='Visualize drum patterns')
    parser.add_argument('--type', choices=['single', 'multiple', 'heatmap', 'analysis', 'all'],
                       default='all', help='Type of visualization')
    parser.add_argument('--output-dir', type=str, default='/tmp/drum_patterns/visualizations',
                       help='Output directory for visualizations')

    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    print("\n" + "=" * 70)
    print("Drum Pattern Visualizer")
    print("=" * 70)

    visualizer = PatternVisualizer()

    # Create example patterns
    patterns = [
        ("Four-on-Floor", EDMPatternLibrary.four_on_floor(16)),
        ("Syncopated Hi-Hat", EDMPatternLibrary.syncopated_hihat(16)),
        ("Breakbeat", EDMPatternLibrary.breakbeat(16)),
        ("Drop", EDMPatternLibrary.drop_pattern(16)),
    ]

    # Full EDM pattern
    full_edm = EDMPatternLibrary.combine_patterns(
        EDMPatternLibrary.four_on_floor(16),
        EDMPatternLibrary.syncopated_hihat(16),
        EDMPatternLibrary.snare_clap_pattern(16)
    )

    # Build-up pattern
    buildup = EDMPatternLibrary.build_up_pattern(32)

    if args.type in ['single', 'all']:
        print("\n1. Creating single pattern visualizations...")
        visualizer.plot_pattern(
            full_edm,
            "Full EDM Pattern",
            output_file=os.path.join(args.output_dir, 'pattern_edm.png')
        )
        visualizer.plot_pattern(
            buildup,
            "Build-up Pattern (32 steps)",
            output_file=os.path.join(args.output_dir, 'pattern_buildup.png')
        )

    if args.type in ['multiple', 'all']:
        print("\n2. Creating multiple patterns visualization...")
        visualizer.plot_multiple_patterns(
            patterns,
            output_file=os.path.join(args.output_dir, 'patterns_comparison.png')
        )

    if args.type in ['heatmap', 'all']:
        print("\n3. Creating heatmap visualization...")
        visualizer.plot_pattern_heatmap(
            full_edm,
            output_file=os.path.join(args.output_dir, 'pattern_heatmap.png')
        )

    if args.type in ['analysis', 'all']:
        print("\n4. Creating analysis visualization...")
        visualizer.plot_pattern_analysis(
            full_edm,
            output_file=os.path.join(args.output_dir, 'pattern_analysis.png')
        )
        visualizer.plot_pattern_analysis(
            buildup,
            output_file=os.path.join(args.output_dir, 'buildup_analysis.png')
        )

    print("\n" + "=" * 70)
    print(f"All visualizations saved to: {args.output_dir}")
    print("=" * 70)


if __name__ == "__main__":
    main()
