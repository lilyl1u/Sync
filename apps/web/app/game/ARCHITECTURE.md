# Rendering System Architecture

## Visual Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Window                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   React Component Tree                    │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │         Your Game Component                     │    │   │
│  │  │                                                 │    │   │
│  │  │  ┌────────────────────────────────────────┐   │    │   │
│  │  │  │  Container <div> (relative)            │   │    │   │
│  │  │  │                                        │   │    │   │
│  │  │  │  ┌──────────────────────────────┐    │   │    │   │
│  │  │  │  │   GameCanvas Component       │    │   │    │   │
│  │  │  │  │   (React Lifecycle Manager)  │    │   │    │   │
│  │  │  │  │                              │    │   │    │   │
│  │  │  │  │   ┌──────────────────────┐  │    │   │    │   │
│  │  │  │  │   │  <canvas> Element    │  │    │   │    │   │
│  │  │  │  │   │  (HTML5 Canvas)      │  │    │   │    │   │
│  │  │  │  │   │                      │  │    │   │    │   │
│  │  │  │  │   │  ┌────────────────┐ │  │    │   │    │   │
│  │  │  │  │   │  │   Renderer     │ │  │    │   │    │   │
│  │  │  │  │   │  │   Instance     │ │  │    │   │    │   │
│  │  │  │  │   │  │                │ │  │    │   │    │   │
│  │  │  │  │   │  │  Draws:        │ │  │    │   │    │   │
│  │  │  │  │   │  │  - Background  │ │  │    │   │    │   │
│  │  │  │  │   │  │  - Parallax    │ │  │    │   │    │   │
│  │  │  │  │   │  │  - Ground      │ │  │    │   │    │   │
│  │  │  │  │   │  │  - Objects     │ │  │    │   │    │   │
│  │  │  │  │   │  │  - Player      │ │  │    │   │    │   │
│  │  │  │  │   │  └────────────────┘ │  │    │   │    │   │
│  │  │  │  │   └──────────────────────┘  │    │   │    │   │
│  │  │  │  └──────────────────────────────┘    │   │    │   │
│  │  │  │                                        │   │    │   │
│  │  │  │  ┌──────────────────────────────┐    │   │    │   │
│  │  │  │  │   GameUI Component           │    │   │    │   │
│  │  │  │  │   (Absolute positioned over) │    │   │    │   │
│  │  │  │  │                              │    │   │    │   │
│  │  │  │  │   - Score HUD                │    │   │    │   │
│  │  │  │  │   - Health HUD               │    │   │    │   │
│  │  │  │  │   - Pause Menu               │    │   │    │   │
│  │  │  │  │   - Game Over Screen         │    │   │    │   │
│  │  │  │  │   - Level Info               │    │   │    │   │
│  │  │  │  └──────────────────────────────┘    │   │    │   │
│  │  │  └────────────────────────────────────────┘   │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────┐
│  Game State  │ ◄── Updated by GameEngine, Physics, Input
└──────┬───────┘
       │
       ├────────────────────┐
       │                    │
       ▼                    ▼
