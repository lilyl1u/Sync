# Modal EDM Generator - Spotify Features to EDM Tracks

A Modal-deployed service that generates complete EDM tracks based on Spotify audio features. This service intelligently maps audio characteristics (energy, danceability, valence, etc.) to EDM production parameters and creates full tracks with drums, bass, and melodies.

## Features

### Input: Spotify Audio Features
- **Energy** (0.0-1.0): Intensity and activity level
- **Danceability** (0.0-1.0): Suitability for dancing
- **Valence** (0.0-1.0): Musical positiveness (happy vs sad)
- **Tempo** (BPM): Beats per minute
- **Loudness** (dB): Overall loudness
- **Acousticness** (0.0-1.0): Acoustic confidence
- **Instrumentalness** (0.0-1.0): Vocal presence
- **Speechiness** (0.0-1.0): Spoken word presence
- **Key** (0-11): Pitch class
- **Mode** (0 or 1): Major/Minor

### Output: Complete EDM Track
- Drum patterns (kicks, snares, hi-hats)
- Bass lines
- Melodies
- Audio effects (filters, reverb)
- WAV audio file (44.1kHz, 30 seconds)

## Feature Mapping Logic

### Energy → Drum Intensity
- **High (0.7-1.0)**: Aggressive drums, fast hi-hats (double-time), high kick velocity (90-127)
- **Medium (0.4-0.7)**: Balanced drum patterns, standard hi-hats
- **Low (0.0-0.4)**: Lighter drums, slower hi-hats

### Danceability → Rhythm Patterns
- **High (0.7-1.0)**: Four-on-the-floor kicks, dense hi-hats (0.4-1.0 density), syncopated elements
- **Medium (0.4-0.7)**: Standard dance patterns
- **Low (0.0-0.4)**: Simpler rhythms

### Valence → Melody & Harmony
- **High (0.7-1.0)**: Major keys, uplifting melodies, bright tones
- **Medium (0.4-0.7)**: Balanced emotional tone
- **Low (0.0-0.4)**: Minor keys, darker tones, melancholic feel

### Tempo → BPM
- Automatically mapped to EDM-appropriate range (120-140 BPM)
- Input <100 BPM → defaults to 128 BPM
- Input >150 BPM → caps at 135 BPM

### Loudness → Bass Intensity
- Normalized from typical -60dB to 0dB range
- Maps to bass intensity (0.6-1.0)
- Affects bass note velocity and frequency (40-60 Hz)

### Acousticness → Reverb
- Maps to reverb amount (0.2-0.7)
- Higher values create more spacious, ambient sound

### Instrumentalness → Melody Complexity
- Maps to melodic complexity (0.3-1.0)
- Higher values create more complex melodic patterns with wider intervals

