"""
Simple: Generate audio.mp4 using VAE model

Usage:
    python scripts/simple_generate.py "My Song Name"
"""

import subprocess
import sys
from pathlib import Path

def main():
    # Get song name (optional, just for reference)
    if len(sys.argv) > 1:
        song_name = sys.argv[1]
    else:
        song_name = input("Enter song name (optional): ").strip() or "generated_song"

    print("\n" + "="*60)
    print("🎵 Generate Music with VAE Model")
    print("="*60)
    print(f"\nGenerating: {song_name}")

    soundfont = "data/soundfont.sf2"
    if not Path(soundfont).exists():
        print(f"\n❌ Soundfont not found: {soundfont}")
        sys.exit(1)

    try:
        # Step 1: Generate MIDI using VAE model
        print("\n" + "="*60)
        print("Step 1/4: Generating MIDI with VAE model...")
        print("="*60)

        result = subprocess.run(
            ["modal", "run", "scripts/generate_midi_vae.py", "--num-samples", "1"],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode != 0:
            print(f"❌ Generation failed:")
            print(result.stderr)
            sys.exit(1)

        print("✓ MIDI generated on Modal")

        # Step 2: Download MIDI
        print("\n" + "="*60)
        print("Step 2/4: Downloading generated MIDI...")
        print("="*60)

        midi_file = Path("audio.mid")
        subprocess.run(
            ["modal", "volume", "get", "generated-midi",
             "generated_0000.mid", str(midi_file)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        print(f"✓ Downloaded to {midi_file}")

        # Step 3: Synth to WAV
        print("\n" + "="*60)
        print("Step 3/4: Synthesizing to audio...")
        print("="*60)

        wav_file = Path("audio.wav")
        subprocess.run(
            ["fluidsynth", "-ni", soundfont, str(midi_file),
             "-F", str(wav_file), "-r", "44100"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        print(f"✓ Generated WAV: {wav_file}")

        # Step 4: Convert to MP4
        print("\n" + "="*60)
        print("Step 4/4: Converting to MP4...")
        print("="*60)

        mp4_file = Path("audio.mp4")
        subprocess.run(
            ["ffmpeg", "-i", str(wav_file), "-codec:a", "aac",
             "-b:a", "192k", str(mp4_file), "-y"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        print(f"✓ Generated MP4: {mp4_file}")

        # Cleanup
        wav_file.unlink()
        midi_file.unlink()

        # Done!
        print("\n" + "="*60)
        print("🎉 Success!")
        print("="*60)
        print(f"\n✓ Generated: audio.mp4")
        print(f"  Reference: {song_name}")
        print(f"  File size: {mp4_file.stat().st_size / 1024:.1f} KB")
        print(f"\nPlay it:")
        print(f"  open audio.mp4")

    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted")
        sys.exit(1)


if __name__ == "__main__":
    main()
