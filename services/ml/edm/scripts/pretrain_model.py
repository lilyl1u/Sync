"""
Pre-train MIDI Generation Model (ONE-TIME ADMIN TASK)

Trains a MusicVAE model on the FULL LMD dataset (176k MIDI files).
This creates a general-purpose music generation model.

Usage:
    # Train on full dataset (all ~176k MIDI files)
    modal run scripts/pretrain_model.py --gpu A100 --epochs 100

    # Train on limited dataset (for testing)
    modal run scripts/pretrain_model.py --gpu A100 --epochs 10 --max-files 50000
"""

import modal
import sys
from pathlib import Path

# Create Modal app
app = modal.App("lmd-pretraining-v2")

# Volumes
dataset_volume = modal.Volume.from_name("lmd-dataset")
models_volume = modal.Volume.from_name("trained-models", create_if_missing=True)

# GPU image
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.1.2",
        "numpy==1.26.3",
        "pretty-midi==0.2.10",
        "tqdm",
    )
)

DATASET_PATH = "/data"
MODELS_PATH = "/models"

# Inline MusicVAE model (avoids mounting issues with new Modal API)
class MusicVAE:
    """Placeholder - actual class defined in train() method"""
    pass

@app.cls(
    image=image,
    volumes={
        DATASET_PATH: dataset_volume,
        MODELS_PATH: models_volume,
    },
    timeout=3600 * 12,
)
class Pretrainer:
    """Pre-train on full dataset"""

    def __init__(self, epochs: int = 50, batch_size: int = 64, max_files: int = None):
        import torch

        self.epochs = epochs
        self.batch_size = batch_size
        self.max_files = max_files
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        print(f"Device: {self.device}")
        if torch.cuda.is_available():
            print(f"GPU: {torch.cuda.get_device_name(0)}")

    @modal.method()
    def train(self):
        """Train on full LMD dataset"""
        import torch
        import torch.nn as nn
        import torch.nn.functional as F
        import torch.optim as optim
        from torch.utils.data import Dataset, DataLoader
        from torch.cuda.amp import autocast, GradScaler
        from tqdm import tqdm
        import numpy as np
        import pretty_midi
        import random
        import json
        import os
        from typing import Dict, Tuple

        # Inline MusicVAE definition to avoid mounting issues
        # input_dim=88 is not divisible by 16, so we pad to 96 internally
        class MusicVAE(nn.Module):
            def __init__(self, input_dim=88, latent_dim=512, seq_length=512, beta=1.0):
                super().__init__()
                self.input_dim, self.latent_dim, self.seq_length, self.beta = input_dim, latent_dim, seq_length, beta
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

            def encode(self, x):
                h = self.encoder_conv(self._pad(x)).view(x.size(0), -1)
                return self.fc_mu(h), self.fc_logvar(h)

            def reparameterize(self, mu, logvar):
                return mu + torch.randn_like(mu) * torch.exp(0.5 * logvar)

            def decode(self, z, apply_sigmoid=False):
                h = self.decoder_fc(z).view(z.size(0), 256, self.padded_dim // 16, self.seq_length // 16)
                logits = self._crop(self.decoder_conv(h))
                return torch.sigmoid(logits) if apply_sigmoid else logits

            def forward(self, x):
                mu, logvar = self.encode(x)
                z = self.reparameterize(mu, logvar)
                return {'reconstruction': self.decode(z), 'mu': mu, 'logvar': logvar, 'z': z}

            def loss_function(self, reconstruction, x, mu, logvar):
                recon_loss = F.binary_cross_entropy_with_logits(reconstruction, x, reduction='sum') / x.size(0)
                kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp()) / x.size(0)
                return {'loss': recon_loss + self.beta * kl_loss, 'recon_loss': recon_loss, 'kl_loss': kl_loss}

        print("=" * 60)
        print("Pre-training on Full LMD Dataset")
        print("=" * 60)

        # Get all MIDI files
        lmd_dir = Path(DATASET_PATH) / "lmd_full"
        all_midi_files = list(lmd_dir.rglob("*.mid"))

        # Apply max_files limit if specified
        if self.max_files is not None:
            midi_files = all_midi_files[:self.max_files]
            print(f"Found {len(all_midi_files):,} total MIDI files")
            print(f"Limiting to {len(midi_files):,} files (--max-files={self.max_files})")
        else:
            midi_files = all_midi_files
            print(f"Training on full dataset: {len(midi_files):,} MIDI files")

        print(f"Using {len(midi_files):,} MIDI files for training")

        # Fast MIDI-to-piano-roll using only note events (skips expensive get_piano_roll)
        def fast_midi_to_pianoroll(filepath, fs=4, seq_len=512):
            midi_data = pretty_midi.PrettyMIDI(str(filepath))
            total_time = midi_data.get_end_time()
            if total_time <= 0:
                return None
            n_frames = int(total_time * fs) + 1
            piano_roll = np.zeros((88, max(n_frames, 1)), dtype=np.float32)
            for inst in midi_data.instruments:
                if inst.is_drum:
                    continue
                for note in inst.notes:
                    pitch_idx = note.pitch - 21
                    if 0 <= pitch_idx < 88:
                        start_frame = int(note.start * fs)
                        end_frame = int(note.end * fs) + 1
                        vel = note.velocity / 127.0
                        piano_roll[pitch_idx, start_frame:min(end_frame, piano_roll.shape[1])] = vel
            if piano_roll.shape[1] >= seq_len:
                start = random.randint(0, piano_roll.shape[1] - seq_len)
                piano_roll = piano_roll[:, start:start + seq_len]
            else:
                piano_roll = np.pad(piano_roll, ((0, 0), (0, seq_len - piano_roll.shape[1])))
            return piano_roll

        class MIDIDataset(Dataset):
            def __init__(self, files):
                self.files = files

            def __len__(self):
                return len(self.files)

            def __getitem__(self, idx):
                try:
                    piano_roll = fast_midi_to_pianoroll(self.files[idx])
                    if piano_roll is None:
                        return torch.zeros(1, 88, 512)
                    return torch.FloatTensor(piano_roll[np.newaxis, :, :])
                except Exception:
                    return torch.zeros(1, 88, 512)

        # Split
        random.shuffle(midi_files)
        train_size = int(0.9 * len(midi_files))
        train_files = midi_files[:train_size]
        val_files = midi_files[train_size:]

        num_cpus = min(16, len(os.sched_getaffinity(0)) if hasattr(os, 'sched_getaffinity') else 8)
        train_loader = DataLoader(MIDIDataset(train_files), batch_size=self.batch_size, shuffle=True, num_workers=num_cpus, pin_memory=True, prefetch_factor=4, persistent_workers=True)
        val_loader = DataLoader(MIDIDataset(val_files), batch_size=self.batch_size, shuffle=False, num_workers=num_cpus, pin_memory=True, prefetch_factor=4, persistent_workers=True)

        # Model
        model = MusicVAE(input_dim=88, latent_dim=512, beta=0.1).to(self.device)
        optimizer = optim.AdamW(model.parameters(), lr=0.0001)
        scheduler = optim.lr_scheduler.OneCycleLR(optimizer, max_lr=0.0001, epochs=self.epochs, steps_per_epoch=len(train_loader))
        scaler = GradScaler()

        # Train
        best_val_loss = float('inf')
        for epoch in range(self.epochs):
            model.train()
            train_loss = 0

            for batch in tqdm(train_loader, desc=f"Epoch {epoch+1}/{self.epochs}"):
                batch = batch.to(self.device)
                optimizer.zero_grad()

                with autocast():
                    outputs = model(batch)
                    losses = model.loss_function(outputs['reconstruction'], batch, outputs['mu'], outputs['logvar'])
                    loss = losses['loss']

                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
                scheduler.step()

                train_loss += loss.item()

            train_loss /= len(train_loader)

            # Val
            model.eval()
            val_loss = 0
            with torch.no_grad():
                for batch in val_loader:
                    batch = batch.to(self.device)
                    outputs = model(batch)
                    losses = model.loss_function(outputs['reconstruction'], batch, outputs['mu'], outputs['logvar'])
                    val_loss += losses['loss'].item()

            val_loss /= len(val_loader)

            print(f"Epoch {epoch+1}: Train={train_loss:.4f}, Val={val_loss:.4f}")

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                torch.save({
                    'model_state_dict': model.state_dict(),
                    'config': {'latent_dim': 512, 'beta': 0.1}
                }, Path(MODELS_PATH) / "pretrained_model.pt")
                models_volume.commit()
                print(f"  ✓ Saved best model")

        print("\n✓ Pre-training complete!")
        return {"best_val_loss": best_val_loss}

@app.local_entrypoint()
def main(gpu: str = "A100", epochs: int = 50, max_files: int = None):
    # Configure GPU for the Pretrainer class
    PretrainerWithGPU = Pretrainer.with_options(gpu=gpu)

    trainer = PretrainerWithGPU(epochs=epochs, max_files=max_files)
    result = trainer.train.remote()
    print(f"\nTraining complete! Best validation loss: {result['best_val_loss']:.4f}")

if __name__ == "__main__":
    print("Pre-train model on full dataset (ONE-TIME):")
    print("  modal run scripts/pretrain_model.py --gpu A100 --epochs 50")
    print("  modal run scripts/pretrain_model.py --gpu A100 --epochs 50 --max-files 50000  # limit files")
