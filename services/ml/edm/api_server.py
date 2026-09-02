#!/usr/bin/env python3
"""
FastAPI server for EDM remix generation

Provides web API endpoints for the EDM generator.
Handles Spotify feature extraction and Modal/local generation.

Usage:
    python api_server.py
    # Or: uvicorn api_server:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Dict, Optional
from pathlib import Path
import os
import sys
import logging
import tempfile
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import the Spotify extractor
try:
    import spotipy
    from spotipy.oauth2 import SpotifyClientCredentials
    SPOTIPY_AVAILABLE = True
except ImportError:
    SPOTIPY_AVAILABLE = False
    logger.warning("spotipy not installed. Spotify features will not be available.")

# Initialize FastAPI app
app = FastAPI(
    title="EDM Remix Generator API",
    description="Generate EDM remixes from Spotify tracks",
    version="1.0.0"
)

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory for generated files
OUTPUT_DIR = Path("generated_edm")
OUTPUT_DIR.mkdir(exist_ok=True)

# Job storage (in production, use Redis or database)
jobs: Dict[str, Dict] = {}


# ==================== Request/Response Models ====================

class ProfileTracksRequest(BaseModel):
    profile_url: str = Field(..., description="Spotify profile/user URL")
    limit: int = Field(default=50, description="Max tracks to return")


class EDMGenerateRequest(BaseModel):
    spotify_url: str = Field(..., description="Spotify track URL or URI")
    local_only: bool = Field(default=False, description="Skip Modal, use local generation")


class EDMGenerateResponse(BaseModel):
    status: str
    job_id: str
    track_name: str
    artist: str
    features: Dict
    filename: str
    size_bytes: int
    download_url: str


class JobStatus(BaseModel):
    job_id: str
    status: str  # queued, processing, completed, failed
    progress: float  # 0-100
    created_at: str
    updated_at: str
    result: Optional[Dict] = None
    error: Optional[str] = None


# ==================== Spotify Feature Extraction ====================

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

        auth_manager = SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret
        )
        self.sp = spotipy.Spotify(auth_manager=auth_manager)

    def extract_track_id(self, url_or_uri: str) -> str:
        """Extract track ID from Spotify URL or URI"""
        if "spotify.com/track/" in url_or_uri:
            track_id = url_or_uri.split("/track/")[1].split("?")[0]
        elif "spotify:track:" in url_or_uri:
            track_id = url_or_uri.split(":")[-1]
        else:
            track_id = url_or_uri
        return track_id

    def extract_user_id(self, url_or_uri: str) -> str:
        """Extract user ID from Spotify profile URL or URI"""
        if "spotify.com/user/" in url_or_uri:
            user_id = url_or_uri.split("/user/")[1].split("?")[0].split("/")[0]
        elif "spotify:user:" in url_or_uri:
            user_id = url_or_uri.split(":")[-1]
        else:
            user_id = url_or_uri
        return user_id

    def get_user_tracks(self, profile_url: str, limit: int = 50) -> Dict:
        """Get tracks from a user's public playlists"""
        user_id = self.extract_user_id(profile_url)

        try:
            user = self.sp.user(user_id)
        except Exception:
            raise ValueError(f"Could not find Spotify user: {user_id}")

        playlists = self.sp.user_playlists(user_id, limit=10)
        tracks = []
        seen_ids = set()

        for playlist in playlists.get("items", []):
            if not playlist:
                continue
            try:
                results = self.sp.playlist_tracks(
                    playlist["id"], limit=min(limit - len(tracks), 20)
                )
            except Exception:
                continue

            for item in results.get("items", []):
                track = item.get("track")
                if not track or not track.get("id") or track["id"] in seen_ids:
                    continue
                seen_ids.add(track["id"])
                tracks.append({
                    "id": track["id"],
                    "name": track["name"],
                    "artist": ", ".join(a["name"] for a in track["artists"]),
                    "album": track["album"]["name"],
                    "url": track["external_urls"].get("spotify", ""),
                    "duration_ms": track["duration_ms"],
                    "playlist": playlist["name"],
                })
                if len(tracks) >= limit:
                    break
            if len(tracks) >= limit:
                break

        return {
            "user_id": user_id,
            "display_name": user.get("display_name", user_id),
            "tracks": tracks,
            "total": len(tracks),
        }

    def get_track_features(self, url_or_uri: str) -> Dict:
        """Get track metadata and audio features from Spotify"""
        import random

        track_id = self.extract_track_id(url_or_uri)
        track = self.sp.track(track_id)

        # audio-features API was restricted by Spotify (403 for most apps)
        features = None
        try:
            result = self.sp.audio_features([track_id])
            if result and result[0]:
                features = result[0]
        except Exception as e:
            logger.warning(f"audio-features unavailable (Spotify API restriction): {e}")

        if features:
            feat_dict = {
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
        else:
            # Derive what we can from track popularity, seed the rest
            popularity = track.get("popularity", 50) / 100.0
            seed = hash(track_id) & 0xFFFFFFFF
            rng = random.Random(seed)
            feat_dict = {
                "tempo": rng.uniform(118, 140),
                "key": rng.randint(0, 11),
                "mode": rng.randint(0, 1),
                "time_signature": 4,
                "energy": 0.4 + popularity * 0.5 + rng.uniform(-0.1, 0.1),
                "danceability": 0.5 + popularity * 0.3 + rng.uniform(-0.1, 0.1),
                "valence": rng.uniform(0.3, 0.8),
                "acousticness": rng.uniform(0.05, 0.3),
                "instrumentalness": rng.uniform(0.0, 0.2),
                "liveness": rng.uniform(0.05, 0.3),
                "loudness": rng.uniform(-8, -3),
                "speechiness": rng.uniform(0.03, 0.15),
            }
            for k in ("energy", "danceability", "valence", "acousticness",
                       "instrumentalness", "liveness", "speechiness"):
                feat_dict[k] = max(0.0, min(1.0, feat_dict[k]))
            logger.info(f"Using generated features for {track['name']} (seed={seed})")

        return {
            "track_name": track["name"],
            "artist": ", ".join(artist["name"] for artist in track["artists"]),
            "album": track["album"]["name"],
            "duration_ms": track["duration_ms"],
            "features": feat_dict,
        }


# ==================== EDM Generation ====================

def call_modal_edm_generator(features: Dict) -> Optional[bytes]:
    """
    Call Modal EDM generator service

    This is a placeholder for actual Modal integration.
    In production, this would call your Modal function.
    """
    try:
        import modal
        logger.info("Attempting Modal EDM generation...")

        # TODO: Implement actual Modal function call
        # Example:
        # from modal_edm_generator import app as edm_app
        # with edm_app.run():
        #     audio_bytes = generate_edm.remote(features)
        #     return audio_bytes

        return None  # Fallback to local for now

    except ImportError:
        logger.info("Modal not available")
        return None
    except Exception as e:
        logger.error(f"Modal generation error: {e}")
        return None


def generate_edm_local(features: Dict) -> bytes:
    """Generate Geometry Dash style EDM: intro → build → drop structure"""
    import random
    import numpy as np
    from scipy.io import wavfile

    models_dir = str(Path(__file__).parent / "src" / "models")
    if models_dir not in sys.path:
        sys.path.insert(0, models_dir)

    from edm_synthesizer import EDMSynthesizer, SynthConfig
    from drum_pattern_generator import (
        EDMPatternLibrary, DrumPattern, DrumType, PatternVariation,
    )

    f = features["features"]

    # Force tempo into energetic EDM range (130-180)
    raw_tempo = f["tempo"]
    if raw_tempo < 100:
        raw_tempo *= 2
    tempo = max(130, min(180, int(raw_tempo)))

    config = SynthConfig(
        tempo=tempo,
        energy=max(0.7, f["energy"]),
        valence=f["valence"],
        danceability=max(0.7, f["danceability"]),
    )
    synth = EDMSynthesizer(config)

    # Deterministic randomness per track
    seed = hash(features.get("track_name", "edm")) & 0xFFFFFFFF
    random.seed(seed)

    # ---- Musical setup ----
    key = f["key"]
    mode = f["mode"]
    root_midi = 48 + key
    scale = [0, 2, 4, 5, 7, 9, 11] if mode == 1 else [0, 2, 3, 5, 7, 8, 10]

    def note(degree, octave=0):
        """Scale degree → MIDI note. Handles wrapping across octaves."""
        o = degree // len(scale)
        i = degree % len(scale)
        return root_midi + scale[i] + (o + octave) * 12

    # Chord progression (scale degrees for root of each chord)
    if mode == 1:
        chord_roots = [0, 4, 5, 3]   # I - V - vi - IV
    else:
        chord_roots = [0, 5, 2, 6]   # i - VI - III - VII

    beat = 60.0 / tempo
    eighth = beat / 2
    bar_dur = beat * 4

    # ---- Song structure: 16 bars ----
    # Bars 0-3:  Intro  (hihats + sparse melody)
    # Bars 4-7:  Build  (drums fill in, bass enters, melody intensifies)
    # Bars 8-15: Drop   (full kick+snare+hihat, pumping bass, full melody)
    total_bars = 16

    logger.info(f"Generating {total_bars} bars at {tempo} BPM, "
                f"key={key} {'maj' if mode == 1 else 'min'}")

    # ==== DRUMS (rendered per section, then concatenated) ====
    logger.info("  Drums...")
    drum_sections = []

    # Intro: soft hihats, occasional kick
    intro_p = DrumPattern(steps=16)
    for s in range(0, 16, 2):
        intro_p.add_hit(s, DrumType.HIHAT_CLOSED, random.randint(45, 65))
    for s in [0, 8]:
        intro_p.add_hit(s, DrumType.KICK, 65)
    drum_sections.append(synth.synthesize_drums(intro_p, bars=4))

    # Build: each bar gets denser
    for bi in range(4):
        bp = DrumPattern(steps=16)
        for s in range(0, 16, 4):
            bp.add_hit(s, DrumType.KICK, 85 + bi * 10)
        hh_step = max(1, 4 - bi)
        for s in range(0, 16, hh_step):
            bp.add_hit(s, DrumType.HIHAT_CLOSED, 55 + bi * 12)
        if bi >= 2:
            snare_step = max(1, 4 - bi)
            for s in range(0, 16, snare_step):
                bp.add_hit(s, DrumType.SNARE, 50 + bi * 18)
        if bi == 3:
            bp.add_hit(15, DrumType.CRASH, 120)
        drum_sections.append(synth.synthesize_drums(bp, bars=1))

    # Drop: full energy
    drop_p = DrumPattern(steps=16)
    for s in range(0, 16, 4):
        drop_p.add_hit(s, DrumType.KICK, 127)
    for s in [4, 12]:
        drop_p.add_hit(s, DrumType.SNARE, 115)
        drop_p.add_hit(s, DrumType.CLAP, 95)
    for s in range(0, 16, 2):
        drop_p.add_hit(s, DrumType.HIHAT_CLOSED, random.randint(75, 100))
    for s in [6, 14]:
        if random.random() < 0.5:
            drop_p.add_hit(s, DrumType.HIHAT_OPEN, 80)
    drop_p.add_hit(0, DrumType.CRASH, 115)

    drop_p = PatternVariation.velocity_variation(drop_p, 0.08)
    drum_sections.append(synth.synthesize_drums(drop_p, bars=8))

    drum_audio = np.concatenate(drum_sections)

    # ==== BASS (follows chord roots) ====
    logger.info("  Bass...")
    bass_notes = []
    for bar in range(total_bars):
        cr = chord_roots[bar % len(chord_roots)]
        t0 = bar * bar_dur
        bass_n = note(cr, octave=-1)

        if bar < 4:
            pass  # no bass in intro
        elif bar < 8:
            # Build: sustained notes, getting louder
            vel = 0.4 + 0.12 * (bar - 4)
            bass_notes.append((bass_n, t0, bar_dur * 0.9, vel))
        else:
            # Drop: pumping 8th-note bass
            for i in range(8):
                t = t0 + i * eighth
                vel = 0.9 if i % 2 == 0 else 0.5
                bass_notes.append((bass_n, t, eighth * 0.7, vel))

    bass_audio = (synth.synthesize_midi_notes(bass_notes, 'saw_bass')
                  if bass_notes else np.zeros(1))

    # ==== LEAD MELODY (chord-following patterns) ====
    logger.info("  Lead...")
    # Each pattern: list of (8th-note position in bar, scale-degree offset from chord root)
    # These create melodic shapes that transpose with each chord change
    melodies = [
        [(0,0),(1,2),(2,4),(3,7),(4,4),(5,2),(6,4),(7,0)],       # arch
        [(0,4),(1,2),(2,0),(3,2),(4,4),(5,7),(6,4),(7,2)],       # wave
        [(0,0),(1,1),(2,2),(3,4),(4,5),(5,4),(6,2),(7,0)],       # scale run
        [(0,7),(1,4),(2,2),(3,0),(4,2),(5,4),(6,7),(7,9)],       # descent-ascent
    ]

    lead_notes = []
    for bar in range(total_bars):
        cr = chord_roots[bar % len(chord_roots)]
        t0 = bar * bar_dur
        pat = melodies[bar % len(melodies)]

        if bar < 4:
            # Intro: just chord tones on beats 1 and 3, held long
            for bi in [0, 2]:
                deg = [0, 4][bi // 2]
                n = note(cr + deg, octave=1)
                lead_notes.append((n, t0 + bi * beat, beat * 1.8, 0.3))
        elif bar < 8:
            # Build: melody appears, crescendo
            vel = 0.35 + 0.1 * (bar - 4)
            for pos, deg in pat:
                n = note(cr + deg, octave=1)
                lead_notes.append((n, t0 + pos * eighth, eighth * 0.85, vel))
        else:
            # Drop: full melody
            for pos, deg in pat:
                n = note(cr + deg, octave=1)
                lead_notes.append((n, t0 + pos * eighth, eighth * 0.8, 0.7))

    lead_audio = (synth.synthesize_midi_notes(lead_notes, 'supersaw')
                  if lead_notes else np.zeros(1))

    # ==== MIX ====
    logger.info("  Mixing...")
    max_len = max(len(drum_audio), len(bass_audio), len(lead_audio))

    def pad(arr):
        if len(arr) < max_len:
            return np.pad(arr, (0, max_len - len(arr)))
        return arr[:max_len]

    mixed = (pad(drum_audio) * 1.0
             + pad(bass_audio) * 0.75
             + pad(lead_audio) * 0.55)

    # Normalize → soft-limit for loudness
    pk = np.max(np.abs(mixed))
    if pk > 0:
        mixed = mixed / pk
    mixed = np.tanh(mixed * 1.5) * 0.92

    duration = len(mixed) / config.sample_rate
    logger.info(f"  Done: {duration:.1f}s, {len(mixed)} samples")

    # ==== Export WAV ====
    audio_int = (mixed * 32767).astype(np.int16)
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    wavfile.write(tmp.name, config.sample_rate, audio_int)

    with open(tmp.name, "rb") as fh:
        wav_bytes = fh.read()
    Path(tmp.name).unlink()

    logger.info(f"  WAV: {len(wav_bytes)} bytes")
    return wav_bytes


def sanitize_filename(text: str) -> str:
    """Convert text to safe filename"""
    import re
    safe = re.sub(r'[^\w\s-]', '', text)
    safe = re.sub(r'[-\s]+', '_', safe)
    return safe[:50]


# ==================== API Endpoints ====================

@app.get("/")
async def root():
    """Serve the HTML interface"""
    return FileResponse("index.html")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "edm-generator",
        "spotipy_available": SPOTIPY_AVAILABLE,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/profile/tracks")
async def get_profile_tracks(request: ProfileTracksRequest):
    """Fetch tracks from a Spotify user's public playlists"""
    try:
        if not SPOTIPY_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="Spotify integration not available. Install spotipy."
            )

        extractor = SpotifyExtractor()
        result = extractor.get_user_tracks(request.profile_url, request.limit)
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Profile fetch error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


@app.post("/api/edm/generate", response_model=EDMGenerateResponse)
async def generate_edm_remix(request: EDMGenerateRequest):
    """
    Generate EDM remix from Spotify track

    Steps:
    1. Extract Spotify features
    2. Generate EDM remix (Modal or local)
    3. Save audio file
    4. Return download link
    """
    try:
        logger.info(f"Generating EDM remix for: {request.spotify_url}")

        # Step 1: Extract Spotify features
        if not SPOTIPY_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="Spotify integration not available. Install spotipy."
            )

        extractor = SpotifyExtractor()
        track_info = extractor.get_track_features(request.spotify_url)

        logger.info(f"Track: {track_info['track_name']} by {track_info['artist']}")

        # Step 2: Generate EDM remix
        audio_bytes = None

        if not request.local_only:
            logger.info("Attempting Modal generation...")
            audio_bytes = call_modal_edm_generator(track_info)

        if audio_bytes is None:
            logger.info("Using local generation...")
            audio_bytes = generate_edm_local(track_info)

        # Step 3: Save audio file
        artist_safe = sanitize_filename(track_info['artist'])
        track_safe = sanitize_filename(track_info['track_name'])

        # Determine extension based on generation method
        extension = ".mid" if request.local_only else ".mp3"
        filename = f"{artist_safe}_{track_safe}_edm_remix{extension}"

        output_path = OUTPUT_DIR / filename

        with open(output_path, "wb") as f:
            f.write(audio_bytes)

        logger.info(f"Saved: {output_path}")

        # Create job record
        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            "job_id": job_id,
            "status": "completed",
            "track_info": track_info,
            "filename": filename,
            "size_bytes": len(audio_bytes),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Return response
        return EDMGenerateResponse(
            status="success",
            job_id=job_id,
            track_name=track_info["track_name"],
            artist=track_info["artist"],
            features=track_info["features"],
            filename=filename,
            size_bytes=len(audio_bytes),
            download_url=f"/api/edm/download/{filename}"
        )

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.get("/api/edm/download/{filename}")
async def download_file(filename: str):
    """Download generated EDM file"""
    file_path = OUTPUT_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=filename
    )


@app.get("/api/edm/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get job status"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job = jobs[job_id]

    return JobStatus(
        job_id=job["job_id"],
        status=job["status"],
        progress=100.0 if job["status"] == "completed" else 0.0,
        created_at=job["created_at"],
        updated_at=job["updated_at"],
        result=job.get("track_info"),
        error=job.get("error")
    )


@app.get("/api/edm/jobs")
async def list_jobs(limit: int = 50):
    """List all jobs"""
    job_list = list(jobs.values())
    job_list.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "total": len(job_list),
        "jobs": job_list[:limit]
    }


@app.delete("/api/edm/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated file"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job = jobs.pop(job_id)

    # Delete the file if it exists
    filename = job.get("filename")
    if filename:
        file_path = OUTPUT_DIR / filename
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted file: {file_path}")

    return {
        "status": "success",
        "message": f"Job {job_id} deleted"
    }


# ==================== Startup/Shutdown Events ====================

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info("EDM Generator API starting up...")
    logger.info(f"Output directory: {OUTPUT_DIR.absolute()}")
    logger.info(f"Spotipy available: {SPOTIPY_AVAILABLE}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("EDM Generator API shutting down...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