### Key & Mode → Musical Scale
- Key (0-11) sets root note (0=C, 1=C#, 2=D, etc.)
- Mode determines major/minor
- Combined with valence to select scale type (major, minor, harmonic minor)

## Installation

### Prerequisites
```bash
# Install Modal
pip install modal

# Authenticate with Modal
modal token new
```

### Deploy the Service
```bash
# Deploy to Modal
modal deploy modal_edm_generator.py

# Or run locally (for testing)
modal run modal_edm_generator.py --energy 0.8 --danceability 0.7
```

## Usage

### 1. Command Line Interface

Generate a track with specific features:
```bash
modal run modal_edm_generator.py \
  --energy 0.9 \
  --danceability 0.85 \
  --valence 0.7 \
  --tempo 135 \
  --loudness -3 \
  --acousticness 0.05 \
  --instrumentalness 0.95 \
  --speechiness 0.03 \
  --key 0 \
  --mode 1 \
  --output my_edm_track.wav
```

### 2. Python API

```python
from modal_edm_generator import app, generate_edm_track

# Define Spotify features
features = {
    "energy": 0.8,
    "danceability": 0.75,
    "valence": 0.6,
    "tempo": 128.0,
    "loudness": -5.0,
    "acousticness": 0.1,
    "instrumentalness": 0.9,
    "speechiness": 0.05,
    "key": 0,
    "mode": 1,
}

# Generate track
with app.run():
    audio_bytes = generate_edm_track.remote(features)

    # Save to file
    with open("output.wav", "wb") as f:
        f.write(audio_bytes)
```

### 3. HTTP API (FastAPI)

Deploy as a web service:
```bash
modal serve modal_edm_generator.py
```

Then call the API:
```python
import requests

url = "https://your-modal-deployment-url.modal.run"

features = {
    "energy": 0.9,
    "danceability": 0.8,
    "valence": 0.7,
    "tempo": 135.0,
    "loudness": -3.0,
    "acousticness": 0.05,
    "instrumentalness": 0.95,
    "speechiness": 0.03,
    "key": 0,
    "mode": 1,
}

response = requests.post(f"{url}/generate", json=features)

# Save audio
with open("edm_track.wav", "wb") as f:
    f.write(response.content)
```

### 4. Using Presets

Use the example script with presets:
```bash
# Show available presets
python modal_edm_generator_example.py presets

# Generate with a preset
python modal_edm_generator_example.py generate-cli --preset high_energy_drop --output drop.wav

# Show feature mapping guide
python modal_edm_generator_example.py mapping

# Create custom features interactively
python modal_edm_generator_example.py custom
```

## Presets

### High Energy Drop
Aggressive drop with heavy kicks and fast hi-hats
- Energy: 0.95
- Danceability: 0.85
- Valence: 0.7
- Tempo: 135 BPM
- Key: C Major

### Melodic Progressive House
Uplifting melodies with moderate energy
- Energy: 0.7
- Danceability: 0.75
- Valence: 0.8
- Tempo: 128 BPM
- Key: D Major

### Dark Techno
Dark, driving techno with minimal melody
- Energy: 0.85
- Danceability: 0.9
- Valence: 0.2
- Tempo: 130 BPM
- Key: A Minor

### Chill House
Laid-back house with warm vibes
- Energy: 0.5
- Danceability: 0.65
- Valence: 0.6
- Tempo: 120 BPM
- Key: G Major

### Breakbeat / DnB Style
Fast tempo with complex drum patterns
- Energy: 0.9
- Danceability: 0.7
- Valence: 0.5
- Tempo: 140 BPM
- Key: F Minor

## Architecture

### Components

1. **FeatureMapper**: Maps Spotify features to EDM parameters
2. **AudioSynthesizer**: Generates basic waveforms (kick, snare, hi-hat, bass, melody)
3. **DrumPatternGenerator**: Creates drum patterns based on energy and danceability
4. **MelodyGenerator**: Generates melodies based on key, scale, and complexity
5. **BasslineGenerator**: Creates bass lines based on frequency and intensity
6. **AudioEffects**: Applies filters and reverb

### Generation Pipeline

```
Spotify Features
    ↓
Feature Mapping
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│  Drum Pattern   │    Bass Line    │     Melody      │
│   Generator     │    Generator    │    Generator    │
└─────────────────┴─────────────────┴─────────────────┘
    ↓
Audio Mixing
    ↓
Effects Processing (Filter → Reverb)
    ↓
Normalization
    ↓
WAV Output
```

## Technical Details

### Audio Specifications
- **Sample Rate**: 44,100 Hz
- **Format**: 32-bit float WAV
- **Duration**: 30 seconds (configurable)
- **Channels**: Mono

### Synthesis Methods
- **Kick**: Sine wave with frequency sweep (150Hz → 40Hz)
- **Snare**: Noise + tonal component (200Hz)
- **Hi-hat**: High-frequency noise + harmonics (6-10.5kHz)
- **Bass**: Sawtooth wave + sub-bass (40-60Hz)
- **Melody**: Square wave + harmonics with ADSR envelope

### Drum Patterns
- **Standard**: Kick on 1,3, snare on 2,4
- **Aggressive**: More frequent snares (every other beat)
- **Breakbeat**: Syncopated pattern inspired by amen break

### Scales
- **Major**: W-W-H-W-W-W-H (0,2,4,5,7,9,11)
- **Natural Minor**: W-H-W-W-H-W-W (0,2,3,5,7,8,10)
- **Harmonic Minor**: W-H-W-W-H-W+H-H (0,2,3,5,7,8,11)

## Limitations & Future Improvements

### Current Limitations
- 30-second track duration (for quick generation)
- Mono audio output
- Basic synthesis (no advanced wavetables)
- Simple effects (basic filter and reverb)
- No arrangement variation (intro/buildup/drop/outro)

### Potential Improvements
- [ ] Add arrangement structure (intro, buildup, drop, breakdown)
- [ ] Implement more advanced synthesis (FM, wavetable)
- [ ] Add more effects (delay, chorus, distortion, sidechain compression)
- [ ] Support stereo output with panning
- [ ] Integrate ML-based melody generation
- [ ] Add vocal synthesis for tracks with low instrumentalness
- [ ] Support longer track durations (up to 3-5 minutes)
- [ ] Add MIDI export option
- [ ] Implement real soundfonts for better quality
- [ ] Add GPU acceleration for ML components

## Integration with Existing Codebase

This service integrates with:
- **`src/models/drum_pattern_generator.py`**: Uses similar drum pattern concepts
- **`src/audio_utils.py`**: Shares audio synthesis and effects utilities
- **`src/models/drum_midi_utils.py`**: Compatible MIDI structure

To use the drum pattern generator directly:
```python
from src.models.drum_pattern_generator import EDMPatternLibrary, DrumPattern

# Generate pattern
pattern = EDMPatternLibrary.drop_pattern(steps=16)

# Export to MIDI
from src.models.drum_midi_utils import DrumMIDIConverter, MIDIConfig

config = MIDIConfig(tempo=128)
converter = DrumMIDIConverter(config)
converter.pattern_to_midi(pattern, "drums.mid", bars=4)
```

## Examples

### Example 1: High Energy Track
```python
features = {
    "energy": 0.95,
    "danceability": 0.9,
    "valence": 0.8,
    "tempo": 140,
    "loudness": -2,
    "key": 0,
    "mode": 1,
}
# Result: Fast BPM (140), aggressive drums, bright melodies in C major
```

### Example 2: Dark Atmospheric Track
```python
features = {
    "energy": 0.6,
    "danceability": 0.7,
    "valence": 0.2,
    "tempo": 125,
    "loudness": -6,
    "acousticness": 0.4,
    "key": 9,
    "mode": 0,
}
# Result: Moderate BPM (125), dark melodies in A minor, more reverb
```

### Example 3: Using with Spotify API
```python
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

# Get features from Spotify
sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials())
track_id = "spotify:track:6y0igZArWVi6Iz0rj35c1Y"
features = sp.audio_features(track_id)[0]

# Extract relevant features
edm_features = {
    "energy": features["energy"],
    "danceability": features["danceability"],
    "valence": features["valence"],
    "tempo": features["tempo"],
    "loudness": features["loudness"],
    "acousticness": features["acousticness"],
    "instrumentalness": features["instrumentalness"],
    "speechiness": features["speechiness"],
    "key": features["key"],
    "mode": features["mode"],
}

# Generate track
audio_bytes = generate_edm_track.remote(edm_features)
```

## Troubleshooting

### Modal Authentication Error
```bash
# Re-authenticate
modal token new
```

### Import Errors
```bash
# Make sure all dependencies are in the Modal image
# They're defined in the image definition in modal_edm_generator.py
```

### Audio Quality Issues
- Increase sample rate (modify `sample_rate = 44100` in the code)
- Adjust normalization (currently at 0.9 to leave headroom)
- Modify effect parameters for different sound

### Generation Timeout
- Current timeout is 5 minutes (300 seconds)
- For longer tracks, increase timeout in `@app.function` decorator
- Consider reducing track duration for faster generation

## License

This project is part of the EDM generation suite and follows the same license.

## Contributing

To extend this service:
1. Add new synthesis methods in `AudioSynthesizer`
2. Implement new drum patterns in `DrumPatternGenerator`
3. Add more scales in `MelodyGenerator.SCALES`
4. Create new effects in `AudioEffects`
5. Add new mapping logic in `FeatureMapper`

## Support

For issues or questions:
1. Check the feature mapping guide
2. Try different presets
3. Verify Spotify features are in valid ranges
4. Check Modal deployment status
