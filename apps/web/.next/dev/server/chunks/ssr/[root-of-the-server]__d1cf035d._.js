module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// Core type definitions for the modular Geometry Dash game
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GameObjectType = void 0;
var GameObjectType;
(function(GameObjectType) {
    GameObjectType["PLAYER"] = "player";
    GameObjectType["OBSTACLE_SPIKE"] = "obstacle_spike";
    GameObjectType["OBSTACLE_BLOCK"] = "obstacle_block";
    GameObjectType["PLATFORM"] = "platform";
    GameObjectType["PORTAL"] = "portal";
    GameObjectType["COLLECTIBLE"] = "collectible";
})(GameObjectType || (exports.GameObjectType = GameObjectType = {})); //# sourceMappingURL=index.js.map
}),
"[project]/packages/game-engine/dist/engine/CollisionDetection.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.CollisionDetection = void 0;
// Axis-Aligned Bounding Box (AABB) collision detection system
const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
/** Padding for obstacle bounds - prevents jump-through on sides/bottom. No top padding on blocks so players can land on them. */ const OBSTACLE_SIDE_PADDING = 4;
/** Spike hitbox insets — shrink the AABB inward to approximate the triangle shape.
 *  Positive values = more forgiving (shrinks hitbox). */ const SPIKE_INSET_SIDES = 8; // Generous: triangle is narrow near edges
