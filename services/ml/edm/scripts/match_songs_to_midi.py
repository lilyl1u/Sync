"""
Match user-entered songs to MIDI files in LMD (string/fuzzy matching)

No Spotify required. User provides artist + song name (e.g. "Noah Kahan – Call Your Mom").
Uses string normalization and fuzzy matching against LMD metadata.

Pipeline:
  1. Load user songs (from JSON file or CLI)
  2. Load LMD metadata (from md5_to_paths.json or MIDI filenames)
  3. Fuzzy match user songs → LMD tracks
  4. Output matched MIDI paths for generate_from_matched.py

Usage:
  modal run scripts/match_songs_to_midi.py --songs-file data/spotify_tracks.json
  modal run scripts/match_songs_to_midi.py --song "Noah Kahan – Call Your Mom"
  modal run scripts/match_songs_to_midi.py --song "Noah Kahan – Call Your Mom" --song "boygenius – Not Strong Enough"
"""

import modal
import json
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from difflib import SequenceMatcher

app = modal.App("match-songs-to-midi")

dataset_volume = modal.Volume.from_name("lmd-dataset")
processed_volume = modal.Volume.from_name("lmd-processed", create_if_missing=True)

MD5_TO_PATHS_URL = "https://colinraffel.com/projects/lmd/md5_to_paths.json"

image = modal.Image.debian_slim(python_version="3.11").pip_install("tqdm", "requests")

DATASET_PATH = "/data"
PROCESSED_PATH = "/processed"

MIN_CONFIDENCE_EXACT = 0.95
MIN_CONFIDENCE_FUZZY = 0.80
MIN_CONFIDENCE_WEAK = 0.60


