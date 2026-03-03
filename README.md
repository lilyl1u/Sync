# Sync

**Made during HackIllinois**

Backend: https://github.com/michellee-wang/sync-ml-api
Beat-synced endless platformer: stake SOL, play solo or 1v1 duels. Terrain is verifiable (ORAO VRF); music is AI-generated (LSTM). Built with a custom TypeScript game engine, Next.js, and Solana/Anchor.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For Solana gambling (staking, pool), see [Solana & Gambling Setup](packages/solana/README.md#setup-anchor-no-house-keypair) in `packages/solana/README.md`.

## Commands

- `npm run dev` — start web app
- `npm run build` — build all workspaces
- `npm run setup:gambling` — deploy Anchor program + init pool (needs Anchor/Solana CLI)

## Stack

Next.js · React · TypeScript · Solana / Anchor · Privy · Firebase · Tone.js · Modal (LSTM API)
