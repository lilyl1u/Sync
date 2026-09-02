"""MIDI parsing and sequence preparation for training and generation."""

import pickle
from pathlib import Path

import numpy as np
from music21 import converter, instrument, note, chord

WINDOW_SIZE = 32
MIDI_DIR = Path("midi_songs")
CACHE_PATH = Path("data/notes")


def extract_tokens_from_midi(midi_dir: Path = MIDI_DIR) -> list[str]:
    """Walk every .mid file and pull out a flat token stream of pitches and chords."""
    tokens: list[str] = []

    for path in sorted(midi_dir.glob("*.mid")):
        print(f"  [{path.name}]", end="")
        score = converter.parse(str(path))

        parts = instrument.partitionByInstrument(score)
        elements = parts.parts[0].recurse() if parts else score.flat.notes

        for el in elements:
            if isinstance(el, note.Note):
                tokens.append(str(el.pitch))
            elif isinstance(el, chord.Chord):
                tokens.append(".".join(str(n) for n in el.normalOrder))

    print()
    return tokens


def load_or_parse_tokens(force_reparse: bool = False) -> list[str]:
    """Return the token list, parsing MIDI files only when necessary."""
    if not force_reparse and CACHE_PATH.exists():
        with open(CACHE_PATH, "rb") as f:
            tokens = pickle.load(f)
        print(f"Loaded {len(tokens)} tokens from cache ({len(set(tokens))} unique)")
        return tokens

    print("Parsing MIDI files...")
    tokens = extract_tokens_from_midi()
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_PATH, "wb") as f:
        pickle.dump(tokens, f)
    print(f"Cached {len(tokens)} tokens ({len(set(tokens))} unique)")
    return tokens


def build_vocabulary(tokens: list[str]) -> tuple[dict[str, int], dict[int, str]]:
    """Create bidirectional mappings between token strings and integer IDs."""
    unique = sorted(set(tokens))
    tok2id = {t: i for i, t in enumerate(unique)}
    id2tok = {i: t for t, i in tok2id.items()}
    return tok2id, id2tok


def create_training_pairs(tokens: list[str], vocab_size: int):
    """Slide a window over the token stream to build (input, target) arrays."""
    tok2id, _ = build_vocabulary(tokens)

    inputs, targets = [], []
    for i in range(len(tokens) - WINDOW_SIZE):
        window = tokens[i : i + WINDOW_SIZE]
        label = tokens[i + WINDOW_SIZE]
        inputs.append([tok2id[t] for t in window])
        targets.append(tok2id[label])

    x = np.array(inputs, dtype=np.float32).reshape(-1, WINDOW_SIZE, 1) / vocab_size
    y = np.zeros((len(targets), vocab_size), dtype=np.float32)
    for i, t in enumerate(targets):
        y[i, t] = 1.0

    return x, y


def create_seed_sequences(tokens: list[str], vocab_size: int):
    """Build raw + normalized seed arrays for generation."""
    tok2id, _ = build_vocabulary(tokens)

    raw_seqs = []
    for i in range(len(tokens) - WINDOW_SIZE):
        raw_seqs.append([tok2id[t] for t in tokens[i : i + WINDOW_SIZE]])

    norm = np.array(raw_seqs, dtype=np.float32).reshape(-1, WINDOW_SIZE, 1) / vocab_size
    return raw_seqs, norm
