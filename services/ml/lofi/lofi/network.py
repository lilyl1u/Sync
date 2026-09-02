"""LSTM model definition shared by training and generation."""

import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout, BatchNormalization


def create_model(seq_length: int, vocab_size: int) -> tf.keras.Model:
    """Construct a stacked-LSTM classifier for next-token prediction."""
    return Sequential([
        Input(shape=(seq_length, 1)),
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


def compile_model(model: tf.keras.Model) -> tf.keras.Model:
    model.compile(loss="categorical_crossentropy", optimizer="adam")
    return model
