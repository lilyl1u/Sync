"""
Modal EDM Generator Service based on Spotify Audio Features

This service takes Spotify audio features and generates complete EDM tracks by:
1. Mapping Spotify features to EDM generation parameters
2. Generating drum patterns based on energy and danceability
3. Creating melodies based on valence and key
4. Generating bass lines based on energy and loudness
5. Combining all elements into a full EDM track
6. Returning audio as WAV format

Usage:
    modal deploy modal_edm_generator.py

    # Then call the API endpoint or use the function directly
    modal run modal_edm_generator.py --features '{"energy": 0.8, "danceability": 0.7, ...}'
"""

import modal
import numpy as np
import io
from typing import Dict, Optional, Tuple
from dataclasses import dataclass

# Create Modal app
app = modal.App("edm-generator")

# Define the image with all required dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy==1.26.3",
        "scipy==1.11.4",
        "soundfile==0.12.1",
        "librosa==0.10.1",
        "torch==2.1.2",
        "pretty_midi==0.2.10",
        "mido==1.3.0",
    )
)


@dataclass
class SpotifyFeatures:
    """Spotify audio features"""
    energy: float  # 0.0-1.0: Intensity and activity
    danceability: float  # 0.0-1.0: How suitable for dancing
    valence: float  # 0.0-1.0: Musical positiveness (happy vs sad)
    tempo: float  # BPM (typically 50-200)
    loudness: float  # dB (typically -60 to 0)
    acousticness: float  # 0.0-1.0: Confidence the track is acoustic
    instrumentalness: float  # 0.0-1.0: Predicts if track has vocals
    speechiness: float  # 0.0-1.0: Presence of spoken words
    key: int  # 0-11: Pitch class (0=C, 1=C#, etc.)
    mode: int  # 0 or 1: Major (1) or minor (0)


@dataclass
class EDMParameters:
    """Mapped EDM generation parameters"""
    bpm: float
    kick_density: float  # 0.0-1.0
    kick_velocity: int  # 0-127
    hihat_density: float  # 0.0-1.0
    hihat_speed: float  # 1.0 = normal, 2.0 = double time
    snare_pattern: str  # "standard", "breakbeat", "aggressive"
    bass_frequency: float  # Hz
    bass_intensity: float  # 0.0-1.0
    melody_key: int  # MIDI note
    melody_scale: str  # "major", "minor", "harmonic_minor"
    melody_complexity: float  # 0.0-1.0
    filter_cutoff: float  # Hz
    reverb_amount: float  # 0.0-1.0
    track_duration: float  # seconds


# GPU configuration for potential ML models
gpu_config = modal.gpu.A10G()


