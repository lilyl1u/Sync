"""
EDM Audio Synthesizer

Takes generated MIDI patterns (drums, melody, bass) and synthesizes them into audio.
Includes drum synthesis, bass synthesis, lead synthesis, effects processing,
and export to WAV/MP3 formats. Maps Spotify audio features to synthesis parameters.
"""

import numpy as np
import scipy.signal as signal
from scipy.io import wavfile
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from enum import Enum
import os
import tempfile

try:
    import librosa
    import soundfile as sf
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("Warning: librosa not installed. Some features will be limited.")

try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False
    print("Warning: pydub not installed. MP3 export will not be available.")

try:
    import mido
    from mido import MidiFile
    MIDO_AVAILABLE = True
except ImportError:
    MIDO_AVAILABLE = False
    print("Warning: mido not installed. MIDI import will be limited.")


class WaveformType(Enum):
    """Oscillator waveform types"""
    SINE = "sine"
    SQUARE = "square"
    SAW = "saw"
    TRIANGLE = "triangle"
    NOISE = "noise"


@dataclass
class SynthConfig:
    """Configuration for audio synthesis"""
    sample_rate: int = 44100
    bit_depth: int = 16
    tempo: int = 128  # BPM
    master_volume: float = 0.8  # 0.0 to 1.0

    # Spotify feature mappings (0.0 to 1.0)
    energy: float = 0.7
    valence: float = 0.6
    danceability: float = 0.8

    def get_filter_brightness(self) -> float:
        """Map valence to filter brightness"""
        return 0.3 + (self.valence * 0.7)  # 0.3 to 1.0

    def get_distortion_amount(self) -> float:
        """Map energy to distortion amount"""
        return self.energy * 0.5  # 0 to 0.5

    def get_sidechain_strength(self) -> float:
        """Map danceability to sidechain compression strength"""
        return self.danceability * 0.7  # 0 to 0.7


