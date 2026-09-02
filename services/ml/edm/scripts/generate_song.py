"""
Simple script to generate music from a single song input.

This script:
1. Takes console input (Artist - Song Name)
2. Matches to MIDI files in the LMD dataset
3. Downloads the matched MIDI
4. Synthesizes to audio.mp4

Requirements:
- Modal CLI: pip install modal && modal token new
- FluidSynth: brew install fluid-synth (Mac) or apt-get install fluidsynth (Linux)
- FFmpeg: brew install ffmpeg (Mac) or apt-get install ffmpeg (Linux)

Usage:
    python scripts/generate_song.py
"""

import subprocess
import json
import sys
from pathlib import Path
import tempfile
import shutil

def check_dependencies():
    """Check if required tools are installed."""
    missing = []

    if shutil.which("modal") is None:
        missing.append("modal (pip install modal)")

    if shutil.which("fluidsynth") is None:
        missing.append("fluidsynth (brew install fluid-synth)")

    if shutil.which("ffmpeg") is None:
        missing.append("ffmpeg (brew install ffmpeg)")

    if missing:
        print("❌ Missing dependencies:")
        for dep in missing:
            print(f"   - {dep}")
        print("\nPlease install them and try again.")
        return False

    return True


def download_soundfont():
    """Download a free soundfont if not present."""
    soundfont_path = Path("data/soundfont.sf2")

    if soundfont_path.exists():
        return str(soundfont_path)

    print("\n📥 Downloading soundfont...")
    soundfont_url = "https://gitlab.com/umonics/musescore-general-soundfont/-/raw/main/MuseScore_General.sf3"

    try:
        import urllib.request
        soundfont_path.parent.mkdir(exist_ok=True)
        urllib.request.urlretrieve(soundfont_url, soundfont_path)
        print(f"✓ Downloaded soundfont to {soundfont_path}")
        return str(soundfont_path)
    except Exception as e:
        print(f"❌ Failed to download soundfont: {e}")
        print("\nPlease download a soundfont (.sf2 or .sf3) manually and place it in data/soundfont.sf2")
        return None


def main():
    print("\n" + "="*60)
    print("🎵 Generate Music from Song")
    print("="*60)

    # Check dependencies
    if not check_dependencies():
        sys.exit(1)

    # Get soundfont
    soundfont = download_soundfont()
    if not soundfont:
        sys.exit(1)

    # Get user input
    print("\nEnter a song (format: Artist - Song Name)")
    print("Example: Noah Kahan - Call Your Mom")
    print("Tip: Works best with popular songs from before 2010\n")

    song_input = input("Song: ").strip()

    if not song_input:
        print("❌ No input provided. Exiting.")
        sys.exit(1)

    # Parse artist and song
    if " - " in song_input:
        artist, song_name = song_input.split(" - ", 1)
    elif "–" in song_input:
        artist, song_name = song_input.split("–", 1)
    else:
        artist = ""
        song_name = song_input

    artist = artist.strip()
    song_name = song_name.strip()

    print(f"\n✓ Artist: {artist or '(none)'}")
    print(f"✓ Song: {song_name}")

    # Step 1: Match song to MIDI
    print("\n" + "="*60)
    print("Step 1/4: Matching song to MIDI files...")
    print("="*60)

    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)

    temp_songs_file = data_dir / "temp_song_input.json"
    with open(temp_songs_file, "w") as f:
        json.dump({"tracks": [{"artist": artist, "name": song_name}]}, f)

    try:
        # Run matching via Modal
        print("Running Modal matching...")
        result = subprocess.run(
            ["modal", "run", "scripts/match_songs_to_midi.py",
             "--songs-file", str(temp_songs_file)],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode != 0:
            print(f"❌ Matching failed:")
            print(result.stderr)
            sys.exit(1)

        print("✓ Matching complete")

        # Step 2: Check results
        print("\n" + "="*60)
        print("Step 2/4: Checking match results...")
        print("="*60)

        # The matches are saved to Modal volume, need to download them
        # For now, we'll use modal volume get to download the matches file
        subprocess.run(
            ["modal", "volume", "get", "lmd-processed",
             "spotify_midi_matches.json", str(data_dir / "matches.json")],
            check=True
        )

        with open(data_dir / "matches.json") as f:
            match_data = json.load(f)

        matched_count = match_data["statistics"]["matched_count"]
        if matched_count == 0:
            print(f"❌ No matches found for '{artist} - {song_name}'")
            print("\n💡 Tips:")
            print("  - Try a different song (popular songs work better)")
            print("  - Songs from before 2010 are more likely to match")
            print("  - The Million Song Dataset has ~1M songs")
            sys.exit(1)

        first_match = match_data["matched"][0]
        midi_path = first_match["matched_track"]["midi_files"][0]
        match_score = first_match["match_score"]

        print(f"✓ Found match: {midi_path}")
        print(f"  Match score: {match_score:.2%}")

        # Step 3: Download MIDI file
        print("\n" + "="*60)
        print("Step 3/4: Downloading MIDI file...")
        print("="*60)

        midi_file = Path("audio.mid")
        subprocess.run(
            ["modal", "volume", "get", "lmd-dataset",
             f"lmd_full/{midi_path}", str(midi_file)],
            check=True
        )
        print(f"✓ Downloaded to {midi_file}")

        # Step 4: Synthesize to audio
        print("\n" + "="*60)
        print("Step 4/4: Converting MIDI to audio...")
        print("="*60)

        # Convert MIDI to WAV using FluidSynth
        wav_file = Path("audio.wav")
        print("Synthesizing with FluidSynth...")
        subprocess.run(
            ["fluidsynth", "-ni", soundfont, str(midi_file),
             "-F", str(wav_file), "-r", "44100"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        print(f"✓ Generated WAV: {wav_file}")

        # Convert WAV to MP4 using FFmpeg
        mp4_file = Path("audio.mp4")
        print("Converting to MP4...")
        subprocess.run(
            ["ffmpeg", "-i", str(wav_file), "-codec:a", "aac",
             "-b:a", "192k", str(mp4_file), "-y"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        print(f"✓ Generated MP4: {mp4_file}")

        # Cleanup temp files
        wav_file.unlink()
        midi_file.unlink()

        # Final output
        print("\n" + "="*60)
        print("🎉 Success!")
        print("="*60)
        print(f"\n✓ Generated: audio.mp4")
        print(f"  Based on: {artist} - {song_name}")
        print(f"  Match score: {match_score:.2%}")
        print(f"\nYou can play it with:")
        print(f"  open audio.mp4    # Mac")
        print(f"  xdg-open audio.mp4  # Linux")

    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error: {e}")
        if e.stderr:
            print(e.stderr)
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print("\n❌ Timeout: Matching took too long (>5 minutes)")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
    finally:
        # Cleanup
        if temp_songs_file.exists():
            temp_songs_file.unlink()


if __name__ == "__main__":
    main()
