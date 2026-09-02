#!/usr/bin/env python3
"""
Generate EDM remix from Spotify URL

This script extracts audio features from a Spotify track and uses them
to generate an EDM remix using Modal (or local fallback).

Usage:
    python generate_edm.py https://open.spotify.com/track/...
    python generate_edm.py  # Will prompt for URL
"""

import sys
import os
import argparse
from pathlib import Path
from typing import Dict, Optional
import json

try:
    import spotipy
    from spotipy.oauth2 import SpotifyClientCredentials
    SPOTIPY_AVAILABLE = True
except ImportError:
    SPOTIPY_AVAILABLE = False
    print("Warning: spotipy not installed. Install with: pip install spotipy")


class SpotifyExtractor:
    """Extract audio features from Spotify tracks"""

    def __init__(self):
        if not SPOTIPY_AVAILABLE:
            raise ImportError("spotipy is required. Install with: pip install spotipy")

        # Get credentials from environment
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")

        if not client_id or not client_secret:
            raise ValueError(
                "Spotify credentials not found. Set SPOTIFY_CLIENT_ID and "
                "SPOTIFY_CLIENT_SECRET environment variables."
            )

        # Initialize Spotify client
        auth_manager = SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret
        )
        self.sp = spotipy.Spotify(auth_manager=auth_manager)

    def extract_track_id(self, url_or_uri: str) -> str:
        """Extract track ID from Spotify URL or URI"""
        if "spotify.com/track/" in url_or_uri:
            # URL format: https://open.spotify.com/track/ID?...
            track_id = url_or_uri.split("/track/")[1].split("?")[0]
        elif "spotify:track:" in url_or_uri:
            # URI format: spotify:track:ID
            track_id = url_or_uri.split(":")[-1]
        else:
            # Assume it's already a track ID
            track_id = url_or_uri

        return track_id

    def get_track_features(self, url_or_uri: str) -> Dict:
        """
        Get track metadata and audio features from Spotify

        Returns:
            Dict with track info and audio features
        """
        track_id = self.extract_track_id(url_or_uri)

        # Get track metadata
        track = self.sp.track(track_id)

        # Get audio features
        features = self.sp.audio_features([track_id])[0]

        if not features:
            raise ValueError(f"Could not get audio features for track {track_id}")

        return {
            "track_name": track["name"],
            "artist": ", ".join(artist["name"] for artist in track["artists"]),
            "album": track["album"]["name"],
            "duration_ms": track["duration_ms"],
            "features": {
                "tempo": features["tempo"],
                "key": features["key"],
                "mode": features["mode"],
                "time_signature": features["time_signature"],
                "energy": features["energy"],
                "danceability": features["danceability"],
                "valence": features["valence"],
                "acousticness": features["acousticness"],
                "instrumentalness": features["instrumentalness"],
                "liveness": features["liveness"],
                "loudness": features["loudness"],
                "speechiness": features["speechiness"],
            }
        }


def call_modal_edm_generator(features: Dict) -> Optional[bytes]:
    """
    Call Modal EDM generator service with audio features

    Returns:
        Audio bytes if successful, None if Modal not available
    """
    try:
        import modal

        # Try to get the Modal app
        # This is a placeholder - you would need to implement the actual Modal function
        print("  Connecting to Modal service...")

        # For now, return None to trigger fallback
        # In production, this would call your Modal EDM generation function
        return None

    except ImportError:
        print("  Modal not available")
        return None
    except Exception as e:
        print(f"  Modal error: {e}")
        return None


