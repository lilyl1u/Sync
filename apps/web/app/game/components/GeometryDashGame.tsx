'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, Renderer, createTestLevel, GameState, Player, GameObjectType } from '@geometrydash/game-engine';

interface GeometryDashGameProps {
  width?: number;
  height?: number;
}

export function GeometryDashGame({ width = 1200, height = 600 }: GeometryDashGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // Initialize game
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create test level
    const level = createTestLevel();

    // Create game engine
    const engine = new GameEngine(level, {
      canvasWidth: width,
      canvasHeight: height,
      playerSpeed: 300,
    });

    // Create renderer
    const renderer = new Renderer({
      canvas,
      width,
      height,
    });

    // Set up render callback
    engine.onRender((state) => {
      renderer.render(state);
      setGameState(state);
    });

    // Set up game over callback
    engine.onGameOver((score) => {
      setIsGameOver(true);
      console.log('Game Over! Final score:', score);
    });

    // Start the game
    engine.start();

    engineRef.current = engine;
    rendererRef.current = renderer;

    // Cleanup
    return () => {
      engine.destroy();
    };
  }, [width, height]);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.restart();
      setIsGameOver(false);
      setIsPaused(false);
    }
  }, []);

  const handlePause = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const handleResume = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  // Keyboard controls for pause/restart
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (isPaused) {
          handleResume();
        } else {
          handlePause();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPaused, handlePause, handleResume, handleRestart]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-purple-950 to-purple-900">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border-4 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/50"
      />

      {/* UI Overlay */}
      {gameState && (
        <>
          {/* HUD - Distance Tracker */}
          <div className="absolute top-8 left-8 bg-black/30 backdrop-blur-sm px-6 py-3 rounded-lg border border-purple-500/30">
            <div className="text-white font-mono">
              <div className="text-sm text-purple-300">Distance</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {Math.max(0, Math.floor((gameState.player.position.x - 100) / 10))}m
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-8 left-8 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/30">
            <div className="text-xs text-purple-300 font-mono space-y-1">
              <div>SPACE / CLICK - Jump</div>
              <div>P - Pause</div>
              <div>R - Restart</div>
            </div>
          </div>

          {/* Pause Menu */}
          {isPaused && !isGameOver && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center">
              <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 p-12 rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50">
                <h2 className="text-5xl font-bold text-white mb-8 text-center bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  PAUSED
                </h2>
                <div className="space-y-4">
                  <button
                    onClick={handleResume}
                    className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50"
                  >
                    Resume
                  </button>
                  <button
                    onClick={handleRestart}
                    className="w-full px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all"
                  >
                    Restart
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Game Over Screen */}
          {isGameOver && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center">
              <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 p-12 rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50">
                <h2 className="text-5xl font-bold text-white mb-4 text-center bg-gradient-to-r from-red-300 to-pink-300 bg-clip-text text-transparent">
                  GAME OVER
                </h2>
                <div className="text-center mb-8">
                  <div className="text-lg text-purple-300 mb-2">Distance Traveled</div>
                  <div className="text-6xl font-bold text-white">
                    {Math.max(0, Math.floor((gameState.player.position.x - 100) / 10))}m
                  </div>
                </div>
                <button
                  onClick={handleRestart}
                  className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
