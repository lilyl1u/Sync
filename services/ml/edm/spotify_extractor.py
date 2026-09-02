#!/usr/bin/env python3
"""
Spotify Feature Extraction Module

This module provides functionality to extract audio features and metadata
from Spotify tracks using the Spotify Web API via the spotipy library.

Features extracted:
- Audio features: energy, danceability, valence, tempo, loudness, acousticness,
  instrumentalness, speechiness, key, mode, duration_ms
- Track metadata: name, artist(s), album

Usage:
    As a module:
        from spotify_extractor import SpotifyFeatureExtractor

        extractor = SpotifyFeatureExtractor()
        features = extractor.extract_features("spotify:track:3n3Ppam7vgaVa1iaRUc9Lp")

    As a command-line script:
        python spotify_extractor.py "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp"
        python spotify_extractor.py "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp"

Requirements:
    - spotipy
    - python-dotenv

Environment Variables:
    SPOTIFY_CLIENT_ID: Your Spotify application client ID
    SPOTIFY_CLIENT_SECRET: Your Spotify application client secret
"""

import os
import re
import sys
import json
from typing import Dict, Optional, Any
from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials


class SpotifyFeatureExtractor:
    """
    A class to extract audio features and metadata from Spotify tracks.

    Uses the Spotify Web API with client credentials flow for authentication.
    """

    def __init__(self, client_id: Optional[str] = None, client_secret: Optional[str] = None):
        """
        Initialize the Spotify Feature Extractor.

        Args:
            client_id: Spotify client ID. If not provided, reads from SPOTIFY_CLIENT_ID env var.
            client_secret: Spotify client secret. If not provided, reads from SPOTIFY_CLIENT_SECRET env var.

        Raises:
            ValueError: If credentials are not provided and not found in environment variables.
        """
        # Load environment variables from .env file if it exists
        load_dotenv()

        # Get credentials from parameters or environment
        self.client_id = client_id or os.getenv('SPOTIFY_CLIENT_ID')
        self.client_secret = client_secret or os.getenv('SPOTIFY_CLIENT_SECRET')

        if not self.client_id or not self.client_secret:
            raise ValueError(
                "Spotify credentials not found. Please provide client_id and client_secret "
                "as parameters or set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables."
            )

        # Initialize Spotify client with client credentials flow
        try:
            auth_manager = SpotifyClientCredentials(
                client_id=self.client_id,
                client_secret=self.client_secret
            )
            self.sp = spotipy.Spotify(auth_manager=auth_manager)
        except Exception as e:
            raise ValueError(f"Failed to authenticate with Spotify: {str(e)}")

    @staticmethod
    def parse_track_id(spotify_input: str) -> str:
        """
        Extract track ID from Spotify URL or URI.

        Supports multiple input formats:
        - Spotify URI: spotify:track:3n3Ppam7vgaVa1iaRUc9Lp
        - Spotify URL: https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp
        - Direct track ID: 3n3Ppam7vgaVa1iaRUc9Lp

        Args:
            spotify_input: Spotify track URL, URI, or ID

        Returns:
            str: The extracted track ID

        Raises:
            ValueError: If the input format is invalid
        """
        # Remove any query parameters and fragments
        spotify_input = spotify_input.split('?')[0].split('#')[0].strip()

        # Pattern for Spotify URI: spotify:track:TRACK_ID
        uri_pattern = r'spotify:track:([a-zA-Z0-9]+)'
        uri_match = re.match(uri_pattern, spotify_input)
        if uri_match:
            return uri_match.group(1)

        # Pattern for Spotify URL: https://open.spotify.com/track/TRACK_ID
        url_pattern = r'https?://open\.spotify\.com/track/([a-zA-Z0-9]+)'
        url_match = re.match(url_pattern, spotify_input)
        if url_match:
            return url_match.group(1)

        # Check if it's just a track ID (alphanumeric string of reasonable length)
        id_pattern = r'^[a-zA-Z0-9]{22}$'
        if re.match(id_pattern, spotify_input):
            return spotify_input

        raise ValueError(
            f"Invalid Spotify input: '{spotify_input}'. "
            "Please provide a valid Spotify track URL, URI, or ID."
        )

    def extract_features(self, spotify_input: str) -> Dict[str, Any]:
        """
        Extract audio features and metadata from a Spotify track.

        Args:
            spotify_input: Spotify track URL, URI, or ID

        Returns:
            dict: A dictionary containing:
                - track_id: Spotify track ID
                - track_name: Name of the track
                - artist_name: Primary artist name
                - artists: List of all artist names
                - album_name: Album name
                - release_date: Album release date
                - duration_ms: Track duration in milliseconds
                - popularity: Track popularity (0-100)
                - Audio features:
                    - energy: 0.0 to 1.0
                    - danceability: 0.0 to 1.0
                    - valence: 0.0 to 1.0 (musical positiveness)
                    - tempo: BPM (beats per minute)
                    - loudness: dB
                    - acousticness: 0.0 to 1.0
                    - instrumentalness: 0.0 to 1.0
                    - speechiness: 0.0 to 1.0
                    - key: 0-11 (pitch class notation, 0=C, 1=C#, etc.)
                    - mode: 0 (minor) or 1 (major)
                    - time_signature: Time signature (e.g., 4 for 4/4)
                    - liveness: 0.0 to 1.0 (presence of audience)

        Raises:
            ValueError: If the input format is invalid
            Exception: If there's an error fetching data from Spotify API
        """
        try:
            # Parse the track ID from various input formats
            track_id = self.parse_track_id(spotify_input)

            # Get track metadata
            track_info = self.sp.track(track_id)

            # Get audio features
            audio_features = self.sp.audio_features(track_id)[0]

            if not audio_features:
                raise Exception(f"No audio features found for track ID: {track_id}")

            # Extract artist information
            artists = [artist['name'] for artist in track_info['artists']]
            primary_artist = artists[0] if artists else "Unknown Artist"

            # Build the feature dictionary
            features = {
                # Track identification
                'track_id': track_id,
                'track_name': track_info['name'],
                'artist_name': primary_artist,
                'artists': artists,
                'album_name': track_info['album']['name'],
                'release_date': track_info['album']['release_date'],
                'duration_ms': track_info['duration_ms'],
                'popularity': track_info['popularity'],

                # Audio features
                'energy': audio_features['energy'],
                'danceability': audio_features['danceability'],
                'valence': audio_features['valence'],
                'tempo': audio_features['tempo'],
                'loudness': audio_features['loudness'],
                'acousticness': audio_features['acousticness'],
                'instrumentalness': audio_features['instrumentalness'],
                'speechiness': audio_features['speechiness'],
                'key': audio_features['key'],
                'mode': audio_features['mode'],
                'time_signature': audio_features['time_signature'],
                'liveness': audio_features['liveness'],

                # Spotify URLs
                'spotify_url': track_info['external_urls']['spotify'],
                'spotify_uri': track_info['uri'],
            }

            return features

        except ValueError as e:
            # Re-raise ValueError (invalid input format)
            raise
        except spotipy.exceptions.SpotifyException as e:
            if e.http_status == 404:
                raise Exception(f"Track not found: {spotify_input}")
            elif e.http_status == 401:
                raise Exception("Authentication failed. Please check your Spotify credentials.")
            else:
                raise Exception(f"Spotify API error: {str(e)}")
        except Exception as e:
            raise Exception(f"Error extracting features: {str(e)}")

    def extract_features_batch(self, spotify_inputs: list) -> Dict[str, Dict[str, Any]]:
        """
        Extract features from multiple tracks.

        Args:
            spotify_inputs: List of Spotify track URLs, URIs, or IDs

        Returns:
            dict: Dictionary mapping each input to its features or error
                  Format: {input: {'success': True, 'data': features} or {'success': False, 'error': msg}}
        """
        results = {}

        for spotify_input in spotify_inputs:
            try:
                features = self.extract_features(spotify_input)
                results[spotify_input] = {
                    'success': True,
                    'data': features
                }
            except Exception as e:
                results[spotify_input] = {
                    'success': False,
                    'error': str(e)
                }

        return results

    def get_key_name(self, key: int, mode: int) -> str:
        """
        Convert key and mode integers to musical key name.

        Args:
            key: Integer from 0-11 (pitch class)
            mode: 0 (minor) or 1 (major)

        Returns:
            str: Key name (e.g., "C Major", "A Minor")
        """
        key_names = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F',
                     'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B']
        mode_name = 'Major' if mode == 1 else 'Minor'

        if 0 <= key <= 11:
            return f"{key_names[key]} {mode_name}"
        return "Unknown"