def generate_edm_local(features: Dict) -> bytes:
    """
    Generate EDM remix locally as fallback

    This is a placeholder that creates a simple MIDI file based on features
    """
    try:
        import pretty_midi
        from pathlib import Path
        import tempfile

        print("  Generating with local fallback (basic MIDI)...")

        # Create a simple EDM pattern based on features
        midi = pretty_midi.PrettyMIDI(initial_tempo=features["features"]["tempo"])

        # Create instruments
        kick = pretty_midi.Instrument(program=0)  # Acoustic Grand Piano (placeholder)
        bass = pretty_midi.Instrument(program=38)  # Synth Bass

        # Generate kick pattern (4-on-the-floor)
        duration = 30  # 30 seconds
        beat_duration = 60 / features["features"]["tempo"]

        for beat in range(int(duration / beat_duration)):
            time = beat * beat_duration
            note = pretty_midi.Note(
                velocity=100,
                pitch=36,  # C2 - kick
                start=time,
                end=time + 0.1
            )
            kick.notes.append(note)

        # Add bassline based on key
        key = features["features"]["key"]
        bass_note = 36 + key  # Start from C2 + key offset

        for beat in range(int(duration / beat_duration)):
            if beat % 2 == 0:  # Every other beat
                time = beat * beat_duration
                note = pretty_midi.Note(
                    velocity=80,
                    pitch=bass_note,
                    start=time,
                    end=time + beat_duration * 0.8
                )
                bass.notes.append(note)

        midi.instruments.append(kick)
        midi.instruments.append(bass)

        # Write to temporary file
        with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as f:
            midi.write(f.name)
            temp_path = f.name

        # Read the MIDI file
        with open(temp_path, "rb") as f:
            midi_bytes = f.read()

        # Clean up
        Path(temp_path).unlink()

        return midi_bytes

    except ImportError as e:
        raise ImportError(f"Required library not available: {e}")


def save_audio_file(audio_bytes: bytes, filename: str) -> str:
    """Save audio bytes to file"""
    output_path = Path(filename)

    with open(output_path, "wb") as f:
        f.write(audio_bytes)

    return str(output_path)


def sanitize_filename(text: str) -> str:
    """Convert text to safe filename"""
    import re
    # Remove invalid filename characters
    safe = re.sub(r'[^\w\s-]', '', text)
    safe = re.sub(r'[-\s]+', '_', safe)
    return safe[:50]  # Limit length


def main():
    parser = argparse.ArgumentParser(
        description="Generate EDM remix from Spotify track"
    )
    parser.add_argument(
        "spotify_url",
        nargs="?",
        help="Spotify track URL or URI"
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output filename (default: auto-generated)"
    )
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="Skip Modal and use local generation only"
    )

    args = parser.parse_args()

    # Get Spotify URL
    spotify_url = args.spotify_url
    if not spotify_url:
        spotify_url = input("Enter Spotify track URL: ").strip()

    if not spotify_url:
        print("Error: No Spotify URL provided")
        sys.exit(1)

    print("\n" + "="*60)
    print("EDM Remix Generator")
    print("="*60)

    try:
        # Step 1: Extract Spotify features
        print("\nExtracting Spotify features...")

        if not SPOTIPY_AVAILABLE:
            print("Error: spotipy not installed")
            print("Install with: pip install spotipy")
            sys.exit(1)

        extractor = SpotifyExtractor()
        track_info = extractor.get_track_features(spotify_url)

        print(f"  Track: {track_info['track_name']}")
        print(f"  Artist: {track_info['artist']}")
        print(f"  Tempo: {track_info['features']['tempo']:.1f} BPM")
        print(f"  Key: {track_info['features']['key']}")
        print(f"  Energy: {track_info['features']['energy']:.2f}")
        print(f"  Danceability: {track_info['features']['danceability']:.2f}")

        # Step 2: Generate EDM remix
        audio_bytes = None

        if not args.local_only:
            print("\nGenerating EDM remix on Modal...")
            audio_bytes = call_modal_edm_generator(track_info)

        if audio_bytes is None:
            print("\nGenerating EDM remix locally...")
            audio_bytes = generate_edm_local(track_info)

        # Step 3: Save audio file
        print("\nSaving audio file...")

        if args.output:
            filename = args.output
        else:
            artist_safe = sanitize_filename(track_info['artist'])
            track_safe = sanitize_filename(track_info['track_name'])

            # Try MP3 first, fall back to MIDI if local generation was used
            extension = ".mp3" if args.local_only else ".mid"
            filename = f"{artist_safe}_{track_safe}_edm_remix{extension}"

        output_path = save_audio_file(audio_bytes, filename)

        print(f"\nGenerated: {output_path}")
        print(f"  Size: {len(audio_bytes) / 1024:.1f} KB")

        print("\n" + "="*60)
        print("Success!")
        print("="*60)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
