# Geometry Dash Monorepo

A comprehensive monorepo for a Geometry Dash clone with Solana gambling integration and ML-powered music genre prediction.

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
│   │   │   ├── levels/       # Level generation (Procedural, ML-ready)
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
│       │   ├── ml.ts        # ML-related types
│       │   └── index.ts
│       └── package.json
│
├── services/
│   └── ml-service/           # Python ML service
│       ├── src/
│       │   ├── api/         # FastAPI endpoints
│       │   ├── models/      # ML model code
│       │   ├── training/    # Training scripts
│       │   └── inference/   # Inference code
│       ├── pretrained/      # Pretrained models
│       ├── data/            # Training data
│       ├── scripts/         # Utility scripts
│       ├── requirements.txt
│       └── Dockerfile
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
- ML-ready architecture for AI-generated levels

### Solana Integration
- Time-alive gambling mechanics
- Players bet on survival time predictions
- Smart contracts built with Anchor
- Accuracy-based payout system (up to 10x multiplier)

### ML Music Genre Prediction
- Pretrained model integration
- Fine-tuning based on user's Spotify data
- FastAPI-based service
- Real-time inference

### Spotify Integration
- User authentication
- Playlist and track data fetching
- Audio feature extraction
- Integration with ML service for personalized recommendations

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Python 3.11+ (for ML service)
- Rust & Anchor (for Solana development)
- Solana CLI

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

### ML Service

```bash
cd services/ml-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn src.api.main:app --reload
```

API docs available at [http://localhost:8000/docs](http://localhost:8000/docs)

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
- [ML Service Guide](./services/ml-service/README.md)
- [ML Integration Guide](./ML_INTEGRATION_GUIDE.md)

## Project Goals

1. **Geometry Dash Clone**: Fully functional platformer game with procedural level generation
2. **Solana Gambling**: Decentralized betting system based on survival time predictions
3. **ML Integration**:
   - Music genre prediction from Spotify data
   - Fine-tuning models based on user preferences
   - Potential for ML-generated game levels

## Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS

**Game Engine:**
- TypeScript
- Canvas API
- Custom physics engine

**Blockchain:**
- Solana
- Anchor Framework
- @solana/web3.js

**ML Service:**
- Python 3.11
- FastAPI
- PyTorch/TensorFlow
- Transformers (Hugging Face)
- Spotipy

## Contributing

This monorepo structure allows for independent development of each component while maintaining shared types and utilities.

## License

MIT
