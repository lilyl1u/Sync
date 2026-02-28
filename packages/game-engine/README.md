# @geometrydash/game-engine

Reusable Geometry Dash game engine for monorepo applications.

## Installation

```bash
npm install @geometrydash/game-engine
```

## Usage

```typescript
import { GameEngine, PhysicsEngine } from '@geometrydash/game-engine';
```

## Development

```bash
# Build the package
npm run build

# Watch mode for development
npm run build:watch

# Clean build artifacts
npm run clean
```

## Structure

- `src/engine/` - Core game engine components (GameEngine, PhysicsEngine, CollisionDetection, InputHandler)
- `src/systems/` - Game systems (Renderer)
- `src/levels/` - Level generation (LevelGenerator, ProceduralGenerator, SegmentTemplates, TestLevel)
- `src/components/` - React components (Player, Obstacle, GameCanvas, GameUI, GeometryDashGame, GameExample)
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions
