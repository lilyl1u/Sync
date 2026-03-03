# 🎵 Sync

**Beat-synced endless platformer on Solana** — stake SOL, play solo or 1v1 duels, and run to AI-generated music.

> Built at HackIllinois · [Devpost](https://devpost.com/software/sync-mdn04e?ref_content=my-projects-tab&ref_feature=my_projects) · [ML Backend Repo](https://github.com/michellee-wang/sync-ml-api)

---

## Overview

Sync is an endless platformer where terrain is generated in sync with the beat of AI-composed music. Players can stake SOL to enter solo runs or competitive 1v1 duels, with on-chain verifiable randomness (ORAO VRF) ensuring fair terrain generation. Music is produced in real time by an LSTM model served via Modal.

### Key Features

- **Beat-synced gameplay** — Platforms and obstacles spawn on the beat of dynamically generated music, creating a rhythm-game feel in a platformer format.
- **AI-generated music** — An LSTM neural network generates original tracks in real time, served through a Modal-hosted API endpoint.
- **Solana staking & duels** — Players can stake SOL to enter games. A 1v1 duel mode lets players compete head-to-head with pooled stakes. Built with Anchor.
- **Verifiable randomness (ORAO VRF)** — Terrain generation uses ORAO's on-chain VRF so that game worlds are provably fair and reproducible from a given seed.
- **Custom TypeScript game engine** — The platformer runs on a purpose-built engine (no Unity/Phaser), giving full control over rendering, physics, and beat-sync timing.
- **Wallet auth via Privy** — Seamless wallet connection and authentication without requiring users to install browser extensions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Game Engine | Custom TypeScript engine |
| Audio | Tone.js |
| Blockchain | Solana, Anchor |
| Auth | Privy |
| ML / Music Gen | LSTM model served on Modal |
| Randomness | ORAO VRF |
| Database | Firebase |

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- A Solana wallet (for staking features)
- Solana CLI + Anchor CLI (only if deploying the on-chain program)

### Installation

```bash
git clone https://github.com/michellee-wang/sync.git
cd sync
npm install
```

### Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

> **Note:** The game is playable without a wallet. Staking and duel features require a connected Solana wallet.

---

## Solana & Gambling Setup

To deploy the Anchor program and initialize the staking pool:

```bash
npm run setup:gambling
```

This requires the Solana CLI and Anchor CLI to be installed and configured. See [`packages/solana/README.md`](packages/solana/README.md#setup-anchor-no-house-keypair) for detailed setup instructions including keypair configuration and pool initialization.

---

## Project Structure

```
sync/
├── packages/
│   └── solana/          # Anchor program for staking, duels, and pool management
├── src/                 # Next.js app + custom game engine
│   ├── engine/          # TypeScript game engine (rendering, physics, beat-sync)
│   ├── components/      # React UI components
│   └── ...
├── public/              # Static assets
└── package.json         # Workspace root
```

---

## How It Works

### Music Generation

An LSTM model trained on MIDI data generates melodic sequences. The model is hosted as a serverless endpoint on [Modal](https://modal.com), which the frontend calls to get note sequences. [Tone.js](https://tonejs.github.io/) synthesizes the audio in the browser and provides precise beat timing events.

### Terrain Generation

When a game starts, a seed is obtained from ORAO VRF on Solana. This seed deterministically generates the terrain layout, meaning any two players with the same seed will get the same world. Platforms, gaps, and obstacles are placed in sync with the beat timeline from the music generator, so the gameplay has a rhythmic quality.

### Staking & Duels

Players can optionally stake SOL before starting a run. In **solo mode**, the stake acts as a commitment to the run. In **1v1 duel mode**, two players' stakes are pooled, and the player who survives longest (or scores highest) takes the pool. The Anchor smart contract manages escrow, pool creation, and payout logic.

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build all workspaces |
| `npm run setup:gambling` | Deploy Anchor program + initialize the staking pool |

---

## Architecture Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Next.js    │────▶│  Modal API   │────▶│   LSTM Model     │
│   Frontend   │◀────│  (Serverless)│◀────│   (Music Gen)    │
└──────┬───────┘     └──────────────┘     └──────────────────┘
       │
       │  Tone.js (audio)
       │  Custom Engine (rendering + physics)
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│    Privy     │────▶│   Solana     │────▶│  ORAO VRF        │
│   (Auth)     │     │  (Anchor)    │     │  (Randomness)    │
└──────────────┘     └──────────────┘     └──────────────────┘
                           │
                           ▼
                     ┌──────────────┐
                     │   Firebase   │
                     │  (Scores/DB) │
                     └──────────────┘
```

---

## Contributing

This project was built during HackIllinois. Contributions, issues, and forks are welcome.

## License

MIT
