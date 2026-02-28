'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { GameEngine, Renderer, createInfiniteLevel, GameState, Player, GameObjectType } from '@geometrydash/game-engine';

interface GeometryDashGameProps {
  width?: number;
  height?: number;
}

function formatSessionTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GeometryDashGame({ width = 1200, height = 600 }: GeometryDashGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Initialize game
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const level = createInfiniteLevel();

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

    // Set up render callback (engine handles canvas rendering)
    engine.onRender((state) => {
      renderer.render(state);
    });

    // Set up game over callback
    engine.onGameOver((score) => {
      setIsGameOver(true);
      console.log('Game Over! Final score:', score);
    });

    // Initial render so user sees the level (game starts on Start button click)
    renderer.render(engine.getState());

    engineRef.current = engine;
    rendererRef.current = renderer;

    // Cleanup
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [width, height]);

  // Poll engine state via requestAnimationFrame for reliable real-time UI updates
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const engine = engineRef.current;
      if (engine) {
        setGameState(engine.getState());
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleStart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.start();
      setHasStarted(true);
      // Focus game container so keyboard (space) reliably reaches the game
      gameContainerRef.current?.focus();
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.restart();
      engineRef.current.start();
      setIsGameOver(false);
      setHasExtracted(false);
      setHasStarted(true);
      gameContainerRef.current?.focus();
    }
  }, []);

  const handleExtractConfirm = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
      setHasExtracted(true);
      setShowExtractModal(false);
      // Cash out complete - user successfully extracted before dying
    }
  }, []);

  const handleExtractCancel = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resume();
    }
    setShowExtractModal(false);
  }, []);

  // Keyboard controls for restart and extract
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
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
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleRestart, handleStart, isGameOver, hasExtracted, hasStarted, showExtractModal]);

  return (
    <div
      ref={gameContainerRef}
      tabIndex={0}
      className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-purple-950 to-purple-900 outline-none focus:outline-none"
      aria-label="Game"
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border-4 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/50"
      />

      {/* Start screen */}
      {!hasStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl border-2 border-purple-500 p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Ready to Play?
            </h2>
            <p className="text-purple-200 mb-8 max-w-md">
              Survive as long as you can. Press ENTER or click Start to extract and cash out before you die!
            </p>
            <button
              onClick={handleStart}
              className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-xl"
            >
              Start
            </button>
          </div>
        </div>
      )}

      {/* UI Overlay - z-10 ensures HUD is above canvas */}
      {gameState && hasStarted && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* HUD - Time Tracker */}
          <div className="absolute top-8 left-8 bg-black/30 backdrop-blur-sm px-6 py-3 rounded-lg border border-purple-500/30 pointer-events-none">
            <div className="text-white font-mono">
              <div className="text-sm text-purple-300">Time</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {formatSessionTime(gameState.elapsedTime)}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-8 left-8 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/30 pointer-events-none">
            <div className="text-xs text-purple-300 font-mono space-y-1">
              <div>SPACE / CLICK - Jump</div>
              <div>ENTER - Extract & Cash Out</div>
              <div>R - Restart</div>
            </div>
          </div>

          {/* Extract confirmation modal */}
          {showExtractModal && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto z-20">
              <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 p-12 rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50 max-w-md">
                <h2 className="text-2xl font-bold text-white mb-4 text-center">
                  Confirm Extract
                </h2>
                <p className="text-purple-200 text-center mb-6">
                  Cash out now with your current time? Your run will end.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={handleExtractConfirm}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-green-500/30 hover:shadow-green-400/40 border border-green-400/30"
                  >
                    Yes
                  </button>
                  <button
                    onClick={handleExtractCancel}
                    className="flex-1 px-6 py-3 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg transition-all hover:border-purple-300 hover:bg-purple-500/20 hover:text-white hover:shadow-lg hover:shadow-purple-500/25"
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Extracted success screen */}
          {hasExtracted && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto">
              <div className="bg-gradient-to-br from-purple-900/90 to-green-900/90 p-12 rounded-2xl border-2 border-green-500 shadow-2xl shadow-green-500/50">
                <h2 className="text-5xl font-bold text-white mb-4 text-center bg-gradient-to-r from-green-300 to-cyan-300 bg-clip-text text-transparent">
                  EXTRACTED!
                </h2>
                <div className="text-center mb-8">
                  <div className="text-lg text-purple-300 mb-2">Time Cashed Out</div>
                  <div className="text-6xl font-bold text-white">
                    {formatSessionTime(gameState.elapsedTime)}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleRestart}
                    className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg"
                  >
                    Play Again
                  </button>
                  <Link
                    href="/"
                    className="w-full px-8 py-4 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg text-center transition-all hover:border-purple-300 hover:bg-purple-500/20 hover:text-white hover:shadow-lg hover:shadow-purple-500/25"
                  >
                    Back to Homepage
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Game Over Screen - pointer-events-auto so button is clickable */}
          {isGameOver && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto">
              <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 p-12 rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50">
                <h2 className="text-5xl font-bold text-white mb-4 text-center bg-gradient-to-r from-red-300 to-pink-300 bg-clip-text text-transparent">
                  GAME OVER
                </h2>
                <div className="text-center mb-8">
                  <div className="text-lg text-purple-300 mb-2">Time Survived</div>
                  <div className="text-6xl font-bold text-white">
                    {formatSessionTime(gameState.elapsedTime)}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleRestart}
                    className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50"
                  >
                    Try Again
                  </button>
                  <Link
                    href="/"
                    className="w-full px-8 py-4 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg text-center transition-all hover:border-purple-300 hover:bg-purple-500/20 hover:text-white hover:shadow-lg hover:shadow-purple-500/25"
                  >
                    Back to Homepage
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
