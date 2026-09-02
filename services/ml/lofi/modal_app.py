"""Modal deployment for the lo-fi hip-hop generator.

Usage:
    modal serve modal_app.py      # dev mode (hot reload, ephemeral URL)
    modal deploy modal_app.py     # production (persistent URL)

Before first run, upload your local weights + training data:
    python upload_to_modal.py
"""

import io
import pickle
import tempfile
from pathlib import Path

import modal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Modal resources
# ---------------------------------------------------------------------------

app = modal.App("lofi-generator")

volume = modal.Volume.from_name("lofi-data", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "tensorflow==2.17.1",
        "music21>=9.1",
        "numpy>=1.24,<2.0",
        "h5py>=3.10",
        "fastapi[standard]",
    )
)

VOLUME_PATH = "/vol"
CHECKPOINTS_DIR = f"{VOLUME_PATH}/checkpoints"
DATA_DIR = f"{VOLUME_PATH}/data"
MIDI_DIR = f"{VOLUME_PATH}/midi_songs"

WINDOW_SIZE = 32


# ---------------------------------------------------------------------------
# Helpers (run inside Modal containers)
# ---------------------------------------------------------------------------

def _load_tokens() -> list[str]:
    with open(f"{DATA_DIR}/notes", "rb") as f:
        return pickle.load(f)


def _build_vocab(tokens):
    unique = sorted(set(tokens))
    tok2id = {t: i for i, t in enumerate(unique)}
    id2tok = {i: t for t, i in tok2id.items()}
    return tok2id, id2tok


def _create_model(vocab_size: int):
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Input, LSTM, Dense, Dropout, BatchNormalization

    model = Sequential([
        Input(shape=(WINDOW_SIZE, 1)),
        LSTM(512, recurrent_dropout=0.3, return_sequences=True),
        LSTM(512, recurrent_dropout=0.3, return_sequences=True),
        LSTM(512),
        BatchNormalization(),
        Dropout(0.3),
        Dense(256, activation="relu"),
        BatchNormalization(),
        Dropout(0.3),
        Dense(vocab_size, activation="softmax"),
    ])
    model.compile(loss="categorical_crossentropy", optimizer="adam")
    return model


# ---------------------------------------------------------------------------
# Training (GPU)
# ---------------------------------------------------------------------------

@app.function(
    image=image,
    gpu="T4",
    volumes={VOLUME_PATH: volume},
    timeout=86400,
)
def train(epochs: int = 100, batch_size: int = 64, weights_name: str | None = None):
    import numpy as np
    from tensorflow.keras.callbacks import ModelCheckpoint

    tokens = _load_tokens()
    vocab_size = len(set(tokens))
    tok2id, _ = _build_vocab(tokens)

    inputs, targets = [], []
    for i in range(len(tokens) - WINDOW_SIZE):
        inputs.append([tok2id[t] for t in tokens[i:i + WINDOW_SIZE]])
        targets.append(tok2id[tokens[i + WINDOW_SIZE]])

    x = np.array(inputs, dtype=np.float32).reshape(-1, WINDOW_SIZE, 1) / vocab_size
    y = np.zeros((len(targets), vocab_size), dtype=np.float32)
    for i, t in enumerate(targets):
        y[i, t] = 1.0

    print(f"Training: {x.shape[0]} sequences, vocab={vocab_size}, epochs={epochs}")

    model = _create_model(vocab_size)

    if weights_name:
        wpath = f"{CHECKPOINTS_DIR}/{weights_name}"
        print(f"Loading weights: {wpath}")
        model.load_weights(wpath)

    Path(CHECKPOINTS_DIR).mkdir(parents=True, exist_ok=True)
    ckpt = f"{CHECKPOINTS_DIR}/lofi-e{{epoch:03d}}-loss{{loss:.4f}}.weights.h5"

    model.fit(
        x, y,
        epochs=epochs,
        batch_size=batch_size,
        callbacks=[
            ModelCheckpoint(ckpt, monitor="loss", save_best_only=True,
                            save_weights_only=True, verbose=1),
        ],
    )

    volume.commit()
    return "Training complete"


