"""
Convert audio files to MIDI using basic-pitch

Reads audio files from data/audio/ and writes MIDI files to data/user_midis/.
Supports mp3, wav, m4a, flac, ogg formats.

Usage:
    source ~/.venvs/midi/bin/activate
    python scripts/convert_audio_to_midi.py
"""

from pathlib import Path
import sys

AUDIO_DIR = Path(__file__).parent.parent / "data" / "audio"
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "user_midis"

SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".wma"}


def convert_all():
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    audio_files = [
        f for f in AUDIO_DIR.iterdir()
        if f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not audio_files:
        print(f"No audio files found in {AUDIO_DIR}")
        print(f"Place mp3/wav/m4a files there and re-run.")
        sys.exit(1)

    print(f"Found {len(audio_files)} audio file(s) in {AUDIO_DIR}")
    print(f"Output directory: {OUTPUT_DIR}\n")

    for audio_file in audio_files:
        print(f"Converting: {audio_file.name}")
        try:
            model_output, midi_data, note_events = predict(audio_file)

            output_path = OUTPUT_DIR / f"{audio_file.stem}.mid"
            midi_data.write(str(output_path))
            print(f"  -> {output_path.name} ({output_path.stat().st_size / 1024:.1f} KB)")

        except Exception as e:
            print(f"  ERROR: {e}")
            continue

    midi_count = len(list(OUTPUT_DIR.glob("*.mid")))
    print(f"\nDone! {midi_count} MIDI file(s) in {OUTPUT_DIR}")


if __name__ == "__main__":
    convert_all()
