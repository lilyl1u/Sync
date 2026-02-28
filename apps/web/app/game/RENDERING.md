# Geometry Dash Clone - Rendering System Documentation

## Overview

The rendering system uses HTML5 Canvas for high-performance 2D game rendering at 60fps. The system features parallax backgrounds, smooth camera scrolling, particle effects, and Geometry Dash-inspired visual aesthetics with a purple/pink theme stolen from HackIllinois.

## Architecture

### Canvas-Based Rendering
- **Why Canvas?** Better performance for fast-moving 2D graphics, pixel-perfect control, and built-in hardware acceleration
- **React Integration** React manages component lifecycle while Canvas handles the actual drawing
- **60fps Target** RequestAnimationFrame for smooth rendering synchronized with display refresh

## File Structure

```
app/game/
├── systems/
│   ├── Renderer.ts           # Core canvas rendering system
│   └── index.ts              # System exports
├── components/
│   ├── GameCanvas.tsx        # Main React canvas component
│   ├── Player.tsx            # Player rendering utilities
│   ├── Obstacle.tsx          # Obstacle rendering utilities
│   ├── UI/
│   │   └── GameUI.tsx        # Game UI overlay (score, health, pause, game over)
│   └── index.ts              # Component exports
└── types/
    └── index.ts              # Type definitions
```

## Key Components

### 1. Renderer.ts
**Purpose:** Core rendering engine that draws to canvas

**Features:**
- Parallax background layers (stars, clouds)
- Camera system with smooth scrolling
- Game object rendering (player, obstacles, platforms)
- Visual effects (glow, trails, particles)
- Ground with animated grid pattern

**Color Palette:**
```typescript
colors = {
  sky: '#1a1033',              // Dark purple background
  ground: '#6b46c1',           // Purple ground
  player: '#00f2ff',           // Cyan player
  obstacle: '#ff006e',         // Hot pink obstacles
  platform: '#8b5cf6',         // Purple platforms
  collectible: '#fbbf24',      // Gold collectibles
}
```

**Usage:**
```typescript
const renderer = new Renderer({
  canvas: canvasElement,
  width: 1200,
  height: 600,
});

renderer.render(gameState);
```

### 2. GameCanvas.tsx
**Purpose:** React component that manages canvas lifecycle and rendering loop

**Features:**
- Canvas initialization and cleanup
- RequestAnimationFrame render loop
- Window resize handling
- Device pixel ratio support for crisp rendering

**Usage:**
```typescript
<GameCanvas
  gameState={gameState}
  width={1200}
  height={600}
  className="game-canvas"
/>
```

### 3. GameUI.tsx
**Purpose:** React overlay for UI elements (HUD, pause, game over)

**Features:**
- Score and health display with gradient backgrounds
- Pause/resume functionality
- Game over screen with statistics
- Level indicator
- Controls instructions

**Visual Design:**
- Glass-morphism effect (backdrop-blur)
- Neon glow effects using box-shadow
- Gradient backgrounds (purple to pink to cyan)
- Animated elements (pulse, fade-in)

**Usage:**
```typescript
<GameUI
  gameState={gameState}
  onRestart={handleRestart}
  onPause={handlePause}
  onResume={handleResume}
/>
```

### 4. Player.tsx & Obstacle.tsx
**Purpose:** Utility functions and factories for rendering game entities

**Features:**
- Color calculation based on health/damage
- Animation frame calculation
- Trail particle generation
- Rotation helpers
- Factory functions for creating obstacles

## Visual Features

### Parallax Background
- **Stars Layer:** Slowest (0.2x camera speed) - Creates depth
- **Clouds Layer:** Medium (0.4x camera speed) - Mid-ground depth
- **Ground Layer:** Moves with camera - Foreground

### Player Effects
- **Rotation:** Dynamic rotation based on velocity
- **Trail:** Motion trail when moving fast
- **Glow:** Cyan glow effect around player
- **Health Color:** Changes from cyan → orange → red as health decreases

### Obstacle Effects
- **Spikes:** Triangle shape with pink glow
- **Blocks:** Square with X pattern and rotation
- **Danger Particles:** Orbiting particles for high-damage obstacles
- **Warning Indicators:** Visual warning for upcoming obstacles

### Camera System
- **Smooth Following:** Camera follows player with offset
- **Screen Culling:** Only renders objects visible on screen
- **Parallax Offset:** Background layers move at different speeds

## Performance Optimizations

1. **Screen Culling**
   - Only draws objects within viewport bounds
   - Checks: `screenX < -width - 100 || screenX > width + 100`

2. **Device Pixel Ratio**
   - Handles high-DPI displays (Retina, etc.)
   - Scales canvas for crisp rendering

3. **RequestAnimationFrame**
   - Synchronized with display refresh rate
   - Pauses when game is paused

4. **Image Smoothing**
   - High-quality smoothing for SVG assets
   - Crisp-edges for game objects

## Integration Example

```typescript
import { GameCanvas, GameUI } from '@/app/game/components';
import { GameState } from '@/app/game/types';

function GameView() {
  const [gameState, setGameState] = useState<GameState>(initialState);

  return (
    <div className="relative w-full h-screen">
      {/* Canvas for game rendering */}
      <GameCanvas
        gameState={gameState}
        width={1200}
        height={600}
      />

      {/* UI overlay */}
      <GameUI
        gameState={gameState}
        onRestart={() => setGameState(initialState)}
        onPause={() => setGameState(s => ({ ...s, isPaused: true }))}
        onResume={() => setGameState(s => ({ ...s, isPaused: false }))}
      />
    </div>
  );
}
```

## Assets Used

### From public/assets/
- **stars.svg** - Starfield background with glow effects
- **clouds.svg** - Purple gradient clouds for parallax

### Asset Credits
Stolen from HackIllinois website (thanks for the free assets!)

## Visual Design Inspiration

### Geometry Dash Style
- Geometric shapes (cubes, triangles)
- Bright neon colors
- Glow effects
- Simple but visually striking

### HackIllinois Theme
- Purple color palette (#6b46c1, #8b5cf6)
- Pink accents (#ff006e)
- Cyan highlights (#00f2ff)
- Dark purple backgrounds (#1a1033)

## Debugging

### Development Mode
Player.tsx and Obstacle.tsx include debug overlays (hidden by default):
```typescript
if (process.env.NODE_ENV === 'development') {
  // Shows collision boxes
}
```

### Enable Debug Overlays
Modify component styles to show collision boxes:
```typescript
display: 'block', // Change from 'none'
```

## Future Enhancements

Potential additions to the rendering system:
- [ ] Particle system for explosions
- [ ] Dynamic lighting effects
- [ ] Post-processing effects (bloom, chromatic aberration)
- [ ] More background layers
- [ ] Animated obstacles
- [ ] Power-up visual effects
- [ ] Level transition animations

## Performance Metrics

Target performance:
- **60 FPS** - Render loop
- **16.67ms** - Frame time budget
- **Canvas size** - 1200x600 base resolution
- **Object limit** - ~100 active objects before culling needed

## Troubleshooting

### Canvas not rendering
- Check canvas ref is attached
- Verify Renderer initialization
- Check console for context errors

### Low FPS
- Reduce particle count
- Enable more aggressive culling
- Check device pixel ratio

### Blurry rendering
- Verify pixel ratio handling
- Check canvas width/height vs style width/height
- Enable crisp-edges if needed

## Credits

Built for a modular Geometry Dash clone with:
- TypeScript for type safety
- React for component management
- HTML5 Canvas for rendering
- Next.js for the framework
- HackIllinois assets for visual flair