class Oscillator:
    """Basic oscillator for waveform generation"""

    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate

    def generate(
        self,
        frequency: float,
        duration: float,
        waveform: WaveformType = WaveformType.SINE,
        phase: float = 0.0
    ) -> np.ndarray:
        """
        Generate a waveform

        Args:
            frequency: Frequency in Hz
            duration: Duration in seconds
            waveform: Waveform type
            phase: Initial phase (0 to 2π)

        Returns:
            Audio samples as numpy array
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), endpoint=False)

        if waveform == WaveformType.SINE:
            return np.sin(2 * np.pi * frequency * t + phase)

        elif waveform == WaveformType.SQUARE:
            return signal.square(2 * np.pi * frequency * t + phase)

        elif waveform == WaveformType.SAW:
            return signal.sawtooth(2 * np.pi * frequency * t + phase)

        elif waveform == WaveformType.TRIANGLE:
            return signal.sawtooth(2 * np.pi * frequency * t + phase, width=0.5)

        elif waveform == WaveformType.NOISE:
            return np.random.uniform(-1, 1, len(t))

        return np.zeros(len(t))


class ADSR:
    """ADSR Envelope Generator"""

    def __init__(
        self,
        attack: float = 0.01,
        decay: float = 0.1,
        sustain: float = 0.7,
        release: float = 0.2,
        sample_rate: int = 44100
    ):
        """
        Initialize ADSR envelope

        Args:
            attack: Attack time in seconds
            decay: Decay time in seconds
            sustain: Sustain level (0.0 to 1.0)
            release: Release time in seconds
            sample_rate: Sample rate
        """
        self.attack = attack
        self.decay = decay
        self.sustain = sustain
        self.release = release
        self.sample_rate = sample_rate

    def generate(self, duration: float, note_duration: Optional[float] = None) -> np.ndarray:
        """
        Generate ADSR envelope

        Args:
            duration: Total duration in seconds
            note_duration: Duration of note before release (if None, uses duration)

        Returns:
            Envelope as numpy array
        """
        if note_duration is None:
            note_duration = duration

        num_samples = int(self.sample_rate * duration)
        envelope = np.zeros(num_samples)

        # Attack
        attack_samples = int(self.attack * self.sample_rate)
        if attack_samples > 0:
            envelope[:attack_samples] = np.linspace(0, 1, attack_samples)

        # Decay
        decay_samples = int(self.decay * self.sample_rate)
        decay_start = attack_samples
        decay_end = attack_samples + decay_samples
        if decay_samples > 0 and decay_end < num_samples:
            envelope[decay_start:decay_end] = np.linspace(1, self.sustain, decay_samples)

        # Sustain
        sustain_end = int(note_duration * self.sample_rate)
        if decay_end < sustain_end < num_samples:
            envelope[decay_end:sustain_end] = self.sustain

        # Release
        release_samples = int(self.release * self.sample_rate)
        release_start = sustain_end
        release_end = min(release_start + release_samples, num_samples)
        if release_samples > 0 and release_start < num_samples:
            start_level = envelope[release_start - 1] if release_start > 0 else self.sustain
            envelope[release_start:release_end] = np.linspace(start_level, 0, release_end - release_start)

        return envelope


class Filter:
    """Audio filters"""

    @staticmethod
    def lowpass(audio: np.ndarray, cutoff: float, sample_rate: int = 44100, order: int = 4) -> np.ndarray:
        """Apply lowpass filter"""
        nyquist = sample_rate / 2
        normalized_cutoff = cutoff / nyquist
        normalized_cutoff = np.clip(normalized_cutoff, 0.001, 0.999)

        b, a = signal.butter(order, normalized_cutoff, btype='low')
        return signal.filtfilt(b, a, audio)

    @staticmethod
    def highpass(audio: np.ndarray, cutoff: float, sample_rate: int = 44100, order: int = 4) -> np.ndarray:
        """Apply highpass filter"""
        nyquist = sample_rate / 2
        normalized_cutoff = cutoff / nyquist
        normalized_cutoff = np.clip(normalized_cutoff, 0.001, 0.999)

        b, a = signal.butter(order, normalized_cutoff, btype='high')
        return signal.filtfilt(b, a, audio)

    @staticmethod
    def bandpass(audio: np.ndarray, low: float, high: float, sample_rate: int = 44100, order: int = 4) -> np.ndarray:
        """Apply bandpass filter"""
        nyquist = sample_rate / 2
        low_norm = np.clip(low / nyquist, 0.001, 0.999)
        high_norm = np.clip(high / nyquist, 0.001, 0.999)

        b, a = signal.butter(order, [low_norm, high_norm], btype='band')
        return signal.filtfilt(b, a, audio)


class DrumSynthesizer:
    """Synthesize drum sounds"""

    def __init__(self, config: SynthConfig):
        self.config = config
        self.osc = Oscillator(config.sample_rate)

    def kick(self, duration: float = 0.5, pitch: float = 60.0) -> np.ndarray:
        """
        Generate kick drum sound

        Args:
            duration: Duration in seconds
            pitch: Base pitch (MIDI note number)

        Returns:
            Audio samples
        """
        # Pitch envelope (frequency sweep)
        num_samples = int(self.config.sample_rate * duration)
        t = np.linspace(0, duration, num_samples, endpoint=False)

        # Sweep from high to low frequency
        start_freq = librosa.midi_to_hz(pitch + 24) if LIBROSA_AVAILABLE else 440 * (2 ** ((pitch + 24 - 69) / 12))
        end_freq = librosa.midi_to_hz(pitch) if LIBROSA_AVAILABLE else 440 * (2 ** ((pitch - 69) / 12))

        freq_envelope = np.linspace(start_freq, end_freq, num_samples)

        # Generate sine wave with frequency sweep
        phase = 2 * np.pi * np.cumsum(freq_envelope) / self.config.sample_rate
        kick_wave = np.sin(phase)

        # Amplitude envelope (sharp attack, quick decay)
        amp_envelope = np.exp(-t / 0.1)

        # Add some noise for punch
        noise = np.random.uniform(-1, 1, num_samples) * 0.1
        noise = Filter.lowpass(noise, 200, self.config.sample_rate)
        noise *= np.exp(-t / 0.05)

        # Combine
        kick = kick_wave * amp_envelope + noise

        # Apply distortion based on energy
        distortion = self.config.get_distortion_amount()
        if distortion > 0:
            kick = np.tanh(kick * (1 + distortion * 2))

        return self._normalize(kick)

    def snare(self, duration: float = 0.3) -> np.ndarray:
        """Generate snare drum sound"""
        num_samples = int(self.config.sample_rate * duration)
        t = np.linspace(0, duration, num_samples, endpoint=False)

        # Tonal component (two resonant frequencies)
        tone1 = np.sin(2 * np.pi * 180 * t)
        tone2 = np.sin(2 * np.pi * 330 * t)
        tone = (tone1 + tone2) * 0.5

        # Noise component
        noise = np.random.uniform(-1, 1, num_samples)
        noise = Filter.bandpass(noise, 2000, 8000, self.config.sample_rate)

        # Mix tone and noise
        snare = tone * 0.3 + noise * 0.7

        # Envelope
        envelope = np.exp(-t / 0.1)
        snare *= envelope

        return self._normalize(snare)

    def hihat_closed(self, duration: float = 0.1) -> np.ndarray:
        """Generate closed hi-hat sound"""
        num_samples = int(self.config.sample_rate * duration)
        t = np.linspace(0, duration, num_samples, endpoint=False)

        # High-frequency noise
        noise = np.random.uniform(-1, 1, num_samples)
        hihat = Filter.highpass(noise, 7000, self.config.sample_rate)

        # Sharp envelope
        envelope = np.exp(-t / 0.05)
        hihat *= envelope

        # Adjust brightness based on valence
        brightness = self.config.get_filter_brightness()
        if brightness < 0.7:
            hihat = Filter.lowpass(hihat, 12000, self.config.sample_rate)

        return self._normalize(hihat * 0.6)

    def hihat_open(self, duration: float = 0.4) -> np.ndarray:
        """Generate open hi-hat sound"""
        num_samples = int(self.config.sample_rate * duration)
        t = np.linspace(0, duration, num_samples, endpoint=False)

        # High-frequency noise
        noise = np.random.uniform(-1, 1, num_samples)
        hihat = Filter.highpass(noise, 6000, self.config.sample_rate)

        # Longer decay than closed
        envelope = np.exp(-t / 0.15)
        hihat *= envelope

        return self._normalize(hihat * 0.5)

    def clap(self, duration: float = 0.2) -> np.ndarray:
        """Generate clap sound"""
        num_samples = int(self.config.sample_rate * duration)
        t = np.linspace(0, duration, num_samples, endpoint=False)

        # Multiple short noise bursts
        clap = np.zeros(num_samples)
        for delay in [0, 0.01, 0.02, 0.03]:
            start_idx = int(delay * self.config.sample_rate)
            if start_idx < num_samples:
                burst_len = min(500, num_samples - start_idx)
                burst = np.random.uniform(-1, 1, burst_len)
                burst = Filter.bandpass(burst, 1000, 4000, self.config.sample_rate)
                clap[start_idx:start_idx + burst_len] += burst

        # Envelope
        envelope = np.exp(-t / 0.08)
        clap *= envelope

        return self._normalize(clap)

    def crash(self, duration: float = 2.0) -> np.ndarray:
        """Generate crash cymbal sound"""
        num_samples = int(self.config.sample_rate * duration)
        t = np.linspace(0, duration, num_samples, endpoint=False)

        # Complex noise with multiple frequency components
        crash = np.random.uniform(-1, 1, num_samples)
        crash = Filter.highpass(crash, 3000, self.config.sample_rate)

        # Long decay
        envelope = np.exp(-t / 0.6)
        crash *= envelope

        return self._normalize(crash * 0.4)

    def _normalize(self, audio: np.ndarray, headroom: float = 0.9) -> np.ndarray:
        """Normalize audio to prevent clipping"""
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            return audio * (headroom / max_val)
        return audio


class BassSynthesizer:
    """Synthesize bass sounds"""

    def __init__(self, config: SynthConfig):
        self.config = config
        self.osc = Oscillator(config.sample_rate)

    def sub_bass(
        self,
        midi_note: int,
        duration: float,
        velocity: float = 1.0
    ) -> np.ndarray:
        """
        Generate sub-bass (pure sine wave)

        Args:
            midi_note: MIDI note number
            duration: Duration in seconds
            velocity: Velocity (0.0 to 1.0)

        Returns:
            Audio samples
        """
        frequency = librosa.midi_to_hz(midi_note) if LIBROSA_AVAILABLE else 440 * (2 ** ((midi_note - 69) / 12))

        # Pure sine wave for sub
        bass = self.osc.generate(frequency, duration, WaveformType.SINE)

        # ADSR envelope
        adsr = ADSR(attack=0.01, decay=0.1, sustain=0.8, release=0.1, sample_rate=self.config.sample_rate)
        envelope = adsr.generate(duration)

        bass *= envelope * velocity

        return bass

    def saw_bass(
        self,
        midi_note: int,
        duration: float,
        velocity: float = 1.0
    ) -> np.ndarray:
        """
        Generate saw bass (detuned saws with filter)

        Args:
            midi_note: MIDI note number
            duration: Duration in seconds
            velocity: Velocity (0.0 to 1.0)

        Returns:
            Audio samples
        """
        frequency = librosa.midi_to_hz(midi_note) if LIBROSA_AVAILABLE else 440 * (2 ** ((midi_note - 69) / 12))

        # Multiple detuned saw waves
        saw1 = self.osc.generate(frequency, duration, WaveformType.SAW)
        saw2 = self.osc.generate(frequency * 1.01, duration, WaveformType.SAW)
        saw3 = self.osc.generate(frequency * 0.99, duration, WaveformType.SAW)

        bass = (saw1 + saw2 + saw3) / 3

        # Lowpass filter with envelope
        cutoff_base = 200 + (self.config.get_filter_brightness() * 800)  # 200-1000 Hz
        num_samples = len(bass)
        t = np.linspace(0, duration, num_samples, endpoint=False)

        # Filter envelope
        filter_env = np.exp(-t / 0.2)
        cutoff_freq = cutoff_base + (filter_env * 500)

        # Apply filter (simplified - constant cutoff)
        bass = Filter.lowpass(bass, cutoff_base + 300, self.config.sample_rate)

        # ADSR envelope
        adsr = ADSR(attack=0.01, decay=0.15, sustain=0.7, release=0.15, sample_rate=self.config.sample_rate)
        envelope = adsr.generate(duration)

        bass *= envelope * velocity

        # Add distortion based on energy
        distortion = self.config.get_distortion_amount()
        if distortion > 0:
            bass = np.tanh(bass * (1 + distortion * 3))

        return bass * 0.7

    def fm_bass(
        self,
        midi_note: int,
        duration: float,
        velocity: float = 1.0
    ) -> np.ndarray:
        """
        Generate FM bass (frequency modulation)

        Args:
            midi_note: MIDI note number
            duration: Duration in seconds
            velocity: Velocity (0.0 to 1.0)

        Returns:
            Audio samples
        """
        carrier_freq = librosa.midi_to_hz(midi_note) if LIBROSA_AVAILABLE else 440 * (2 ** ((midi_note - 69) / 12))
        modulator_freq = carrier_freq * 2  # Harmonic ratio

        num_samples = int(self.config.sample_rate * duration)
        t = np.linspace(0, duration, num_samples, endpoint=False)

        # FM synthesis
        mod_index = 3.0 * np.exp(-t / 0.1)  # Modulation index envelope
        modulator = np.sin(2 * np.pi * modulator_freq * t)
        carrier = np.sin(2 * np.pi * carrier_freq * t + mod_index * modulator)

        # ADSR envelope
        adsr = ADSR(attack=0.005, decay=0.1, sustain=0.6, release=0.1, sample_rate=self.config.sample_rate)
        envelope = adsr.generate(duration)

        bass = carrier * envelope * velocity

        # Lowpass filter
        bass = Filter.lowpass(bass, 800, self.config.sample_rate)

        return bass * 0.7


class LeadSynthesizer:
    """Synthesize lead sounds"""

    def __init__(self, config: SynthConfig):
        self.config = config
        self.osc = Oscillator(config.sample_rate)

    def supersaw(
        self,
        midi_note: int,
        duration: float,
        velocity: float = 1.0
    ) -> np.ndarray:
        """
        Generate supersaw lead (multiple detuned saws)

        Args:
            midi_note: MIDI note number
            duration: Duration in seconds
            velocity: Velocity (0.0 to 1.0)

        Returns:
            Audio samples
        """
        frequency = librosa.midi_to_hz(midi_note) if LIBROSA_AVAILABLE else 440 * (2 ** ((midi_note - 69) / 12))

        # 7 detuned saw waves
        detune_amounts = [-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15]
        saws = []

        for detune in detune_amounts:
            detuned_freq = frequency * (2 ** (detune / 12))
            saw = self.osc.generate(detuned_freq, duration, WaveformType.SAW)
            saws.append(saw)

        supersaw = np.sum(saws, axis=0) / len(saws)

        # ADSR envelope
        adsr = ADSR(attack=0.02, decay=0.2, sustain=0.8, release=0.3, sample_rate=self.config.sample_rate)
        envelope = adsr.generate(duration)

        supersaw *= envelope * velocity

        # Highpass to remove mud
        supersaw = Filter.highpass(supersaw, 100, self.config.sample_rate)

        # Adjust brightness based on valence
        brightness = self.config.get_filter_brightness()
        cutoff = 2000 + (brightness * 6000)  # 2-8 kHz
        supersaw = Filter.lowpass(supersaw, cutoff, self.config.sample_rate)

        return supersaw * 0.6

    def pluck(
        self,
        midi_note: int,
        duration: float,
        velocity: float = 1.0
    ) -> np.ndarray:
        """
        Generate pluck lead (Karplus-Strong algorithm)

        Args:
            midi_note: MIDI note number
            duration: Duration in seconds
            velocity: Velocity (0.0 to 1.0)

        Returns:
            Audio samples
        """
        frequency = librosa.midi_to_hz(midi_note) if LIBROSA_AVAILABLE else 440 * (2 ** ((midi_note - 69) / 12))

        # Simplified pluck synthesis using filtered noise burst
        num_samples = int(self.config.sample_rate * duration)

        # Initial noise burst
        burst_len = int(self.config.sample_rate / frequency)
        burst = np.random.uniform(-1, 1, burst_len)

        # Extend and filter
        pluck = np.zeros(num_samples)
        pluck[:burst_len] = burst

        # Apply resonant lowpass filter
        pluck = Filter.lowpass(pluck, frequency * 4, self.config.sample_rate)

        # Decay envelope
        t = np.linspace(0, duration, num_samples, endpoint=False)
        envelope = np.exp(-t / 0.5)

        pluck *= envelope * velocity

        return pluck * 0.5

    def arp(
        self,
        midi_note: int,
        duration: float,
        velocity: float = 1.0
    ) -> np.ndarray:
        """
        Generate arp lead (short, punchy square wave)

        Args:
            midi_note: MIDI note number
            duration: Duration in seconds
            velocity: Velocity (0.0 to 1.0)

        Returns:
            Audio samples
        """
        frequency = librosa.midi_to_hz(midi_note) if LIBROSA_AVAILABLE else 440 * (2 ** ((midi_note - 69) / 12))

        # Square wave with PWM (pulse width modulation)
        arp = self.osc.generate(frequency, duration, WaveformType.SQUARE)

        # Very short envelope for arp character
        adsr = ADSR(attack=0.001, decay=0.05, sustain=0.3, release=0.05, sample_rate=self.config.sample_rate)
        envelope = adsr.generate(duration, note_duration=min(duration, 0.15))

        arp *= envelope * velocity

        # Bandpass filter for character
        arp = Filter.bandpass(arp, 500, 4000, self.config.sample_rate)

        return arp * 0.5


class EffectsProcessor:
    """Audio effects processing"""

    def __init__(self, config: SynthConfig):
        self.config = config

    def reverb(
        self,
        audio: np.ndarray,
        room_size: float = 0.5,
        damping: float = 0.5,
        wet: float = 0.3
    ) -> np.ndarray:
        """
        Apply reverb effect (simplified using multiple delays)

        Args:
            audio: Input audio
            room_size: Room size (0 to 1)
            damping: High frequency damping (0 to 1)
            wet: Wet/dry mix (0 to 1)

        Returns:
            Audio with reverb
        """
        # Simplified reverb using comb filters
        delays = [0.037, 0.041, 0.043, 0.047]  # Prime number delays in seconds

        reverb_signal = np.zeros_like(audio)

        for delay_time in delays:
            delay_samples = int(delay_time * self.config.sample_rate * room_size)
            feedback = 0.7 * room_size

            # Create delayed version
            delayed = np.zeros_like(audio)
            delayed[delay_samples:] = audio[:-delay_samples]

            # Apply feedback
            comb_output = np.zeros_like(audio)
            for i in range(len(audio)):
                comb_output[i] = delayed[i]
                if i >= delay_samples:
                    comb_output[i] += comb_output[i - delay_samples] * feedback

            # Apply damping (lowpass)
            if damping > 0:
                cutoff = 20000 * (1 - damping)
                comb_output = Filter.lowpass(comb_output, cutoff, self.config.sample_rate, order=2)

            reverb_signal += comb_output

        reverb_signal /= len(delays)

        # Mix dry and wet
        return audio * (1 - wet) + reverb_signal * wet

    def delay(
        self,
        audio: np.ndarray,
        delay_time: float = 0.25,
        feedback: float = 0.4,
        wet: float = 0.3
    ) -> np.ndarray:
        """
        Apply delay effect

        Args:
            audio: Input audio
            delay_time: Delay time in seconds
            feedback: Feedback amount (0 to 1)
            wet: Wet/dry mix (0 to 1)

        Returns:
            Audio with delay
        """
        delay_samples = int(delay_time * self.config.sample_rate)

        delayed_signal = np.zeros_like(audio)

        for i in range(len(audio)):
            delayed_signal[i] = audio[i]
            if i >= delay_samples:
                delayed_signal[i] += delayed_signal[i - delay_samples] * feedback

        # Mix dry and wet
        return audio * (1 - wet) + delayed_signal * wet

    def sidechain_compress(
        self,
        audio: np.ndarray,
        trigger: np.ndarray,
        threshold: float = 0.3,
        ratio: float = 4.0,
        attack: float = 0.01,
        release: float = 0.2
    ) -> np.ndarray:
        """
        Apply sidechain compression

        Args:
            audio: Input audio to compress
            trigger: Trigger signal (usually kick drum)
            threshold: Threshold for compression
            ratio: Compression ratio
            attack: Attack time in seconds
            release: Release time in seconds

        Returns:
            Compressed audio
        """
        # Ensure same length
        min_len = min(len(audio), len(trigger))
        audio = audio[:min_len]
        trigger = trigger[:min_len]

        # Calculate gain reduction envelope
        trigger_envelope = np.abs(trigger)

        # Smooth the envelope
        attack_samples = int(attack * self.config.sample_rate)
        release_samples = int(release * self.config.sample_rate)

        gain_reduction = np.ones_like(audio)
        current_gain = 1.0

        for i in range(len(audio)):
            # Calculate target gain based on trigger
            if trigger_envelope[i] > threshold:
                target_gain = 1.0 - ((trigger_envelope[i] - threshold) / ratio)
                target_gain = max(0.1, target_gain)
            else:
                target_gain = 1.0

            # Apply attack/release smoothing
            if target_gain < current_gain:
                # Attack
                alpha = 1.0 - np.exp(-1.0 / attack_samples) if attack_samples > 0 else 1.0
                current_gain = current_gain * (1 - alpha) + target_gain * alpha
            else:
                # Release
                alpha = 1.0 - np.exp(-1.0 / release_samples) if release_samples > 0 else 1.0
                current_gain = current_gain * (1 - alpha) + target_gain * alpha

            gain_reduction[i] = current_gain

        return audio * gain_reduction

    def distortion(
        self,
        audio: np.ndarray,
        amount: float = 0.5,
        mix: float = 0.5
    ) -> np.ndarray:
        """
        Apply distortion

        Args:
            audio: Input audio
            amount: Distortion amount (0 to 1)
            mix: Wet/dry mix (0 to 1)

        Returns:
            Distorted audio
        """
        # Soft clipping distortion
        gain = 1 + (amount * 9)  # 1 to 10
        distorted = np.tanh(audio * gain) / np.tanh(gain)

        return audio * (1 - mix) + distorted * mix

    def compressor(
        self,
        audio: np.ndarray,
        threshold: float = 0.5,
        ratio: float = 4.0,
        attack: float = 0.005,
        release: float = 0.1
    ) -> np.ndarray:
        """
        Apply dynamic range compression

        Args:
            audio: Input audio
            threshold: Threshold for compression (0 to 1)
            ratio: Compression ratio
            attack: Attack time in seconds
            release: Release time in seconds

        Returns:
            Compressed audio
        """
        # Calculate envelope
        envelope = np.abs(audio)

        # Smooth envelope
        attack_coeff = np.exp(-1.0 / (attack * self.config.sample_rate))
        release_coeff = np.exp(-1.0 / (release * self.config.sample_rate))

        smoothed_envelope = np.zeros_like(envelope)
        current = 0.0

        for i in range(len(envelope)):
            if envelope[i] > current:
                coeff = attack_coeff
            else:
                coeff = release_coeff

            current = coeff * current + (1 - coeff) * envelope[i]
            smoothed_envelope[i] = current

        # Calculate gain reduction
        gain = np.ones_like(audio)
        mask = smoothed_envelope > threshold
        gain[mask] = threshold + (smoothed_envelope[mask] - threshold) / ratio
        gain[mask] /= smoothed_envelope[mask]

        return audio * gain


class EDMSynthesizer:
    """Main EDM synthesizer - combines all elements"""

    def __init__(self, config: Optional[SynthConfig] = None):
        """Initialize EDM synthesizer"""
        self.config = config or SynthConfig()
        self.drum_synth = DrumSynthesizer(self.config)
        self.bass_synth = BassSynthesizer(self.config)
        self.lead_synth = LeadSynthesizer(self.config)
        self.effects = EffectsProcessor(self.config)

    def synthesize_drums(
        self,
        pattern: 'DrumPattern',
        bars: int = 1
    ) -> np.ndarray:
        """
        Synthesize drum pattern to audio

        Args:
            pattern: DrumPattern object
            bars: Number of bars to render

        Returns:
            Audio samples
        """
        from drum_pattern_generator import DrumType

        # Calculate duration
        beats_per_bar = 4
        seconds_per_beat = 60.0 / self.config.tempo
        bar_duration = beats_per_bar * seconds_per_beat
        total_duration = bar_duration * bars

        # Initialize output
        num_samples = int(self.config.sample_rate * total_duration)
        output = np.zeros(num_samples)

        # Get drum hit timings
        hits = pattern.get_hits()

        # Time per step
        time_per_step = bar_duration / pattern.steps

        # Map drum types to synthesis functions
        drum_synth_map = {
            DrumType.KICK: (self.drum_synth.kick, 0.5),
            DrumType.SNARE: (self.drum_synth.snare, 0.3),
            DrumType.CLAP: (self.drum_synth.clap, 0.2),
            DrumType.HIHAT_CLOSED: (self.drum_synth.hihat_closed, 0.1),
            DrumType.HIHAT_OPEN: (self.drum_synth.hihat_open, 0.4),
            DrumType.CRASH: (self.drum_synth.crash, 2.0),
        }

        # Render each bar
        for bar in range(bars):
            bar_offset = bar * bar_duration

            for hit in hits:
                if hit.drum_type not in drum_synth_map:
                    continue

                synth_func, default_duration = drum_synth_map[hit.drum_type]

                # Calculate hit time
                hit_time = bar_offset + (hit.step * time_per_step)
                hit_sample = int(hit_time * self.config.sample_rate)

                # Generate drum sound
                velocity = hit.velocity / 127.0

                # Add pitch variation for kick based on energy
                if hit.drum_type == DrumType.KICK:
                    pitch = 55 - (self.config.energy * 10)  # Lower pitch for higher energy
                    drum_audio = synth_func(duration=default_duration, pitch=pitch)
                else:
                    drum_audio = synth_func(duration=default_duration)

                drum_audio *= velocity

                # Add to output
                end_sample = min(hit_sample + len(drum_audio), num_samples)
                audio_len = end_sample - hit_sample
                if audio_len > 0:
                    output[hit_sample:end_sample] += drum_audio[:audio_len]

        return output

    def synthesize_midi_notes(
        self,
        midi_notes: List[Tuple[int, float, float, float]],
        synth_type: str = 'bass'
    ) -> np.ndarray:
        """
        Synthesize MIDI notes to audio

        Args:
            midi_notes: List of (note, start_time, duration, velocity) tuples
            synth_type: Type of synthesis ('bass', 'lead', 'sub_bass', 'saw_bass', etc.)

        Returns:
            Audio samples
        """
        if not midi_notes:
            return np.array([])

        # Calculate total duration
        max_end_time = max(start + duration for _, start, duration, _ in midi_notes)
        num_samples = int(self.config.sample_rate * max_end_time)
        output = np.zeros(num_samples)

        # Select synthesizer
        synth_map = {
            'sub_bass': self.bass_synth.sub_bass,
            'saw_bass': self.bass_synth.saw_bass,
            'fm_bass': self.bass_synth.fm_bass,
            'supersaw': self.lead_synth.supersaw,
            'pluck': self.lead_synth.pluck,
            'arp': self.lead_synth.arp,
        }

        # Default to saw_bass for 'bass' and supersaw for 'lead'
        if synth_type == 'bass':
            synth_type = 'saw_bass'
        elif synth_type == 'lead':
            synth_type = 'supersaw'

        synth_func = synth_map.get(synth_type, self.bass_synth.saw_bass)

        # Render each note
        for note, start_time, duration, velocity in midi_notes:
            start_sample = int(start_time * self.config.sample_rate)

            # Generate note
            note_audio = synth_func(note, duration, velocity)

            # Add to output
            end_sample = min(start_sample + len(note_audio), num_samples)
            audio_len = end_sample - start_sample
            if audio_len > 0:
                output[start_sample:end_sample] += note_audio[:audio_len]

        return output

    def mix_tracks(
        self,
        tracks: Dict[str, np.ndarray],
        levels: Optional[Dict[str, float]] = None
    ) -> np.ndarray:
        """
        Mix multiple tracks together

        Args:
            tracks: Dictionary of track_name -> audio
            levels: Dictionary of track_name -> level (0 to 1)

        Returns:
            Mixed audio
        """
        if not tracks:
            return np.array([])

        # Default levels
        if levels is None:
            levels = {
                'drums': 1.0,
                'bass': 0.8,
                'lead': 0.7,
                'kick': 1.2,  # Kick often louder
            }

        # Find max length
        max_len = max(len(audio) for audio in tracks.values())

        # Mix tracks
        mixed = np.zeros(max_len)

        for track_name, audio in tracks.items():
            level = levels.get(track_name, 0.8)

            # Pad if needed
            if len(audio) < max_len:
                audio = np.pad(audio, (0, max_len - len(audio)))

            mixed += audio * level

        # Apply master compression
        mixed = self.effects.compressor(
            mixed,
            threshold=0.6,
            ratio=4.0,
            attack=0.005,
            release=0.1
        )

        # Apply master volume
        mixed *= self.config.master_volume

        # Soft limiter
        mixed = np.tanh(mixed * 1.2) * 0.9

        return mixed

    def apply_sidechain_to_track(
        self,
        audio: np.ndarray,
        kick_audio: np.ndarray,
        strength: Optional[float] = None
    ) -> np.ndarray:
        """
        Apply sidechain compression to a track using kick as trigger

        Args:
            audio: Audio to compress
            kick_audio: Kick drum audio (trigger)
            strength: Sidechain strength (uses danceability if None)

        Returns:
            Sidechained audio
        """
        if strength is None:
            strength = self.config.get_sidechain_strength()

        # Calculate parameters from strength
        ratio = 2.0 + (strength * 8.0)  # 2:1 to 10:1

        return self.effects.sidechain_compress(
            audio,
            kick_audio,
            threshold=0.2,
            ratio=ratio,
            attack=0.005,
            release=0.15
        )

    def export_wav(
        self,
        audio: np.ndarray,
        filename: str,
        normalize: bool = True
    ):
        """
        Export audio to WAV file

        Args:
            audio: Audio samples
            filename: Output filename
            normalize: Whether to normalize audio
        """
        # Normalize if requested
        if normalize:
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                audio = audio / max_val * 0.95

        # Convert to int16
        audio_int = (audio * 32767).astype(np.int16)

        # Write file
        wavfile.write(filename, self.config.sample_rate, audio_int)
        print(f"Exported WAV: {filename}")

    def export_mp3(
        self,
        audio: np.ndarray,
        filename: str,
        bitrate: str = "192k",
        normalize: bool = True
    ):
        """
        Export audio to MP3 file

        Args:
            audio: Audio samples
            filename: Output filename
            bitrate: MP3 bitrate
            normalize: Whether to normalize audio
        """
        if not PYDUB_AVAILABLE:
            print("Warning: pydub not available. Cannot export MP3. Exporting WAV instead.")
            wav_filename = filename.replace('.mp3', '.wav')
            self.export_wav(audio, wav_filename, normalize)
            return

        # Normalize if requested
        if normalize:
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                audio = audio / max_val * 0.95

        # Convert to int16
        audio_int = (audio * 32767).astype(np.int16)

        # Create temporary WAV file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_wav:
            temp_wav_path = temp_wav.name
            wavfile.write(temp_wav_path, self.config.sample_rate, audio_int)

        try:
            # Convert to MP3 using pydub
            audio_segment = AudioSegment.from_wav(temp_wav_path)
            audio_segment.export(filename, format='mp3', bitrate=bitrate)
            print(f"Exported MP3: {filename}")
        finally:
            # Clean up temp file
            if os.path.exists(temp_wav_path):
                os.remove(temp_wav_path)

    def render_full_track(
        self,
        drum_pattern: Optional['DrumPattern'] = None,
        bass_notes: Optional[List[Tuple[int, float, float, float]]] = None,
        lead_notes: Optional[List[Tuple[int, float, float, float]]] = None,
        bars: int = 4,
        add_effects: bool = True,
        output_filename: Optional[str] = None
    ) -> np.ndarray:
        """
        Render a complete EDM track

        Args:
            drum_pattern: DrumPattern object
            bass_notes: List of (note, start_time, duration, velocity) for bass
            lead_notes: List of (note, start_time, duration, velocity) for lead
            bars: Number of bars to render
            add_effects: Whether to add reverb, delay, etc.
            output_filename: If provided, export to file (.wav or .mp3)

        Returns:
            Mixed audio
        """
        tracks = {}

        # Render drums
        if drum_pattern is not None:
            print("Rendering drums...")
            drums = self.synthesize_drums(drum_pattern, bars)
            tracks['drums'] = drums

            # Extract kick for sidechain
            from drum_pattern_generator import DrumPattern, DrumType
            kick_pattern = DrumPattern(steps=drum_pattern.steps)
            for hit in drum_pattern.get_hits():
                if hit.drum_type == DrumType.KICK:
                    kick_pattern.add_hit(hit.step, hit.drum_type, hit.velocity)
            kick_audio = self.synthesize_drums(kick_pattern, bars)
        else:
            kick_audio = None

        # Render bass
        if bass_notes is not None:
            print("Rendering bass...")
            bass = self.synthesize_midi_notes(bass_notes, synth_type='saw_bass')

            # Apply sidechain if we have kick
            if kick_audio is not None and len(bass) > 0:
                bass = self.apply_sidechain_to_track(bass, kick_audio)

            tracks['bass'] = bass

        # Render lead
        if lead_notes is not None:
            print("Rendering lead...")
            lead = self.synthesize_midi_notes(lead_notes, synth_type='supersaw')

            # Apply effects if requested
            if add_effects:
                # Add reverb based on valence (happier = more reverb)
                reverb_amount = 0.2 + (self.config.valence * 0.3)
                lead = self.effects.reverb(lead, room_size=0.6, wet=reverb_amount)

                # Add delay
                beat_duration = 60.0 / self.config.tempo
                delay_time = beat_duration / 2  # 8th note delay
                lead = self.effects.delay(lead, delay_time=delay_time, feedback=0.3, wet=0.2)

            # Apply sidechain if we have kick
            if kick_audio is not None and len(lead) > 0:
                lead = self.apply_sidechain_to_track(lead, kick_audio, strength=0.3)

            tracks['lead'] = lead

        # Mix all tracks
        print("Mixing tracks...")
        mixed = self.mix_tracks(tracks)

        # Add global reverb
        if add_effects:
            mixed = self.effects.reverb(mixed, room_size=0.4, wet=0.15)

        # Export if filename provided
        if output_filename is not None:
            if output_filename.endswith('.mp3'):
                self.export_mp3(mixed, output_filename)
            else:
                self.export_wav(mixed, output_filename)

        return mixed


def midi_file_to_notes(midi_path: str) -> Dict[str, List[Tuple[int, float, float, float]]]:
    """
    Convert MIDI file to note lists

    Args:
        midi_path: Path to MIDI file

    Returns:
        Dictionary with 'bass', 'lead', 'melody' note lists
    """
    if not MIDO_AVAILABLE:
        print("Error: mido not available")
        return {}

    mid = MidiFile(midi_path)

    # Get tempo
    tempo = 500000  # Default 120 BPM in microseconds
    for track in mid.tracks:
        for msg in track:
            if msg.type == 'set_tempo':
                tempo = msg.tempo
                break

    ticks_per_beat = mid.ticks_per_beat
    seconds_per_tick = (tempo / 1000000.0) / ticks_per_beat

    # Extract notes from each track
    result = {}

    for i, track in enumerate(mid.tracks):
        notes = []
        current_time = 0
        active_notes = {}

        for msg in track:
            current_time += msg.time * seconds_per_tick

            if msg.type == 'note_on' and msg.velocity > 0:
                active_notes[msg.note] = (current_time, msg.velocity / 127.0)

            elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                if msg.note in active_notes:
                    start_time, velocity = active_notes.pop(msg.note)
                    duration = current_time - start_time
                    notes.append((msg.note, start_time, duration, velocity))

        if notes:
            # Classify track by pitch range
            avg_pitch = np.mean([note[0] for note in notes])
            if avg_pitch < 48:
                result['bass'] = notes
            elif avg_pitch < 72:
                result['melody'] = notes
            else:
                result['lead'] = notes

    return result


if __name__ == "__main__":
    print("EDM Synthesizer Test\n")
    print("=" * 60)

    # Create config with Spotify features
    config = SynthConfig(
        tempo=128,
        energy=0.8,
        valence=0.7,
        danceability=0.9
    )

    synth = EDMSynthesizer(config)

    # Test 1: Drum synthesis
    print("\n1. Testing drum synthesis...")
    from drum_pattern_generator import EDMPatternLibrary, DrumPattern

    kick = EDMPatternLibrary.four_on_floor(16)
    hihat = EDMPatternLibrary.syncopated_hihat(16)
    snare = EDMPatternLibrary.snare_clap_pattern(16)
    pattern = EDMPatternLibrary.combine_patterns(kick, hihat, snare)

    drums_audio = synth.synthesize_drums(pattern, bars=2)
    synth.export_wav(drums_audio, "/tmp/test_drums.wav")

    # Test 2: Bass synthesis
    print("\n2. Testing bass synthesis...")
    bass_notes = [
        (36, 0.0, 0.5, 0.8),
        (36, 0.5, 0.5, 0.7),
        (38, 1.0, 0.5, 0.8),
        (36, 1.5, 0.5, 0.7),
    ]
    bass_audio = synth.synthesize_midi_notes(bass_notes, synth_type='saw_bass')
    synth.export_wav(bass_audio, "/tmp/test_bass.wav")

    # Test 3: Lead synthesis
    print("\n3. Testing lead synthesis...")
    lead_notes = [
        (60, 0.0, 0.25, 0.7),
        (64, 0.25, 0.25, 0.7),
        (67, 0.5, 0.25, 0.7),
        (72, 0.75, 0.5, 0.8),
    ]
    lead_audio = synth.synthesize_midi_notes(lead_notes, synth_type='supersaw')
    synth.export_wav(lead_audio, "/tmp/test_lead.wav")

    # Test 4: Full track
    print("\n4. Testing full track render...")
    full_track = synth.render_full_track(
        drum_pattern=pattern,
        bass_notes=bass_notes * 4,  # Repeat for 4 bars
        lead_notes=lead_notes * 4,
        bars=4,
        add_effects=True,
        output_filename="/tmp/test_full_track.wav"
    )

    print("\n" + "=" * 60)
    print("Tests completed! Check /tmp/ for output files.")
    print(f"Full track length: {len(full_track) / config.sample_rate:.2f} seconds")
