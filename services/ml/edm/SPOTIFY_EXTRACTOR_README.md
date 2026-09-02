# Spotify Feature Extractor

A Python module for extracting audio features and metadata from Spotify tracks using the Spotify Web API.

## Features

### Audio Features Extracted
- **Energy** (0.0 to 1.0) - Intensity and activity measure
- **Danceability** (0.0 to 1.0) - How suitable a track is for dancing
- **Valence** (0.0 to 1.0) - Musical positiveness (happy/cheerful vs sad/angry)
- **Tempo** (BPM) - Estimated tempo in beats per minute
- **Loudness** (dB) - Overall loudness in decibels
- **Acousticness** (0.0 to 1.0) - Confidence measure of acoustic nature
- **Instrumentalness** (0.0 to 1.0) - Predicts whether a track contains vocals
- **Speechiness** (0.0 to 1.0) - Presence of spoken words
- **Liveness** (0.0 to 1.0) - Presence of an audience
- **Key** (0-11) - Pitch class notation (0=C, 1=C#, 2=D, etc.)
- **Mode** (0 or 1) - 0 for minor, 1 for major
- **Time Signature** - Estimated time signature (e.g., 4 for 4/4)
- **Duration** (milliseconds) - Track length

### Track Metadata
- Track name
- Artist name(s)
- Album name
- Release date
- Popularity (0-100)
- Spotify URLs

## Installation

### Prerequisites

1. **Install required packages:**
   ```bash
   pip install spotipy python-dotenv
   ```

   Or if you have the project's requirements.txt:
   ```bash
   pip install -r requirements.txt
   ```

2. **Get Spotify API credentials:**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Log in with your Spotify account
   - Click "Create an App"
   - Give it a name and description
   - Accept the terms and create the app
   - Copy your **Client ID** and **Client Secret**

3. **Set up environment variables:**

   Create a `.env` file in your project directory:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

   Or export them as environment variables:
   ```bash
   export SPOTIFY_CLIENT_ID=your_client_id_here
   export SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

## Usage

### As a Python Module

```python
from spotify_extractor import SpotifyFeatureExtractor

# Initialize the extractor (reads credentials from .env or environment variables)
extractor = SpotifyFeatureExtractor()

# Or pass credentials directly
extractor = SpotifyFeatureExtractor(
    client_id="your_client_id",
    client_secret="your_client_secret"
)

# Extract features from a track
features = extractor.extract_features("spotify:track:3n3Ppam7vgaVa1iaRUc9Lp")

# Access the features
print(f"Track: {features['track_name']}")
print(f"Artist: {features['artist_name']}")
print(f"Energy: {features['energy']}")
print(f"Danceability: {features['danceability']}")
print(f"Tempo: {features['tempo']} BPM")
```

### Supported Input Formats

The module accepts multiple formats for track identification:

```python
# Spotify URI
features = extractor.extract_features("spotify:track:3n3Ppam7vgaVa1iaRUc9Lp")

# Spotify URL
features = extractor.extract_features("https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp")

# Direct track ID
features = extractor.extract_features("3n3Ppam7vgaVa1iaRUc9Lp")
```

### Batch Processing

Extract features from multiple tracks at once:

```python
tracks = [
    "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp",
    "https://open.spotify.com/track/60nZcImufyMA1MKQY3dcCH",
    "6rqhFgbbKwnb9MLmUQDhG6"
]

results = extractor.extract_features_batch(tracks)

for track_input, result in results.items():
    if result['success']:
        features = result['data']
        print(f"{features['track_name']} - {features['artist_name']}")
    else:
        print(f"Error: {result['error']}")
```

### As a Command-Line Script

```bash
# Using a Spotify URL
python spotify_extractor.py "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp"

# Using a Spotify URI
python spotify_extractor.py "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp"

# Using a track ID
python spotify_extractor.py "3n3Ppam7vgaVa1iaRUc9Lp"
```

The command-line script will output:
- Formatted display of track information
- All audio features with descriptions
- Full JSON output of all extracted data

### Utility Functions

Convert numeric key/mode to readable key names:

```python
key_name = extractor.get_key_name(key=0, mode=1)  # Returns "C Major"
key_name = extractor.get_key_name(key=9, mode=0)  # Returns "A Minor"
```

## Example Output

When you run the extractor, you'll get a dictionary like this:

```python
{
    'track_id': '3n3Ppam7vgaVa1iaRUc9Lp',
    'track_name': 'Mr. Brightside',
    'artist_name': 'The Killers',
    'artists': ['The Killers'],
    'album_name': 'Hot Fuss',
    'release_date': '2004-06-07',
    'duration_ms': 222973,
    'popularity': 90,
    'energy': 0.912,
    'danceability': 0.347,
    'valence': 0.212,
    'tempo': 148.017,
    'loudness': -4.564,
    'acousticness': 0.00114,
    'instrumentalness': 0.000504,
    'speechiness': 0.0338,
    'key': 1,  # C# / Db
    'mode': 1,  # Major
    'time_signature': 4,
    'liveness': 0.115,
    'spotify_url': 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp',
    'spotify_uri': 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp'
}
```

## Error Handling

The module includes comprehensive error handling:

```python
try:
    features = extractor.extract_features("invalid_input")
except ValueError as e:
    # Invalid URL/URI format
    print(f"Invalid input: {e}")
except Exception as e:
    # API errors, network issues, etc.
    print(f"Error: {e}")
```

Common errors:
- `ValueError`: Invalid Spotify URL, URI, or ID format
- `SpotifyException`: Track not found (404), authentication failed (401)
- `Exception`: Network errors, API rate limits, etc.

## Testing

Run the included test script to verify your setup:

```bash
python test_spotify_extractor.py
```

This will test:
- Single track extraction with different input formats
- Batch processing of multiple tracks
- Key name conversion utility
- Error handling

## API Reference

### SpotifyFeatureExtractor

Main class for extracting Spotify features.

#### Methods

**`__init__(client_id=None, client_secret=None)`**
- Initialize the extractor with Spotify credentials
- If not provided, reads from environment variables

**`extract_features(spotify_input: str) -> Dict[str, Any]`**
- Extract all features and metadata from a single track
- Returns: Dictionary with all track information

**`extract_features_batch(spotify_inputs: list) -> Dict[str, Dict]`**
- Extract features from multiple tracks
- Returns: Dictionary mapping inputs to results

**`parse_track_id(spotify_input: str) -> str`** (static)
- Parse track ID from URL, URI, or ID
- Returns: The extracted track ID

**`get_key_name(key: int, mode: int) -> str`**
- Convert numeric key/mode to readable name
- Returns: Key name (e.g., "C Major", "A Minor")

## Notes

- The module uses the Spotify Web API's **Client Credentials Flow**, which provides access to public track information without requiring user authentication
- No user login or authorization callback is needed
- Rate limits apply based on your Spotify application settings
- All audio features are computed by Spotify's audio analysis algorithms

## Troubleshooting

### "Module not found: spotipy"
Install the required packages:
```bash
pip install spotipy python-dotenv
```

### "Authentication failed"
- Verify your credentials are correct
- Check that your Spotify app is active in the [Developer Dashboard](https://developer.spotify.com/dashboard)
- Make sure your `.env` file is in the correct location or environment variables are set

### "Track not found"
- Verify the track ID/URL is correct
- Some tracks may be restricted or unavailable in certain regions
- The track may have been removed from Spotify

## License

This module is provided as-is for educational and development purposes.

## Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [Audio Features Documentation](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)
- [Spotipy Library Documentation](https://spotipy.readthedocs.io/)
