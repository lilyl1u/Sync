'use client';

/**
 * Example component showing how to integrate the rendering system
 * This demonstrates the complete setup with GameCanvas, GameUI, and game state
 */

import React, { useState, useEffect, useRef } from 'react';
import { GameCanvas } from './GameCanvas';
import { GameUI } from './UI/GameUI';
import { GameState, Player, GameObjectType, Level, LevelSegment } from '../types';

// Example initial game state
const createInitialGameState = (): GameState => {
  const player: Player = {
    id: 'player',
    position: { x: 100, y: 400 },
    velocity: { x: 5, y: 0 },
    size: { x: 40, y: 40 },
    type: GameObjectType.PLAYER,
    active: true,
    isJumping: false,
    isOnGround: true,
    health: 100,
    score: 0,
  };

  const exampleSegment: LevelSegment = {
    id: 'segment_0',
    startX: 0,
    length: 2000,
    difficulty: 1,
    objects: [
      // Example spike
      {
        id: 'spike_1',
        position: { x: 300, y: 510 },
        velocity: { x: 0, y: 0 },
        size: { x: 40, y: 40 },
        type: GameObjectType.OBSTACLE_SPIKE,
        active: true,
      },
      // Example block
      {
        id: 'block_1',
        position: { x: 500, y: 500 },
        velocity: { x: 0, y: 0 },
        size: { x: 50, y: 50 },
        type: GameObjectType.OBSTACLE_BLOCK,
        active: true,
      },
      // Example platform
      {
        id: 'platform_1',
        position: { x: 700, y: 500 },
        velocity: { x: 0, y: 0 },
        size: { x: 20, y: 20 },
        type: GameObjectType.PLATFORM,
        active: true,
      },
    ],
  };

  const exampleLevel: Level = {
    id: 'example_level',
    name: 'Example Level',
    segments: [exampleSegment],
    totalLength: 2000,
    difficulty: 1,
    generatedBy: 'manual',
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
  };
};

export const GameExample: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Simple game loop for demonstration
  useEffect(() => {
    const gameLoop = (currentTime: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      if (!gameState.isPaused && !gameState.isGameOver) {
        setGameState((prev) => {
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
                x: newPlayerX,
              },
            },
            cameraOffset: newCameraOffset,
            score: newScore,
            isGameOver,
          };
        });
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.isPaused, gameState.isGameOver]);

  const handleRestart = () => {
    setGameState(createInitialGameState());
    lastTimeRef.current = 0;
  };

  const handlePause = () => {
    setGameState((prev) => ({ ...prev, isPaused: true }));
  };

  const handleResume = () => {
    setGameState((prev) => ({ ...prev, isPaused: false }));
    lastTimeRef.current = 0; // Reset time to prevent jump
  };

  // Keyboard controls example
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          if (gameState.isGameOver) {
            handleRestart();
          } else if (!gameState.isPaused && gameState.player.isOnGround) {
            // Jump logic (simplified)
            setGameState((prev) => ({
              ...prev,
              player: {
                ...prev.player,
                velocity: { ...prev.player.velocity, y: -15 },
                isJumping: true,
                isOnGround: false,
              },
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-gray-900 to-black overflow-hidden">
      {/* Game Canvas */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: '1200px', height: '600px' }}>
          <GameCanvas gameState={gameState} width={1200} height={600} />
          <GameUI
            gameState={gameState}
            onRestart={handleRestart}
            onPause={handlePause}
            onResume={handleResume}
          />
        </div>
      </div>

      {/* Instructions overlay */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white text-sm p-4 rounded-lg max-w-md">
        <h3 className="font-bold mb-2">Example Game View</h3>
        <p className="text-gray-300 mb-2">
          This is a demonstration of the rendering system. A full game would integrate with:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1 text-xs">
          <li>PhysicsEngine for realistic movement</li>
          <li>CollisionDetection for interactions</li>
          <li>GameEngine for game loop management</li>
          <li>LevelGenerator for procedural levels</li>
          <li>InputHandler for player controls</li>
        </ul>
      </div>
    </div>
  );
};