┌──────────────┐    ┌──────────────┐
│  GameCanvas  │    │   GameUI     │
│              │    │              │
│  Passes to:  │    │  Displays:   │
│  Renderer    │    │  - Score     │
│              │    │  - Health    │
│  Draws:      │    │  - Pause     │
│  - Canvas    │    │  - Game Over │
│    Graphics  │    │              │
└──────────────┘    └──────────────┘
```

## Rendering Pipeline (Frame-by-Frame)

```
┌─────────────────────────────────────────────┐
│  requestAnimationFrame (60fps)               │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  GameCanvas.render() called                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Renderer.render(gameState)                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  1. Clear canvas                             │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  2. Draw background gradient                 │
│     (Purple sky: #1a1033 → #2d1b4e)         │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  3. Draw parallax stars                      │
│     - Offset: cameraOffset * 0.2            │
│     - Tile across screen                    │
│     - Alpha: 0.7                            │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  4. Draw parallax clouds                     │
│     - Offset: cameraOffset * 0.4            │
│     - Tile across screen                    │
│     - Alpha: 0.5                            │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  5. Draw ground                              │
│     - Purple base (#6b46c1)                 │
│     - Animated grid pattern                 │
│     - Neon top border                       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  6. Draw game objects (with screen culling)  │
│     For each object in gameState.gameObjects:│
│       - Check if visible on screen          │
│       - Draw based on type:                 │
│         • Spikes (triangle, pink glow)      │
│         • Blocks (square, X pattern)        │
│         • Platforms (purple rectangles)     │
│         • Collectibles (pulsing gold)       │
│         • Portals (animated swirl)          │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  7. Draw player                              │
│     - Cyan cube with rotation               │
│     - Glow effect (shadowBlur)              │
│     - Motion trail if moving fast           │
│     - Health-based color                    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  8. Frame complete                           │
│     Continue to next frame                   │
└─────────────────────────────────────────────┘
```

## Component Responsibilities

### Renderer.ts
```
┌────────────────────────────────────┐
│          Renderer Class            │
├────────────────────────────────────┤
│  Properties:                       │
│  - ctx: CanvasRenderingContext2D  │
│  - canvas: HTMLCanvasElement      │
│  - colors: ColorPalette           │
│  - images: Background assets      │
├────────────────────────────────────┤
│  Methods:                          │
│  - render(gameState)              │
│  - drawBackground()               │
│  - drawParallaxStars()            │
│  - drawParallaxClouds()           │
│  - drawGround()                   │
│  - drawPlayer()                   │
│  - drawObstacle()                 │
│  - drawPlatform()                 │
│  - drawCollectible()              │
│  - drawPortal()                   │
│  - resize(width, height)          │
│  - destroy()                      │
└────────────────────────────────────┘
```

### GameCanvas.tsx
```
┌────────────────────────────────────┐
│     GameCanvas Component           │
├────────────────────────────────────┤
│  Props:                            │
│  - gameState: GameState           │
│  - width: number                  │
│  - height: number                 │
│  - className?: string             │
├────────────────────────────────────┤
│  Responsibilities:                 │
│  - Create canvas element          │
│  - Initialize Renderer            │
│  - Start render loop              │
│  - Handle resize                  │
│  - Cleanup on unmount             │
├────────────────────────────────────┤
│  Hooks:                            │
│  - useRef (canvas, renderer)      │
│  - useEffect (init, resize, loop) │
│  - useCallback (render function)  │
└────────────────────────────────────┘
```

### GameUI.tsx
```
┌────────────────────────────────────┐
│       GameUI Component             │
├────────────────────────────────────┤
│  Props:                            │
│  - gameState: GameState           │
│  - onRestart: () => void          │
│  - onPause: () => void            │
│  - onResume: () => void           │
├────────────────────────────────────┤
│  UI Elements:                      │
│  - Score HUD (top-left)           │
│  - Health HUD (top-right)         │
│  - Pause button (top-center)      │
│  - Pause overlay (fullscreen)     │
│  - Game Over overlay (fullscreen) │
│  - Level indicator (bottom-left)  │
│  - Instructions (bottom-right)    │
├────────────────────────────────────┤
│  Styling:                          │
│  - Tailwind CSS classes           │
│  - Glass-morphism effects         │
│  - Gradient backgrounds           │
│  - Neon glow (box-shadow)         │
└────────────────────────────────────┘
```

## Camera System

```
┌─────────────────────────────────────────────────────────────┐
│                         Game World                           │
│  (Infinite horizontal space)                                 │
│                                                              │
│  Player ───►  Movement Direction                            │
│  Position X                                                  │
│                                                              │
│  ┌────────────────────────────┐                            │
│  │  Visible Screen Area       │                            │
│  │  (Viewport)                │                            │
│  │                            │                            │
│  │  Camera Offset ────────────┼─►                          │
│  │  (scrolls with player)     │                            │
│  │                            │                            │
│  │  Objects drawn relative    │                            │
│  │  to camera offset:         │                            │
│  │  screenX = worldX - offset │                            │
│  └────────────────────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Camera Offset Calculation:
  cameraOffset = player.position.x - 200
  (Keeps player 200px from left edge)

Background Layers:
  Stars offset:  cameraOffset * 0.2  (slower = farther)
  Clouds offset: cameraOffset * 0.4  (medium = mid-ground)
  Ground offset: cameraOffset * 1.0  (same = foreground)
```

## Performance Optimizations

```
┌─────────────────────────────────────────────────────────────┐
│                   Optimization Strategy                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Screen Culling                                          │
│     ┌──────────────────────────────────────────┐           │
│     │  Only draw objects in viewport:          │           │
│     │                                           │           │
│     │  if (screenX < -100 || screenX > 1300)   │           │
│     │    return; // Skip drawing               │           │
│     └──────────────────────────────────────────┘           │
│                                                              │
│  2. Device Pixel Ratio                                      │
│     ┌──────────────────────────────────────────┐           │
│     │  canvas.width = width * pixelRatio       │           │
│     │  ctx.scale(pixelRatio, pixelRatio)       │           │
│     │  // Crisp on Retina displays             │           │
│     └──────────────────────────────────────────┘           │
│                                                              │
│  3. Image Caching                                           │
│     ┌──────────────────────────────────────────┐           │
│     │  Load stars.svg & clouds.svg once        │           │
│     │  Reuse on every frame                    │           │
│     └──────────────────────────────────────────┘           │
│                                                              │
│  4. RequestAnimationFrame                                   │
│     ┌──────────────────────────────────────────┐           │
│     │  Synced with display refresh (60Hz)      │           │
│     │  Pauses when tab not visible             │           │
│     └──────────────────────────────────────────┘           │
│                                                              │
│  5. Render Loop Control                                     │
│     ┌──────────────────────────────────────────┐           │
│     │  if (isPaused) return; // Stop rendering │           │
│     │  Saves CPU when paused                   │           │
│     └──────────────────────────────────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Visual Effects Stack

```
Layer 7: UI Overlay (React DOM)
         ┌─────────────────────┐
         │ Score, Health, etc. │
         └─────────────────────┘

Layer 6: Player Effects
         ┌─────────────────────┐
         │ Motion trail        │
         │ Rotation            │
         │ Glow                │
         └─────────────────────┘

Layer 5: Game Objects
         ┌─────────────────────┐
         │ Obstacles           │
         │ Platforms           │
         │ Collectibles        │
         └─────────────────────┘

Layer 4: Ground
         ┌─────────────────────┐
         │ Grid pattern        │
         │ Neon border         │
         └─────────────────────┘

Layer 3: Clouds (Parallax 0.4x)
         ┌─────────────────────┐
         │ Purple clouds       │
         │ Alpha: 0.5          │
         └─────────────────────┘

Layer 2: Stars (Parallax 0.2x)
         ┌─────────────────────┐
         │ Starfield           │
         │ Alpha: 0.7          │
         └─────────────────────┘

Layer 1: Background
         ┌─────────────────────┐
         │ Purple gradient     │
         │ #1a1033 → #2d1b4e  │
         └─────────────────────┘
```

## Type System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    types/index.ts                            │
│                                                              │
│  Defines:                                                    │
│  - GameObject (base interface)                              │
│  - Player extends GameObject                                │
│  - Obstacle extends GameObject                              │
│  - Platform extends GameObject                              │
│  - GameState (complete game state)                          │
│  - Vector2D (x, y positions)                                │
│  - GameObjectType (enum)                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Renderer.ts    │     │  Components     │
│                 │     │                 │
│  Uses types for:│     │  Use types for: │
│  - render()     │     │  - Props        │
│  - draw methods │     │  - State        │
│                 │     │  - Utilities    │
└─────────────────┘     └─────────────────┘
```

## File Dependencies

```
GameCanvas.tsx
  ├── imports Renderer from systems/Renderer
  ├── imports types from types/index
  └── exports GameCanvas component

GameUI.tsx
  ├── imports types from types/index
  └── exports GameUI component

Renderer.ts
  ├── imports types from types/index
  └── exports Renderer class

Player.tsx
  ├── imports types from types/index
  └── exports Player component & PlayerRenderer utilities

Obstacle.tsx
  ├── imports types from types/index
  └── exports Obstacle component & ObstacleRenderer utilities

components/index.ts
  ├── exports all components
  └── re-exports common types

systems/index.ts
  └── exports Renderer & RenderConfig
```

---

This architecture provides:
- **Separation of concerns** (Canvas vs React)
- **Type safety** (TypeScript throughout)
- **Performance** (60fps with culling)
- **Modularity** (Easy to extend/modify)
- **Visual polish** (Parallax, effects, UI)
