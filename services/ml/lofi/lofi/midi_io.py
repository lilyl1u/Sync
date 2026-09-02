"""Convert a list of predicted tokens back into a playable MIDI file."""

from music21 import instrument, note, chord, stream


def tokens_to_midi(tokens: list[str], output_path: str, step: float = 0.5):
    """Write a sequence of note/chord tokens to a MIDI file.

    Each token is either a pitch name like 'C4' or a dot-separated chord
    like '0.4.7' (normalOrder integers).
    """
    offset = 0.0
    events = []

    for tok in tokens:
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

        offset += step

    midi = stream.Stream(events)
    midi.write("midi", fp=output_path)
    print(f"Wrote {len(events)} events -> {output_path}")