const SPIKE_INSET_TOP = 12; // Very generous: tip is thin, shouldn't kill on near-miss
const SPIKE_INSET_BOTTOM = 2; // Small: base of triangle is wide
class CollisionDetection {
    /**
     * Check if two game objects are colliding using AABB collision detection
     * @param a First game object
     * @param b Second game object
     * @returns true if objects are colliding
     */ static checkAABBCollision(a, b) {
        return a.position.x < b.position.x + b.size.x && a.position.x + a.size.x > b.position.x && a.position.y < b.position.y + b.size.y && a.position.y + a.size.y > b.position.y;
    }
    /**
     * Check collision with an obstacle. Uses asymmetric padding:
     * - OBSTACLE_BLOCK: padding on sides/bottom only (no top) so players can land on blocks
     * - OBSTACLE_SPIKE: full padding on all sides
     */ static checkObstacleCollision(player, obstacle) {
        if (obstacle.type === types_1.GameObjectType.OBSTACLE_BLOCK) {
            const p = OBSTACLE_SIDE_PADDING;
            const left = obstacle.position.x - p;
            const right = obstacle.position.x + obstacle.size.x + p;
            const top = obstacle.position.y; // No top padding - landable
            const bottom = obstacle.position.y + obstacle.size.y + p;
            return player.position.x < right && player.position.x + player.size.x > left && player.position.y < bottom && player.position.y + player.size.y > top;
        }
        const left = obstacle.position.x + SPIKE_INSET_SIDES;
        const right = obstacle.position.x + obstacle.size.x - SPIKE_INSET_SIDES;
        const top = obstacle.position.y + SPIKE_INSET_TOP;
        const bottom = obstacle.position.y + obstacle.size.y - SPIKE_INSET_BOTTOM;
        if (left >= right || top >= bottom) {
            return false;
        }
        return player.position.x < right && player.position.x + player.size.x > left && player.position.y < bottom && player.position.y + player.size.y > top;
    }
    /**
     * Check if a point is inside a game object
     * @param point The point to check
     * @param obj The game object
     * @returns true if point is inside object
     */ static pointInObject(point, obj) {
        return point.x >= obj.position.x && point.x <= obj.position.x + obj.size.x && point.y >= obj.position.y && point.y <= obj.position.y + obj.size.y;
    }
    /**
     * Find all collisions between a game object and a list of objects
     * Uses expanded obstacle bounds for OBSTACLE_SPIKE and OBSTACLE_BLOCK to prevent jump-through.
     * @param obj The object to check collisions for
     * @param objects List of objects to check against
     * @returns Array of objects that are colliding with obj
     */ static findCollisions(obj, objects) {
        return objects.filter((other)=>{
            if (other.id === obj.id || !other.active) return false;
            if (other.type === types_1.GameObjectType.OBSTACLE_SPIKE || other.type === types_1.GameObjectType.OBSTACLE_BLOCK) {
                return this.checkObstacleCollision(obj, other);
            }
            return this.checkAABBCollision(obj, other);
        });
    }
    /**
     * Calculate the penetration depth of a collision
     * @param a First game object
     * @param b Second game object
     * @returns Vector representing penetration depth (positive means overlap)
     */ static getPenetrationDepth(a, b) {
        const overlapX = Math.min(a.position.x + a.size.x - b.position.x, b.position.x + b.size.x - a.position.x);
        const overlapY = Math.min(a.position.y + a.size.y - b.position.y, b.position.y + b.size.y - a.position.y);
        return {
            x: overlapX,
            y: overlapY
        };
    }
    /**
     * Check if an object is on the ground (standing on a platform)
     * @param obj The object to check
     * @param platforms List of platform objects
     * @param tolerance How close to be considered "on ground"
     * @returns true if object is on ground
     */ static isOnGround(obj, platforms, tolerance = 2) {
        const bottomY = obj.position.y + obj.size.y;
        for (const platform of platforms){
            if (!platform.active) continue;
            const platformTop = platform.position.y;
            const horizontalOverlap = obj.position.x + obj.size.x > platform.position.x && obj.position.x < platform.position.x + platform.size.x;
            // Check if object's bottom is close to platform's top
            if (horizontalOverlap && Math.abs(bottomY - platformTop) <= tolerance) {
                return true;
            }
        }
        return false;
    }
}
exports.CollisionDetection = CollisionDetection; //# sourceMappingURL=CollisionDetection.js.map
}),
"[project]/packages/game-engine/dist/engine/PhysicsEngine.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PhysicsEngine = void 0;
// Physics simulation system for the game
const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
const CollisionDetection_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/engine/CollisionDetection.js [app-ssr] (ecmascript)");
class PhysicsEngine {
    constructor(config){
        // Default physics configuration (tuned for Geometry Dash-like gameplay)
        this.config = {
            gravity: 2800,
            jumpForce: -680,
            maxVelocity: {
                x: 400,
                y: 1200
            },
            friction: 0.8,
            ...config
        };
    }
    /**
     * Get the current physics configuration
     */ getConfig() {
        return {
            ...this.config
        };
    }
    /**
     * Update physics configuration
     */ updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }
    /**
     * Apply gravity to an object
     * @param obj The game object
     * @param deltaTime Time elapsed since last update (in seconds)
     */ applyGravity(obj, deltaTime) {
        obj.velocity.y += this.config.gravity * deltaTime;
        // Clamp to max velocity
        if (obj.velocity.y > this.config.maxVelocity.y) {
            obj.velocity.y = this.config.maxVelocity.y;
        }
    }
    /**
     * Update object position based on velocity
     * @param obj The game object
     * @param deltaTime Time elapsed since last update (in seconds)
     */ updatePosition(obj, deltaTime) {
        obj.position.x += obj.velocity.x * deltaTime;
        obj.position.y += obj.velocity.y * deltaTime;
    }
    /**
     * Make the player jump - fixed height, any tap (even 0.1ms) clears 1 block (50px)
     */ jump(player) {
        if (player.isOnGround && !player.isJumping) {
            player.velocity.y = this.config.jumpForce;
            player.isJumping = true;
            player.isOnGround = false;
        }
    }
    /**
     * Set the player's horizontal velocity (auto-run)
     * @param player The player object
     * @param speed Speed in pixels per second
     */ setPlayerRunSpeed(player, speed) {
        player.velocity.x = Math.min(speed, this.config.maxVelocity.x);
    }
    /**
     * Update player physics state
     * @param player The player object
     * @param platforms List of platform objects
     * @param deltaTime Time elapsed since last update (in seconds)
     * @param floorY Optional - ground surface Y (player bottom clamped to never go below this)
     */ updatePlayer(player, platforms, deltaTime, floorY) {
        // Apply gravity
        this.applyGravity(player, deltaTime);
        // Update position
        this.updatePosition(player, deltaTime);
        // Prevent jumping through platforms from below
        if (player.velocity.y < 0) {
            for (const platform of platforms){
                if (!platform.active) continue;
                if (!CollisionDetection_1.CollisionDetection.checkAABBCollision(player, platform)) continue;
                const platformBottom = platform.position.y + platform.size.y;
                if (player.position.y + player.size.y > platformBottom) {
                    player.position.y = platformBottom;
                    player.velocity.y = 0;
                }
            }
        }
        // Prevent falling through floors - resolve penetration when player has dropped into a platform
        if (player.velocity.y >= 0) {
            const playerBottom = player.position.y + player.size.y;
            // Sort by platform top (ascending) so we snap to the highest platform we've penetrated
            const sortedPlatforms = [
                ...platforms
            ].sort((a, b)=>a.position.y - b.position.y);
            for (const platform of sortedPlatforms){
                if (!platform.active) continue;
                const platformTop = platform.position.y;
                const horizontalOverlap = player.position.x + player.size.x > platform.position.x && player.position.x < platform.position.x + platform.size.x;
                // Player has fallen into/through the platform (bottom penetrated past top)
                if (horizontalOverlap && playerBottom > platformTop) {
                    player.position.y = platformTop - player.size.y;
                    player.velocity.y = 0;
                    break; // Resolve one platform per frame
                }
            }
        }
        // Check ground collision only when falling/stationary — never when rising,
        // otherwise the tolerance window snaps the player back down mid-jump.
        if (player.velocity.y >= 0) {
            const wasOnGround = player.isOnGround;
            player.isOnGround = CollisionDetection_1.CollisionDetection.isOnGround(player, platforms, 12);
            if (player.isOnGround) {
                const groundPlatform = this.findGroundPlatform(player, platforms);
                if (groundPlatform) {
                    player.position.y = groundPlatform.position.y - player.size.y;
                    player.velocity.y = 0;
                    player.isJumping = false;
                }
            } else if (wasOnGround && !player.isOnGround) {
                player.isJumping = false;
            }
        } else {
            player.isOnGround = false;
        }
        // Hard floor clamp - keep player above floor at all times (failsafe)
        if (floorY !== undefined) {
            const playerBottom = player.position.y + player.size.y;
            if (playerBottom > floorY) {
                player.position.y = floorY - player.size.y;
                player.velocity.y = 0;
                player.isOnGround = true;
                player.isJumping = false;
            }
        }
    // Apply friction to horizontal movement (optional)
    // player.velocity.x *= this.config.friction;
    }
    /**
     * Find the platform the player is standing on
     * @param player The player object
     * @param platforms List of platform objects
     * @returns The platform object or null
     */ findGroundPlatform(player, platforms) {
        const bottomY = player.position.y + player.size.y;
        for (const platform of platforms){
            if (!platform.active) continue;
            const platformTop = platform.position.y;
            const horizontalOverlap = player.position.x + player.size.x > platform.position.x && player.position.x < platform.position.x + platform.size.x;
            if (horizontalOverlap && Math.abs(bottomY - platformTop) <= 12) {
                return platform;
            }
        }
        return null;
    }
    /**
     * Handle collision response for the player
     * @param player The player object
     * @param collidedObject The object the player collided with
     * @returns true if the collision was fatal
     */ handlePlayerCollision(player, collidedObject) {
        switch(collidedObject.type){
            case types_1.GameObjectType.OBSTACLE_SPIKE:
                player.health = 0;
                return true;
            case types_1.GameObjectType.OBSTACLE_BLOCK:
                // Landing on top of a block is safe - treat like a platform
                const playerBottom = player.position.y + player.size.y;
                const blockTop = collidedObject.position.y;
                const landingTolerance = 18; // Forgiving window for landing
                const isLandingOnTop = playerBottom >= blockTop - 4 && playerBottom <= blockTop + landingTolerance && player.velocity.y >= -150; // Falling or just landed (allow slight upward at peak)
                if (isLandingOnTop) {
                    return false; // Not fatal - physics will snap player on top
                }
                player.health = 0;
                return true;
            case types_1.GameObjectType.PLATFORM:
                // Platform collision handled in updatePlayer
                return false;
            case types_1.GameObjectType.PORTAL:
                // Portal logic (can be extended later)
                return false;
            default:
                return false;
        }
    }
    /**
     * Reset player physics state
     * @param player The player object
     */ resetPlayer(player) {
        player.velocity = {
            x: 0,
            y: 0
        };
        player.isJumping = false;
        player.isOnGround = false;
    }
    /**
     * Check if an object is out of bounds
     * @param obj The game object
     * @param bounds The game bounds
     * @returns true if object is out of bounds
     */ isOutOfBounds(obj, bounds) {
        return obj.position.y > bounds.height || // Fell off the bottom
        obj.position.y + obj.size.y < 0 || // Above the screen
        obj.position.x + obj.size.x < 0 // Left of the screen
        ;
    }
}
exports.PhysicsEngine = PhysicsEngine; //# sourceMappingURL=PhysicsEngine.js.map
}),
"[project]/packages/game-engine/dist/engine/InputHandler.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InputHandler = void 0;
class InputHandler {
    constructor(){
        this.inputState = {
            jump: false,
            restart: false,
            pause: false
        };
        // Map keyboard keys to input actions
        this.keyMap = new Map([
            [
                ' ',
                'jump'
            ],
            [
                'Space',
                'jump'
            ],
            [
                'ArrowUp',
                'jump'
            ],
            [
                'w',
                'jump'
            ],
            [
                'W',
                'jump'
            ],
            [
                'r',
                'restart'
            ],
            [
                'R',
                'restart'
            ],
            [
                'p',
                'pause'
            ],
            [
                'P',
                'pause'
            ],
            [
                'Escape',
                'pause'
            ]
        ]);
        this.activeKeys = new Set();
        this.setupEventListeners();
    }
    /**
     * Set up keyboard and touch event listeners
     */ setupEventListeners() {
        // Keyboard events
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        // Touch/click events (for mobile and mouse)
        window.addEventListener('mousedown', this.handlePointerDown.bind(this));
        window.addEventListener('mouseup', this.handlePointerUp.bind(this));
        window.addEventListener('touchstart', this.handlePointerDown.bind(this), {
            passive: false
        });
        window.addEventListener('touchend', this.handlePointerUp.bind(this), {
            passive: false
        });
    }
    /**
     * Handle key down events
     */ handleKeyDown(event) {
        const action = this.keyMap.get(event.key);
        if (action) {
            event.preventDefault();
            // Prevent key repeat for single-press actions
            if (!this.activeKeys.has(event.key)) {
                this.inputState[action] = true;
                this.activeKeys.add(event.key);
            }
        }
    }
    /**
     * Handle key up events
     */ handleKeyUp(event) {
        const action = this.keyMap.get(event.key);
        if (action) {
            event.preventDefault();
            this.inputState[action] = false;
            this.activeKeys.delete(event.key);
        }
    }
    /**
     * Handle pointer down (mouse/touch)
     */ handlePointerDown(event) {
        event.preventDefault();
        this.inputState.jump = true;
    }
    /**
     * Handle pointer up (mouse/touch)
     */ handlePointerUp(event) {
        event.preventDefault();
        this.inputState.jump = false;
    }
    /**
     * Get the current input state
     */ getInputState() {
        return {
            ...this.inputState
        };
    }
    /**
     * Check if a specific action is active
     */ isActionActive(action) {
        return this.inputState[action];
    }
    /**
     * Reset all input states
     */ reset() {
        this.inputState.jump = false;
        this.inputState.restart = false;
        this.inputState.pause = false;
        this.activeKeys.clear();
    }
    /**
     * Consume an action (set it to false after reading)
     * Useful for single-press actions like restart and pause
     */ consumeAction(action) {
        const value = this.inputState[action];
        if (value) {
            this.inputState[action] = false;
        }
        return value;
    }
    /**
     * Clean up event listeners (call when destroying the game)
     */ destroy() {
        window.removeEventListener('keydown', this.handleKeyDown.bind(this));
        window.removeEventListener('keyup', this.handleKeyUp.bind(this));
        window.removeEventListener('mousedown', this.handlePointerDown.bind(this));
        window.removeEventListener('mouseup', this.handlePointerUp.bind(this));
        window.removeEventListener('touchstart', this.handlePointerDown.bind(this));
        window.removeEventListener('touchend', this.handlePointerUp.bind(this));
    }
}
exports.InputHandler = InputHandler; //# sourceMappingURL=InputHandler.js.map
}),
"[project]/packages/game-engine/dist/engine/GameEngine.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GameEngine = void 0;
// Main game engine with game loop and state management
const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
const PhysicsEngine_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/engine/PhysicsEngine.js [app-ssr] (ecmascript)");
const CollisionDetection_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/engine/CollisionDetection.js [app-ssr] (ecmascript)");
const InputHandler_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/engine/InputHandler.js [app-ssr] (ecmascript)");
class GameEngine {
    constructor(initialLevel, config){
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        this.isRunning = false;
        this.config = config;
        this.physicsEngine = new PhysicsEngine_1.PhysicsEngine(config.physicsConfig);
        this.inputHandler = new InputHandler_1.InputHandler();
        // Initialize game state
        this.gameState = this.createInitialState(initialLevel);
    }
    /**
     * Create initial game state
     */ createInitialState(level) {
        const player = {
            id: 'player',
            position: {
                x: 100,
                y: this.config.canvasHeight - 150
            },
            velocity: {
                x: this.config.playerSpeed,
                y: 0
            },
            size: {
                x: 30,
                y: 30
            },
            type: types_1.GameObjectType.PLAYER,
            active: true,
            isJumping: false,
            isOnGround: false,
            health: 1,
            score: 0
        };
        return {
            player,
            currentLevel: level,
            currentSegmentIndex: 0,
            gameObjects: this.loadVisibleObjects(level, 0),
            cameraOffset: 0,
            isPaused: false,
            isGameOver: false,
            score: 0,
            elapsedTime: 0
        };
    }
    /**
     * Load game objects that are currently visible or near the player
     */ loadVisibleObjects(level, cameraOffset) {
        const loadDistance = this.config.canvasWidth * 2; // Load objects 2 screens ahead
        const objects = [];
        for (const segment of level.segments){
            // Check if segment is in visible range
            if (segment.startX + segment.length >= cameraOffset && segment.startX <= cameraOffset + loadDistance) {
                objects.push(...segment.objects.filter((obj)=>obj.active));
            }
        }
        return objects;
    }
    /**
     * Start the game loop
     */ start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.gameLoop(this.lastFrameTime);
    }
    /**
     * Stop the game loop
     */ stop() {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    /**
     * Main game loop using requestAnimationFrame
     */ gameLoop(currentTime) {
        if (!this.isRunning) return;
        // Calculate delta time (in seconds)
        const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1); // Cap at 100ms
        this.lastFrameTime = currentTime;
        // Update game state
        this.update(deltaTime);
        // Render
        if (this.onRenderCallback) {
            this.onRenderCallback(this.gameState);
        }
        // Request next frame
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    }
    update(deltaTime) {
        if (this.gameState.isGameOver) return;
        // CRITICAL: Floor clamp FIRST - fix any bad state from previous frame immediately
        const player = this.gameState.player;
        const playerBottom = player.position.y + player.size.y;
        if (playerBottom > GameEngine.GROUND_Y) {
            player.position.y = GameEngine.GROUND_Y - player.size.y;
            player.velocity.y = 0;
            player.isOnGround = true;
            player.isJumping = false;
        }
        // Handle input
        this.handleInput();
        if (this.gameState.isPaused) return;
        this.gameState.elapsedTime += deltaTime;
        // Update player physics - include OBSTACLE_BLOCK so player can land on top of blocks
        const levelPlatforms = this.gameState.gameObjects.filter((obj)=>(obj.type === types_1.GameObjectType.PLATFORM || obj.type === types_1.GameObjectType.OBSTACLE_BLOCK) && obj.active);
        // Permanent safety floor - prevents falling through (never unloaded, spans entire level)
        const safetyFloor = {
            id: '__safety_floor__',
            position: {
                x: -5000,
                y: GameEngine.GROUND_Y
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 20000,
                y: 50
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        };
        const platforms = [
            safetyFloor,
            ...levelPlatforms
        ];
        // floorY = ground surface - player bottom clamped to never go below this
        this.physicsEngine.updatePlayer(this.gameState.player, platforms, deltaTime, GameEngine.GROUND_Y);
        // Maintain player's forward speed
        this.physicsEngine.setPlayerRunSpeed(this.gameState.player, this.config.playerSpeed);
        // Update camera to follow player
        this.updateCamera();
        // Load/unload objects based on camera position
        this.updateVisibleObjects();
        // Check collisions
        this.checkCollisions();
        // Check out of bounds - only die from going off left or above; never from falling
        // Final floor clamp (belt and suspenders)
        if (player.position.y + player.size.y > GameEngine.GROUND_Y) {
            player.position.y = GameEngine.GROUND_Y - player.size.y;
            player.velocity.y = 0;
            player.isOnGround = true;
            player.isJumping = false;
        }
        // Only trigger game over for left/above bounds, not falling
        if (player.position.x + player.size.x < 0 || player.position.y + player.size.y < 0) {
            this.handleGameOver();
        }
        // Update score
        if (this.gameState.player.score !== this.gameState.score) {
            this.gameState.score = this.gameState.player.score;
            if (this.onScoreUpdateCallback) {
                this.onScoreUpdateCallback(this.gameState.score);
            }
        }
    }
    /**
     * Handle player input
     */ handleInput() {
        const input = this.inputHandler.getInputState();
        // Jump
        if (input.jump) {
            this.physicsEngine.jump(this.gameState.player);
        }
        // Restart
        if (this.inputHandler.consumeAction('restart')) {
            this.restart();
        }
        // Pause
        if (this.inputHandler.consumeAction('pause')) {
            this.togglePause();
        }
    }
    /**
     * Update camera position to follow player
     */ updateCamera() {
        const playerScreenX = this.gameState.player.position.x - this.gameState.cameraOffset;
        const targetScreenX = this.config.canvasWidth * 0.3; // Keep player at 30% of screen width
        if (playerScreenX > targetScreenX) {
            this.gameState.cameraOffset += playerScreenX - targetScreenX;
        }
    }
    /**
     * Update visible objects based on camera position
     */ updateVisibleObjects() {
        const loadDistance = this.config.canvasWidth * 2;
        const unloadDistance = -this.config.canvasWidth;
        // Remove objects that are too far behind (never unload floor/platforms - prevents fall-through)
        this.gameState.gameObjects = this.gameState.gameObjects.filter((obj)=>{
            if (obj.type === types_1.GameObjectType.PLATFORM) return true; // Always keep platforms
            const relativeX = obj.position.x - this.gameState.cameraOffset;
            return relativeX > unloadDistance;
        });
        // Load new objects ahead
        const existingIds = new Set(this.gameState.gameObjects.map((obj)=>obj.id));
        const newObjects = this.loadVisibleObjects(this.gameState.currentLevel, this.gameState.cameraOffset).filter((obj)=>!existingIds.has(obj.id));
        this.gameState.gameObjects.push(...newObjects);
    }
    /**
     * Check and handle collisions
     */ checkCollisions() {
        const collisions = CollisionDetection_1.CollisionDetection.findCollisions(this.gameState.player, this.gameState.gameObjects);
        for (const obj of collisions){
            const isFatal = this.physicsEngine.handlePlayerCollision(this.gameState.player, obj);
            if (isFatal) {
                this.handleGameOver();
                break;
            }
        }
    }
    /**
     * Handle game over
     */ handleGameOver() {
        this.gameState.isGameOver = true;
        this.gameState.player.health = 0;
        if (this.onGameOverCallback) {
            this.onGameOverCallback(this.gameState.score);
        }
    }
    /**
     * Restart the game
     */ restart() {
        this.gameState = this.createInitialState(this.gameState.currentLevel);
        this.inputHandler.reset();
    }
    /**
     * Toggle pause state
     */ togglePause() {
        this.gameState.isPaused = !this.gameState.isPaused;
    }
    /**
     * Pause the game
     */ pause() {
        this.gameState.isPaused = true;
    }
    /**
     * Resume the game
     */ resume() {
        this.gameState.isPaused = false;
    }
    /**
     * Get current game state (immutable copy)
     */ getState() {
        return JSON.parse(JSON.stringify(this.gameState));
    }
    /**
     * Set render callback
     */ onRender(callback) {
        this.onRenderCallback = callback;
    }
    /**
     * Set game over callback
     */ onGameOver(callback) {
        this.onGameOverCallback = callback;
    }
    /**
     * Set score update callback
     */ onScoreUpdate(callback) {
        this.onScoreUpdateCallback = callback;
    }
    /**
     * Load a new level
     */ loadLevel(level) {
        this.stop();
        this.gameState = this.createInitialState(level);
        this.start();
    }
    /**
     * Clean up resources
     */ destroy() {
        this.stop();
        this.inputHandler.destroy();
    }
}
exports.GameEngine = GameEngine;
/**
 * Update game state
 */ /** Ground surface Y - player bottom must never go below this. Matches level design. */ GameEngine.GROUND_Y = 500; //# sourceMappingURL=GameEngine.js.map
}),
"[project]/packages/game-engine/dist/engine/index.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InputHandler = exports.CollisionDetection = exports.PhysicsEngine = exports.GameEngine = void 0;
// Game Engine Module Exports
var GameEngine_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/engine/GameEngine.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "GameEngine", {
    enumerable: true,
    get: function() {
        return GameEngine_1.GameEngine;
    }
});
var PhysicsEngine_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/engine/PhysicsEngine.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "PhysicsEngine", {
    enumerable: true,
    get: function() {
        return PhysicsEngine_1.PhysicsEngine;
    }
});
var CollisionDetection_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/engine/CollisionDetection.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "CollisionDetection", {
    enumerable: true,
    get: function() {
        return CollisionDetection_1.CollisionDetection;
    }
});
var InputHandler_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/engine/InputHandler.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "InputHandler", {
    enumerable: true,
    get: function() {
        return InputHandler_1.InputHandler;
    }
}); //# sourceMappingURL=index.js.map
}),
"[project]/packages/game-engine/dist/systems/Renderer.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// Core rendering system for the Geometry Dash clone
// Handles canvas drawing, camera, and visual effects
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Renderer = void 0;
const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
class Renderer {
    constructor(config){
        // Background parallax layers
        this.starsImage = null;
        this.cloudsImage = null;
        this.backgroundOffset = 0;
        // Color palette - Geometry Dash inspired with HackIllinois purple theme
        this.colors = {
            sky: '#1a1033',
            skyGradientTop: '#2d1b4e',
            skyGradientBottom: '#1a1033',
            ground: '#6b46c1',
            groundDark: '#553c9a',
            player: '#00f2ff',
            playerGlow: '#00d4ff',
            obstacle: '#ff006e',
            obstacleGlow: '#ff1a7f',
            platform: '#8b5cf6',
            platformGlow: '#a78bfa',
            collectible: '#fbbf24',
            portal: '#8b5cf6',
            particle: '#ffffff',
            star: '#ffefcf'
        };
        this.canvas = config.canvas;
        this.width = config.width;
        this.height = config.height;
        this.pixelRatio = config.pixelRatio || window.devicePixelRatio || 1;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D rendering context');
        }
        this.ctx = ctx;
        this.setupCanvas();
        this.loadBackgroundAssets();
    }
    setupCanvas() {
        // Set canvas size accounting for device pixel ratio
        this.canvas.width = this.width * this.pixelRatio;
        this.canvas.height = this.height * this.pixelRatio;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        // Scale context to match device pixel ratio
        this.ctx.scale(this.pixelRatio, this.pixelRatio);
        // Enable image smoothing for better quality
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }
    loadBackgroundAssets() {
        // Load stars
        this.starsImage = new Image();
        this.starsImage.src = '/assets/stars.svg';
        // Load clouds
        this.cloudsImage = new Image();
        this.cloudsImage.src = '/assets/clouds.svg';
    }
    render(gameState) {
        // Clear canvas
        this.clear();
        // Update background offset for parallax effect
        this.backgroundOffset = gameState.cameraOffset;
        // Draw layers from back to front
        this.drawBackground();
        this.drawParallaxStars(gameState.cameraOffset);
        this.drawParallaxClouds(gameState.cameraOffset);
        this.drawGround(gameState.cameraOffset);
        // Draw game objects relative to camera
        this.drawGameObjects(gameState);
        this.drawPlayer(gameState.player, gameState.cameraOffset);
    }
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }
    drawBackground() {
        // Gradient sky background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, this.colors.skyGradientTop);
        gradient.addColorStop(1, this.colors.skyGradientBottom);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    drawParallaxStars(cameraOffset) {
        if (!this.starsImage || !this.starsImage.complete) return;
        // Parallax speed - slower than camera (depth effect)
        const parallaxSpeed = 0.2;
        const offset = -(cameraOffset * parallaxSpeed) % this.starsImage.width;
        this.ctx.globalAlpha = 0.7;
        // Draw stars tiled across the screen
        for(let x = offset - this.starsImage.width; x < this.width; x += this.starsImage.width){
            this.ctx.drawImage(this.starsImage, x, 0, this.starsImage.width, this.starsImage.height);
        }
        this.ctx.globalAlpha = 1.0;
    }
    drawParallaxClouds(cameraOffset) {
        if (!this.cloudsImage || !this.cloudsImage.complete) return;
        // Parallax speed - medium speed for mid-ground
        const parallaxSpeed = 0.4;
        const offset = -(cameraOffset * parallaxSpeed) % this.cloudsImage.width;
        this.ctx.globalAlpha = 0.5;
        // Draw clouds tiled across the screen
        for(let x = offset - this.cloudsImage.width; x < this.width; x += this.cloudsImage.width){
            this.ctx.drawImage(this.cloudsImage, x, this.height * 0.15, this.cloudsImage.width, this.cloudsImage.height * 0.6 // Scale down height
            );
        }
        this.ctx.globalAlpha = 1.0;
    }
    drawGround(cameraOffset) {
        const groundHeight = 100;
        const groundY = this.height - groundHeight;
        // Draw ground with pattern
        this.ctx.fillStyle = this.colors.ground;
        this.ctx.fillRect(0, groundY, this.width, groundHeight);
        // Add grid pattern to ground
        this.ctx.strokeStyle = this.colors.groundDark;
        this.ctx.lineWidth = 2;
        const gridSize = 50;
        const offset = cameraOffset % gridSize;
        // Vertical lines
        for(let x = -offset; x < this.width; x += gridSize){
            this.ctx.beginPath();
            this.ctx.moveTo(x, groundY);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        // Horizontal lines
        for(let y = groundY; y < this.height; y += gridSize){
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
        // Top border glow
        this.ctx.strokeStyle = this.colors.platformGlow;
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.colors.platformGlow;
        this.ctx.beginPath();
        this.ctx.moveTo(0, groundY);
        this.ctx.lineTo(this.width, groundY);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }
    drawGameObjects(gameState) {
        const { gameObjects, cameraOffset } = gameState;
        gameObjects.forEach((obj)=>{
            if (!obj.active) return;
            // Only draw objects that are visible on screen
            const screenX = obj.position.x - cameraOffset;
            if (screenX < -obj.size.x - 100 || screenX > this.width + 100) {
                return;
            }
            switch(obj.type){
                case types_1.GameObjectType.OBSTACLE_SPIKE:
                case types_1.GameObjectType.OBSTACLE_BLOCK:
                    this.drawObstacle(obj, cameraOffset);
                    break;
                case types_1.GameObjectType.PLATFORM:
                    this.drawPlatform(obj, cameraOffset);
                    break;
                case types_1.GameObjectType.COLLECTIBLE:
                    this.drawCollectible(obj, cameraOffset);
                    break;
                case types_1.GameObjectType.PORTAL:
                    this.drawPortal(obj, cameraOffset);
                    break;
            }
        });
    }
    drawPlayer(player, cameraOffset) {
        const screenX = player.position.x - cameraOffset;
        const screenY = player.position.y;
        this.ctx.save();
        // Translate to player position
        this.ctx.translate(screenX + player.size.x / 2, screenY + player.size.y / 2);
        // Rotate based on velocity (adds dynamic feel)
        const rotation = player.velocity.y * 0.05;
        this.ctx.rotate(rotation);
        // Draw glow effect
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = this.colors.playerGlow;
        // Draw player as cube (Geometry Dash style)
        this.ctx.fillStyle = this.colors.player;
        this.ctx.fillRect(-player.size.x / 2, -player.size.y / 2, player.size.x, player.size.y);
        // Draw inner detail
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(-player.size.x / 2 + 5, -player.size.y / 2 + 5, player.size.x - 10, player.size.y - 10);
        // Draw border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-player.size.x / 2, -player.size.y / 2, player.size.x, player.size.y);
        this.ctx.restore();
        // Draw trail effect when moving fast
        if (Math.abs(player.velocity.x) > 3) {
            this.drawPlayerTrail(screenX, screenY, player.size);
        }
    }
    drawPlayerTrail(x, y, size) {
        const trailLength = 3;
        for(let i = 0; i < trailLength; i++){
            const alpha = 0.2 - i * 0.05;
            const offset = (i + 1) * 10;
            this.ctx.fillStyle = `rgba(0, 242, 255, ${alpha})`;
            this.ctx.fillRect(x - offset, y, size.x, size.y);
        }
    }
    drawObstacle(obstacle, cameraOffset) {
        const screenX = obstacle.position.x - cameraOffset;
        const screenY = obstacle.position.y;
        this.ctx.save();
        if (obstacle.type === types_1.GameObjectType.OBSTACLE_SPIKE) {
            this.drawSpike(screenX, screenY, obstacle.size);
        } else {
            this.drawBlock(screenX, screenY, obstacle.size);
        }
        this.ctx.restore();
    }
    drawSpike(x, y, size) {
        // Draw glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.colors.obstacleGlow;
        // Draw triangle spike
        this.ctx.fillStyle = this.colors.obstacle;
        this.ctx.beginPath();
        this.ctx.moveTo(x + size.x / 2, y); // Top point
        this.ctx.lineTo(x + size.x, y + size.y); // Bottom right
        this.ctx.lineTo(x, y + size.y); // Bottom left
        this.ctx.closePath();
        this.ctx.fill();
        // Draw border
        this.ctx.strokeStyle = '#ff3399';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }
    drawBlock(x, y, size) {
        // Draw glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.colors.obstacleGlow;
        // Draw block
        this.ctx.fillStyle = this.colors.obstacle;
        this.ctx.fillRect(x, y, size.x, size.y);
        // Draw pattern
        this.ctx.strokeStyle = '#ff3399';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + size.x, y + size.y);
        this.ctx.moveTo(x + size.x, y);
        this.ctx.lineTo(x, y + size.y);
        this.ctx.stroke();
        // Draw border
        this.ctx.strokeRect(x, y, size.x, size.y);
        this.ctx.shadowBlur = 0;
    }
    drawPlatform(platform, cameraOffset) {
        const screenX = platform.position.x - cameraOffset;
        const screenY = platform.position.y;
        // Draw glow
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = this.colors.platformGlow;
        // Draw platform
        this.ctx.fillStyle = this.colors.platform;
        this.ctx.fillRect(screenX, screenY, platform.width, platform.size.y);
        // Draw top highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.fillRect(screenX, screenY, platform.width, 5);
        // Draw border
        this.ctx.strokeStyle = this.colors.platformGlow;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(screenX, screenY, platform.width, platform.size.y);
        this.ctx.shadowBlur = 0;
    }
    drawCollectible(obj, cameraOffset) {
        const screenX = obj.position.x - cameraOffset;
        const screenY = obj.position.y;
        const centerX = screenX + obj.size.x / 2;
        const centerY = screenY + obj.size.y / 2;
        const radius = obj.size.x / 2;
        // Pulsing effect
        const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 1;
        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        this.ctx.scale(pulse, pulse);
        // Draw glow
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = this.colors.collectible;
        // Draw star/coin
        this.ctx.fillStyle = this.colors.collectible;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fill();
        // Draw inner detail
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        this.ctx.shadowBlur = 0;
    }
    drawPortal(obj, cameraOffset) {
        const screenX = obj.position.x - cameraOffset;
        const screenY = obj.position.y;
        // Animated portal effect
        const time = Date.now() * 0.001;
        this.ctx.save();
        // Draw outer glow
        this.ctx.shadowBlur = 30;
        this.ctx.shadowColor = this.colors.portal;
        // Draw portal frame
        this.ctx.strokeStyle = this.colors.portal;
        this.ctx.lineWidth = 5;
        this.ctx.strokeRect(screenX, screenY, obj.size.x, obj.size.y);
        // Draw animated swirl inside
        this.ctx.globalAlpha = 0.5;
        const centerX = screenX + obj.size.x / 2;
        const centerY = screenY + obj.size.y / 2;
        for(let i = 0; i < 3; i++){
            const angle = time + i * Math.PI * 2 / 3;
            const x = centerX + Math.cos(angle) * 15;
            const y = centerY + Math.sin(angle) * 15;
            this.ctx.fillStyle = this.colors.portal;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
        this.ctx.shadowBlur = 0;
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.setupCanvas();
    }
    destroy() {
        // Cleanup if needed
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
exports.Renderer = Renderer; //# sourceMappingURL=Renderer.js.map
}),
"[project]/packages/game-engine/dist/systems/index.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// Main exports for game systems
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Renderer = void 0;
var Renderer_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/systems/Renderer.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "Renderer", {
    enumerable: true,
    get: function() {
        return Renderer_1.Renderer;
    }
}); //# sourceMappingURL=index.js.map
}),
"[project]/packages/game-engine/dist/levels/SegmentTemplates.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * Segment Templates - Reusable level segment patterns
 *
 * These templates serve dual purposes:
 * 1. Procedural generation building blocks
 * 2. Training data for ML models to learn obstacle patterns
 *
 * ML Integration Notes:
 * - Each template is encoded with numerical features that ML models can learn
 * - Templates can be used to generate synthetic training data
 * - Feature vectors can be extracted for supervised/reinforcement learning
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.TEMPLATE_REGISTRY = exports.EXTREME_CHALLENGE = exports.MIXED_OBSTACLES = exports.PLATFORM_JUMPS = exports.SPIKE_RHYTHM = exports.STAIRCASE_BLOCKS = exports.SIMPLE_GAP = exports.FLAT_GROUND_SPIKE = void 0;
exports.getAllTemplates = getAllTemplates;
exports.getTemplatesByDifficulty = getTemplatesByDifficulty;
exports.extractFeatureVector = extractFeatureVector;
exports.generateTrainingData = generateTrainingData;
const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
/**
 * Generate a unique ID for game objects
 */ function generateId(prefix, index, seed) {
    return `${prefix}_${seed}_${index}_${Date.now()}`;
}
/**
 * Seeded random number generator (for reproducibility)
 */ class SeededRandom {
    constructor(seed){
        this.seed = seed;
    }
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    range(min, max) {
        return min + this.next() * (max - min);
    }
    integer(min, max) {
        return Math.floor(this.range(min, max + 1));
    }
}
// ============================================================================
// BASIC TEMPLATES (Difficulty 0.1 - 0.3)
// ============================================================================
exports.FLAT_GROUND_SPIKE = {
    name: 'flat_ground_spike',
    difficulty: 0.1,
    length: 100,
    features: {
        difficulty: 0.1,
        density: 0.3,
        verticalComplexity: 0.1,
        gapFrequency: 0,
        platformRatio: 1.0,
        obstacleTypes: [
            1,
            0,
            0
        ],
        rhythmPattern: [
            0,
            0,
            1,
            0,
            0,
            1
        ]
    },
    generator: (startX, seed)=>{
        const rng = new SeededRandom(seed);
        const objects = [];
        const groundY = 500;
        const segmentLength = 100;
        // Ground platform
        objects.push({
            id: generateId('platform', 0, seed),
            position: {
                x: startX,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: segmentLength,
                y: 20
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        });
        // Simple spike pattern
        const spikePositions = [
            30,
            60
        ];
        spikePositions.forEach((offset, idx)=>{
            objects.push({
                id: generateId('spike', idx, seed),
                position: {
                    x: startX + offset,
                    y: groundY - 20
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: 15,
                    y: 20
                },
                type: types_1.GameObjectType.OBSTACLE_SPIKE,
                active: true
            });
        });
        return objects;
    }
};
exports.SIMPLE_GAP = {
    name: 'simple_gap',
    difficulty: 0.2,
    length: 120,
    features: {
        difficulty: 0.2,
        density: 0.1,
        verticalComplexity: 0.2,
        gapFrequency: 1,
        platformRatio: 0.7,
        obstacleTypes: [
            0,
            0,
            1
        ],
        rhythmPattern: [
            1,
            0,
            0,
            0,
            1
        ]
    },
    generator: (startX, seed)=>{
        const objects = [];
        const groundY = 500;
        const gapWidth = 40;
        const platformWidth = 40;
        // Left platform
        objects.push({
            id: generateId('platform', 0, seed),
            position: {
                x: startX,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: platformWidth,
                y: 20
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        });
        // Right platform
        objects.push({
            id: generateId('platform', 1, seed),
            position: {
                x: startX + platformWidth + gapWidth,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: platformWidth,
                y: 20
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        });
        return objects;
    }
};
// ============================================================================
// INTERMEDIATE TEMPLATES (Difficulty 0.4 - 0.6)
// ============================================================================
exports.STAIRCASE_BLOCKS = {
    name: 'staircase_blocks',
    difficulty: 0.4,
    length: 150,
    features: {
        difficulty: 0.4,
        density: 0.5,
        verticalComplexity: 0.6,
        gapFrequency: 0,
        platformRatio: 0.8,
        obstacleTypes: [
            0,
            1,
            0
        ],
        rhythmPattern: [
            1,
            1,
            1,
            1,
            1
        ]
    },
    generator: (startX, seed)=>{
        const objects = [];
        const groundY = 500;
        const blockSize = 30;
        const steps = 5;
        // Ground platform
        objects.push({
            id: generateId('platform', 0, seed),
            position: {
                x: startX,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 150,
                y: 20
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        });
        // Staircase blocks
        for(let i = 0; i < steps; i++){
            objects.push({
                id: generateId('block', i, seed),
                position: {
                    x: startX + 20 + i * blockSize,
                    y: groundY - 20 - (i + 1) * blockSize
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: blockSize,
                    y: blockSize
                },
                type: types_1.GameObjectType.OBSTACLE_BLOCK,
                active: true
            });
        }
        return objects;
    }
};
exports.SPIKE_RHYTHM = {
    name: 'spike_rhythm',
    difficulty: 0.5,
    length: 160,
    features: {
        difficulty: 0.5,
        density: 0.7,
        verticalComplexity: 0.3,
        gapFrequency: 0,
        platformRatio: 1.0,
        obstacleTypes: [
            1,
            0,
            0
        ],
        rhythmPattern: [
            1,
            0,
            1,
            1,
            0,
            1
        ]
    },
    generator: (startX, seed)=>{
        const rng = new SeededRandom(seed);
        const objects = [];
        const groundY = 500;
        // Ground platform
        objects.push({
            id: generateId('platform', 0, seed),
            position: {
                x: startX,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 160,
                y: 20
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        });
        // Rhythmic spike pattern - short-short-long pattern
        const pattern = [
            20,
            40,
            60,
            80,
            120,
            140
        ];
        pattern.forEach((offset, idx)=>{
            objects.push({
                id: generateId('spike', idx, seed),
                position: {
                    x: startX + offset,
                    y: groundY - 20
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: 15,
                    y: 20
                },
                type: types_1.GameObjectType.OBSTACLE_SPIKE,
                active: true
            });
        });
        return objects;
    }
};
exports.PLATFORM_JUMPS = {
    name: 'platform_jumps',
    difficulty: 0.6,
    length: 180,
    features: {
        difficulty: 0.6,
        density: 0.4,
        verticalComplexity: 0.7,
        gapFrequency: 3,
        platformRatio: 0.5,
        obstacleTypes: [
            0,
            0,
            1
        ],
        rhythmPattern: [
            1,
            0,
            0,
            1,
            0,
            0
        ]
    },
    generator: (startX, seed)=>{
        const rng = new SeededRandom(seed);
        const objects = [];
        const groundY = 500;
        // Multiple platforms at varying heights
        const platforms = [
            {
                x: 0,
                y: 0,
                width: 40
            },
            {
                x: 60,
                y: -30,
                width: 30
            },
            {
                x: 110,
                y: -60,
                width: 35
            },
            {
                x: 160,
                y: -30,
                width: 40
            }
        ];
        platforms.forEach((plat, idx)=>{
            objects.push({
                id: generateId('platform', idx, seed),
                position: {
                    x: startX + plat.x,
                    y: groundY + plat.y
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: plat.width,
                    y: 20
                },
                type: types_1.GameObjectType.PLATFORM,
                active: true
            });
            // Add spike on some platforms
            if (rng.next() > 0.5) {
                objects.push({
                    id: generateId('spike', idx, seed),
                    position: {
                        x: startX + plat.x + plat.width / 2,
                        y: groundY + plat.y - 20
                    },
                    velocity: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 15,
                        y: 20
                    },
                    type: types_1.GameObjectType.OBSTACLE_SPIKE,
                    active: true
                });
            }
        });
        return objects;
    }
};
// ============================================================================
// ADVANCED TEMPLATES (Difficulty 0.7 - 1.0)
// ============================================================================
exports.MIXED_OBSTACLES = {
    name: 'mixed_obstacles',
    difficulty: 0.7,
    length: 200,
    features: {
        difficulty: 0.7,
        density: 0.8,
        verticalComplexity: 0.8,
        gapFrequency: 2,
        platformRatio: 0.6,
        obstacleTypes: [
            0.5,
            0.5,
            0.3
        ],
        rhythmPattern: [
            1,
            1,
            0,
            1,
            0,
            1
        ]
    },
    generator: (startX, seed)=>{
        const rng = new SeededRandom(seed);
        const objects = [];
        const groundY = 500;
        // Main platform
        objects.push({
            id: generateId('platform', 0, seed),
            position: {
                x: startX,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 80,
                y: 20
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        });
        // Blocks and spikes on ground
        objects.push({
            id: generateId('block', 0, seed),
            position: {
                x: startX + 30,
                y: groundY - 20
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 25,
                y: 25
            },
            type: types_1.GameObjectType.OBSTACLE_BLOCK,
            active: true
        });
        objects.push({
            id: generateId('spike', 0, seed),
            position: {
                x: startX + 60,
                y: groundY - 20
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 15,
                y: 20
            },
            type: types_1.GameObjectType.OBSTACLE_SPIKE,
            active: true
        });
        // Gap
        // Elevated platform
        objects.push({
            id: generateId('platform', 1, seed),
            position: {
                x: startX + 120,
                y: groundY - 40
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 50,
                y: 20
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        });
        // Spike on elevated platform
        objects.push({
            id: generateId('spike', 1, seed),
            position: {
                x: startX + 145,
                y: groundY - 60
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 15,
                y: 20
            },
            type: types_1.GameObjectType.OBSTACLE_SPIKE,
            active: true
        });
        // Final platform
        objects.push({
            id: generateId('platform', 2, seed),
            position: {
                x: startX + 180,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 50,
                y: 20
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true
        });
        return objects;
    }
};
exports.EXTREME_CHALLENGE = {
    name: 'extreme_challenge',
    difficulty: 0.9,
    length: 250,
    features: {
        difficulty: 0.9,
        density: 1.0,
        verticalComplexity: 1.0,
        gapFrequency: 4,
        platformRatio: 0.4,
        obstacleTypes: [
            0.7,
            0.6,
            0.5
        ],
        rhythmPattern: [
            1,
            1,
            1,
            0,
            1,
            1
        ]
    },
    generator: (startX, seed)=>{
        const rng = new SeededRandom(seed);
        const objects = [];
        const groundY = 500;
        // Create a complex multi-level challenge
        const platformConfigs = [
            {
                x: 0,
                y: 0,
                width: 30,
                hasSpike: false,
                hasBlock: true
            },
            {
                x: 50,
                y: -50,
                width: 25,
                hasSpike: true,
                hasBlock: false
            },
            {
                x: 95,
                y: -100,
                width: 20,
                hasSpike: true,
                hasBlock: false
            },
            {
                x: 135,
                y: -70,
                width: 25,
                hasSpike: false,
                hasBlock: true
            },
            {
                x: 180,
                y: -40,
                width: 30,
                hasSpike: true,
                hasBlock: false
            },
            {
                x: 230,
                y: 0,
                width: 35,
                hasSpike: false,
                hasBlock: false
            }
        ];
        platformConfigs.forEach((config, idx)=>{
            // Platform
            objects.push({
                id: generateId('platform', idx, seed),
                position: {
                    x: startX + config.x,
                    y: groundY + config.y
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: config.width,
                    y: 20
                },
                type: types_1.GameObjectType.PLATFORM,
                active: true
            });
            // Spike
            if (config.hasSpike) {
                objects.push({
                    id: generateId('spike', idx, seed),
                    position: {
                        x: startX + config.x + config.width / 2,
                        y: groundY + config.y - 20
                    },
                    velocity: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 15,
                        y: 20
                    },
                    type: types_1.GameObjectType.OBSTACLE_SPIKE,
                    active: true
                });
            }
            // Block
            if (config.hasBlock) {
                objects.push({
                    id: generateId('block', idx, seed),
                    position: {
                        x: startX + config.x + 5,
                        y: groundY + config.y - 25
                    },
                    velocity: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 20,
                        y: 25
                    },
                    type: types_1.GameObjectType.OBSTACLE_BLOCK,
                    active: true
                });
            }
        });
        return objects;
    }
};
// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================
/**
 * All available templates organized by difficulty
 * ML models can use this for training data generation
 */ exports.TEMPLATE_REGISTRY = {
    easy: [
        exports.FLAT_GROUND_SPIKE,
        exports.SIMPLE_GAP
    ],
    medium: [
        exports.STAIRCASE_BLOCKS,
        exports.SPIKE_RHYTHM,
        exports.PLATFORM_JUMPS
    ],
    hard: [
        exports.MIXED_OBSTACLES
    ],
    extreme: [
        exports.EXTREME_CHALLENGE
    ]
};
/**
 * Get all templates as a flat array
 */ function getAllTemplates() {
    return [
        ...exports.TEMPLATE_REGISTRY.easy,
        ...exports.TEMPLATE_REGISTRY.medium,
        ...exports.TEMPLATE_REGISTRY.hard,
        ...exports.TEMPLATE_REGISTRY.extreme
    ];
}
/**
 * Get templates filtered by difficulty range
 */ function getTemplatesByDifficulty(minDiff, maxDiff) {
    return getAllTemplates().filter((t)=>t.difficulty >= minDiff && t.difficulty <= maxDiff);
}
/**
 * Extract feature vector from a template (for ML training)
 * Returns a normalized feature array that can be fed to ML models
 */ function extractFeatureVector(template) {
    const features = template.features;
    return [
        features.difficulty,
        features.density,
        features.verticalComplexity,
        features.gapFrequency,
        features.platformRatio,
        ...features.obstacleTypes,
        ...features.rhythmPattern
    ];
}
/**
 * Generate synthetic training data from templates
 * Useful for creating datasets for ML model training
 */ function generateTrainingData(template, numSamples) {
    const samples = [];
    for(let i = 0; i < numSamples; i++){
        samples.push({
            features: extractFeatureVector(template),
            template: template.name
        });
    }
    return samples;
} //# sourceMappingURL=SegmentTemplates.js.map
}),
"[project]/packages/game-engine/dist/levels/ProceduralGenerator.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * Procedural Generator - Algorithm-based level generation
 *
 * This module contains procedural algorithms for generating levels.
 * In the ML-ready architecture, these algorithms serve as:
 * 1. Baseline generation methods
 * 2. Fallback when ML models are unavailable
 * 3. Data augmentation for ML training
 *
 * The procedural approach uses mathematical rules and randomness,
 * while ML approaches will learn patterns from data.
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ProceduralGenerator = exports.WaveBasedStrategy = exports.NoiseBasedStrategy = exports.TemplateBasedStrategy = exports.SeededRandom = void 0;
exports.applyConstraints = applyConstraints;
exports.analyzeSegmentDifficulty = analyzeSegmentDifficulty;
const SegmentTemplates_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/levels/SegmentTemplates.js [app-ssr] (ecmascript)");
/**
 * Seeded random number generator for reproducible generation
 */ class SeededRandom {
    constructor(seed){
        this.seed = seed;
    }
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    range(min, max) {
        return min + this.next() * (max - min);
    }
    integer(min, max) {
        return Math.floor(this.range(min, max + 1));
    }
    choice(array) {
        return array[this.integer(0, array.length - 1)];
    }
}
exports.SeededRandom = SeededRandom;
/**
 * Template-based generation strategy
 * Selects and chains pre-made templates based on difficulty
 */ class TemplateBasedStrategy {
    constructor(){
        this.name = 'template_based';
    }
    generate(config, rng) {
        const segments = [];
        let currentX = 0;
        const targetLength = config.length;
        // Calculate difficulty variance (allows some easier/harder sections)
        const difficultyVariance = 0.2;
        while(currentX < targetLength){
            // Sample difficulty with some variance for variety
            const segmentDifficulty = Math.max(0, Math.min(1, config.difficulty + rng.range(-difficultyVariance, difficultyVariance)));
            // Get appropriate templates for this difficulty
            const minDiff = Math.max(0, segmentDifficulty - 0.2);
            const maxDiff = Math.min(1, segmentDifficulty + 0.2);
            const suitableTemplates = (0, SegmentTemplates_1.getTemplatesByDifficulty)(minDiff, maxDiff);
            if (suitableTemplates.length === 0) {
                // Fallback to all templates if no suitable ones found
                const template = rng.choice((0, SegmentTemplates_1.getAllTemplates)());
                const segment = this.createSegmentFromTemplate(template, currentX, rng.integer(0, 1000000));
                segments.push(segment);
                currentX += segment.length;
            } else {
                // Choose a random suitable template
                const template = rng.choice(suitableTemplates);
                const segment = this.createSegmentFromTemplate(template, currentX, rng.integer(0, 1000000));
                segments.push(segment);
                currentX += segment.length;
            }
        }
        return segments;
    }
    createSegmentFromTemplate(template, startX, seed) {
        return {
            id: `segment_${seed}_${startX}`,
            startX,
            length: template.length,
            difficulty: template.difficulty,
            objects: template.generator(startX, seed),
            metadata: {
                templateName: template.name,
                generationMethod: 'template_based',
                features: template.features
            }
        };
    }
}
exports.TemplateBasedStrategy = TemplateBasedStrategy;
/**
 * Noise-based procedural generation
 * Uses mathematical noise functions to create organic patterns
 * This simulates what an ML model might learn - continuous patterns
 */ class NoiseBasedStrategy {
    constructor(){
        this.name = 'noise_based';
    }
    generate(config, rng) {
        const segments = [];
        const segmentLength = 150;
        const numSegments = Math.ceil(config.length / segmentLength);
        for(let i = 0; i < numSegments; i++){
            const startX = i * segmentLength;
            const segment = this.generateNoiseSegment(startX, segmentLength, config, rng, i);
            segments.push(segment);
        }
        return segments;
    }
    generateNoiseSegment(startX, length, config, rng, index) {
        const objects = [];
        const groundY = 500;
        // Create base platform
        objects.push({
            id: `platform_noise_${index}_${startX}`,
            position: {
                x: startX,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: length,
                y: 20
            },
            type: 'platform',
            active: true
        });
        // Use perlin-like noise to determine obstacle placement
        const obstacleCount = Math.floor(config.difficulty * 10 + rng.range(0, 3));
        for(let j = 0; j < obstacleCount; j++){
            const xOffset = j / obstacleCount * length + rng.range(-10, 10);
            const noiseValue = this.noise(startX + xOffset, index);
            // Decide obstacle type based on noise value
            if (noiseValue < 0.33) {
                // Spike
                objects.push({
                    id: `spike_noise_${index}_${j}`,
                    position: {
                        x: startX + xOffset,
                        y: groundY - 20
                    },
                    velocity: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 15,
                        y: 20
                    },
                    type: 'obstacle_spike',
                    active: true
                });
            } else if (noiseValue < 0.66) {
                // Block
                const blockHeight = 20 + config.difficulty * 30;
                objects.push({
                    id: `block_noise_${index}_${j}`,
                    position: {
                        x: startX + xOffset,
                        y: groundY - blockHeight
                    },
                    velocity: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 25,
                        y: blockHeight
                    },
                    type: 'obstacle_block',
                    active: true
                });
            }
        // else: gap (no obstacle)
        }
        // Calculate feature metrics for this segment
        const spikeCount = objects.filter((o)=>o.type === 'obstacle_spike').length;
        const blockCount = objects.filter((o)=>o.type === 'obstacle_block').length;
        const density = (spikeCount + blockCount) / length;
        return {
            id: `segment_noise_${index}_${startX}`,
            startX,
            length,
            difficulty: config.difficulty,
            objects,
            metadata: {
                generationMethod: 'noise_based',
                features: {
                    difficulty: config.difficulty,
                    density,
                    verticalComplexity: config.difficulty * 0.6,
                    gapFrequency: 0,
                    platformRatio: 1.0,
                    obstacleTypes: [
                        spikeCount / 10,
                        blockCount / 10,
                        0
                    ]
                }
            }
        };
    }
    /**
     * Simple noise function (simplified Perlin noise)
     * Returns value between 0 and 1
     */ noise(x, seed) {
        const n = Math.sin(x * 0.01 + seed) * Math.cos(x * 0.02 - seed);
        return (n + 1) / 2; // Normalize to 0-1
    }
}
exports.NoiseBasedStrategy = NoiseBasedStrategy;
/**
 * Wave-based generation strategy
 * Creates rhythmic patterns similar to music-synced levels
 */ class WaveBasedStrategy {
    constructor(){
        this.name = 'wave_based';
    }
    generate(config, rng) {
        const segments = [];
        const segmentLength = 120;
        const numSegments = Math.ceil(config.length / segmentLength);
        // Define wave parameters based on difficulty
        const frequency = 0.5 + config.difficulty * 1.5; // Higher difficulty = higher frequency
        const amplitude = config.difficulty;
        for(let i = 0; i < numSegments; i++){
            const startX = i * segmentLength;
            const segment = this.generateWaveSegment(startX, segmentLength, frequency, amplitude, i, rng);
            segments.push(segment);
        }
        return segments;
    }
    generateWaveSegment(startX, length, frequency, amplitude, index, rng) {
        const objects = [];
        const groundY = 500;
        // Base platform
        objects.push({
            id: `platform_wave_${index}_${startX}`,
            position: {
                x: startX,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: length,
                y: 20
            },
            type: 'platform',
            active: true
        });
        // Generate obstacles in wave pattern
        const obstacleSpacing = 20;
        const numObstacles = Math.floor(length / obstacleSpacing);
        for(let i = 0; i < numObstacles; i++){
            const xOffset = i * obstacleSpacing;
            const waveValue = Math.sin((startX + xOffset) * frequency * 0.01);
            // Wave determines if obstacle appears (threshold based on amplitude)
            if (Math.abs(waveValue) > 1 - amplitude) {
                const obstacleType = waveValue > 0 ? 'spike' : 'block';
                if (obstacleType === 'spike') {
                    objects.push({
                        id: `spike_wave_${index}_${i}`,
                        position: {
                            x: startX + xOffset,
                            y: groundY - 20
                        },
                        velocity: {
                            x: 0,
                            y: 0
                        },
                        size: {
                            x: 15,
                            y: 20
                        },
                        type: 'obstacle_spike',
                        active: true
                    });
                } else {
                    objects.push({
                        id: `block_wave_${index}_${i}`,
                        position: {
                            x: startX + xOffset,
                            y: groundY - 25
                        },
                        velocity: {
                            x: 0,
                            y: 0
                        },
                        size: {
                            x: 20,
                            y: 25
                        },
                        type: 'obstacle_block',
                        active: true
                    });
                }
            }
        }
        return {
            id: `segment_wave_${index}_${startX}`,
            startX,
            length,
            difficulty: amplitude,
            objects,
            metadata: {
                generationMethod: 'wave_based',
                waveFrequency: frequency,
                waveAmplitude: amplitude
            }
        };
    }
}
exports.WaveBasedStrategy = WaveBasedStrategy;
/**
 * Main procedural generator class
 * Coordinates different generation strategies
 */ class ProceduralGenerator {
    constructor(){
        this.strategies = new Map();
        this.registerStrategy(new TemplateBasedStrategy());
        this.registerStrategy(new NoiseBasedStrategy());
        this.registerStrategy(new WaveBasedStrategy());
    }
    /**
     * Register a new generation strategy
     */ registerStrategy(strategy) {
        this.strategies.set(strategy.name, strategy);
    }
    /**
     * Generate level segments using specified strategy
     */ generate(config, strategyName = 'template_based') {
        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
            throw new Error(`Unknown generation strategy: ${strategyName}`);
        }
        const seed = config.seed ?? Math.floor(Math.random() * 1000000);
        const rng = new SeededRandom(seed);
        return strategy.generate(config, rng);
    }
    /**
     * Generate using multiple strategies and blend results
     * This creates more diverse levels by mixing approaches
     */ generateBlended(config, strategyWeights = {
        template_based: 0.7,
        noise_based: 0.2,
        wave_based: 0.1
    }) {
        const seed = config.seed ?? Math.floor(Math.random() * 1000000);
        const rng = new SeededRandom(seed);
        // Determine which strategy to use for each segment based on weights
        const totalWeight = Object.values(strategyWeights).reduce((a, b)=>a + b, 0);
        const normalizedWeights = Object.entries(strategyWeights).map(([name, weight])=>({
                name,
                weight: weight / totalWeight
            }));
        // Calculate cumulative probabilities
        let cumulative = 0;
        const strategyRanges = normalizedWeights.map(({ name, weight })=>{
            const start = cumulative;
            cumulative += weight;
            return {
                name,
                start,
                end: cumulative
            };
        });
        // Select strategy based on random value
        const random = rng.next();
        const selectedStrategy = strategyRanges.find((range)=>random >= range.start && random < range.end);
        if (!selectedStrategy) {
            // Fallback to template_based
            return this.generate(config, 'template_based');
        }
        return this.generate(config, selectedStrategy.name);
    }
    /**
     * Get list of available strategies
     */ getAvailableStrategies() {
        return Array.from(this.strategies.keys());
    }
}
exports.ProceduralGenerator = ProceduralGenerator;
/**
 * Utility functions for procedural generation
 */ /**
 * Apply constraints to generated segments
 * Ensures generated content respects physical limits
 */ function applyConstraints(segments, constraints) {
    if (!constraints) return segments;
    return segments.map((segment)=>({
            ...segment,
            objects: segment.objects.filter((obj)=>{
                // Filter by max obstacle height
                if (constraints.maxObstacleHeight && (obj.type === 'obstacle_block' || obj.type === 'obstacle_spike')) {
                    if (obj.size.y > constraints.maxObstacleHeight) {
                        return false;
                    }
                }
                // Filter by min platform width
                if (constraints.minPlatformWidth && obj.type === 'platform') {
                    if (obj.size.x < constraints.minPlatformWidth) {
                        return false;
                    }
                }
                return true;
            })
        }));
}
/**
 * Analyze segment difficulty based on object patterns
 * This can be used to validate generated content
 */ function analyzeSegmentDifficulty(segment) {
    const objects = segment.objects;
    const spikeCount = objects.filter((o)=>o.type === 'obstacle_spike').length;
    const blockCount = objects.filter((o)=>o.type === 'obstacle_block').length;
    const platformCount = objects.filter((o)=>o.type === 'platform').length;
    // Calculate metrics
    const obstacleDensity = (spikeCount + blockCount) / segment.length;
    const platformCoverage = platformCount > 0 ? 1 : 0;
    // Weighted difficulty score
    const difficulty = obstacleDensity * 0.6 + (1 - platformCoverage) * 0.2 + blockCount / Math.max(spikeCount + blockCount, 1) * 0.2;
    return Math.min(1, difficulty);
} //# sourceMappingURL=ProceduralGenerator.js.map
}),
"[project]/packages/game-engine/dist/levels/LevelGenerator.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * LevelGenerator - ML-Ready Level Generation System
 *
 * ARCHITECTURE OVERVIEW:
 * ======================
 * This is the main interface for level generation with a pluggable architecture
 * that supports both procedural algorithms and ML models.
 *
 * DESIGN PRINCIPLES:
 * 1. Strategy Pattern: Different generation methods (procedural, ML) implement
 *    a common interface
 * 2. Feature Extraction: All generated content includes numerical features that
 *    ML models can learn from
 * 3. Reproducibility: Seed-based generation ensures consistent outputs
 * 4. Modularity: Easy to swap procedural generation with ML models
 *
 * ML INTEGRATION ROADMAP:
 * =======================
 * Phase 1 (Current): Procedural generation with feature extraction
 * Phase 2: Collect gameplay data (player actions, success/failure, time)
 * Phase 3: Train ML models on collected data
 * Phase 4: Deploy ML models alongside procedural generation
 * Phase 5: A/B test and gradually replace procedural with ML
 *
 * SUPPORTED ML APPROACHES:
 * ========================
 * 1. Supervised Learning:
 *    - Input: difficulty, style, player skill level
 *    - Output: segment features (density, complexity, obstacle types)
 *    - Model: Neural network regression
 *
 * 2. Reinforcement Learning:
 *    - Agent learns to generate segments that match target difficulty
 *    - Reward: based on player completion rate, engagement time
 *    - Model: PPO or DQN
 *
 * 3. Generative Models:
 *    - VAE/GAN for generating novel segment patterns
 *    - Input: latent vector + difficulty
 *    - Output: segment structure
 *
 * 4. Sequence Models:
 *    - LSTM/Transformer to generate coherent sequences of segments
 *    - Learns temporal patterns and difficulty curves
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.StubMLModel = exports.LevelGenerator = void 0;
const ProceduralGenerator_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/levels/ProceduralGenerator.js [app-ssr] (ecmascript)");
/**
 * Main LevelGenerator class with ML-ready architecture
 */ class LevelGenerator {
    constructor(){
        this.proceduralGenerator = new ProceduralGenerator_1.ProceduralGenerator();
        this.mlModel = null;
        this.trainingData = [];
    }
    // ============================================================================
    // PUBLIC API - Level Generation
    // ============================================================================
    /**
     * Generate a complete level using current best method
     * Automatically chooses between procedural and ML if available
     */ generate(config) {
        const generationMethod = this.selectGenerationMethod(config);
        let segments;
        if (generationMethod === 'ml' && this.mlModel) {
            segments = this.generateWithML(config);
        } else {
            segments = this.generateProcedural(config);
        }
        // Apply constraints if specified
        if (config.constraints) {
            segments = (0, ProceduralGenerator_1.applyConstraints)(segments, config.constraints);
        }
        // Post-process segments
        segments = this.postProcessSegments(segments, config);
        // Create level object
        const level = {
            id: this.generateLevelId(config),
            name: this.generateLevelName(config),
            segments,
            totalLength: segments.reduce((sum, seg)=>sum + seg.length, 0),
            difficulty: config.difficulty,
            generatedBy: generationMethod,
            mlModelVersion: this.mlModel?.getVersion()
        };
        // Record for training if enabled
        if (this.isTrainingEnabled()) {
            this.recordGenerationForTraining(config, level);
        }
        return level;
    }
    /**
     * Generate level using procedural algorithms
     * This is the baseline/fallback method
     */ generateProcedural(config) {
        // Choose strategy based on style
        const strategy = this.selectProceduralStrategy(config.style);
        return this.proceduralGenerator.generate(config, strategy);
    }
    /**
     * Generate level using ML model
     *
     * HOW TO INTEGRATE YOUR ML MODEL:
     * ================================
     * 1. Implement the MLModelInterface (see below)
     * 2. Load your trained model in the implementation
     * 3. Register it: levelGenerator.setMLModel(yourModel)
     * 4. The generator will automatically use it when available
     *
     * EXAMPLE ML MODEL INTEGRATION:
     * ```typescript
     * class MyMLModel implements MLModelInterface {
     *   async predict(config: LevelGeneratorConfig): Promise<MLModelOutput> {
     *     // 1. Prepare input features
     *     const input = [
     *       config.difficulty,
     *       config.style === 'classic' ? 1 : 0,
     *       config.style === 'modern' ? 1 : 0,
     *       config.style === 'extreme' ? 1 : 0,
     *     ];
     *
     *     // 2. Call your ML model (TensorFlow.js, ONNX, API, etc.)
     *     const output = await this.model.predict(input);
     *
     *     // 3. Return structured output
     *     return {
     *       features: {
     *         difficulty: output[0],
     *         density: output[1],
     *         verticalComplexity: output[2],
     *         gapFrequency: output[3],
     *         platformRatio: output[4],
     *         obstacleTypes: [output[5], output[6], output[7]],
     *       },
     *     };
     *   }
     * }
     *
     * const model = new MyMLModel();
     * await model.load('/models/level-generator-v1.onnx');
     * levelGenerator.setMLModel(model);
     * ```
     */ generateWithML(config) {
        if (!this.mlModel) {
            console.warn('ML model not available, falling back to procedural');
            return this.generateProcedural(config);
        }
        const segments = [];
        const segmentLength = 150;
        const numSegments = Math.ceil(config.length / segmentLength);
        const seed = config.seed ?? Math.floor(Math.random() * 1000000);
        for(let i = 0; i < numSegments; i++){
            const startX = i * segmentLength;
            // Call ML model for this segment
            const modelOutput = this.mlModel.predictSync({
                difficulty: config.difficulty,
                segmentIndex: i,
                totalSegments: numSegments,
                previousSegmentFeatures: i > 0 ? this.extractSegmentFeatures(segments[i - 1]) : undefined,
                style: config.style
            });
            // Convert ML output to actual segment
            const segment = this.convertMLOutputToSegment(modelOutput, startX, segmentLength, seed + i);
            segments.push(segment);
        }
        return segments;
    }
    /**
     * Hybrid generation: Use ML for some segments, procedural for others
     * Useful for A/B testing and gradual ML rollout
     */ generateHybrid(config, mlRatio = 0.5) {
        if (!this.mlModel) {
            return this.generateProcedural(config);
        }
        const seed = config.seed ?? Math.floor(Math.random() * 1000000);
        const rng = new ProceduralGenerator_1.SeededRandom(seed);
        const segmentLength = 150;
        const numSegments = Math.ceil(config.length / segmentLength);
        const segments = [];
        for(let i = 0; i < numSegments; i++){
            const startX = i * segmentLength;
            // Randomly choose between ML and procedural
            const useML = rng.next() < mlRatio;
            if (useML) {
                const modelOutput = this.mlModel.predictSync({
                    difficulty: config.difficulty,
                    segmentIndex: i,
                    totalSegments: numSegments,
                    style: config.style
                });
                const segment = this.convertMLOutputToSegment(modelOutput, startX, segmentLength, seed + i);
                segments.push(segment);
            } else {
                const proceduralSegments = this.proceduralGenerator.generate({
                    ...config,
                    length: segmentLength,
                    seed: seed + i
                }, 'template_based');
                segments.push(...proceduralSegments);
            }
        }
        return segments;
    }
    // ============================================================================
    // ML MODEL MANAGEMENT
    // ============================================================================
    /**
     * Register an ML model for level generation
     */ setMLModel(model) {
        this.mlModel = model;
        console.log(`ML model registered: ${model.getVersion()}`);
    }
    /**
     * Remove ML model (fall back to procedural)
     */ removeMLModel() {
        this.mlModel = null;
    }
    /**
     * Check if ML model is available
     */ hasMLModel() {
        return this.mlModel !== null;
    }
    // ============================================================================
    // TRAINING DATA COLLECTION
    // ============================================================================
    /**
     * Enable training data collection
     * Call this to start recording generated levels for ML training
     */ enableTraining() {
        this.trainingData = [];
    }
    /**
     * Get collected training data
     */ getTrainingData() {
        return this.trainingData;
    }
    /**
     * Export training data to JSON for ML training pipeline
     */ exportTrainingData() {
        return JSON.stringify(this.trainingData, null, 2);
    }
    /**
     * Record gameplay metrics for a level (for reinforcement learning)
     */ recordGameplayMetrics(levelId, metrics) {
        // Find corresponding training example and update metrics
        const example = this.trainingData.find((ex)=>ex.levelId === levelId);
        if (example) {
            example.metrics = {
                playerCompleted: metrics.completed,
                attempts: metrics.attempts,
                completionTime: metrics.completionTime,
                deathPositions: metrics.deathPositions
            };
        }
    }
    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================
    selectGenerationMethod(config) {
        // Use ML if available and not explicitly disabled
        if (this.mlModel && !config.forceProceduralMode) {
            return 'ml';
        }
        return 'procedural';
    }
    selectProceduralStrategy(style) {
        switch(style){
            case 'classic':
                return 'template_based';
            case 'modern':
                return 'noise_based';
            case 'extreme':
                return 'wave_based';
            default:
                return 'template_based';
        }
    }
    postProcessSegments(segments, config) {
        // Validate and adjust difficulty
        return segments.map((segment)=>({
                ...segment,
                difficulty: this.validateDifficulty(segment.difficulty, config.difficulty)
            }));
    }
    validateDifficulty(segmentDifficulty, targetDifficulty) {
        // Ensure segment difficulty is within reasonable range of target
        const maxDeviation = 0.3;
        const minDiff = Math.max(0, targetDifficulty - maxDeviation);
        const maxDiff = Math.min(1, targetDifficulty + maxDeviation);
        return Math.max(minDiff, Math.min(maxDiff, segmentDifficulty));
    }
    convertMLOutputToSegment(mlOutput, startX, length, seed) {
        const objects = [];
        const groundY = 500;
        // If model provides direct obstacle predictions, use them
        if (mlOutput.obstacles && mlOutput.obstacles.length > 0) {
            mlOutput.obstacles.forEach((obstacle, idx)=>{
                objects.push({
                    id: `ml_${obstacle.type}_${seed}_${idx}`,
                    position: {
                        x: startX + obstacle.x * length,
                        y: groundY + obstacle.y
                    },
                    velocity: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: obstacle.type === 'spike' ? 15 : 25,
                        y: obstacle.type === 'spike' ? 20 : 25
                    },
                    type: `obstacle_${obstacle.type}`,
                    active: true
                });
            });
        } else {
            // Otherwise, use features to procedurally generate with ML guidance
            objects.push(...this.generateFromFeatures(mlOutput.features, startX, length, seed));
        }
        return {
            id: `segment_ml_${seed}_${startX}`,
            startX,
            length,
            difficulty: mlOutput.features.difficulty,
            objects,
            metadata: {
                generationMethod: 'ml',
                modelVersion: mlOutput.modelVersion,
                confidence: mlOutput.confidence,
                features: mlOutput.features
            }
        };
    }
    generateFromFeatures(features, startX, length, seed) {
        const objects = [];
        const groundY = 500;
        const rng = new ProceduralGenerator_1.SeededRandom(seed);
        // Create base platform
        objects.push({
            id: `platform_ml_${seed}`,
            position: {
                x: startX,
                y: groundY
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: length,
                y: 20
            },
            type: 'platform',
            active: true
        });
        // Generate obstacles based on ML-predicted features
        const numObstacles = Math.floor(features.density * length);
        for(let i = 0; i < numObstacles; i++){
            const xPos = startX + i / numObstacles * length + rng.range(-10, 10);
            // Choose obstacle type based on predicted distribution
            const typeRand = rng.next();
            const [spikeProb, blockProb] = features.obstacleTypes;
            if (typeRand < spikeProb) {
                objects.push({
                    id: `spike_ml_${seed}_${i}`,
                    position: {
                        x: xPos,
                        y: groundY - 20
                    },
                    velocity: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 15,
                        y: 20
                    },
                    type: 'obstacle_spike',
                    active: true
                });
            } else if (typeRand < spikeProb + blockProb) {
                const height = 20 + features.verticalComplexity * 40;
                objects.push({
                    id: `block_ml_${seed}_${i}`,
                    position: {
                        x: xPos,
                        y: groundY - height
                    },
                    velocity: {
                        x: 0,
                        y: 0
                    },
                    size: {
                        x: 25,
                        y: height
                    },
                    type: 'obstacle_block',
                    active: true
                });
            }
        }
        return objects;
    }
    extractSegmentFeatures(segment) {
        if (segment.metadata?.features) {
            const f = segment.metadata.features;
            return [
                f.difficulty || 0,
                f.density || 0,
                f.verticalComplexity || 0,
                f.gapFrequency || 0,
                f.platformRatio || 0,
                ...f.obstacleTypes || [
                    0,
                    0,
                    0
                ]
            ];
        }
        // Fallback: analyze segment if features not available
        return [
            (0, ProceduralGenerator_1.analyzeSegmentDifficulty)(segment),
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ];
    }
    generateLevelId(config) {
        const timestamp = Date.now();
        const seed = config.seed ?? 0;
        return `level_${timestamp}_${seed}`;
    }
    generateLevelName(config) {
        const difficultyName = this.getDifficultyName(config.difficulty);
        const styleName = config.style || 'classic';
        return `${styleName.charAt(0).toUpperCase() + styleName.slice(1)} ${difficultyName}`;
    }
    getDifficultyName(difficulty) {
        if (difficulty < 0.2) return 'Easy';
        if (difficulty < 0.4) return 'Normal';
        if (difficulty < 0.6) return 'Hard';
        if (difficulty < 0.8) return 'Expert';
        return 'Extreme';
    }
    isTrainingEnabled() {
        return this.trainingData !== null;
    }
    recordGenerationForTraining(config, level) {
        level.segments.forEach((segment, idx)=>{
            const example = {
                input: {
                    targetDifficulty: config.difficulty,
                    segmentIndex: idx,
                    previousSegmentFeatures: idx > 0 ? this.extractSegmentFeatures(level.segments[idx - 1]) : undefined,
                    style: config.style
                },
                output: {
                    segmentFeatures: this.extractSegmentFeatures(segment),
                    objects: segment.objects.map((obj)=>({
                            type: obj.type,
                            x: obj.position.x,
                            y: obj.position.y,
                            width: obj.size.x,
                            height: obj.size.y
                        }))
                }
            };
            this.trainingData.push(example);
        });
    }
}
exports.LevelGenerator = LevelGenerator;
/**
 * Example stub ML model for testing
 * Replace this with your actual ML implementation
 */ class StubMLModel {
    constructor(){
        this.version = 'stub-v1.0.0';
        this.rng = new ProceduralGenerator_1.SeededRandom(12345);
    }
    predictSync(input) {
        // Stub: just return features based on input difficulty
        return {
            features: {
                difficulty: input.difficulty,
                density: input.difficulty * 0.8,
                verticalComplexity: input.difficulty * 0.6,
                gapFrequency: Math.floor(input.difficulty * 3),
                platformRatio: 1 - input.difficulty * 0.3,
                obstacleTypes: [
                    input.difficulty * 0.6,
                    input.difficulty * 0.4,
                    input.difficulty * 0.2
                ]
            },
            modelVersion: this.version,
            confidence: 0.75,
            latencyMs: 5
        };
    }
    async predict(input) {
        return this.predictSync(input);
    }
    async load(modelPath) {
        console.log(`Stub model loaded from ${modelPath}`);
    }
    getVersion() {
        return this.version;
    }
    getMetadata() {
        return {
            architecture: 'stub',
            trainedOn: 'synthetic',
            accuracy: 0.75,
            avgLatency: 5
        };
    }
}
exports.StubMLModel = StubMLModel; //# sourceMappingURL=LevelGenerator.js.map
}),
"[project]/packages/game-engine/dist/levels/TestLevel.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createTestLevel = createTestLevel;
// Simple test level for Geometry Dash clone
const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
function createTestLevel() {
    const platforms = [];
    const obstacles = [];
    // GROUND LEVEL: y = 500 (player can stand here)
    // PLAYER: 30px tall, stands at y = 470 when on ground
    // MAX JUMP HEIGHT: ~100px, can reach y = 370
    // Single solid floor - no gaps, no seams, impossible to fall through
    platforms.push({
        id: 'solid-floor',
        position: {
            x: 0,
            y: 500
        },
        velocity: {
            x: 0,
            y: 0
        },
        size: {
            x: 6000,
            y: 50
        },
        type: types_1.GameObjectType.PLATFORM,
        active: true,
        width: 6000
    });
    // DIFFICULTY PROGRESSION: Easy → Medium → Hard
    // SECTION 1: Easy (x: 0-1500) - Single obstacles, well spaced
    const easySpikes = [
        500,
        800
    ];
    easySpikes.forEach((x, i)=>{
        obstacles.push({
            id: `easy-spike-${i}`,
            position: {
                x,
                y: 470
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 30,
                y: 30
            },
            type: types_1.GameObjectType.OBSTACLE_SPIKE,
            active: true,
            damage: 1
        });
    });
    // SECTION 2: Medium (x: 1500-3500) - Closer spacing, some blocks
    const mediumSpikes = [
        1700,
        1950,
        2300
    ];
    mediumSpikes.forEach((x, i)=>{
        obstacles.push({
            id: `medium-spike-${i}`,
            position: {
                x,
                y: 470
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 30,
                y: 30
            },
            type: types_1.GameObjectType.OBSTACLE_SPIKE,
            active: true,
            damage: 1
        });
    });
    const mediumBlocks = [
        {
            x: 2100,
            y: 450
        },
        {
            x: 2800,
            y: 445
        }
    ];
    mediumBlocks.forEach((pos, i)=>{
        obstacles.push({
            id: `medium-block-${i}`,
            position: pos,
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 50,
                y: 50
            },
            type: types_1.GameObjectType.OBSTACLE_BLOCK,
            active: true,
            damage: 1
        });
    });
    // SECTION 3: Hard (x: 3300+) - More spread out after ~11 second mark
    const hardSpikes = [
        3600,
        4200,
        4800,
        5400,
        6000
    ];
    hardSpikes.forEach((x, i)=>{
        obstacles.push({
            id: `hard-spike-${i}`,
            position: {
                x,
                y: 470
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 30,
                y: 30
            },
            type: types_1.GameObjectType.OBSTACLE_SPIKE,
            active: true,
            damage: 1
        });
    });
    const hardBlocks = [
        {
            x: 3900,
            y: 445
        },
        {
            x: 4500,
            y: 440
        },
        {
            x: 5100,
            y: 445
        },
        {
            x: 5700,
            y: 450
        }
    ];
    hardBlocks.forEach((pos, i)=>{
        obstacles.push({
            id: `hard-block-${i}`,
            position: pos,
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 50,
                y: 50
            },
            type: types_1.GameObjectType.OBSTACLE_BLOCK,
            active: true,
            damage: 1
        });
    });
    // Add some elevated platforms for variety (all reachable with jumps)
    const elevatedPlatforms = [
        {
            x: 650,
            y: 410
        },
        {
            x: 1900,
            y: 400
        },
        {
            x: 3200,
            y: 415
        },
        {
            x: 4600,
            y: 405
        }
    ];
    elevatedPlatforms.forEach((pos, i)=>{
        platforms.push({
            id: `elevated-${i}`,
            position: pos,
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 140,
                y: 25
            },
            type: types_1.GameObjectType.PLATFORM,
            active: true,
            width: 140
        });
    });
    const allObjects = [
        ...platforms,
        ...obstacles
    ];
    const segment = {
        id: 'segment-1',
        startX: 0,
        length: 6000,
        difficulty: 0.5,
        objects: allObjects
    };
    return {
        id: 'test-level-1',
        name: 'Test Level',
        segments: [
            segment
        ],
        totalLength: 6000,
        difficulty: 0.5,
        generatedBy: 'manual'
    };
} //# sourceMappingURL=TestLevel.js.map
}),
"[project]/packages/game-engine/dist/levels/InfiniteLevel.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createInfiniteLevel = createInfiniteLevel;
exports.generateInfiniteChunk = generateInfiniteChunk;
/**
 * Infinite Level - Procedurally generates content as the player progresses
 * Solid continuous floor, obstacles (spikes, blocks) generated on demand
 */ const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
