"""
Generate MIDI files using pretrained VAE model

Usage:
    modal run scripts/generate_midi_vae.py --num-samples 1
"""

import modal
from pathlib import Path

app = modal.App("vae-midi-generation")

models_volume = modal.Volume.from_name("trained-models")
output_volume = modal.Volume.from_name("generated-midi", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("torch==2.1.2", "numpy==1.26.3", "pretty-midi==0.2.10")
)

MODELS_PATH = "/models"
OUTPUT_PATH = "/output"


@app.function(
    image=image,
    gpu="T4",
    volumes={
        MODELS_PATH: models_volume,
        OUTPUT_PATH: output_volume,
    },
    timeout=600,
)
def generate_midi(num_samples: int = 1, temperature: float = 1.0):
    """
    Generate MIDI files from pretrained VAE model

    Args:
        num_samples: Number of MIDI files to generate
        temperature: Sampling temperature (higher = more random)

    Returns:
        List of generated file paths
    """
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import numpy as np
    import pretty_midi

    print("="*60)
    print("Generating MIDI with VAE Model")
    print("="*60)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\nDevice: {device}")

    # Define MusicVAE (same as training)
    class MusicVAE(nn.Module):
        def __init__(self, input_dim=88, latent_dim=512, seq_length=512, beta=1.0):
            super().__init__()
            self.input_dim = input_dim
            self.latent_dim = latent_dim
            self.seq_length = seq_length
            self.beta = beta
            self.padded_dim = ((input_dim + 15) // 16) * 16  # 88 -> 96

            self.encoder_conv = nn.Sequential(
                nn.Conv2d(1, 32, 4, 2, 1), nn.BatchNorm2d(32), nn.ReLU(),
                nn.Conv2d(32, 64, 4, 2, 1), nn.BatchNorm2d(64), nn.ReLU(),
                nn.Conv2d(64, 128, 4, 2, 1), nn.BatchNorm2d(128), nn.ReLU(),
                nn.Conv2d(128, 256, 4, 2, 1), nn.BatchNorm2d(256), nn.ReLU(),
            )

            self.conv_output_size = 256 * (self.padded_dim // 16) * (seq_length // 16)
            self.fc_mu = nn.Linear(self.conv_output_size, latent_dim)
            self.fc_logvar = nn.Linear(self.conv_output_size, latent_dim)
            self.decoder_fc = nn.Linear(latent_dim, self.conv_output_size)

            self.decoder_conv = nn.Sequential(
                nn.ConvTranspose2d(256, 128, 4, 2, 1), nn.BatchNorm2d(128), nn.ReLU(),
                nn.ConvTranspose2d(128, 64, 4, 2, 1), nn.BatchNorm2d(64), nn.ReLU(),
                nn.ConvTranspose2d(64, 32, 4, 2, 1), nn.BatchNorm2d(32), nn.ReLU(),
                nn.ConvTranspose2d(32, 1, 4, 2, 1),
            )

        def _pad(self, x):
            if self.input_dim < self.padded_dim:
                return F.pad(x, (0, 0, 0, self.padded_dim - self.input_dim))
            return x

        def _crop(self, x):
            return x[:, :, :self.input_dim, :]

        def decode(self, z, apply_sigmoid=False):
            h = self.decoder_fc(z).view(z.size(0), 256, self.padded_dim // 16, self.seq_length // 16)
            logits = self._crop(self.decoder_conv(h))
            return torch.sigmoid(logits) if apply_sigmoid else logits

    # Load model
    model_path = Path(MODELS_PATH) / "pretrained_model.pt"

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model not found: {model_path}\n"
            "Run: modal run scripts/pretrain_model.py --gpu A100 --epochs 50"
        )

    print(f"\nLoading model from {model_path}...")
    checkpoint = torch.load(model_path, map_location=device)

    config = checkpoint.get('config', {})
    latent_dim = config.get('latent_dim', 512)

    model = MusicVAE(input_dim=88, latent_dim=latent_dim, seq_length=512, beta=config.get('beta', 0.1))
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()

    print(f"✓ Model loaded (latent_dim={latent_dim})")

    # Create output directory
    output_dir = Path(OUTPUT_PATH)
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_files = []

    print(f"\nGenerating {num_samples} MIDI file(s)...")
    print(f"Temperature: {temperature}")

    with torch.no_grad():
        for i in range(num_samples):
            # Sample from standard normal distribution
            z = torch.randn(1, latent_dim).to(device) * temperature

            # Decode to piano roll
            output = model.decode(z, apply_sigmoid=True)
            piano_roll = output[0, 0].cpu().numpy()  # (88, 512)

            # Convert piano roll to MIDI
            midi = pianoroll_to_midi(piano_roll, fs=4, threshold=0.3)

            # Save MIDI file
            output_file = output_dir / f"generated_{i:04d}.mid"
            midi.write(str(output_file))

            generated_files.append(str(output_file.relative_to(OUTPUT_PATH)))
            print(f"  ✓ Generated: {output_file.name}")

    # Commit to volume
    output_volume.commit()

    print(f"\n✓ Generated {len(generated_files)} MIDI files")
    print(f"  Saved to Modal volume: generated-midi")

    return generated_files


def pianoroll_to_midi(piano_roll, fs=4, threshold=0.3):
    """Convert piano roll to MIDI"""
    import pretty_midi
    import numpy as np

    midi = pretty_midi.PrettyMIDI()
    instrument = pretty_midi.Instrument(program=0)  # Piano

    # Threshold piano roll
    piano_roll_binary = (piano_roll > threshold).astype(int)

    # Find note on/off events
    padded_roll = np.pad(piano_roll_binary, ((0, 0), (1, 1)), mode='constant')
    diff = np.diff(padded_roll, axis=1)

    for pitch in range(88):
        # Find note starts and ends
        starts = np.where(diff[pitch] == 1)[0]
        ends = np.where(diff[pitch] == -1)[0]

        for start, end in zip(starts, ends):
            # Convert frame to time
            start_time = start / fs
            end_time = end / fs

            # Get average velocity
            velocity = int(piano_roll[pitch, start:end].mean() * 127)
            velocity = max(1, min(127, velocity))

            # Create note (pitch offset by 21 for A0)
            note = pretty_midi.Note(
                velocity=velocity,
                pitch=pitch + 21,
                start=start_time,
                end=end_time
            )
            instrument.notes.append(note)

    midi.instruments.append(instrument)
    return midi


@app.local_entrypoint()
def main(num_samples: int = 1, temperature: float = 1.0):
    """
    Generate MIDI files using pretrained VAE

    Args:
        num_samples: Number of MIDI files to generate (default: 1)
        temperature: Sampling temperature, higher = more random (default: 1.0)
    """
    print(f"\nGenerating {num_samples} MIDI file(s) with temperature={temperature}...")

    files = generate_midi.remote(num_samples, temperature)

    print(f"\n✓ Generation complete!")
    print(f"  Generated {len(files)} MIDI files")
    print(f"\nTo download:")
    print(f"  modal volume get generated-midi generated_0000.mid ./audio.mid")


if __name__ == "__main__":
    print("Generate MIDI with pretrained VAE model:")
    print("  modal run scripts/generate_midi_vae.py --num-samples 1")
    print("  modal run scripts/generate_midi_vae.py --num-samples 5 --temperature 1.2")