def print_features(features: Dict[str, Any], indent: int = 2) -> None:
    """
    Pretty print the extracted features.

    Args:
        features: Feature dictionary returned by extract_features()
        indent: Number of spaces for JSON indentation
    """
    print(json.dumps(features, indent=indent))


def main():
    """
    Command-line interface for the Spotify Feature Extractor.
    """
    if len(sys.argv) < 2:
        print("Usage: python spotify_extractor.py <spotify_track_url_or_uri>")
        print("\nExamples:")
        print("  python spotify_extractor.py 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp'")
        print("  python spotify_extractor.py 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp'")
        print("  python spotify_extractor.py '3n3Ppam7vgaVa1iaRUc9Lp'")
        sys.exit(1)

    spotify_input = sys.argv[1]

    try:
        # Initialize extractor
        extractor = SpotifyFeatureExtractor()

        # Extract features
        print(f"Extracting features from: {spotify_input}\n")
        features = extractor.extract_features(spotify_input)

        # Print results
        print("=" * 60)
        print(f"Track: {features['track_name']}")
        print(f"Artist: {features['artist_name']}")
        print(f"Album: {features['album_name']}")
        print("=" * 60)
        print("\nAudio Features:")
        print("-" * 60)

        # Print audio features in a formatted way
        key_name = extractor.get_key_name(features['key'], features['mode'])
        print(f"  Energy:           {features['energy']:.3f}")
        print(f"  Danceability:     {features['danceability']:.3f}")
        print(f"  Valence:          {features['valence']:.3f}")
        print(f"  Tempo:            {features['tempo']:.2f} BPM")
        print(f"  Loudness:         {features['loudness']:.2f} dB")
        print(f"  Acousticness:     {features['acousticness']:.3f}")
        print(f"  Instrumentalness: {features['instrumentalness']:.3f}")
        print(f"  Speechiness:      {features['speechiness']:.3f}")
        print(f"  Liveness:         {features['liveness']:.3f}")
        print(f"  Key:              {features['key']} ({key_name})")
        print(f"  Mode:             {features['mode']} ({'Major' if features['mode'] == 1 else 'Minor'})")
        print(f"  Time Signature:   {features['time_signature']}/4")
        print(f"  Duration:         {features['duration_ms'] / 1000:.2f} seconds")
        print(f"  Popularity:       {features['popularity']}/100")

        print("\n" + "=" * 60)
        print("\nFull JSON output:")
        print("-" * 60)
        print_features(features)

        return 0

    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