const GROUND_Y = 500;
const CHUNK_SIZE = 800;
const INITIAL_LENGTH = 6000;
const FLOOR_EXTENSION = 500000;
function seededRandom(seed) {
    return function next() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}
// 11 seconds at 300px/s = 3300 - significantly more spread out after this
const EASIER_AFTER_X = 3300;
const BLOCK_WIDTH = 50;
const BLOCK_HEIGHTS = [
    50,
    100,
    150
];
function generateChunkObstacles(startX, length, seed) {
    const obstacles = [];
    const rng = seededRandom(seed);
    const isPast11Sec = startX >= EASIER_AFTER_X;
    // After 11 sec: much wider spacing (400-600px between shapes)
    const minSpacing = isPast11Sec ? 400 : 200;
    const maxSpacing = isPast11Sec ? 600 : 320;
    const blockChance = isPast11Sec ? 0.5 : 0.35;
    let x = startX + 80;
    while(x < startX + length - 100){
        const spacing = minSpacing + rng() * (maxSpacing - minSpacing);
        if (rng() < blockChance) {
            const height = BLOCK_HEIGHTS[Math.floor(rng() * 3)];
            obstacles.push({
                id: `inf-block-${startX}-${x}`,
                position: {
                    x,
                    y: GROUND_Y - height
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: BLOCK_WIDTH,
                    y: height
                },
                type: types_1.GameObjectType.OBSTACLE_BLOCK,
                active: true,
                damage: 1
            });
            x += spacing + BLOCK_WIDTH;
        } else {
            obstacles.push({
                id: `inf-spike-${startX}-${x}`,
                position: {
                    x,
                    y: GROUND_Y - 30
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: 30,
                    y: 30
                },
                type: types_1.GameObjectType.OBSTACLE_SPIKE,
                active: true,
                damage: 1
            });
            x += spacing + 30;
        }
    }
    return obstacles;
}
function createInfiniteLevel() {
    const platforms = [];
    const obstacles = [];
    platforms.push({
        id: 'solid-floor',
        position: {
            x: 0,
            y: GROUND_Y
        },
        velocity: {
            x: 0,
            y: 0
        },
        size: {
            x: FLOOR_EXTENSION,
            y: 50
        },
        type: types_1.GameObjectType.PLATFORM,
        active: true,
        width: FLOOR_EXTENSION
    });
    const easySpikes = [
        500,
        950,
        1450,
        2000
    ];
    easySpikes.forEach((x, i)=>{
        obstacles.push({
            id: `easy-spike-${i}`,
            position: {
                x,
                y: GROUND_Y - 30
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 30,
                y: 30
            },
            type: types_1.GameObjectType.OBSTACLE_SPIKE,
            active: true,
            damage: 1
        });
    });
    const blocks = [
        {
            x: 800,
            y: GROUND_Y - 50,
            h: 50
        },
        {
            x: 1300,
            y: GROUND_Y - 100,
            h: 100
        },
        {
            x: 1900,
            y: GROUND_Y - 50,
            h: 50
        },
        {
            x: 2600,
            y: GROUND_Y - 150,
            h: 150
        },
        {
            x: 3300,
            y: GROUND_Y - 100,
            h: 100
        },
        {
            x: 4000,
            y: GROUND_Y - 50,
            h: 50
        },
        {
            x: 4700,
            y: GROUND_Y - 100,
            h: 100
        },
        {
            x: 5400,
            y: GROUND_Y - 50,
            h: 50
        },
        {
            x: 6100,
            y: GROUND_Y - 150,
            h: 150
        },
        {
            x: 6800,
            y: GROUND_Y - 100,
            h: 100
        },
        {
            x: 7500,
            y: GROUND_Y - 50,
            h: 50
        }
    ];
    blocks.forEach((pos, i)=>{
        obstacles.push({
            id: `block-${i}`,
            position: {
                x: pos.x,
                y: pos.y
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 50,
                y: pos.h
            },
            type: types_1.GameObjectType.OBSTACLE_BLOCK,
            active: true,
            damage: 1
        });
    });
    const mediumSpikes = [
        1100,
        1700,
        2400,
        3100,
        3800,
        4500,
        5200,
        5900,
        6600
    ];
    mediumSpikes.forEach((x, i)=>{
        obstacles.push({
            id: `medium-spike-${i}`,
            position: {
                x,
                y: GROUND_Y - 30
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 30,
                y: 30
            },
            type: types_1.GameObjectType.OBSTACLE_SPIKE,
            active: true,
            damage: 1
        });
    });
    const allObjects = [
        ...platforms,
        ...obstacles
    ];
    const segment = {
        id: 'segment-initial',
        startX: 0,
        length: 8000,
        difficulty: 0.5,
        objects: allObjects
    };
    return {
        id: 'infinite-level',
        name: 'Infinite Run',
        segments: [
            segment
        ],
        totalLength: FLOOR_EXTENSION,
        difficulty: 0.5,
        generatedBy: 'procedural'
    };
}
function generateInfiniteChunk(startX, length, seed) {
    return generateChunkObstacles(startX, length, seed);
} //# sourceMappingURL=InfiniteLevel.js.map
}),
"[project]/packages/game-engine/dist/levels/index.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * Level Generation System - Main Exports
 *
 * This module provides a complete, ML-ready level generation system for
 * a Geometry Dash clone.
 *
 * QUICK START:
 * ============
 * ```typescript
 * import { LevelGenerator } from '@/game/levels';
 *
 * const generator = new LevelGenerator();
 *
 * const level = generator.generate({
 *   difficulty: 0.5,
 *   length: 1000,
 *   seed: 12345,
 *   style: 'classic',
 * });
 * ```
 *
 * ARCHITECTURE:
 * =============
 * - LevelGenerator: Main interface, handles both procedural and ML generation
 * - ProceduralGenerator: Algorithm-based generation (baseline)
 * - SegmentTemplates: Reusable building blocks with ML-ready features
 *
 * ML INTEGRATION:
 * ===============
 * 1. Implement MLModelInterface
 * 2. Train your model on collected gameplay data
 * 3. Register: generator.setMLModel(yourModel)
 * 4. Generate: generator.generate(config) - automatically uses ML
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.defaultLevelGenerator = exports.generateTrainingData = exports.extractFeatureVector = exports.getTemplatesByDifficulty = exports.getAllTemplates = exports.TEMPLATE_REGISTRY = exports.EXTREME_CHALLENGE = exports.MIXED_OBSTACLES = exports.PLATFORM_JUMPS = exports.SPIKE_RHYTHM = exports.STAIRCASE_BLOCKS = exports.SIMPLE_GAP = exports.FLAT_GROUND_SPIKE = exports.analyzeSegmentDifficulty = exports.applyConstraints = exports.WaveBasedStrategy = exports.NoiseBasedStrategy = exports.TemplateBasedStrategy = exports.SeededRandom = exports.ProceduralGenerator = exports.generateInfiniteChunk = exports.createInfiniteLevel = exports.createTestLevel = exports.StubMLModel = exports.LevelGenerator = void 0;
exports.createLevelGenerator = createLevelGenerator;
exports.generateLevel = generateLevel;
exports.generateLevelWithML = generateLevelWithML;
exports.generateLevelBatch = generateLevelBatch;
exports.generateDifficultySpectrum = generateDifficultySpectrum;
// ============================================================================
// MAIN GENERATOR
// ============================================================================
var LevelGenerator_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/levels/LevelGenerator.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "LevelGenerator", {
    enumerable: true,
    get: function() {
        return LevelGenerator_1.LevelGenerator;
    }
});
Object.defineProperty(exports, "StubMLModel", {
    enumerable: true,
    get: function() {
        return LevelGenerator_1.StubMLModel;
    }
});
// ============================================================================
// TEST LEVEL
// ============================================================================
var TestLevel_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/levels/TestLevel.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "createTestLevel", {
    enumerable: true,
    get: function() {
        return TestLevel_1.createTestLevel;
    }
});
var InfiniteLevel_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/levels/InfiniteLevel.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "createInfiniteLevel", {
    enumerable: true,
    get: function() {
        return InfiniteLevel_1.createInfiniteLevel;
    }
});
Object.defineProperty(exports, "generateInfiniteChunk", {
    enumerable: true,
    get: function() {
        return InfiniteLevel_1.generateInfiniteChunk;
    }
});
// ============================================================================
// PROCEDURAL GENERATION
// ============================================================================
var ProceduralGenerator_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/levels/ProceduralGenerator.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "ProceduralGenerator", {
    enumerable: true,
    get: function() {
        return ProceduralGenerator_1.ProceduralGenerator;
    }
});
Object.defineProperty(exports, "SeededRandom", {
    enumerable: true,
    get: function() {
        return ProceduralGenerator_1.SeededRandom;
    }
});
Object.defineProperty(exports, "TemplateBasedStrategy", {
    enumerable: true,
    get: function() {
        return ProceduralGenerator_1.TemplateBasedStrategy;
    }
});
Object.defineProperty(exports, "NoiseBasedStrategy", {
    enumerable: true,
    get: function() {
        return ProceduralGenerator_1.NoiseBasedStrategy;
    }
});
Object.defineProperty(exports, "WaveBasedStrategy", {
    enumerable: true,
    get: function() {
        return ProceduralGenerator_1.WaveBasedStrategy;
    }
});
Object.defineProperty(exports, "applyConstraints", {
    enumerable: true,
    get: function() {
        return ProceduralGenerator_1.applyConstraints;
    }
});
Object.defineProperty(exports, "analyzeSegmentDifficulty", {
    enumerable: true,
    get: function() {
        return ProceduralGenerator_1.analyzeSegmentDifficulty;
    }
});
// ============================================================================
// SEGMENT TEMPLATES
// ============================================================================
var SegmentTemplates_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/levels/SegmentTemplates.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "FLAT_GROUND_SPIKE", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.FLAT_GROUND_SPIKE;
    }
});
Object.defineProperty(exports, "SIMPLE_GAP", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.SIMPLE_GAP;
    }
});
Object.defineProperty(exports, "STAIRCASE_BLOCKS", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.STAIRCASE_BLOCKS;
    }
});
Object.defineProperty(exports, "SPIKE_RHYTHM", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.SPIKE_RHYTHM;
    }
});
Object.defineProperty(exports, "PLATFORM_JUMPS", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.PLATFORM_JUMPS;
    }
});
Object.defineProperty(exports, "MIXED_OBSTACLES", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.MIXED_OBSTACLES;
    }
});
Object.defineProperty(exports, "EXTREME_CHALLENGE", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.EXTREME_CHALLENGE;
    }
});
Object.defineProperty(exports, "TEMPLATE_REGISTRY", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.TEMPLATE_REGISTRY;
    }
});
Object.defineProperty(exports, "getAllTemplates", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.getAllTemplates;
    }
});
Object.defineProperty(exports, "getTemplatesByDifficulty", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.getTemplatesByDifficulty;
    }
});
Object.defineProperty(exports, "extractFeatureVector", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.extractFeatureVector;
    }
});
Object.defineProperty(exports, "generateTrainingData", {
    enumerable: true,
    get: function() {
        return SegmentTemplates_1.generateTrainingData;
    }
});
// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================
const LevelGenerator_2 = __turbopack_context__.r("[project]/packages/game-engine/dist/levels/LevelGenerator.js [app-ssr] (ecmascript)");
/**
 * Create a default level generator instance
 */ function createLevelGenerator() {
    return new LevelGenerator_2.LevelGenerator();
}
/**
 * Quick generate function for simple use cases
 */ function generateLevel(difficulty, length, seed) {
    const generator = new LevelGenerator_2.LevelGenerator();
    return generator.generate({
        difficulty,
        length,
        seed,
        style: 'classic'
    });
}
/**
 * Generate a level with ML if model is provided
 */ function generateLevelWithML(config, model) {
    const generator = new LevelGenerator_2.LevelGenerator();
    if (model) {
        generator.setMLModel(model);
    }
    return generator.generate(config);
}
/**
 * Batch generate multiple levels (useful for testing/training data)
 */ function generateLevelBatch(baseConfig, count) {
    const generator = new LevelGenerator_2.LevelGenerator();
    const levels = [];
    for(let i = 0; i < count; i++){
        const config = {
            ...baseConfig,
            seed: (baseConfig.seed ?? 0) + i
        };
        levels.push(generator.generate(config));
    }
    return levels;
}
/**
 * Generate levels across difficulty spectrum (for playtesting)
 */ function generateDifficultySpectrum(length = 1000, steps = 5) {
    const generator = new LevelGenerator_2.LevelGenerator();
    const levels = [];
    for(let i = 0; i < steps; i++){
        const difficulty = i / (steps - 1); // 0.0 to 1.0
        levels.push(generator.generate({
            difficulty,
            length,
            seed: i,
            style: 'classic'
        }));
    }
    return levels;
}
// ============================================================================
// DEFAULT INSTANCE
// ============================================================================
/**
 * Singleton instance for convenience
 * Use this if you don't need multiple generators
 */ exports.defaultLevelGenerator = new LevelGenerator_2.LevelGenerator(); //# sourceMappingURL=index.js.map
}),
"[project]/packages/game-engine/dist/components/GameCanvas.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __createBinding = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importStar || function() {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o) {
            var ar = [];
            for(var k in o)if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
            for(var k = ownKeys(mod), i = 0; i < k.length; i++)if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
    };
}();
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GameCanvas = void 0;
const react_1 = __importStar(__turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)"));
const Renderer_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/systems/Renderer.js [app-ssr] (ecmascript)");
const GameCanvas = ({ gameState, width = 1200, height = 600, className = '' })=>{
    const canvasRef = (0, react_1.useRef)(null);
    const rendererRef = (0, react_1.useRef)(null);
    const animationFrameRef = (0, react_1.useRef)(null);
    // Initialize renderer
    (0, react_1.useEffect)(()=>{
        if (!canvasRef.current) return;
        try {
            rendererRef.current = new Renderer_1.Renderer({
                canvas: canvasRef.current,
                width,
                height
            });
            console.log('Renderer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize renderer:', error);
        }
        return ()=>{
            if (rendererRef.current) {
                rendererRef.current.destroy();
                rendererRef.current = null;
            }
        };
    }, [
        width,
        height
    ]);
    // Handle window resize
    (0, react_1.useEffect)(()=>{
        const handleResize = ()=>{
            if (rendererRef.current) {
                const container = canvasRef.current?.parentElement;
                if (container) {
                    const newWidth = container.clientWidth;
                    const newHeight = container.clientHeight || height;
                    rendererRef.current.resize(newWidth, newHeight);
                }
            }
        };
        window.addEventListener('resize', handleResize);
        return ()=>window.removeEventListener('resize', handleResize);
    }, [
        height
    ]);
    // Render loop
    const render = (0, react_1.useCallback)(()=>{
        if (rendererRef.current && gameState) {
            rendererRef.current.render(gameState);
        }
        // Continue animation loop
        animationFrameRef.current = requestAnimationFrame(render);
    }, [
        gameState
    ]);
    // Start/stop render loop
    (0, react_1.useEffect)(()=>{
        if (!gameState.isPaused) {
            animationFrameRef.current = requestAnimationFrame(render);
        }
        return ()=>{
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [
        render,
        gameState.isPaused
    ]);
    return react_1.default.createElement("canvas", {
        ref: canvasRef,
        className: `game-canvas ${className}`,
        style: {
            display: 'block',
            maxWidth: '100%',
            imageRendering: 'crisp-edges'
        }
    });
};
exports.GameCanvas = GameCanvas; //# sourceMappingURL=GameCanvas.js.map
}),
"[project]/packages/game-engine/dist/components/Player.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PlayerRenderer = exports.Player = void 0;
const react_1 = __importDefault(__turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)"));
/**
 * Player component - Provides React-based utilities for player rendering
 * Note: Actual rendering is done via Canvas in Renderer.ts
 * This component can be used for debugging or CSS-based overlays
 */ const Player = ({ player, cameraOffset })=>{
    // This component is primarily for logical purposes
    // The actual rendering happens in Renderer.ts using Canvas API
    // Can be used for debugging
    if ("TURBOPACK compile-time truthy", 1) {
        return react_1.default.createElement("div", {
            className: "player-debug",
            style: {
                position: 'absolute',
                left: player.position.x - cameraOffset,
                top: player.position.y,
                width: player.size.x,
                height: player.size.y,
                border: '2px dashed rgba(0, 255, 0, 0.3)',
                pointerEvents: 'none',
                display: 'none'
            },
            title: `Player - Health: ${player.health}, Score: ${player.score}`
        });
    }
    //TURBOPACK unreachable
    ;
};
exports.Player = Player;
/**
 * Player rendering utilities for use in Renderer
 */ exports.PlayerRenderer = {
    /**
     * Calculate player rotation based on velocity
     */ getRotation: (player)=>{
        return player.velocity.y * 0.05;
    },
    /**
     * Get player color based on health
     */ getColor: (player)=>{
        if (player.health <= 25) return '#ff0066'; // Low health - red
        if (player.health <= 50) return '#ffaa00'; // Medium health - orange
        return '#00f2ff'; // Full health - cyan
    },
    /**
     * Calculate animation frame based on movement
     */ getAnimationFrame: (player, time)=>{
        const speed = Math.abs(player.velocity.x);
        const frameRate = Math.max(50, 200 - speed * 10);
        return Math.floor(time / frameRate) % 4;
    },
    /**
     * Check if player should show trail effect
     */ shouldShowTrail: (player)=>{
        return Math.abs(player.velocity.x) > 3 || Math.abs(player.velocity.y) > 5;
    },
    /**
     * Get trail particles for player movement
     */ getTrailParticles: (player, count = 3)=>{
        const particles = [];
        for(let i = 0; i < count; i++){
            particles.push({
                x: player.position.x - (i + 1) * 10,
                y: player.position.y + player.size.y / 2,
                alpha: 0.3 - i * 0.1
            });
        }
        return particles;
    }
}; //# sourceMappingURL=Player.js.map
}),
"[project]/packages/game-engine/dist/components/Obstacle.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ObstacleFactory = exports.ObstacleRenderer = exports.Obstacle = void 0;
const react_1 = __importDefault(__turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)"));
const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
/**
 * Obstacle component - Provides React-based utilities for obstacle rendering
 * Note: Actual rendering is done via Canvas in Renderer.ts
 * This component can be used for debugging or CSS-based overlays
 */ const Obstacle = ({ obstacle, cameraOffset })=>{
    // This component is primarily for logical purposes
    // The actual rendering happens in Renderer.ts using Canvas API
    // Can be used for debugging
    if ("TURBOPACK compile-time truthy", 1) {
        return react_1.default.createElement("div", {
            className: "obstacle-debug",
            style: {
                position: 'absolute',
                left: obstacle.position.x - cameraOffset,
                top: obstacle.position.y,
                width: obstacle.size.x,
                height: obstacle.size.y,
                border: '2px dashed rgba(255, 0, 0, 0.3)',
                pointerEvents: 'none',
                display: 'none'
            },
            title: `Obstacle - Type: ${obstacle.type}, Damage: ${obstacle.damage}`
        });
    }
    //TURBOPACK unreachable
    ;
};
exports.Obstacle = Obstacle;
/**
 * Obstacle rendering utilities for use in Renderer
 */ exports.ObstacleRenderer = {
    /**
     * Get spike vertices for drawing triangular spikes
     */ getSpikeVertices: (x, y, width, height)=>{
        return [
            {
                x: x + width / 2,
                y
            },
            {
                x: x + width,
                y: y + height
            },
            {
                x,
                y: y + height
            }
        ];
    },
    /**
     * Get block pattern for drawing decorative patterns
     */ getBlockPattern: (x, y, width, height)=>{
        return [
            {
                from: {
                    x,
                    y
                },
                to: {
                    x: x + width,
                    y: y + height
                }
            },
            {
                from: {
                    x: x + width,
                    y
                },
                to: {
                    x,
                    y: y + height
                }
            }
        ];
    },
    /**
     * Get obstacle color based on type and danger level
     */ getColor: (obstacle)=>{
        const baseDamage = obstacle.damage;
        if (baseDamage >= 100) {
            // Instant kill obstacles
            return {
                fill: '#ff0044',
                glow: '#ff1155',
                border: '#ff3366'
            };
        } else if (baseDamage >= 50) {
            // High damage obstacles
            return {
                fill: '#ff006e',
                glow: '#ff1a7f',
                border: '#ff3399'
            };
        } else {
            // Low damage obstacles
            return {
                fill: '#ff4488',
                glow: '#ff66aa',
                border: '#ff88bb'
            };
        }
    },
    /**
     * Calculate animation offset for moving obstacles
     */ getAnimationOffset: (obstacle, time)=>{
        // Some obstacles could have animated movement
        const shouldAnimate = obstacle.velocity.x !== 0 || obstacle.velocity.y !== 0;
        if (!shouldAnimate) {
            return {
                x: 0,
                y: 0
            };
        }
        return {
            x: Math.sin(time * 0.002) * 5,
            y: Math.cos(time * 0.002) * 5
        };
    },
    /**
     * Get rotation for spinning obstacles
     */ getRotation: (obstacle, time)=>{
        // Spikes don't rotate, blocks can rotate
        if (obstacle.type === types_1.GameObjectType.OBSTACLE_SPIKE) {
            return 0;
        }
        return time * 0.001 % (Math.PI * 2);
    },
    /**
     * Get danger particles around high-damage obstacles
     */ getDangerParticles: (obstacle, time)=>{
        if (obstacle.damage < 75) return [];
        const particles = [];
        const centerX = obstacle.position.x + obstacle.size.x / 2;
        const centerY = obstacle.position.y + obstacle.size.y / 2;
        const particleCount = 6;
        for(let i = 0; i < particleCount; i++){
            const angle = (time * 0.002 + i * Math.PI * 2 / particleCount) % (Math.PI * 2);
            const radius = 30 + Math.sin(time * 0.003) * 10;
            particles.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                size: 3 + Math.sin(time * 0.004 + i) * 1,
                alpha: 0.5 + Math.sin(time * 0.003 + i) * 0.3
            });
        }
        return particles;
    },
    /**
     * Get warning indicator for upcoming obstacles
     */ shouldShowWarning: (obstacle, playerX)=>{
        const distance = obstacle.position.x - playerX;
        return distance > 0 && distance < 300 && obstacle.damage >= 50;
    },
    /**
     * Get scale multiplier for pulsing effect
     */ getPulseScale: (time, speed = 0.003)=>{
        return 1 + Math.sin(time * speed) * 0.1;
    }
};
/**
 * Factory functions for creating different obstacle types
 */ exports.ObstacleFactory = {
    /**
     * Create a spike obstacle
     */ createSpike: (x, y, damage = 100)=>{
        return {
            id: `spike_${Date.now()}_${Math.random()}`,
            position: {
                x,
                y
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 40,
                y: 40
            },
            type: types_1.GameObjectType.OBSTACLE_SPIKE,
            active: true,
            damage
        };
    },
    /**
     * Create a block obstacle
     */ createBlock: (x, y, damage = 50)=>{
        return {
            id: `block_${Date.now()}_${Math.random()}`,
            position: {
                x,
                y
            },
            velocity: {
                x: 0,
                y: 0
            },
            size: {
                x: 50,
                y: 50
            },
            type: types_1.GameObjectType.OBSTACLE_BLOCK,
            active: true,
            damage
        };
    },
    /**
     * Create a moving block obstacle
     */ createMovingBlock: (x, y, velocityX = 2, damage = 50)=>{
        return {
            id: `moving_block_${Date.now()}_${Math.random()}`,
            position: {
                x,
                y
            },
            velocity: {
                x: velocityX,
                y: 0
            },
            size: {
                x: 50,
                y: 50
            },
            type: types_1.GameObjectType.OBSTACLE_BLOCK,
            active: true,
            damage
        };
    }
}; //# sourceMappingURL=Obstacle.js.map
}),
"[project]/packages/game-engine/dist/components/UI/GameUI.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GameUI = void 0;
const react_1 = __importDefault(__turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)"));
const GameUI = ({ gameState, onRestart, onPause, onResume })=>{
    const { player, isPaused, isGameOver, score } = gameState;
    return react_1.default.createElement("div", {
        className: "game-ui absolute inset-0 pointer-events-none"
    }, react_1.default.createElement("div", {
        className: "top-hud absolute top-0 left-0 right-0 p-6 flex justify-between items-start"
    }, react_1.default.createElement("div", {
        className: "score-display pointer-events-auto"
    }, react_1.default.createElement("div", {
        className: "bg-gradient-to-r from-purple-900/80 to-purple-800/80 backdrop-blur-sm rounded-lg px-6 py-3 border-2 border-purple-400/50 shadow-lg",
        style: {
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)'
        }
    }, react_1.default.createElement("div", {
        className: "text-purple-300 text-sm font-semibold uppercase tracking-wider"
    }, "Score"), react_1.default.createElement("div", {
        className: "text-white text-3xl font-bold tabular-nums"
    }, score.toLocaleString()))), react_1.default.createElement("div", {
        className: "health-display pointer-events-auto"
    }, react_1.default.createElement("div", {
        className: "bg-gradient-to-r from-pink-900/80 to-purple-900/80 backdrop-blur-sm rounded-lg px-6 py-3 border-2 border-pink-400/50 shadow-lg",
        style: {
            boxShadow: '0 0 20px rgba(236, 72, 153, 0.3)'
        }
    }, react_1.default.createElement("div", {
        className: "text-pink-300 text-sm font-semibold uppercase tracking-wider"
    }, "Health"), react_1.default.createElement("div", {
        className: "flex items-center gap-3"
    }, react_1.default.createElement("div", {
        className: "text-white text-3xl font-bold tabular-nums"
    }, player.health, "%"), react_1.default.createElement("div", {
        className: "w-32 h-3 bg-gray-900/50 rounded-full overflow-hidden border border-pink-400/30"
    }, react_1.default.createElement("div", {
        className: "h-full transition-all duration-300 ease-out",
        style: {
            width: `${player.health}%`,
            background: player.health > 50 ? 'linear-gradient(90deg, #00f2ff, #00d4ff)' : player.health > 25 ? 'linear-gradient(90deg, #ffaa00, #ff8800)' : 'linear-gradient(90deg, #ff0066, #ff0044)',
            boxShadow: player.health > 50 ? '0 0 10px rgba(0, 242, 255, 0.5)' : player.health > 25 ? '0 0 10px rgba(255, 170, 0, 0.5)' : '0 0 10px rgba(255, 0, 102, 0.5)'
        }
    })))))), !isGameOver && react_1.default.createElement("div", {
        className: "pause-button absolute top-6 left-1/2 transform -translate-x-1/2"
    }, react_1.default.createElement("button", {
        onClick: isPaused ? onResume : onPause,
        className: "pointer-events-auto bg-purple-600/80 hover:bg-purple-500/80 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-200 border-2 border-purple-400/50 shadow-lg hover:shadow-purple-400/50",
        style: {
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)'
        }
    }, isPaused ? 'Resume' : 'Pause')), isPaused && !isGameOver && react_1.default.createElement("div", {
        className: "pause-overlay absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
    }, react_1.default.createElement("div", {
        className: "text-center"
    }, react_1.default.createElement("h2", {
        className: "text-6xl font-bold text-white mb-8",
        style: {
            textShadow: '0 0 20px rgba(139, 92, 246, 0.8), 0 0 40px rgba(139, 92, 246, 0.4)'
        }
    }, "PAUSED"), react_1.default.createElement("div", {
        className: "flex gap-4 justify-center"
    }, react_1.default.createElement("button", {
        onClick: onResume,
        className: "pointer-events-auto bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-8 py-4 rounded-lg font-bold text-xl uppercase tracking-wider transition-all duration-200 border-2 border-purple-400 shadow-lg hover:shadow-purple-400/50",
        style: {
            boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)'
        }
    }, "Resume"), react_1.default.createElement("button", {
        onClick: onRestart,
        className: "pointer-events-auto bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white px-8 py-4 rounded-lg font-bold text-xl uppercase tracking-wider transition-all duration-200 border-2 border-pink-400 shadow-lg hover:shadow-pink-400/50",
        style: {
            boxShadow: '0 0 30px rgba(236, 72, 153, 0.5)'
        }
    }, "Restart")))), isGameOver && react_1.default.createElement("div", {
        className: "game-over-overlay absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in"
    }, react_1.default.createElement("div", {
        className: "text-center max-w-md mx-auto p-8"
    }, react_1.default.createElement("h2", {
        className: "text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 mb-4 animate-pulse",
        style: {
            textShadow: '0 0 30px rgba(236, 72, 153, 0.5)'
        }
    }, "GAME OVER"), react_1.default.createElement("div", {
        className: "my-8 bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-sm rounded-lg p-6 border-2 border-purple-400/30"
    }, react_1.default.createElement("div", {
        className: "text-purple-300 text-lg font-semibold uppercase tracking-wider mb-2"
    }, "Final Score"), react_1.default.createElement("div", {
        className: "text-white text-5xl font-bold tabular-nums",
        style: {
            textShadow: '0 0 20px rgba(255, 255, 255, 0.5)'
        }
    }, score.toLocaleString())), react_1.default.createElement("div", {
        className: "grid grid-cols-2 gap-4 mb-8"
    }, react_1.default.createElement("div", {
        className: "bg-purple-900/30 backdrop-blur-sm rounded-lg p-4 border border-purple-400/20"
    }, react_1.default.createElement("div", {
        className: "text-purple-300 text-xs uppercase tracking-wider mb-1"
    }, "Distance"), react_1.default.createElement("div", {
        className: "text-white text-2xl font-bold"
    }, Math.floor((gameState.elapsedTime ?? 0) * 30), "m")), react_1.default.createElement("div", {
        className: "bg-pink-900/30 backdrop-blur-sm rounded-lg p-4 border border-pink-400/20"
    }, react_1.default.createElement("div", {
        className: "text-pink-300 text-xs uppercase tracking-wider mb-1"
    }, "Difficulty"), react_1.default.createElement("div", {
        className: "text-white text-2xl font-bold"
    }, gameState.currentLevel.difficulty))), react_1.default.createElement("button", {
        onClick: onRestart,
        className: "pointer-events-auto bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 hover:from-purple-500 hover:via-pink-500 hover:to-cyan-500 text-white px-10 py-5 rounded-lg font-bold text-2xl uppercase tracking-wider transition-all duration-300 border-2 border-white/30 shadow-lg hover:shadow-purple-400/50 transform hover:scale-105",
        style: {
            boxShadow: '0 0 40px rgba(139, 92, 246, 0.6), 0 0 60px rgba(236, 72, 153, 0.4)'
        }
    }, "Try Again"), react_1.default.createElement("p", {
        className: "text-gray-400 text-sm mt-6 italic"
    }, "Press SPACE or click to restart"))), !isGameOver && react_1.default.createElement("div", {
        className: "level-indicator absolute bottom-6 left-6"
    }, react_1.default.createElement("div", {
        className: "bg-purple-900/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-purple-400/30"
    }, react_1.default.createElement("div", {
        className: "text-purple-300 text-xs uppercase tracking-wider"
    }, "Level: ", gameState.currentLevel.name), react_1.default.createElement("div", {
        className: "text-white text-sm font-semibold"
    }, "Segment ", gameState.currentSegmentIndex + 1, " /", ' ', gameState.currentLevel.segments.length))), !isGameOver && score === 0 && react_1.default.createElement("div", {
        className: "instructions absolute bottom-6 right-6"
    }, react_1.default.createElement("div", {
        className: "bg-cyan-900/50 backdrop-blur-sm rounded-lg px-4 py-3 border border-cyan-400/30 max-w-xs"
    }, react_1.default.createElement("div", {
        className: "text-cyan-300 text-xs uppercase tracking-wider mb-1 font-bold"
    }, "Controls"), react_1.default.createElement("div", {
        className: "text-white text-sm space-y-1"
    }, react_1.default.createElement("div", null, "SPACE - Jump"), react_1.default.createElement("div", null, "ESC - Pause"), react_1.default.createElement("div", null, "Avoid obstacles and survive!")))));
};
exports.GameUI = GameUI;
// Add custom animations to your global CSS
const styles = `
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
`; //# sourceMappingURL=GameUI.js.map
}),
"[project]/packages/game-engine/dist/components/GameExample.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __createBinding = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importStar || function() {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o) {
            var ar = [];
            for(var k in o)if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
            for(var k = ownKeys(mod), i = 0; i < k.length; i++)if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
    };
}();
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GameExample = void 0;
/**
 * Example component showing how to integrate the rendering system
 * This demonstrates the complete setup with GameCanvas, GameUI, and game state
 */ const react_1 = __importStar(__turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)"));
