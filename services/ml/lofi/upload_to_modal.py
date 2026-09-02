#!/usr/bin/env python3
"""Upload local training data and weights to the Modal volume.

Run this once before your first `modal serve` or `modal deploy`:
    python upload_to_modal.py
"""

import io
from pathlib import Path

import modal

VOLUME_NAME = "lofi-data"


def main():
    vol = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

    uploads = {
        "data/notes": "data/notes",
    }

    weights_file = Path("lofi-hip-hop-weights-improvement-100-0.6290.hdf5")
    if weights_file.exists():
        uploads[str(weights_file)] = f"checkpoints/{weights_file.name}"

    midi_dir = Path("midi_songs")
    if midi_dir.exists():
        for mid in sorted(midi_dir.glob("*.mid")):
            uploads[str(mid)] = f"midi_songs/{mid.name}"

    print(f"Uploading {len(uploads)} files to volume '{VOLUME_NAME}'...")

    for local, remote in uploads.items():
        local_path = Path(local)
        if not local_path.exists():
            print(f"  SKIP (missing): {local}")
            continue
        data = local_path.read_bytes()
        with vol.batch_upload() as batch:
            batch.put_file(io.BytesIO(data), remote)
        print(f"  {local} -> /vol/{remote}  ({len(data):,} bytes)")

    print("Done.")


if __name__ == "__main__":
    main()