class FeatureMapper:
    """Maps Spotify features to EDM generation parameters"""

    @staticmethod
    def map_features(features: SpotifyFeatures) -> EDMParameters:
        """
        Map Spotify features to EDM generation parameters

        Args:
            features: Spotify audio features

        Returns:
            EDM generation parameters
        """
        # Map tempo to EDM range (120-140 BPM typical)
        bpm = max(120, min(140, features.tempo))
        if features.tempo < 100:
            bpm = 128  # Default EDM tempo
        elif features.tempo > 150:
            bpm = 135  # Upper EDM range

        # High energy → Aggressive drums, fast hi-hats
        kick_density = 0.5 + (features.energy * 0.5)  # 0.5-1.0
        kick_velocity = int(90 + (features.energy * 37))  # 90-127

        # High danceability → More hi-hat patterns
        hihat_density = 0.4 + (features.danceability * 0.6)  # 0.4-1.0
        hihat_speed = 1.0 + (features.energy * 1.0)  # 1.0-2.0 (double time when energetic)

        # Determine snare pattern
        if features.energy > 0.8:
            snare_pattern = "aggressive"
        elif features.danceability > 0.7:
            snare_pattern = "standard"
        else:
            snare_pattern = "breakbeat"

        # Bass parameters
        # Low frequencies for heavy bass, mapped from loudness and energy
        normalized_loudness = (features.loudness + 60) / 60  # Normalize -60dB to 0dB → 0-1
        bass_frequency = 40 + (features.energy * 20)  # 40-60 Hz
        bass_intensity = 0.6 + (normalized_loudness * 0.4)  # 0.6-1.0

        # Melody parameters based on valence and key
        # High valence → Major keys, uplifting melodies
        # Low valence → Minor keys, darker tones
        melody_key = 60 + features.key  # MIDI note (C4 = 60)

        if features.mode == 1:  # Major mode
            melody_scale = "major" if features.valence > 0.5 else "harmonic_minor"
        else:  # Minor mode
            melody_scale = "minor" if features.valence < 0.5 else "major"

        # Complexity based on instrumentalness
        melody_complexity = 0.3 + (features.instrumentalness * 0.7)

        # Filter cutoff based on energy (brighter = higher energy)
        filter_cutoff = 2000 + (features.energy * 8000)  # 2000-10000 Hz

        # Reverb amount (more acoustic = more reverb)
        reverb_amount = 0.2 + (features.acousticness * 0.5)  # 0.2-0.7

        # Track duration (default 30 seconds for demo)
        track_duration = 30.0

        return EDMParameters(
            bpm=bpm,
            kick_density=kick_density,
            kick_velocity=kick_velocity,
            hihat_density=hihat_density,
            hihat_speed=hihat_speed,
            snare_pattern=snare_pattern,
            bass_frequency=bass_frequency,
            bass_intensity=bass_intensity,
            melody_key=melody_key,
            melody_scale=melody_scale,
            melody_complexity=melody_complexity,
            filter_cutoff=filter_cutoff,
            reverb_amount=reverb_amount,
            track_duration=track_duration,
        )


class AudioSynthesizer:
    """Generate audio waveforms"""

    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate

    def generate_kick(self, duration: float = 0.5) -> np.ndarray:
        """Generate kick drum with frequency sweep"""
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        frequency = 150 * np.exp(-5 * t / duration)
        envelope = np.exp(-6 * t / duration)
        phase = 2 * np.pi * np.cumsum(frequency) / self.sample_rate
        kick = 0.8 * envelope * np.sin(phase)
        return kick.astype(np.float32)

    def generate_snare(self, duration: float = 0.2) -> np.ndarray:
        """Generate snare drum (tonal + noise)"""
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        tonal = 0.3 * np.sin(2 * np.pi * 200 * t)
        noise = 0.7 * np.random.uniform(-1, 1, len(t))
        envelope = np.exp(-10 * t / duration)
        snare = envelope * (tonal + noise)
        return snare.astype(np.float32)

    def generate_hihat(self, duration: float = 0.1, closed: bool = True) -> np.ndarray:
        """Generate hi-hat (high-frequency noise)"""
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        noise = np.random.uniform(-1, 1, len(t))
        harmonics = sum(np.sin(2 * np.pi * freq * t)
                       for freq in [6000, 7500, 9000, 10500])
        hihat = 0.6 * noise + 0.4 * harmonics
        envelope = np.exp(-40 * t / duration) if closed else np.exp(-15 * t / duration)
        hihat = 0.3 * envelope * hihat
        return hihat.astype(np.float32)

    def generate_bass_note(self, frequency: float, duration: float,
                          intensity: float = 0.8) -> np.ndarray:
        """Generate bass note using sawtooth wave"""
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        # Sawtooth wave for bass
        sawtooth = 2 * (t * frequency - np.floor(0.5 + t * frequency))
        # Add sub-bass (sine wave)
        sub_bass = np.sin(2 * np.pi * frequency * t)
        # Mix sawtooth and sub
        bass = intensity * (0.6 * sawtooth + 0.4 * sub_bass)
        # Envelope
        attack = int(0.01 * self.sample_rate)
        decay = int(0.1 * self.sample_rate)
        envelope = np.ones(len(t))
        envelope[:attack] = np.linspace(0, 1, attack)
        envelope[-decay:] = np.linspace(1, 0, decay)
        bass = bass * envelope
        return bass.astype(np.float32)

    def generate_melody_note(self, frequency: float, duration: float) -> np.ndarray:
        """Generate melody note using square wave with filter"""
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        # Square wave with harmonics
        square = np.sign(np.sin(2 * np.pi * frequency * t))
        # Add some harmonics for richness
        harmonics = 0.3 * np.sin(2 * np.pi * frequency * 2 * t)
        harmonics += 0.2 * np.sin(2 * np.pi * frequency * 3 * t)
        melody = 0.5 * (square + harmonics)
        # Envelope (ADSR)
        attack = int(0.02 * self.sample_rate)
        decay = int(0.05 * self.sample_rate)
        release = int(0.1 * self.sample_rate)
        envelope = np.ones(len(t))
        envelope[:attack] = np.linspace(0, 1, attack)
        envelope[attack:attack+decay] = np.linspace(1, 0.7, decay)
        envelope[-release:] = np.linspace(0.7, 0, release)
        melody = melody * envelope
        return melody.astype(np.float32)


