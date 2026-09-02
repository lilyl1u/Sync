"""
MIDI Generation Models

Generative models for creating new MIDI music:
1. MusicVAE: Variational Autoencoder for continuous latent space
2. MusicTransformer: Transformer-based sequence model for generation
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Tuple, Optional
import math


class MusicVAE(nn.Module):
    """
    Variational Autoencoder for MIDI generation

    Encodes piano rolls into a continuous latent space,
    enabling smooth interpolation and controlled generation.
    """

    def __init__(
        self,
        input_dim: int = 88,  # Piano keys
        latent_dim: int = 512,
        hidden_dims: list = [1024, 512, 256],
        seq_length: int = 512,
        beta: float = 1.0,  # KL weight
    ):
        """
        Initialize MusicVAE

        Args:
            input_dim: Number of piano keys
            latent_dim: Dimension of latent space
            hidden_dims: Hidden layer dimensions for encoder/decoder
            seq_length: Length of input sequences
            beta: Weight for KL divergence loss
        """
        super().__init__()

        self.input_dim = input_dim
        self.latent_dim = latent_dim
        self.seq_length = seq_length
        self.beta = beta
        # Pad input_dim to nearest multiple of 16 for clean conv/deconv math
        self.padded_dim = ((input_dim + 15) // 16) * 16  # 88 -> 96

        # Encoder: Conv layers to process piano roll
        self.encoder_conv = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=(4, 4), stride=(2, 2), padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),

            nn.Conv2d(32, 64, kernel_size=(4, 4), stride=(2, 2), padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),

            nn.Conv2d(64, 128, kernel_size=(4, 4), stride=(2, 2), padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),

            nn.Conv2d(128, 256, kernel_size=(4, 4), stride=(2, 2), padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
        )

        # Calculate flattened size after convolutions
        # padded_dim=96, seq_length=512
        # After 4 conv layers with stride 2: (96/16, 512/16) = (6, 32)
        self.conv_output_size = 256 * (self.padded_dim // 16) * (seq_length // 16)

        # Latent space layers
        self.fc_mu = nn.Linear(self.conv_output_size, latent_dim)
        self.fc_logvar = nn.Linear(self.conv_output_size, latent_dim)

        # Decoder: Transpose conv to reconstruct piano roll
        self.decoder_fc = nn.Linear(latent_dim, self.conv_output_size)

        self.decoder_conv = nn.Sequential(
            nn.ConvTranspose2d(256, 128, kernel_size=(4, 4), stride=(2, 2), padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),

            nn.ConvTranspose2d(128, 64, kernel_size=(4, 4), stride=(2, 2), padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),

            nn.ConvTranspose2d(64, 32, kernel_size=(4, 4), stride=(2, 2), padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),

            nn.ConvTranspose2d(32, 1, kernel_size=(4, 4), stride=(2, 2), padding=1),
        )

    def _pad(self, x: torch.Tensor) -> torch.Tensor:
        """Pad pitch dimension to padded_dim (multiple of 16)"""
        if self.input_dim < self.padded_dim:
            return F.pad(x, (0, 0, 0, self.padded_dim - self.input_dim))
        return x

    def _crop(self, x: torch.Tensor) -> torch.Tensor:
        """Crop pitch dimension back to input_dim"""
        return x[:, :, :self.input_dim, :]

    def encode(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Encode input to latent distribution

        Args:
            x: Input tensor (batch, 1, pitch, time)

        Returns:
            mu, logvar tensors
        """
        h = self.encoder_conv(self._pad(x))
        h = h.view(h.size(0), -1)

        mu = self.fc_mu(h)
        logvar = self.fc_logvar(h)

        return mu, logvar

    def reparameterize(self, mu: torch.Tensor, logvar: torch.Tensor) -> torch.Tensor:
        """
        Reparameterization trick: z = mu + eps * std

        Args:
            mu: Mean
            logvar: Log variance

        Returns:
            Sampled latent vector
        """
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def decode(self, z: torch.Tensor, apply_sigmoid: bool = False) -> torch.Tensor:
        """
        Decode latent vector to piano roll

        Args:
            z: Latent vector (batch, latent_dim)
            apply_sigmoid: If True, apply sigmoid to output (for inference/generation)

        Returns:
            Reconstructed piano roll (batch, 1, pitch, time)
        """
        h = self.decoder_fc(z)
        h = h.view(h.size(0), 256, self.padded_dim // 16, self.seq_length // 16)
        logits = self._crop(self.decoder_conv(h))

        return torch.sigmoid(logits) if apply_sigmoid else logits

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Forward pass

        Args:
            x: Input piano roll (batch, 1, pitch, time)

        Returns:
            Dictionary with reconstruction, mu, logvar, z
        """
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        reconstruction = self.decode(z)

        return {
            'reconstruction': reconstruction,
            'mu': mu,
            'logvar': logvar,
            'z': z,
        }

    def loss_function(
        self,
        reconstruction: torch.Tensor,
        x: torch.Tensor,
        mu: torch.Tensor,
        logvar: torch.Tensor,
    ) -> Dict[str, torch.Tensor]:
        """
        Calculate VAE loss: reconstruction + KL divergence

        Args:
            reconstruction: Reconstructed input
            x: Original input
            mu: Latent mean
            logvar: Latent log variance

        Returns:
            Dictionary with total loss and components
        """
        # Reconstruction loss (binary cross entropy with logits for autocast safety)
        recon_loss = F.binary_cross_entropy_with_logits(
            reconstruction, x, reduction='sum'
        ) / x.size(0)

        # KL divergence loss
        kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp()) / x.size(0)

        # Total loss
        total_loss = recon_loss + self.beta * kl_loss

        return {
            'loss': total_loss,
            'recon_loss': recon_loss,
            'kl_loss': kl_loss,
        }

    def sample(self, num_samples: int, device: str = 'cuda') -> torch.Tensor:
        """
        Generate new samples from random latent vectors

        Args:
            num_samples: Number of samples to generate
            device: Device to generate on

        Returns:
            Generated piano rolls
        """
        with torch.no_grad():
            z = torch.randn(num_samples, self.latent_dim).to(device)
            samples = self.decode(z, apply_sigmoid=True)

        return samples


class MusicTransformer(nn.Module):
    """
    Transformer-based model for sequential MIDI generation

    Generates MIDI note-by-note using autoregressive modeling.
    """

    def __init__(
        self,
        vocab_size: int = 128,  # MIDI note range (0-127)
        d_model: int = 512,
        nhead: int = 8,
        num_layers: int = 6,
        dim_feedforward: int = 2048,
        dropout: float = 0.1,
        max_seq_length: int = 2048,
    ):
        """
        Initialize MusicTransformer

        Args:
            vocab_size: Size of note vocabulary
            d_model: Model dimension
            nhead: Number of attention heads
            num_layers: Number of transformer layers
            dim_feedforward: Feedforward dimension
            dropout: Dropout rate
            max_seq_length: Maximum sequence length
        """
        super().__init__()

        self.d_model = d_model
        self.vocab_size = vocab_size
        self.max_seq_length = max_seq_length

        # Token embeddings
        self.note_embedding = nn.Embedding(vocab_size + 1, d_model)  # +1 for padding
        self.velocity_embedding = nn.Embedding(128, d_model // 2)
        self.duration_embedding = nn.Embedding(256, d_model // 2)

        # Positional encoding
        self.pos_encoder = PositionalEncoding(d_model, dropout, max_seq_length)

        # Transformer
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            activation='gelu',
            batch_first=True
        )

        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        # Output heads
        self.note_head = nn.Linear(d_model, vocab_size)
        self.velocity_head = nn.Linear(d_model, 128)
        self.duration_head = nn.Linear(d_model, 256)

        self._init_weights()

    def _init_weights(self):
        """Initialize weights"""
        initrange = 0.1
        self.note_embedding.weight.data.uniform_(-initrange, initrange)
        self.note_head.bias.data.zero_()
        self.note_head.weight.data.uniform_(-initrange, initrange)

    def forward(
        self,
        notes: torch.Tensor,
        velocities: torch.Tensor,
        durations: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass

        Args:
            notes: Note tensor (batch, seq_len)
            velocities: Velocity tensor (batch, seq_len)
            durations: Duration tensor (batch, seq_len)
            mask: Attention mask

        Returns:
            Dictionary with note, velocity, duration logits
        """
        # Embeddings
        note_emb = self.note_embedding(notes) * math.sqrt(self.d_model)
        vel_emb = self.velocity_embedding(velocities)
        dur_emb = self.duration_embedding(durations)

        # Combine embeddings
        x = note_emb + torch.cat([vel_emb, dur_emb], dim=-1)

        # Add positional encoding
        x = self.pos_encoder(x)

        # Create causal mask for autoregressive generation
        if mask is None:
            seq_len = notes.size(1)
            mask = self._generate_square_subsequent_mask(seq_len).to(notes.device)

        # Transformer
        x = self.transformer(x, mask)

        # Output predictions
        note_logits = self.note_head(x)
        velocity_logits = self.velocity_head(x)
        duration_logits = self.duration_head(x)

        return {
            'note_logits': note_logits,
            'velocity_logits': velocity_logits,
            'duration_logits': duration_logits,
        }

    def _generate_square_subsequent_mask(self, sz: int) -> torch.Tensor:
        """Generate causal mask for autoregressive generation"""
        mask = torch.triu(torch.ones(sz, sz), diagonal=1)
        mask = mask.masked_fill(mask == 1, float('-inf'))
        return mask

    def generate(
        self,
        start_notes: torch.Tensor,
        start_velocities: torch.Tensor,
        start_durations: torch.Tensor,
        max_length: int = 512,
        temperature: float = 1.0,
        top_k: int = 0,
        top_p: float = 0.9,
    ) -> Dict[str, torch.Tensor]:
        """
        Generate new MIDI sequence autoregressively

        Args:
            start_notes: Starting notes (batch, start_len)
            start_velocities: Starting velocities
            start_durations: Starting durations
            max_length: Maximum generation length
            temperature: Sampling temperature
            top_k: Top-k sampling
            top_p: Nucleus sampling threshold

        Returns:
            Generated sequences
        """
        self.eval()
        device = start_notes.device

        notes = start_notes
        velocities = start_velocities
        durations = start_durations

        with torch.no_grad():
            for _ in range(max_length - start_notes.size(1)):
                # Forward pass
                outputs = self(notes, velocities, durations)

                # Get predictions for last token
                next_note_logits = outputs['note_logits'][:, -1, :] / temperature
                next_vel_logits = outputs['velocity_logits'][:, -1, :] / temperature
                next_dur_logits = outputs['duration_logits'][:, -1, :] / temperature

                # Apply top-k and top-p sampling
                next_note = self._sample(next_note_logits, top_k, top_p)
                next_vel = self._sample(next_vel_logits, top_k, top_p)
                next_dur = self._sample(next_dur_logits, top_k, top_p)

                # Append to sequences
                notes = torch.cat([notes, next_note.unsqueeze(1)], dim=1)
                velocities = torch.cat([velocities, next_vel.unsqueeze(1)], dim=1)
                durations = torch.cat([durations, next_dur.unsqueeze(1)], dim=1)

        return {
            'notes': notes,
            'velocities': velocities,
            'durations': durations,
        }

    def _sample(
        self,
        logits: torch.Tensor,
        top_k: int = 0,
        top_p: float = 0.9,
    ) -> torch.Tensor:
        """Sample from logits with top-k/top-p filtering"""
        if top_k > 0:
            # Top-k sampling
            top_k_logits, top_k_indices = torch.topk(logits, top_k)
            logits = torch.full_like(logits, float('-inf'))
            logits.scatter_(1, top_k_indices, top_k_logits)

        if top_p < 1.0:
            # Top-p (nucleus) sampling
            sorted_logits, sorted_indices = torch.sort(logits, descending=True)
            cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)

            # Remove tokens with cumulative probability above threshold
            sorted_indices_to_remove = cumulative_probs > top_p
            sorted_indices_to_remove[..., 1:] = sorted_indices_to_remove[..., :-1].clone()
            sorted_indices_to_remove[..., 0] = 0

            indices_to_remove = sorted_indices_to_remove.scatter(
                1, sorted_indices, sorted_indices_to_remove
            )
            logits = logits.masked_fill(indices_to_remove, float('-inf'))

        # Sample from distribution
        probs = F.softmax(logits, dim=-1)
        sample = torch.multinomial(probs, 1)

        return sample.squeeze(1)


class PositionalEncoding(nn.Module):
    """Positional encoding for transformer"""

    def __init__(self, d_model: int, dropout: float = 0.1, max_len: int = 5000):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))

        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)

        self.register_buffer('pe', pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)
