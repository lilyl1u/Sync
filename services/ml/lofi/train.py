#!/usr/bin/env python3
"""Train the lo-fi LSTM model on a corpus of MIDI files."""

import argparse
from pathlib import Path

from lofi.data import load_or_parse_tokens, create_training_pairs, WINDOW_SIZE
from lofi.network import create_model, compile_model

from tensorflow.keras.callbacks import ModelCheckpoint


CHECKPOINT_DIR = Path("checkpoints")


def run(args):
    tokens = load_or_parse_tokens(force_reparse=args.reparse)
    vocab_size = len(set(tokens))

    x_train, y_train = create_training_pairs(tokens, vocab_size)
    print(f"Training on {x_train.shape[0]} sequences  |  vocab={vocab_size}")

    model = compile_model(create_model(WINDOW_SIZE, vocab_size))
    model.summary()

    if args.weights:
        print(f"Resuming from {args.weights}")
        model.load_weights(args.weights)

    CHECKPOINT_DIR.mkdir(exist_ok=True)
    ckpt = str(CHECKPOINT_DIR / "lofi-e{epoch:03d}-loss{loss:.4f}.weights.h5")

    model.fit(
        x_train, y_train,
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=[
            ModelCheckpoint(ckpt, monitor="loss", save_best_only=True,
                            save_weights_only=True, verbose=1),
        ],
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--weights", type=str, default=None,
                    help="Resume from these weights")
    ap.add_argument("--reparse", action="store_true",
                    help="Force re-extraction from MIDI files")
    run(ap.parse_args())
