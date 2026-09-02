"""
Audio Utilities for EDM Generation

Provides core audio processing functionality including:
- Audio file I/O
- MIDI to audio conversion
- Basic synthesis (sine, square, sawtooth, triangle waves)
- Tempo and beat grid utilities
- Audio effects (reverb, delay, filters)
"""

import numpy as np
import soundfile as sf
import librosa
from pathlib import Path
from typing import Tuple, Optional, List, Union
import warnings

warnings.filterwarnings('ignore')


class AudioSynthesizer:
    """Generate basic waveforms for audio synthesis"""

    def __init__(self, sample_rate: int = 44100):
        """
        Initialize audio synthesizer

        Args:
            sample_rate: Audio sample rate in Hz (default: 44100)
        """
        self.sample_rate = sample_rate

    def generate_sine_wave(
        self,
        frequency: float,
        duration: float,
        amplitude: float = 0.5
    ) -> np.ndarray:
        """
        Generate a sine wave

        Args:
            frequency: Frequency in Hz
            duration: Duration in seconds
            amplitude: Amplitude (0-1)

        Returns:
            Audio signal as numpy array
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        wave = amplitude * np.sin(2 * np.pi * frequency * t)
        return wave.astype(np.float32)

    def generate_square_wave(
        self,
        frequency: float,
        duration: float,
        amplitude: float = 0.5
    ) -> np.ndarray:
        """
        Generate a square wave

        Args:
            frequency: Frequency in Hz
            duration: Duration in seconds
            amplitude: Amplitude (0-1)

        Returns:
            Audio signal as numpy array
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        wave = amplitude * np.sign(np.sin(2 * np.pi * frequency * t))
        return wave.astype(np.float32)

    def generate_sawtooth_wave(
        self,
        frequency: float,
        duration: float,
        amplitude: float = 0.5
    ) -> np.ndarray:
        """
        Generate a sawtooth wave

        Args:
            frequency: Frequency in Hz
            duration: Duration in seconds
            amplitude: Amplitude (0-1)

        Returns:
            Audio signal as numpy array
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        wave = amplitude * 2 * (t * frequency - np.floor(0.5 + t * frequency))
        return wave.astype(np.float32)

    def generate_triangle_wave(
        self,
        frequency: float,
        duration: float,
        amplitude: float = 0.5
    ) -> np.ndarray:
        """
        Generate a triangle wave

        Args:
            frequency: Frequency in Hz
            duration: Duration in seconds
            amplitude: Amplitude (0-1)

        Returns:
            Audio signal as numpy array
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        wave = amplitude * 2 * np.abs(2 * (t * frequency - np.floor(t * frequency + 0.5))) - amplitude
        return wave.astype(np.float32)

    def generate_kick_drum(self, duration: float = 0.5) -> np.ndarray:
        """
        Generate a simple kick drum sound

        Args:
            duration: Duration in seconds

        Returns:
            Kick drum audio signal
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)

        # Frequency sweep from 150Hz to 40Hz
        freq_start = 150
        freq_end = 40
        frequency = freq_start * np.exp(-5 * t / duration)

        # Exponential envelope
        envelope = np.exp(-6 * t / duration)

        # Generate sine wave with frequency sweep
        phase = 2 * np.pi * np.cumsum(frequency) / self.sample_rate
        kick = 0.8 * envelope * np.sin(phase)

        return kick.astype(np.float32)

    def generate_snare_drum(self, duration: float = 0.2) -> np.ndarray:
        """
        Generate a simple snare drum sound

        Args:
            duration: Duration in seconds

        Returns:
            Snare drum audio signal
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)

        # Tonal component (sine)
        tonal = 0.3 * np.sin(2 * np.pi * 200 * t)

        # Noise component
        noise = 0.7 * np.random.uniform(-1, 1, len(t))

        # Envelope
        envelope = np.exp(-10 * t / duration)

        snare = envelope * (tonal + noise)
        return snare.astype(np.float32)

    def generate_hihat(self, duration: float = 0.1, closed: bool = True) -> np.ndarray:
        """
        Generate a hi-hat sound

        Args:
            duration: Duration in seconds
            closed: If True, generate closed hi-hat; otherwise open

        Returns:
            Hi-hat audio signal
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)

        # High-frequency noise
        noise = np.random.uniform(-1, 1, len(t))

        # High-pass filter (simple)
        # Apply multiple sine waves at high frequencies
        harmonics = 0
        for freq in [6000, 7500, 9000, 10500]:
            harmonics += np.sin(2 * np.pi * freq * t)

        # Mix noise with harmonics
        hihat = 0.6 * noise + 0.4 * harmonics

        # Envelope
        if closed:
            envelope = np.exp(-40 * t / duration)
        else:
            envelope = np.exp(-15 * t / duration)

        hihat = 0.3 * envelope * hihat
        return hihat.astype(np.float32)


class AudioIO:
    """Handle audio file input/output operations"""

    @staticmethod
    def load_audio(
        file_path: Union[str, Path],
        sample_rate: Optional[int] = None,
        mono: bool = True
    ) -> Tuple[np.ndarray, int]:
        """
        Load audio file

        Args:
            file_path: Path to audio file
            sample_rate: Target sample rate (None = original rate)
            mono: If True, convert to mono

        Returns:
            Tuple of (audio_data, sample_rate)
        """
        audio, sr = librosa.load(
            str(file_path),
            sr=sample_rate,
            mono=mono
        )
        return audio, sr

    @staticmethod
    def save_audio(
        audio: np.ndarray,
        file_path: Union[str, Path],
        sample_rate: int = 44100,
        format: Optional[str] = None
    ) -> None:
        """
        Save audio to file

        Args:
            audio: Audio data as numpy array
            file_path: Output file path
            sample_rate: Sample rate in Hz
            format: Audio format (WAV, FLAC, OGG, etc.). Auto-detected from extension if None
        """
        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Ensure audio is 2D (channels, samples)
        if audio.ndim == 1:
            audio = audio.reshape(1, -1)

        # Transpose to (samples, channels) for soundfile
        audio = audio.T

        sf.write(str(file_path), audio, sample_rate, format=format)

    @staticmethod
    def audio_info(file_path: Union[str, Path]) -> dict:
        """
        Get audio file information

        Args:
            file_path: Path to audio file

        Returns:
            Dictionary with audio file info
        """
        info = sf.info(str(file_path))
        return {
            'sample_rate': info.samplerate,
            'channels': info.channels,
            'duration': info.duration,
            'frames': info.frames,
            'format': info.format,
            'subtype': info.subtype,
        }


class BeatGridUtils:
    """Utilities for tempo and beat grid operations"""

    @staticmethod
    def detect_tempo(
        audio: np.ndarray,
        sample_rate: int = 44100
    ) -> float:
        """
        Detect tempo (BPM) from audio

        Args:
            audio: Audio signal
            sample_rate: Sample rate in Hz

        Returns:
            Detected tempo in BPM
        """
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sample_rate)
        return float(tempo)

    @staticmethod
    def detect_beats(
        audio: np.ndarray,
        sample_rate: int = 44100
    ) -> Tuple[float, np.ndarray]:
        """
        Detect beat positions in audio

        Args:
            audio: Audio signal
            sample_rate: Sample rate in Hz

        Returns:
            Tuple of (tempo, beat_frames)
        """
        tempo, beat_frames = librosa.beat.beat_track(y=audio, sr=sample_rate)
        return float(tempo), beat_frames

    @staticmethod
    def time_stretch(
        audio: np.ndarray,
        rate: float
    ) -> np.ndarray:
        """
        Time-stretch audio without changing pitch

        Args:
            audio: Audio signal
            rate: Stretch rate (>1 = faster, <1 = slower)

        Returns:
            Time-stretched audio
        """
        return librosa.effects.time_stretch(audio, rate=rate)

    @staticmethod
    def pitch_shift(
        audio: np.ndarray,
        sample_rate: int,
        n_steps: float
    ) -> np.ndarray:
        """
        Shift pitch without changing tempo

        Args:
            audio: Audio signal
            sample_rate: Sample rate in Hz
            n_steps: Number of semitones to shift (can be fractional)

        Returns:
            Pitch-shifted audio
        """
        return librosa.effects.pitch_shift(audio, sr=sample_rate, n_steps=n_steps)

    @staticmethod
    def create_click_track(
        tempo: float,
        duration: float,
        sample_rate: int = 44100
    ) -> np.ndarray:
        """
        Create a metronome click track

        Args:
            tempo: Tempo in BPM
            duration: Duration in seconds
            sample_rate: Sample rate in Hz

        Returns:
            Click track audio
        """
        # Calculate beat interval
        beat_interval = 60.0 / tempo
        num_beats = int(duration / beat_interval)

        # Create clicks
        click_duration = 0.05  # 50ms click
        click_samples = int(click_duration * sample_rate)

        # Generate click sound (short sine burst)
        t = np.linspace(0, click_duration, click_samples)
        click = 0.5 * np.sin(2 * np.pi * 1000 * t) * np.exp(-20 * t)

        # Create full track
        total_samples = int(duration * sample_rate)
        track = np.zeros(total_samples)

        for i in range(num_beats):
            start_sample = int(i * beat_interval * sample_rate)
            end_sample = min(start_sample + click_samples, total_samples)
            track[start_sample:end_sample] = click[:end_sample - start_sample]

        return track.astype(np.float32)


class AudioEffects:
    """Apply audio effects for EDM production"""

    @staticmethod
    def apply_reverb(
        audio: np.ndarray,
        room_size: float = 0.5,
        damping: float = 0.5,
        wet_level: float = 0.3
    ) -> np.ndarray:
        """
        Apply simple reverb effect (using convolution)

        Args:
            audio: Input audio signal
            room_size: Room size parameter (0-1)
            damping: High frequency damping (0-1)
            wet_level: Wet/dry mix (0-1, where 0=dry, 1=wet)

        Returns:
            Audio with reverb applied
        """
        # Simple algorithmic reverb using comb filters
        sample_rate = 44100

        # Create impulse response (simplified)
        ir_length = int(room_size * sample_rate * 0.5)
        impulse_response = np.exp(-3 * np.linspace(0, 1, ir_length))
        impulse_response *= np.random.randn(ir_length) * 0.5

        # Apply damping
        if damping > 0:
            b, a = librosa.filters.get_window('hann', int(damping * 100)), 1
            impulse_response = np.convolve(impulse_response, b, mode='same')

        # Convolve
        wet = np.convolve(audio, impulse_response, mode='same')

        # Mix wet/dry
        output = (1 - wet_level) * audio + wet_level * wet

        # Normalize
        output = output / np.max(np.abs(output) + 1e-8)

        return output.astype(np.float32)

    @staticmethod
    def apply_delay(
        audio: np.ndarray,
        sample_rate: int,
        delay_time: float = 0.25,
        feedback: float = 0.5,
        mix: float = 0.3
    ) -> np.ndarray:
        """
        Apply delay effect

        Args:
            audio: Input audio signal
            sample_rate: Sample rate in Hz
            delay_time: Delay time in seconds
            feedback: Feedback amount (0-1)
            mix: Wet/dry mix (0-1)

        Returns:
            Audio with delay applied
        """
        delay_samples = int(delay_time * sample_rate)

        # Create output buffer
        output = np.zeros(len(audio) + delay_samples * 3)
        output[:len(audio)] = audio

        # Apply delay with feedback
        for i in range(len(audio), len(output)):
            if i >= delay_samples:
                output[i] += output[i - delay_samples] * feedback

        # Trim to original length
        delayed = output[:len(audio)]

        # Mix
        result = (1 - mix) * audio + mix * delayed

        # Normalize
        result = result / np.max(np.abs(result) + 1e-8)

        return result.astype(np.float32)

    @staticmethod
    def apply_lowpass_filter(
        audio: np.ndarray,
        sample_rate: int,
        cutoff_freq: float = 2000
    ) -> np.ndarray:
        """
        Apply low-pass filter

        Args:
            audio: Input audio signal
            sample_rate: Sample rate in Hz
            cutoff_freq: Cutoff frequency in Hz

        Returns:
            Filtered audio
        """
        from scipy import signal

        # Design Butterworth low-pass filter
        nyquist = sample_rate / 2
        normalized_cutoff = cutoff_freq / nyquist
        b, a = signal.butter(4, normalized_cutoff, btype='low')

        # Apply filter
        filtered = signal.filtfilt(b, a, audio)

        return filtered.astype(np.float32)

    @staticmethod
    def apply_highpass_filter(
        audio: np.ndarray,
        sample_rate: int,
        cutoff_freq: float = 200
    ) -> np.ndarray:
        """
        Apply high-pass filter

        Args:
            audio: Input audio signal
            sample_rate: Sample rate in Hz
            cutoff_freq: Cutoff frequency in Hz

        Returns:
            Filtered audio
        """
        from scipy import signal

        # Design Butterworth high-pass filter
        nyquist = sample_rate / 2
        normalized_cutoff = cutoff_freq / nyquist
        b, a = signal.butter(4, normalized_cutoff, btype='high')

        # Apply filter
        filtered = signal.filtfilt(b, a, audio)

        return filtered.astype(np.float32)


class MIDIConverter:
    """Convert MIDI to audio using various methods"""

    @staticmethod
    def midi_to_audio_fluidsynth(
        midi_path: Union[str, Path],
        output_path: Union[str, Path],
        soundfont_path: Union[str, Path],
        sample_rate: int = 44100
    ) -> None:
        """
        Convert MIDI to audio using FluidSynth

        Args:
            midi_path: Path to MIDI file
            output_path: Path to output audio file
            soundfont_path: Path to SoundFont (.sf2) file
            sample_rate: Sample rate in Hz
        """
        import subprocess

        # Use FluidSynth command line
        subprocess.run([
            'fluidsynth',
            '-ni',  # Non-interactive
            str(soundfont_path),
            str(midi_path),
            '-F', str(output_path),
            '-r', str(sample_rate)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    @staticmethod
    def midi_to_audio_synthesis(
        midi_path: Union[str, Path],
        output_path: Union[str, Path],
        sample_rate: int = 44100
    ) -> None:
        """
        Convert MIDI to audio using basic synthesis (no soundfont required)

        Args:
            midi_path: Path to MIDI file
            output_path: Path to output audio file
            sample_rate: Sample rate in Hz
        """
        import pretty_midi

        # Load MIDI
        midi_data = pretty_midi.PrettyMIDI(str(midi_path))

        # Synthesize to audio
        audio = midi_data.fluidsynth(fs=sample_rate)

        # Save
        AudioIO.save_audio(audio, output_path, sample_rate)


# Utility functions for quick access

def load_audio(file_path: Union[str, Path], **kwargs) -> Tuple[np.ndarray, int]:
    """Load audio file - convenience function"""
    return AudioIO.load_audio(file_path, **kwargs)


def save_audio(audio: np.ndarray, file_path: Union[str, Path], **kwargs) -> None:
    """Save audio file - convenience function"""
    AudioIO.save_audio(audio, file_path, **kwargs)


def generate_sine(frequency: float, duration: float, **kwargs) -> np.ndarray:
    """Generate sine wave - convenience function"""
    synth = AudioSynthesizer()
    return synth.generate_sine_wave(frequency, duration, **kwargs)


def generate_beat(tempo: float = 120, duration: float = 4, sample_rate: int = 44100) -> np.ndarray:
    """
    Generate a simple EDM beat pattern

    Args:
        tempo: Tempo in BPM
        duration: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        Audio signal with basic beat pattern
    """
    synth = AudioSynthesizer(sample_rate)

    # Calculate beat timing
    beat_duration = 60.0 / tempo
    num_beats = int(duration / beat_duration)

    # Create output array
    total_samples = int(duration * sample_rate)
    output = np.zeros(total_samples)

    # Add kick on every beat
    kick = synth.generate_kick_drum(0.5)

    # Add snare on beats 2 and 4
    snare = synth.generate_snare_drum(0.2)

    # Add hi-hat on every eighth note
    hihat = synth.generate_hihat(0.1, closed=True)

    for beat in range(num_beats):
        beat_sample = int(beat * beat_duration * sample_rate)

        # Kick drum on every beat
        if beat_sample + len(kick) <= total_samples:
            output[beat_sample:beat_sample + len(kick)] += kick

        # Snare on beats 1 and 3 (in 4/4 time)
        if beat % 4 in [1, 3]:
            if beat_sample + len(snare) <= total_samples:
                output[beat_sample:beat_sample + len(snare)] += snare

        # Hi-hat on every eighth note
        for eighth in range(2):
            eighth_sample = beat_sample + int(eighth * beat_duration * sample_rate / 2)
            if eighth_sample + len(hihat) <= total_samples:
                output[eighth_sample:eighth_sample + len(hihat)] += hihat

    # Normalize
    output = output / np.max(np.abs(output) + 1e-8) * 0.8

    return output.astype(np.float32)