# ---------------------------------------------------------------------------
# Web endpoints (single FastAPI app = one base URL)
# ---------------------------------------------------------------------------

web_app = FastAPI()

# Allow frontend opened as file:// (origin "null") or from any host to call the API
web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@web_app.get("/health")
def health():
    return {"status": "ok", "app": "lofi-generator"}


@web_app.get("/list_checkpoints")
def list_checkpoints():
    """Return available model checkpoints."""
    ckpt_dir = Path(CHECKPOINTS_DIR)
    if not ckpt_dir.exists():
        return {"checkpoints": []}
    files = sorted(ckpt_dir.glob("*.weights.h5")) + sorted(ckpt_dir.glob("*.hdf5"))
    return {"checkpoints": [f.name for f in files]}


@web_app.post("/generate")
def generate(body: dict):
    """Generate a lo-fi MIDI and return it as base64.

    POST body:
        weights: str       — checkpoint filename
        length: int        — number of notes (default 200)
        temperature: float — sampling temp (default 0.8)
    """
    import base64
    import numpy as np
    from music21 import instrument, note, chord, stream

    weights_name = body.get("weights")
    length = body.get("length", 200)
    temperature = body.get("temperature", 0.8)

    if not weights_name:
        return {"error": "Missing 'weights' in request body"}

    tokens = _load_tokens()
    tok2id, id2tok = _build_vocab(tokens)
    vocab_size = len(tok2id)

    model = _create_model(vocab_size)
    wpath = f"{CHECKPOINTS_DIR}/{weights_name}"
    model.load_weights(wpath)

    raw_seqs = []
    for i in range(len(tokens) - WINDOW_SIZE):
        raw_seqs.append([tok2id[t] for t in tokens[i:i + WINDOW_SIZE]])

    seed_idx = np.random.randint(len(raw_seqs))
    window = list(raw_seqs[seed_idx])
    generated = []

    for _ in range(length):
        x = np.array(window, dtype=np.float32).reshape(1, WINDOW_SIZE, 1) / vocab_size
        probs = model.predict(x, verbose=0)[0]

        if temperature == 0:
            idx = int(np.argmax(probs))
        else:
            logits = np.log(probs + 1e-8) / temperature
            scaled = np.exp(logits)
            scaled /= scaled.sum()
            idx = int(np.random.choice(len(scaled), p=scaled))

        generated.append(id2tok[idx])
        window.append(idx)
        window = window[1:]

    offset = 0.0
    events = []
    for tok in generated:
        if ("." in tok) or tok.isdigit():
            pitches = [note.Note(int(p)) for p in tok.split(".")]
            for p in pitches:
                p.storedInstrument = instrument.Piano()
            ch = chord.Chord(pitches)
            ch.offset = offset
            events.append(ch)
        else:
            n = note.Note(tok)
            n.storedInstrument = instrument.Piano()
            n.offset = offset
            events.append(n)
        offset += 0.5

    midi_stream = stream.Stream(events)

    with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as tmp:
        midi_stream.write("midi", fp=tmp.name)
        tmp.seek(0)
        midi_bytes = open(tmp.name, "rb").read()

    midi_b64 = base64.b64encode(midi_bytes).decode("utf-8")

    return {
        "midi_base64": midi_b64,
        "notes_generated": len(generated),
        "weights_used": weights_name,
    }


@web_app.post("/train_endpoint")
def train_endpoint(body: dict):
    """Kick off training via HTTP (returns immediately, trains in background).

    POST body:
        epochs: int        — number of epochs (default 100)
        batch_size: int    — batch size (default 64)
        weights: str|null  — checkpoint to resume from
    """
    epochs = body.get("epochs", 100)
    batch_size = body.get("batch_size", 64)
    weights_name = body.get("weights", None)

    call = train.spawn(epochs=epochs, batch_size=batch_size, weights_name=weights_name)

    return {"status": "training_started", "epochs": epochs, "batch_size": batch_size, "call_id": call.object_id}


@app.function(image=image, volumes={VOLUME_PATH: volume}, timeout=120)
@modal.asgi_app()
def api():
    """Single web app: one base URL with /health, /list_checkpoints, /generate, /train_endpoint."""
    return web_app
