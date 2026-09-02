# Sync ML services

Python backends that generate music for the game. The Next.js app talks to the lo-fi LSTM over Modal via `apps/web/app/api/generate-lofi`.

```
services/ml/
├── lofi/    # TensorFlow LSTM (production game audio)
└── edm/     # PyTorch MIDI VAE, EDM remix, Spotify features
```

## Lo-fi LSTM (`lofi/`)

This is the model the platformer uses. Train locally, then serve on Modal.

```bash
cd services/ml/lofi
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python train.py
python upload_to_modal.py
modal deploy modal_app.py
```

## EDM / Spotify (`edm/`)

Optional pipeline for Spotify-conditioned EDM remixes and MIDI matching.

```bash
cd services/ml/edm
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add Spotify credentials

uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
# or: python api_server.py
```

See `edm/EDM_GENERATOR_README.md`, `edm/MODAL_EDM_GENERATOR_README.md`, and `edm/SPOTIFY_EXTRACTOR_README.md` for details.
