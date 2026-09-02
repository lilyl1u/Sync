# Lo-fi LSTM generator

Production music backend for Sync. An LSTM trained on MIDI produces note sequences; Modal serves `/generate`, and the Next.js app proxies that at `POST /api/generate-lofi`.

Requires **Python 3.11**.

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Train:

```bash
python train.py --epochs 100
```

Upload checkpoints and parsed tokens, then deploy:

```bash
python upload_to_modal.py
modal serve modal_app.py      # ephemeral
modal deploy modal_app.py     # persistent URL
```
