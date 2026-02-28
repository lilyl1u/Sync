"""
Script to fetch training data from Spotify API
"""

import os
import json
import logging
from pathlib import Path
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

def fetch_spotify_data(user_id: str = None, playlist_ids: list = None, output_dir: str = "./data/training"):
    """
    Fetch data from Spotify API for training

    Args:
        user_id: Spotify user ID
        playlist_ids: List of playlist IDs to fetch
        output_dir: Directory to save training data
    """
    # Initialize Spotify client
    client_credentials_manager = SpotifyClientCredentials(
        client_id=os.getenv("SPOTIFY_CLIENT_ID"),
        client_secret=os.getenv("SPOTIFY_CLIENT_SECRET")
    )
    sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    training_data = []

    # Fetch playlists
    if playlist_ids:
        for playlist_id in playlist_ids:
            logger.info(f"Fetching playlist: {playlist_id}")

            try:
                # Get playlist tracks
                results = sp.playlist_tracks(playlist_id)
                tracks = results['items']

                while results['next']:
                    results = sp.next(results)
                    tracks.extend(results['items'])

                # Extract track information
                for item in tracks:
                    track = item['track']
                    if not track:
                        continue

                    # Get audio features
                    audio_features = sp.audio_features(track['id'])[0]

                    if audio_features:
                        track_data = {
                            'track_id': track['id'],
                            'name': track['name'],
                            'artists': [artist['name'] for artist in track['artists']],
                            'preview_url': track['preview_url'],
                            'audio_features': audio_features,
                            'genres': []  # Will be populated if artist genres available
                        }

                        # Get artist genres
                        artist_id = track['artists'][0]['id']
                        artist_info = sp.artist(artist_id)
                        track_data['genres'] = artist_info.get('genres', [])

                        training_data.append(track_data)

                logger.info(f"Fetched {len(tracks)} tracks from playlist {playlist_id}")

            except Exception as e:
                logger.error(f"Error fetching playlist {playlist_id}: {str(e)}")
                continue

    # Save training data
    output_file = output_path / "spotify_training_data.json"
    with open(output_file, 'w') as f:
        json.dump(training_data, f, indent=2)

    logger.info(f"Saved {len(training_data)} tracks to {output_file}")

    return training_data

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Fetch Spotify data for training")
    parser.add_argument("--user-id", type=str, help="Spotify user ID")
    parser.add_argument("--playlist-ids", type=str, nargs="+", help="Playlist IDs to fetch")
    parser.add_argument("--output-dir", type=str, default="./data/training", help="Output directory")

    args = parser.parse_args()

    if not args.playlist_ids:
        logger.error("Please provide at least one playlist ID using --playlist-ids")
        exit(1)

    fetch_spotify_data(args.user_id, args.playlist_ids, args.output_dir)