def normalize_string(s: str) -> str:
    """Normalize string for matching: lowercase, remove extras, collapse whitespace."""
    if not s:
        return ""
    s = s.lower().strip()
    s = re.sub(r'[\[\]\(\)\-–—]', ' ', s)
    s = re.sub(r'\b(the|a|an)\b', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def similarity_score(a: str, b: str) -> float:
    """Return 0-1 similarity between two strings."""
    if not a or not b:
        return 0.0
    na, nb = normalize_string(a), normalize_string(b)
    if na == nb:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def parse_artist_song_from_path(path_str: str) -> Tuple[str, str]:
    """
    Parse 'Artist - Song' or 'Artist – Song' from path/filename.
    Returns (artist, song).
    """
    name = Path(path_str).stem
    for sep in [' - ', ' – ', ' — ', '-', '–']:
        if sep in name:
            parts = name.split(sep, 1)
            if len(parts) == 2:
                artist, song = parts[0].strip(), parts[1].strip()
                if artist and song:
                    return artist, song
    return "", name


def calculate_match_confidence(
    user_artist: str, user_song: str,
    lmd_artist: str, lmd_song: str
) -> Tuple[float, Dict]:
    """Calculate match confidence (0-1) with score details."""
    artist_score = similarity_score(user_artist, lmd_artist)
    song_score = similarity_score(user_song, lmd_song)
    combined = 0.4 * artist_score + 0.6 * song_score
    return combined, {
        "artist_score": artist_score,
        "song_score": song_score,
    }


@app.function(
    image=image,
    volumes={
        DATASET_PATH: dataset_volume,
        PROCESSED_PATH: processed_volume,
    },
    timeout=3600,
)
def match_tracks(user_tracks: List[Dict], min_similarity: float = 0.75) -> Dict:
    """
    Match user tracks (artist + name) to LMD MIDI files using string/fuzzy matching.

    Args:
        user_tracks: [{"artist": "...", "name": "..."}, ...]
        min_similarity: Minimum score to accept (default 0.75)

    Returns:
        Dict with matched, unmatched, statistics
    """
    from tqdm import tqdm

    print("=" * 60)
    print("Song → MIDI Matching (String/Fuzzy)")
    print("=" * 60)

    if not user_tracks:
        raise ValueError("No tracks provided")

    lmd_dir = Path(DATASET_PATH) / "lmd_full"
    if not lmd_dir.exists():
        raise FileNotFoundError(
            f"LMD dataset not found at {lmd_dir}. "
            "Run: modal run scripts/modal_download_lmd.py"
        )

    # Load md5_to_paths.json for metadata (artist/song from original filenames)
    md5_to_meta = {}
    paths_json = Path(PROCESSED_PATH) / "md5_to_paths.json"

    if paths_json.exists():
        print("\nLoading md5_to_paths.json for metadata...")
        with open(paths_json) as f:
            raw = json.load(f)
        for md5, paths in raw.items():
            path_str = paths[0] if isinstance(paths, list) else paths
            artist, song = parse_artist_song_from_path(path_str)
            if artist or song:
                md5_to_meta[md5.lower()] = {"artist": artist, "song": song}
        print(f"  Loaded metadata for {len(md5_to_meta):,} tracks")
    else:
        print("\nmd5_to_paths.json not found. Run with --download-metadata first.")

    # Build track_id -> metadata from actual files
    print("\nScanning LMD directory...")
    midi_files = list(lmd_dir.rglob("*.mid"))
    if not midi_files:
        raise FileNotFoundError(f"No MIDI files in {lmd_dir}")

    print(f"Found {len(midi_files):,} MIDI files")

    # Group by track_id (use folder or md5 as id for dedup)
    track_metadata = {}
    for midi_path in tqdm(midi_files, desc="Indexing"):
        rel_path = str(midi_path.relative_to(lmd_dir))
        stem = midi_path.stem.lower()

        artist, song = "", ""
        if stem in md5_to_meta:
            artist = md5_to_meta[stem].get("artist", "")
            song = md5_to_meta[stem].get("song", "")
        else:
            artist, song = parse_artist_song_from_path(midi_path.name)

        track_id = midi_path.parent.name if midi_path.parent != lmd_dir else stem
        if track_id not in track_metadata:
            track_metadata[track_id] = {
                "artist": artist,
                "song": song,
                "midi_files": [],
            }
        track_metadata[track_id]["midi_files"].append(rel_path)

    print(f"Indexed {len(track_metadata):,} unique tracks")

    # Match user tracks
    matched = []
    unmatched = []

    for user_track in tqdm(user_tracks, desc="Matching"):
        user_artist = user_track.get("artist", "")
        user_song = user_track.get("name", user_track.get("song", ""))

        if not user_artist and not user_song:
            unmatched.append({
                "user_track": user_track,
                "reason": "missing_metadata",
            })
            continue

        best_match = None
        best_score = 0.0
        best_details = None

        for track_id, meta in track_metadata.items():
            lmd_artist = meta["artist"]
            lmd_song = meta["song"]
            if not lmd_artist and not lmd_song:
                continue

            score, details = calculate_match_confidence(
                user_artist, user_song, lmd_artist, lmd_song
            )
            if score > best_score:
                best_score = score
                best_match = {
                    "track_id": track_id,
                    "msd_artist": lmd_artist,
                    "msd_song": lmd_song,
                    "midi_files": meta["midi_files"],
                }
                best_details = details

        spotify_track = {**user_track, "artist": user_artist, "name": user_song}
        if best_match and best_score >= min_similarity:
            matched.append({
                "spotify_track": spotify_track,
                "matched_track": best_match,
                "match_score": round(best_score, 4),
                "score_details": best_details,
            })
        else:
            unmatched.append({
                "spotify_track": spotify_track,
                "best_match": best_match,
                "best_score": round(best_score, 4) if best_match else 0,
                "reason": "below_threshold",
            })

    # Save results
    output = {
        "matched": matched,
        "unmatched": unmatched,
        "statistics": {
            "total_user_tracks": len(user_tracks),
            "matched_count": len(matched),
            "unmatched_count": len(unmatched),
            "match_rate": len(matched) / len(user_tracks) if user_tracks else 0,
        },
    }

    out_path = Path(PROCESSED_PATH) / "spotify_midi_matches.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    processed_volume.commit()

    print("\n" + "=" * 60)
    print(f"Matched: {len(matched)} | Unmatched: {len(unmatched)}")
    print(f"Match rate: {output['statistics']['match_rate']:.1%}")
    print(f"Saved to {out_path}")
    print("=" * 60)

    return output


@app.function(
    image=image,
    volumes={PROCESSED_PATH: processed_volume},
    timeout=300,
)
def download_metadata():
    """Download md5_to_paths.json for artist/song metadata."""
    import requests

    Path(PROCESSED_PATH).mkdir(parents=True, exist_ok=True)
    out_path = Path(PROCESSED_PATH) / "md5_to_paths.json"

    if out_path.exists():
        print("md5_to_paths.json already exists")
        return {"status": "exists", "path": str(out_path)}

    print("Downloading md5_to_paths.json...")
    r = requests.get(MD5_TO_PATHS_URL, timeout=120)
    r.raise_for_status()
    data = r.json()
    with open(out_path, "w") as f:
        json.dump(data, f)
    processed_volume.commit()
    print(f"Saved {len(data):,} entries to {out_path}")
    return {"status": "downloaded", "entries": len(data), "path": str(out_path)}


def parse_song_string(s: str) -> Dict:
    """Parse 'Artist – Song' or 'Artist - Song' into {artist, name}."""
    for sep in [" – ", " — ", " - "]:
        if sep in s:
            parts = s.split(sep, 1)
            return {"artist": parts[0].strip(), "name": parts[1].strip()}
    if "-" in s:
        parts = s.split("-", 1)
        return {"artist": parts[0].strip(), "name": parts[1].strip()}
    return {"artist": "", "name": s.strip()}


@app.local_entrypoint()
def main(
    songs_file: str = "data/spotify_tracks.json",
    song: Optional[str] = None,
    min_similarity: float = 0.75,
    download_metadata_flag: bool = False,
):
    """
    Match user-entered songs to LMD MIDI files.

    Args:
        songs_file: JSON file with tracks ({"tracks": [{"artist", "name"}]})
        song: Single song as "Artist – Song" (can repeat)
        min_similarity: Match threshold 0-1 (default 0.75)
        download_metadata_flag: Download md5_to_paths.json first
    """
    if download_metadata_flag:
        print("Downloading metadata...")
        download_metadata.remote()
        return

    tracks = []

    if song:
        tracks.append(parse_song_string(song))

    songs_path = Path(songs_file)
    if songs_path.exists():
        with open(songs_path) as f:
            data = json.load(f)
        raw = data.get("tracks", data) if isinstance(data, dict) else data
        for t in raw:
            if isinstance(t, str):
                tracks.append(parse_song_string(t))
            else:
                tracks.append({
                    "artist": t.get("artist", ""),
                    "name": t.get("name", t.get("song", "")),
                })

    if not tracks:
        print("No tracks to match. Use --songs-file or --song")
        print("\nExamples:")
        print('  modal run scripts/match_songs_to_midi.py --song "Noah Kahan – Call Your Mom"')
        print('  modal run scripts/match_songs_to_midi.py --songs-file data/spotify_tracks.json')
        print('  modal run scripts/match_songs_to_midi.py --download-metadata-flag  # First-time setup')
        return

    print(f"Matching {len(tracks)} track(s)...")
    result = match_tracks.remote(tracks, min_similarity)

    print(f"\n✓ Done. Matched {result['statistics']['matched_count']} of {result['statistics']['total_user_tracks']}")
