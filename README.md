# Geometry Dash Monorepo

A comprehensive monorepo for a Geometry Dash clone with Solana gambling integration.

## Project Structure

```
sync/
├── apps/
│   └── web/                    # Next.js frontend application
│       ├── app/                # Next.js App Router
│       │   ├── game/          # Game page and UI components
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── public/            # Static assets
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── game-engine/           # Reusable game engine
│   │   ├── src/
│   │   │   ├── engine/       # Core game engine (GameEngine, Physics, Collision, Input)
│   │   │   ├── systems/      # Game systems (Renderer)
│   │   │   ├── levels/       # Level generation (procedural)
│   │   │   ├── components/   # Game components (Player, Obstacle, Canvas)
│   │   │   ├── types/        # TypeScript type definitions
│   │   │   └── index.ts      # Package entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── solana/               # Solana blockchain integration
│   │   ├── programs/         # Anchor smart contracts
│   │   │   └── gambling/     # Time-alive gambling program
│   │   ├── sdk/              # TypeScript SDK for frontend
│   │   ├── tests/            # Integration tests
│   │   ├── Anchor.toml
│   │   └── package.json
│   │
│   ├── spotify/              # Spotify API client
│   │   ├── src/
│   │   │   ├── client.ts    # API client
│   │   │   ├── auth.ts      # Authentication
│   │   │   └── types.ts     # Type definitions
│   │   └── package.json
│   │
│   └── shared-types/         # Shared TypeScript types
│       ├── src/
│       │   ├── game.ts      # Game-related types
│       │   ├── user.ts      # User-related types
│       │   ├── solana.ts    # Blockchain types
│       │   └── index.ts
│       └── package.json
│
├── docs/                     # Documentation
├── package.json             # Root workspace config
└── tsconfig.json            # Root TypeScript config
```

## Features

### Geometry Dash Game Engine
- Modular, reusable game engine built with TypeScript
- Canvas-based rendering system
- Physics engine with collision detection
- Procedural level generation

### Solana Integration
- Time-alive gambling mechanics
- Players bet on survival time predictions
- Smart contracts built with Anchor
- Accuracy-based payout system (up to 10x multiplier)

### Spotify Integration
- User authentication
- Playlist and track data fetching
- Audio feature extraction

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- **For Solana integration:** Rust, Solana CLI, and Anchor CLI 0.32.1

### Solana / Anchor Setup

The Solana gambling package (`packages/solana`) requires the Anchor CLI to build and deploy programs. Run the setup script from the repo root:

```bash
npm run setup:anchor
```

This installs (if missing):

- **Rust** (via rustup)
- **Solana CLI** (stable)
- **AVM** (Anchor Version Manager)
- **Anchor CLI 0.32.1** (matches `packages/solana/Anchor.toml`)

After setup, restart your terminal, then:

```bash
# Generate a wallet (if needed)
solana-keygen new

# Use devnet for development
solana config set --url devnet

# Airdrop devnet SOL
solana airdrop 2

# Build Solana programs
cd packages/solana && anchor build

# Run Solana tests
anchor test
```

**Alternative (all-in-one):** On Mac/Linux, you can instead run the [official Solana install script](https://www.anchor-lang.com/docs/installation), which installs Rust, Solana CLI, Anchor CLI, Node.js, and Yarn. Then ensure Anchor 0.32.1 is active: `avm install 0.32.1 && avm use 0.32.1`.

### Installation

```bash
# Install all dependencies
npm install

# Install dependencies for a specific workspace
npm install --workspace=apps/web
npm install --workspace=packages/game-engine
```

### Development

```bash
# Run the web app
npm run dev

# Or specifically
npm run dev:web

# Build all packages
npm run build

# Build a specific package
npm run build:web

# Type check
npm run type-check

# Clean all node_modules and build artifacts
npm run clean
```

### Web Frontend

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.
Navigate to [http://localhost:3000/game](http://localhost:3000/game) to play the game.

### Solana Programs

```bash
cd packages/solana

# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test
```

## Package Usage

### Using the Game Engine

```typescript
import { GameEngine, createTestLevel, Renderer } from '@geometrydash/game-engine';

// Create a level
const level = createTestLevel();

// Initialize engine
const engine = new GameEngine(level, {
  canvasWidth: 1200,
  canvasHeight: 600,
  playerSpeed: 300
});

// Create renderer
const renderer = new Renderer({ canvas, width: 1200, height: 600 });

// Set up render callback
engine.onRender((state) => {
  renderer.render(state);
});

// Start the game
engine.start();
```

### Using Solana SDK

```typescript
import { GamblingClient } from '@geometrydash/solana/sdk';

const client = new GamblingClient(connection, wallet);

// Place a bet
await client.placeBet(poolPublicKey, 0.1, 30000); // 0.1 SOL, predict 30 seconds

// Settle bet
await client.settleBet(betPublicKey, actualTimeAlive);
```

## Workspace Management

This monorepo uses npm workspaces for managing multiple packages.

```bash
# Add a dependency to a specific workspace
npm install <package> --workspace=apps/web

# Run a script in a specific workspace
npm run <script> --workspace=packages/game-engine

# Run a script across all workspaces
npm run <script> --workspaces
```

## Documentation

- [Game Engine Architecture](./packages/game-engine/README.md)
- [Solana Integration](./packages/solana/README.md)

## Contributing

This monorepo structure allows for independent development of each component while maintaining shared types and utilities.

## License

MIT