const GameCanvas_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/components/GameCanvas.js [app-ssr] (ecmascript)");
const GameUI_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/components/UI/GameUI.js [app-ssr] (ecmascript)");
const types_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)");
// Example initial game state
const createInitialGameState = ()=>{
    const player = {
        id: 'player',
        position: {
            x: 100,
            y: 400
        },
        velocity: {
            x: 5,
            y: 0
        },
        size: {
            x: 40,
            y: 40
        },
        type: types_1.GameObjectType.PLAYER,
        active: true,
        isJumping: false,
        isOnGround: true,
        health: 100,
        score: 0
    };
    const exampleSegment = {
        id: 'segment_0',
        startX: 0,
        length: 2000,
        difficulty: 1,
        objects: [
            // Example spike
            {
                id: 'spike_1',
                position: {
                    x: 300,
                    y: 510
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: 40,
                    y: 40
                },
                type: types_1.GameObjectType.OBSTACLE_SPIKE,
                active: true
            },
            // Example block
            {
                id: 'block_1',
                position: {
                    x: 500,
                    y: 500
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: 50,
                    y: 50
                },
                type: types_1.GameObjectType.OBSTACLE_BLOCK,
                active: true
            },
            // Example platform
            {
                id: 'platform_1',
                position: {
                    x: 700,
                    y: 500
                },
                velocity: {
                    x: 0,
                    y: 0
                },
                size: {
                    x: 20,
                    y: 20
                },
                type: types_1.GameObjectType.PLATFORM,
                active: true
            }
        ]
    };
    const exampleLevel = {
        id: 'example_level',
        name: 'Example Level',
        segments: [
            exampleSegment
        ],
        totalLength: 2000,
        difficulty: 1,
        generatedBy: 'manual'
    };
    return {
        player,
        currentLevel: exampleLevel,
        currentSegmentIndex: 0,
        gameObjects: exampleSegment.objects,
        cameraOffset: 0,
        isPaused: false,
        isGameOver: false,
        score: 0,
        elapsedTime: 0
    };
};
const GameExample = ()=>{
    const [gameState, setGameState] = (0, react_1.useState)(createInitialGameState());
    const gameLoopRef = (0, react_1.useRef)(null);
    const lastTimeRef = (0, react_1.useRef)(0);
    // Simple game loop for demonstration
    (0, react_1.useEffect)(()=>{
        const gameLoop = (currentTime)=>{
            if (!lastTimeRef.current) {
                lastTimeRef.current = currentTime;
            }
            const deltaTime = currentTime - lastTimeRef.current;
            lastTimeRef.current = currentTime;
            if (!gameState.isPaused && !gameState.isGameOver) {
                setGameState((prev)=>{
                    // Move camera with player
                    const newCameraOffset = prev.player.position.x - 200;
                    // Simple auto-scroll
                    const newPlayerX = prev.player.position.x + 2;
                    // Increment score
                    const newScore = prev.score + 1;
                    // Example: Game over if health reaches 0
                    const isGameOver = prev.player.health <= 0;
                    return {
                        ...prev,
                        player: {
                            ...prev.player,
                            position: {
                                ...prev.player.position,
                                x: newPlayerX
                            }
                        },
                        cameraOffset: newCameraOffset,
                        score: newScore,
                        isGameOver
                    };
                });
            }
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        };
        gameLoopRef.current = requestAnimationFrame(gameLoop);
        return ()=>{
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [
        gameState.isPaused,
        gameState.isGameOver
    ]);
    const handleRestart = ()=>{
        setGameState(createInitialGameState());
        lastTimeRef.current = 0;
    };
    const handlePause = ()=>{
        setGameState((prev)=>({
                ...prev,
                isPaused: true
            }));
    };
    const handleResume = ()=>{
        setGameState((prev)=>({
                ...prev,
                isPaused: false
            }));
        lastTimeRef.current = 0; // Reset time to prevent jump
    };
    // Keyboard controls example
    (0, react_1.useEffect)(()=>{
        const handleKeyDown = (e)=>{
            switch(e.key){
                case ' ':
                case 'Spacebar':
                    e.preventDefault();
                    if (gameState.isGameOver) {
                        handleRestart();
                    } else if (!gameState.isPaused && gameState.player.isOnGround) {
                        // Jump logic (simplified)
                        setGameState((prev)=>({
                                ...prev,
                                player: {
                                    ...prev.player,
                                    velocity: {
                                        ...prev.player.velocity,
                                        y: -15
                                    },
                                    isJumping: true,
                                    isOnGround: false
                                }
                            }));
                    }
                    break;
                case 'Escape':
                    if (!gameState.isGameOver) {
                        if (gameState.isPaused) {
                            handleResume();
                        } else {
                            handlePause();
                        }
                    }
                    break;
                case 'r':
                case 'R':
                    handleRestart();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return ()=>window.removeEventListener('keydown', handleKeyDown);
    }, [
        gameState
    ]);
    return react_1.default.createElement("div", {
        className: "relative w-full h-screen bg-gradient-to-b from-gray-900 to-black overflow-hidden"
    }, react_1.default.createElement("div", {
        className: "absolute inset-0 flex items-center justify-center"
    }, react_1.default.createElement("div", {
        className: "relative",
        style: {
            width: '1200px',
            height: '600px'
        }
    }, react_1.default.createElement(GameCanvas_1.GameCanvas, {
        gameState: gameState,
        width: 1200,
        height: 600
    }), react_1.default.createElement(GameUI_1.GameUI, {
        gameState: gameState,
        onRestart: handleRestart,
        onPause: handlePause,
        onResume: handleResume
    }))), react_1.default.createElement("div", {
        className: "absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white text-sm p-4 rounded-lg max-w-md"
    }, react_1.default.createElement("h3", {
        className: "font-bold mb-2"
    }, "Example Game View"), react_1.default.createElement("p", {
        className: "text-gray-300 mb-2"
    }, "This is a demonstration of the rendering system. A full game would integrate with:"), react_1.default.createElement("ul", {
        className: "list-disc list-inside text-gray-300 space-y-1 text-xs"
    }, react_1.default.createElement("li", null, "PhysicsEngine for realistic movement"), react_1.default.createElement("li", null, "CollisionDetection for interactions"), react_1.default.createElement("li", null, "GameEngine for game loop management"), react_1.default.createElement("li", null, "LevelGenerator for procedural levels"), react_1.default.createElement("li", null, "InputHandler for player controls"))));
};
exports.GameExample = GameExample; //# sourceMappingURL=GameExample.js.map
}),
"[project]/packages/game-engine/dist/components/index.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// Main exports for game components
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GameExample = exports.GameUI = exports.ObstacleFactory = exports.ObstacleRenderer = exports.ObstacleComponent = exports.PlayerRenderer = exports.PlayerComponent = exports.GameCanvas = void 0;
var GameCanvas_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/components/GameCanvas.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "GameCanvas", {
    enumerable: true,
    get: function() {
        return GameCanvas_1.GameCanvas;
    }
});
var Player_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/components/Player.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "PlayerComponent", {
    enumerable: true,
    get: function() {
        return Player_1.Player;
    }
});
Object.defineProperty(exports, "PlayerRenderer", {
    enumerable: true,
    get: function() {
        return Player_1.PlayerRenderer;
    }
});
var Obstacle_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/components/Obstacle.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "ObstacleComponent", {
    enumerable: true,
    get: function() {
        return Obstacle_1.Obstacle;
    }
});
Object.defineProperty(exports, "ObstacleRenderer", {
    enumerable: true,
    get: function() {
        return Obstacle_1.ObstacleRenderer;
    }
});
Object.defineProperty(exports, "ObstacleFactory", {
    enumerable: true,
    get: function() {
        return Obstacle_1.ObstacleFactory;
    }
});
var GameUI_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/components/UI/GameUI.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "GameUI", {
    enumerable: true,
    get: function() {
        return GameUI_1.GameUI;
    }
});
var GameExample_1 = __turbopack_context__.r("[project]/packages/game-engine/dist/components/GameExample.js [app-ssr] (ecmascript)");
Object.defineProperty(exports, "GameExample", {
    enumerable: true,
    get: function() {
        return GameExample_1.GameExample;
    }
}); //# sourceMappingURL=index.js.map
}),
"[project]/packages/game-engine/dist/utils/index.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.utilsPlaceholder = void 0;
// Utils module exports
exports.utilsPlaceholder = {}; //# sourceMappingURL=index.js.map
}),
"[project]/packages/game-engine/dist/index.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// Main entry point for @geometrydash/game-engine
var __createBinding = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __exportStar = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__exportStar || function(m, exports1) {
    for(var p in m)if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports1, p)) __createBinding(exports1, m, p);
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
// Re-export all modules
__exportStar(__turbopack_context__.r("[project]/packages/game-engine/dist/engine/index.js [app-ssr] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/packages/game-engine/dist/systems/index.js [app-ssr] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/packages/game-engine/dist/levels/index.js [app-ssr] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/packages/game-engine/dist/components/index.js [app-ssr] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/packages/game-engine/dist/types/index.js [app-ssr] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/packages/game-engine/dist/utils/index.js [app-ssr] (ecmascript)"), exports); //# sourceMappingURL=index.js.map
}),
"[project]/apps/web/app/game/components/GeometryDashGame.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GeometryDashGame",
    ()=>GeometryDashGame
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$game$2d$engine$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/game-engine/dist/index.js [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function formatSessionTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
function GeometryDashGame({ width = 1200, height = 600 }) {
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const gameContainerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const engineRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const rendererRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [gameState, setGameState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isGameOver, setIsGameOver] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [showExtractModal, setShowExtractModal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [hasExtracted, setHasExtracted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [hasStarted, setHasStarted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    // Initialize game
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const level = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$game$2d$engine$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createInfiniteLevel"])();
        // Create game engine
        const engine = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$game$2d$engine$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GameEngine"](level, {
            canvasWidth: width,
            canvasHeight: height,
            playerSpeed: 300
        });
        // Create renderer
        const renderer = new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$game$2d$engine$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Renderer"]({
            canvas,
            width,
            height
        });
        // Set up render callback (engine handles canvas rendering)
        engine.onRender((state)=>{
            renderer.render(state);
        });
        // Set up game over callback
        engine.onGameOver((score)=>{
            setIsGameOver(true);
            console.log('Game Over! Final score:', score);
        });
        // Initial render so user sees the level (game starts on Start button click)
        renderer.render(engine.getState());
        engineRef.current = engine;
        rendererRef.current = renderer;
        // Cleanup
        return ()=>{
            engine.destroy();
            engineRef.current = null;
        };
    }, [
        width,
        height
    ]);
    // Poll engine state via requestAnimationFrame for reliable real-time UI updates
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let rafId;
        const tick = ()=>{
            const engine = engineRef.current;
            if (engine) {
                setGameState(engine.getState());
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return ()=>cancelAnimationFrame(rafId);
    }, []);
    const handleStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (engineRef.current) {
            engineRef.current.start();
            setHasStarted(true);
            // Focus game container so keyboard (space) reliably reaches the game
            gameContainerRef.current?.focus();
        }
    }, []);
    const handleRestart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (engineRef.current) {
            engineRef.current.restart();
            engineRef.current.start();
            setIsGameOver(false);
            setHasExtracted(false);
            setHasStarted(true);
            gameContainerRef.current?.focus();
        }
    }, []);
    const handleExtractConfirm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (engineRef.current) {
            engineRef.current.pause();
            setHasExtracted(true);
            setShowExtractModal(false);
        // Cash out complete - user successfully extracted before dying
        }
    }, []);
    const handleExtractCancel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (engineRef.current) {
            engineRef.current.resume();
        }
        setShowExtractModal(false);
    }, []);
    // Keyboard controls for restart and extract
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleKeyPress = (e)=>{
            if (e.key === 'r' || e.key === 'R') {
                handleRestart();
                return;
            }
            if (e.key === 'Enter' && hasStarted && !isGameOver && !hasExtracted && !showExtractModal) {
                e.preventDefault();
                if (engineRef.current) {
                    engineRef.current.pause();
                    setShowExtractModal(true);
                }
            }
            if (e.key === 'Enter' && !hasStarted) {
                e.preventDefault();
                handleStart();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return ()=>window.removeEventListener('keydown', handleKeyPress);
    }, [
        handleRestart,
        handleStart,
        isGameOver,
        hasExtracted,
        hasStarted,
        showExtractModal
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: gameContainerRef,
        tabIndex: 0,
        className: "relative w-full h-full flex items-center justify-center bg-gradient-to-b from-purple-950 to-purple-900 outline-none focus:outline-none",
        "aria-label": "Game",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
                ref: canvasRef,
                width: width,
                height: height,
                className: "border-4 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/50"
            }, void 0, false, {
                fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                lineNumber: 159,
                columnNumber: 7
            }, this),
            !hasStarted && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 flex items-center justify-center pointer-events-auto z-10",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-black/50 backdrop-blur-sm rounded-2xl border-2 border-purple-500 p-12 text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-3xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent",
                            children: "Ready to Play?"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                            lineNumber: 170,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-purple-200 mb-8 max-w-md",
                            children: "Survive as long as you can. Press ENTER or click Start to extract and cash out before you die!"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                            lineNumber: 173,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: handleStart,
                            className: "px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-xl",
                            children: "Start"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                            lineNumber: 176,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                    lineNumber: 169,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                lineNumber: 168,
                columnNumber: 9
            }, this),
            gameState && hasStarted && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 pointer-events-none z-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-8 left-8 bg-black/30 backdrop-blur-sm px-6 py-3 rounded-lg border border-purple-500/30 pointer-events-none",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-white font-mono",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-sm text-purple-300",
                                    children: "Time"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 192,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent",
                                    children: formatSessionTime(gameState.elapsedTime)
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 193,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                            lineNumber: 191,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                        lineNumber: 190,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-8 left-8 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/30 pointer-events-none",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-xs text-purple-300 font-mono space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: "SPACE / CLICK - Jump"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 202,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: "ENTER - Extract & Cash Out"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 203,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: "R - Restart"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 204,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                            lineNumber: 201,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                        lineNumber: 200,
                        columnNumber: 11
                    }, this),
                    showExtractModal && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto z-20",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gradient-to-br from-purple-900/90 to-pink-900/90 p-12 rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50 max-w-md",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-2xl font-bold text-white mb-4 text-center",
                                    children: "Confirm Extract"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 212,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-purple-200 text-center mb-6",
                                    children: "Cash out now with your current time? Your run will end."
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 215,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex gap-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: handleExtractConfirm,
                                            className: "flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-green-500/30 hover:shadow-green-400/40 border border-green-400/30",
                                            children: "Yes"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 219,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: handleExtractCancel,
                                            className: "flex-1 px-6 py-3 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg transition-all hover:border-purple-300 hover:bg-purple-500/20 hover:text-white hover:shadow-lg hover:shadow-purple-500/25",
                                            children: "No"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 225,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 218,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                            lineNumber: 211,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                        lineNumber: 210,
                        columnNumber: 13
                    }, this),
                    hasExtracted && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gradient-to-br from-purple-900/90 to-green-900/90 p-12 rounded-2xl border-2 border-green-500 shadow-2xl shadow-green-500/50",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-5xl font-bold text-white mb-4 text-center bg-gradient-to-r from-green-300 to-cyan-300 bg-clip-text text-transparent",
                                    children: "EXTRACTED!"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 240,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-center mb-8",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-lg text-purple-300 mb-2",
                                            children: "Time Cashed Out"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 244,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-6xl font-bold text-white",
                                            children: formatSessionTime(gameState.elapsedTime)
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 245,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 243,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: handleRestart,
                                            className: "w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg",
                                            children: "Play Again"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 250,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                            href: "/",
                                            className: "w-full px-8 py-4 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg text-center transition-all hover:border-purple-300 hover:bg-purple-500/20 hover:text-white hover:shadow-lg hover:shadow-purple-500/25",
                                            children: "Back to Homepage"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 256,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 249,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                            lineNumber: 239,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                        lineNumber: 238,
                        columnNumber: 13
                    }, this),
                    isGameOver && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gradient-to-br from-purple-900/90 to-pink-900/90 p-12 rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-5xl font-bold text-white mb-4 text-center bg-gradient-to-r from-red-300 to-pink-300 bg-clip-text text-transparent",
                                    children: "GAME OVER"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 271,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-center mb-8",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-lg text-purple-300 mb-2",
                                            children: "Time Survived"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 275,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-6xl font-bold text-white",
                                            children: formatSessionTime(gameState.elapsedTime)
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 276,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 274,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: handleRestart,
                                            className: "w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50",
                                            children: "Try Again"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 281,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                            href: "/",
                                            className: "w-full px-8 py-4 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg text-center transition-all hover:border-purple-300 hover:bg-purple-500/20 hover:text-white hover:shadow-lg hover:shadow-purple-500/25",
                                            children: "Back to Homepage"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                            lineNumber: 287,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                                    lineNumber: 280,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                            lineNumber: 270,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                        lineNumber: 269,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
                lineNumber: 188,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/app/game/components/GeometryDashGame.tsx",
        lineNumber: 152,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__d1cf035d._.js.map