class DrumPatternGenerator:
    """Generate drum patterns based on EDM parameters"""

    def __init__(self, params: EDMParameters, sample_rate: int = 44100):
        self.params = params
        self.sample_rate = sample_rate
        self.synth = AudioSynthesizer(sample_rate)

    def generate_pattern(self, duration: float) -> np.ndarray:
        """Generate complete drum pattern"""
        # Calculate timing
        beat_duration = 60.0 / self.params.bpm
        num_beats = int(duration / beat_duration)
        total_samples = int(duration * self.sample_rate)
        output = np.zeros(total_samples)

        # Generate drum sounds
        kick = self.synth.generate_kick(0.5)
        snare = self.synth.generate_snare(0.2)
        hihat_closed = self.synth.generate_hihat(0.1, closed=True)
        hihat_open = self.synth.generate_hihat(0.15, closed=False)

        for beat in range(num_beats):
            beat_sample = int(beat * beat_duration * self.sample_rate)

            # Kick pattern (four-on-the-floor with density adjustment)
            if beat % 4 == 0 or (self.params.kick_density > 0.7 and beat % 2 == 0):
                if beat_sample + len(kick) <= total_samples:
                    velocity_scale = self.params.kick_velocity / 127.0
                    output[beat_sample:beat_sample + len(kick)] += kick * velocity_scale

            # Snare pattern
            if self.params.snare_pattern == "standard":
                # Standard: beats 1 and 3 (in 4/4 time)
                if beat % 4 in [1, 3]:
                    if beat_sample + len(snare) <= total_samples:
                        output[beat_sample:beat_sample + len(snare)] += snare * 0.9
            elif self.params.snare_pattern == "aggressive":
                # Aggressive: more frequent snares
                if beat % 2 == 1:
                    if beat_sample + len(snare) <= total_samples:
                        output[beat_sample:beat_sample + len(snare)] += snare * 1.0
            else:  # breakbeat
                # Syncopated pattern
                if beat % 8 in [2, 5, 6]:
                    if beat_sample + len(snare) <= total_samples:
                        output[beat_sample:beat_sample + len(snare)] += snare * 0.85

            # Hi-hat pattern (based on speed and density)
            subdivisions = int(2 * self.params.hihat_speed)  # 2 or 4 hits per beat
            for sub in range(subdivisions):
                if np.random.random() < self.params.hihat_density:
                    sub_sample = beat_sample + int(sub * beat_duration * self.sample_rate / subdivisions)
                    if sub_sample + len(hihat_closed) <= total_samples:
                        # Occasional open hi-hat
                        if sub % 4 == 2 and np.random.random() < 0.3:
                            output[sub_sample:sub_sample + len(hihat_open)] += hihat_open * 0.6
                        else:
                            velocity = 0.5 + (np.random.random() * 0.3)
                            output[sub_sample:sub_sample + len(hihat_closed)] += hihat_closed * velocity

        return output


