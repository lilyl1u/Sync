# EDM / MIDI service

PyTorch MIDI generation, Spotify feature extraction, and EDM remix helpers.

This is **not** the production game soundtrack. Beat-synced lo-fi for the platformer lives in `../lofi`.

## Run

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

uvicorn src.api.main:app --reload --port 8000
```

Docker:

```bash
docker build -t sync-ml-edm .
docker run -p 8000:8000 --env-file .env sync-ml-edm
```

## Layout

- `src/api/` — FastAPI routes (MIDI matching, job status)
- `src/models/` — MusicVAE, drum patterns, EDM synthesizer
- `src/preprocessing/` — MIDI feature extraction
- `api_server.py` — standalone EDM remix API + `index.html` UI
- `spotify_extractor.py` — Spotify audio features (Python; the web app also has `packages/spotify` in TypeScript)
- `modal_edm_generator.py` — Modal deployment for remix generation
- `scripts/` — training, dataset, and generation CLIs
