# EDM Remix Generator

Generate EDM remixes from Spotify tracks using audio features and AI generation.

## Files Created

1. **`generate_edm.py`** - Console script for EDM generation
2. **`index.html`** - Simple web interface
3. **`api_server.py`** - FastAPI backend server

## Setup

### 1. Install Dependencies

```bash
pip install spotipy fastapi uvicorn pretty_midi
```

### 2. Configure Spotify API Credentials

Create a `.env` file or set environment variables:

```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
```

Get credentials from: https://developer.spotify.com/dashboard/

## Usage

### Console Script (generate_edm.py)

**Interactive mode (prompts for URL):**
```bash
python generate_edm.py
```

**With URL argument:**
```bash
python generate_edm.py "https://open.spotify.com/track/..."
```

**Local-only mode (skip Modal):**
```bash
python generate_edm.py --local-only "https://open.spotify.com/track/..."
```

**Custom output filename:**
```bash
python generate_edm.py -o my_remix.mp3 "https://open.spotify.com/track/..."
```

### Web Interface

**1. Start the API server:**
```bash
python api_server.py
# Or: uvicorn api_server:app --reload --port 8000
```

**2. Open the web interface:**
```
http://localhost:8000
```

**3. Enter a Spotify URL and click "Generate EDM Remix"**

## Features

### Console Script Features:
- Takes Spotify URL as command line argument or prompts for input
- Extracts audio features (tempo, key, energy, danceability, etc.)
- Attempts Modal generation, falls back to local if unavailable
- Saves as `{artist}_{track}_edm_remix.mp3` format
- Shows progress messages at each step
- Handles errors gracefully

### Web Interface Features:
- Single input field for Spotify URL
- Submit button triggers generation
- Real-time status updates
- Shows track info and features
- Provides download link when complete
- No CSS, just basic HTML as requested

### API Endpoints:

**Generate EDM Remix:**
```
POST /api/edm/generate
Body: {
  "spotify_url": "https://open.spotify.com/track/...",
  "local_only": false
}
```

**Download File:**
```
GET /api/edm/download/{filename}
```

**Get Job Status:**
```
GET /api/edm/jobs/{job_id}
```

**List All Jobs:**
```
GET /api/edm/jobs
```

**Health Check:**
```
GET /health
```

## How It Works

### 1. Spotify Feature Extraction

The `SpotifyExtractor` class uses the Spotipy library to:
- Parse Spotify URLs/URIs to extract track IDs
- Fetch track metadata (name, artist, album)
- Get audio features:
  - Tempo (BPM)
  - Key and mode
  - Energy, danceability, valence
  - Acousticness, instrumentalness
  - Loudness, speechiness, liveness

### 2. EDM Generation

**Modal Generation (Primary):**
- Calls Modal EDM generator service with features
- Returns generated audio bytes
- Currently returns None (placeholder for your Modal implementation)

**Local Generation (Fallback):**
- Uses `pretty_midi` to create basic MIDI
- Generates 4-on-the-floor kick pattern
- Creates bassline based on track key
- Tempo matches the original track
- Simple but functional demonstration

### 3. File Saving

- Sanitizes artist/track names for safe filenames
- Saves as `{artist}_{track}_edm_remix.{ext}`
- Extension: `.mp3` for Modal, `.mid` for local
- Files saved to `generated_edm/` directory (API) or current dir (console)

## Error Handling

Both scripts handle:
- Missing Spotify credentials
- Invalid Spotify URLs
- Network errors
- Modal unavailability (falls back to local)
- Missing dependencies
- Keyboard interrupts (Ctrl+C)

## Modal Integration

To integrate with your Modal EDM generator:

1. Create a Modal function that accepts audio features
2. Import it in the generation functions
3. Update `call_modal_edm_generator()` to call your function

Example:
```python
# In modal_edm_generator.py
@app.function(...)
def generate_edm(features: Dict) -> bytes:
    # Your EDM generation logic
    return audio_bytes

# In generate_edm.py / api_server.py
from modal_edm_generator import app as edm_app, generate_edm

def call_modal_edm_generator(features: Dict) -> Optional[bytes]:
    with edm_app.run():
        return generate_edm.remote(features)
```

## Testing

**Test console script:**
```bash
# Test with a popular song
python generate_edm.py "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp"
```

**Test API:**
```bash
# Start server
python api_server.py

# In another terminal
curl -X POST http://localhost:8000/api/edm/generate \
  -H "Content-Type: application/json" \
  -d '{"spotify_url": "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp"}'
```

## Output Examples

**Console output:**
```
============================================================
EDM Remix Generator
============================================================

Extracting Spotify features...
  Track: Mr. Brightside
  Artist: The Killers
  Tempo: 148.0 BPM
  Key: 1
  Energy: 0.89
  Danceability: 0.35

Generating EDM remix on Modal...

Generating EDM remix locally...

Saving audio file...

Generated: The_Killers_Mr_Brightside_edm_remix.mid
  Size: 2.3 KB

============================================================
Success!
============================================================
```

**API response:**
```json
{
  "status": "success",
  "job_id": "abc123...",
  "track_name": "Mr. Brightside",
  "artist": "The Killers",
  "features": {
    "tempo": 148.0,
    "key": 1,
    "energy": 0.89,
    "danceability": 0.35
  },
  "filename": "The_Killers_Mr_Brightside_edm_remix.mid",
  "size_bytes": 2345,
  "download_url": "/api/edm/download/The_Killers_Mr_Brightside_edm_remix.mid"
}
```

## Troubleshooting

**"spotipy not installed":**
```bash
pip install spotipy
```

**"Spotify credentials not found":**
- Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` environment variables
- Or create `.env` file with credentials

**"pretty_midi not installed":**
```bash
pip install pretty_midi
```

**CORS errors in web interface:**
- Make sure API server is running
- Check that you're accessing from `localhost:8000`
- CORS is configured to allow all origins in development

## Next Steps

To make this production-ready:

1. **Implement Modal EDM generator:**
   - Create Modal function for EDM generation
   - Use ML models for better quality
   - Support different EDM styles

2. **Improve local generation:**
   - Add more instruments
   - Use audio features for variation
   - Generate longer tracks

3. **Add authentication:**
   - Require API keys
   - Rate limiting
   - User accounts

4. **Add job queue:**
   - Background processing with Celery
   - Progress tracking
   - Email notifications

5. **Enhance web interface:**
   - Add CSS styling
   - Progress bars
   - Audio preview player
   - Multiple file format support

6. **Add monitoring:**
   - Logging to file
   - Error tracking (Sentry)
   - Performance metrics

## License

MIT License - feel free to modify and extend!