class MelodyGenerator:
    """Generate melodies based on key and scale"""

    # Scale definitions (intervals in semitones from root)
    SCALES = {
        "major": [0, 2, 4, 5, 7, 9, 11],
        "minor": [0, 2, 3, 5, 7, 8, 10],
        "harmonic_minor": [0, 2, 3, 5, 7, 8, 11],
    }

    def __init__(self, params: EDMParameters, sample_rate: int = 44100):
        self.params = params
        self.sample_rate = sample_rate
        self.synth = AudioSynthesizer(sample_rate)

    def midi_to_freq(self, midi_note: int) -> float:
        """Convert MIDI note to frequency"""
        return 440.0 * (2.0 ** ((midi_note - 69) / 12.0))

    def generate_melody(self, duration: float) -> np.ndarray:
        """Generate melodic sequence"""
        # Calculate timing
        beat_duration = 60.0 / self.params.bpm
        note_duration = beat_duration  # One note per beat
        num_notes = int(duration / note_duration)
        total_samples = int(duration * self.sample_rate)
        output = np.zeros(total_samples)

        # Get scale
        scale_intervals = self.SCALES.get(self.params.melody_scale, self.SCALES["major"])

        # Generate melodic sequence
        for i in range(num_notes):
            # Choose scale degree based on complexity
            if self.params.melody_complexity > 0.7:
                # More complex: use wider range and jumps
                scale_degree = np.random.choice(range(len(scale_intervals) * 2))
            elif self.params.melody_complexity > 0.4:
                # Medium: use octave
                scale_degree = np.random.choice(range(len(scale_intervals)))
            else:
                # Simple: mostly nearby notes
                scale_degree = np.random.choice(range(min(4, len(scale_intervals))))

            # Get MIDI note
            octave = scale_degree // len(scale_intervals)
            interval = scale_intervals[scale_degree % len(scale_intervals)]
            midi_note = self.params.melody_key + interval + (octave * 12)

            # Generate note
            freq = self.midi_to_freq(midi_note)
            note = self.synth.generate_melody_note(freq, note_duration * 0.8)

            # Add to output
            start_sample = int(i * note_duration * self.sample_rate)
            if start_sample + len(note) <= total_samples:
                output[start_sample:start_sample + len(note)] += note * 0.4

        return output


class BasslineGenerator:
    """Generate bass lines"""

    def __init__(self, params: EDMParameters, sample_rate: int = 44100):
        self.params = params
        self.sample_rate = sample_rate
        self.synth = AudioSynthesizer(sample_rate)

    def generate_bassline(self, duration: float) -> np.ndarray:
        """Generate bass line"""
        # Calculate timing
        beat_duration = 60.0 / self.params.bpm
        # Bass hits on every beat or every 2 beats
        bass_interval = beat_duration if self.params.bass_intensity > 0.7 else beat_duration * 2
        num_bass_hits = int(duration / bass_interval)
        total_samples = int(duration * self.sample_rate)
        output = np.zeros(total_samples)

        for i in range(num_bass_hits):
            # Generate bass note
            bass_note = self.synth.generate_bass_note(
                self.params.bass_frequency,
                bass_interval * 0.9,
                self.params.bass_intensity
            )

            # Add to output
            start_sample = int(i * bass_interval * self.sample_rate)
            if start_sample + len(bass_note) <= total_samples:
                output[start_sample:start_sample + len(bass_note)] += bass_note * 0.7

        return output


