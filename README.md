# Sync

Endless platformer on Solana. Jump to the beat, stake SOL, play solo or 1v1.

[Devpost](https://devpost.com/software/sync-mdn04e)

## What it is

- **Beat-synced run** — obstacles land on the music timeline
- **AI soundtrack** — LSTM on Modal, played in-browser with Tone.js
- **Fair worlds** — ORAO VRF seed so the same seed → the same course
- **Optional SOL** — solo stake or pooled 1v1; Anchor handles escrow
- **Custom engine** — TypeScript (no Unity/Phaser)

Play in the browser with no wallet. Staking needs Phantom (or Privy in `apps/web/.env.local`).

## Run it

Needs **Node 20.9+**.

```bash
git clone https://github.com/lilyl1u/Sync.git
cd Sync
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build workspaces |
| `npm run setup:gambling` | Deploy Anchor program + staking pool |

On-chain setup: Solana CLI + Anchor CLI. Details in [`packages/solana/README.md`](packages/solana/README.md).

## Repo

```
apps/web/              Next.js
packages/game-engine/  render, physics, beat-sync
packages/solana/       staking, duels, pool
packages/shared-types
packages/spotify/
services/ml/lofi/      LSTM used in-game (Modal)
services/ml/edm/       EDM / Spotify pipeline
```

Train or deploy music: [`services/ml/README.md`](services/ml/README.md).

## How a run works

1. Frontend asks Modal for a MIDI clip; Tone.js plays it and exposes beats.
2. A VRF seed (or local seed) builds the course; hazards sit on that beat grid.
3. Solo is a timed run. Duels pool both stakes; longest survival wins. Scores live in Firebase.

```
Next.js ──► Modal LSTM ──► MIDI / beats
   │
   ├── Tone.js + game engine (play + course)
   ├── Privy / Phantom → Solana (Anchor) → ORAO VRF
   └── Firebase (scores, duels)
```

## License

MIT