class AudioEffects:
    """Apply audio effects"""

    @staticmethod
    def apply_lowpass_filter(audio: np.ndarray, sample_rate: int,
                            cutoff_freq: float) -> np.ndarray:
        """Apply simple low-pass filter"""
        from scipy import signal
        nyquist = sample_rate / 2
        normalized_cutoff = min(cutoff_freq / nyquist, 0.99)
        b, a = signal.butter(4, normalized_cutoff, btype='low')
        filtered = signal.filtfilt(b, a, audio)
        return filtered.astype(np.float32)

    @staticmethod
    def apply_reverb(audio: np.ndarray, sample_rate: int,
                     amount: float = 0.3) -> np.ndarray:
        """Apply simple reverb effect"""
        # Simple algorithmic reverb
        ir_length = int(amount * sample_rate * 0.5)
        impulse_response = np.exp(-3 * np.linspace(0, 1, ir_length))
        impulse_response *= np.random.randn(ir_length) * 0.5

        # Convolve
        wet = np.convolve(audio, impulse_response, mode='same')

        # Mix wet/dry
        output = (1 - amount) * audio + amount * wet

        # Normalize
        max_val = np.max(np.abs(output))
        if max_val > 0:
            output = output / max_val

        return output.astype(np.float32)


@app.function(
    image=image,
    timeout=300,  # 5 minute timeout
    cpu=2,
)
def generate_edm_track(spotify_features: Dict) -> bytes:
    """
    Generate EDM track from Spotify audio features

    Args:
        spotify_features: Dictionary containing Spotify audio features
            Required keys: energy, danceability, valence, tempo, loudness,
                          acousticness, instrumentalness, speechiness, key, mode

    Returns:
        WAV audio data as bytes
    """
    import soundfile as sf

    # Parse features
    features = SpotifyFeatures(
        energy=spotify_features.get("energy", 0.7),
        danceability=spotify_features.get("danceability", 0.7),
        valence=spotify_features.get("valence", 0.5),
        tempo=spotify_features.get("tempo", 128.0),
        loudness=spotify_features.get("loudness", -5.0),
        acousticness=spotify_features.get("acousticness", 0.1),
        instrumentalness=spotify_features.get("instrumentalness", 0.8),
        speechiness=spotify_features.get("speechiness", 0.05),
        key=spotify_features.get("key", 0),
        mode=spotify_features.get("mode", 1),
    )

    print(f"Generating EDM track with features:")
    print(f"  Energy: {features.energy:.2f}")
    print(f"  Danceability: {features.danceability:.2f}")
    print(f"  Valence: {features.valence:.2f}")
    print(f"  Tempo: {features.tempo:.1f} BPM")
    print(f"  Key: {features.key} ({'Major' if features.mode == 1 else 'Minor'})")

    # Map features to EDM parameters
    params = FeatureMapper.map_features(features)

    print(f"\nMapped to EDM parameters:")
    print(f"  BPM: {params.bpm:.1f}")
    print(f"  Kick density: {params.kick_density:.2f}")
    print(f"  Hi-hat speed: {params.hihat_speed:.1f}x")
    print(f"  Snare pattern: {params.snare_pattern}")
    print(f"  Bass frequency: {params.bass_frequency:.1f} Hz")
    print(f"  Melody scale: {params.melody_scale}")

    # Generate components
    print("\nGenerating components...")
    sample_rate = 44100
    duration = params.track_duration

    print("  - Drum pattern...")
    drum_gen = DrumPatternGenerator(params, sample_rate)
    drums = drum_gen.generate_pattern(duration)

    print("  - Bass line...")
    bass_gen = BasslineGenerator(params, sample_rate)
    bass = bass_gen.generate_bassline(duration)

    print("  - Melody...")
    melody_gen = MelodyGenerator(params, sample_rate)
    melody = melody_gen.generate_melody(duration)

    # Mix components
    print("\nMixing components...")
    mix = drums * 0.5 + bass * 0.4 + melody * 0.3

    # Apply effects
    print("  - Applying filter...")
    mix = AudioEffects.apply_lowpass_filter(mix, sample_rate, params.filter_cutoff)

    print("  - Applying reverb...")
    mix = AudioEffects.apply_reverb(mix, sample_rate, params.reverb_amount)

    # Normalize
    print("  - Normalizing...")
    max_val = np.max(np.abs(mix))
    if max_val > 0:
        mix = mix / max_val * 0.9  # Leave headroom

    # Convert to WAV bytes
    print("\nConverting to WAV format...")
    buffer = io.BytesIO()
    sf.write(buffer, mix, sample_rate, format='WAV')
    audio_bytes = buffer.getvalue()

    print(f"✓ Generated {len(audio_bytes) / 1024 / 1024:.2f} MB WAV file")

    return audio_bytes


@app.function(
    image=image,
    timeout=300,
)
def generate_edm_track_to_file(spotify_features: Dict, output_path: str = "/tmp/edm_output.wav") -> str:
    """
    Generate EDM track and save to file

    Args:
        spotify_features: Spotify audio features dictionary
        output_path: Path to save WAV file

    Returns:
        Path to generated file
    """
    audio_bytes = generate_edm_track(spotify_features)

    with open(output_path, 'wb') as f:
        f.write(audio_bytes)

    return output_path


@app.local_entrypoint()
def main(
    energy: float = 0.8,
    danceability: float = 0.75,
    valence: float = 0.6,
    tempo: float = 128.0,
    loudness: float = -5.0,
    acousticness: float = 0.1,
    instrumentalness: float = 0.9,
    speechiness: float = 0.05,
    key: int = 0,
    mode: int = 1,
    output: str = "edm_output.wav"
):
    """
    Generate EDM track from command line

    Example:
        modal run modal_edm_generator.py --energy 0.9 --danceability 0.8 --valence 0.7
    """
    features = {
        "energy": energy,
        "danceability": danceability,
        "valence": valence,
        "tempo": tempo,
        "loudness": loudness,
        "acousticness": acousticness,
        "instrumentalness": instrumentalness,
        "speechiness": speechiness,
        "key": key,
        "mode": mode,
    }

    print("=" * 60)
    print("EDM Generator - Modal Service")
    print("=" * 60)

    # Generate track
    audio_bytes = generate_edm_track.remote(features)

    # Save to local file
    with open(output, 'wb') as f:
        f.write(audio_bytes)

    print(f"\n✓ Track saved to: {output}")
    print(f"  File size: {len(audio_bytes) / 1024 / 1024:.2f} MB")
    print("\n" + "=" * 60)


# FastAPI endpoint for HTTP access
@app.function(
    image=image,
)
@modal.asgi_app()
def fastapi_app():
    """Create FastAPI app for HTTP access"""
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import Response
    from pydantic import BaseModel

    web_app = FastAPI(title="EDM Generator API")

    class SpotifyFeaturesRequest(BaseModel):
        energy: float = 0.7
        danceability: float = 0.7
        valence: float = 0.5
        tempo: float = 128.0
        loudness: float = -5.0
        acousticness: float = 0.1
        instrumentalness: float = 0.8
        speechiness: float = 0.05
        key: int = 0
        mode: int = 1

    @web_app.get("/")
    def read_root():
        return {
            "service": "EDM Generator",
            "version": "1.0",
            "endpoints": {
                "/generate": "POST - Generate EDM track from Spotify features",
                "/health": "GET - Health check"
            }
        }

    @web_app.get("/health")
    def health_check():
        return {"status": "healthy"}

    @web_app.post("/generate")
    def generate_track(features: SpotifyFeaturesRequest):
        """Generate EDM track from Spotify features"""
        try:
            # Generate audio
            audio_bytes = generate_edm_track.remote(features.dict())

            # Return as WAV file
            return Response(
                content=audio_bytes,
                media_type="audio/wav",
                headers={
                    "Content-Disposition": "attachment; filename=edm_track.wav"
                }
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return web_app


if __name__ == "__main__":
    print("To run this service:")
    print("  1. Deploy: modal deploy modal_edm_generator.py")
    print("  2. Run locally: modal run modal_edm_generator.py --energy 0.9 --danceability 0.8")
    print("  3. Use as API: modal serve modal_edm_generator.py")
