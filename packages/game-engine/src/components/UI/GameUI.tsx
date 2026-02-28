'use client';

import React from 'react';
import { GameState } from '../../types';

interface GameUIProps {
  gameState: GameState;
  onRestart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

export const GameUI: React.FC<GameUIProps> = ({
  gameState,
  onRestart,
  onPause,
  onResume,
}) => {
  const { player, isPaused, isGameOver, score } = gameState;

  return (
    <div className="game-ui absolute inset-0 pointer-events-none">
      {/* Top HUD - Score and Health */}
      <div className="top-hud absolute top-0 left-0 right-0 p-6 flex justify-between items-start">
        {/* Score Display */}
        <div className="score-display pointer-events-auto">
          <div
            className="bg-gradient-to-r from-purple-900/80 to-purple-800/80 backdrop-blur-sm rounded-lg px-6 py-3 border-2 border-purple-400/50 shadow-lg"
            style={{
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
            }}
          >
            <div className="text-purple-300 text-sm font-semibold uppercase tracking-wider">
              Score
            </div>
            <div className="text-white text-3xl font-bold tabular-nums">
              {score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Health Display */}
        <div className="health-display pointer-events-auto">
          <div
            className="bg-gradient-to-r from-pink-900/80 to-purple-900/80 backdrop-blur-sm rounded-lg px-6 py-3 border-2 border-pink-400/50 shadow-lg"
            style={{
              boxShadow: '0 0 20px rgba(236, 72, 153, 0.3)',
            }}
          >
            <div className="text-pink-300 text-sm font-semibold uppercase tracking-wider">
              Health
            </div>
            <div className="flex items-center gap-3">
              <div className="text-white text-3xl font-bold tabular-nums">
                {player.health}%
              </div>
              {/* Health Bar */}
              <div className="w-32 h-3 bg-gray-900/50 rounded-full overflow-hidden border border-pink-400/30">
                <div
                  className="h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${player.health}%`,
                    background:
                      player.health > 50
                        ? 'linear-gradient(90deg, #00f2ff, #00d4ff)'
                        : player.health > 25
                        ? 'linear-gradient(90deg, #ffaa00, #ff8800)'
                        : 'linear-gradient(90deg, #ff0066, #ff0044)',
                    boxShadow:
                      player.health > 50
                        ? '0 0 10px rgba(0, 242, 255, 0.5)'
                        : player.health > 25
                        ? '0 0 10px rgba(255, 170, 0, 0.5)'
                        : '0 0 10px rgba(255, 0, 102, 0.5)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pause Button */}
      {!isGameOver && (
        <div className="pause-button absolute top-6 left-1/2 transform -translate-x-1/2">
          <button
            onClick={isPaused ? onResume : onPause}
            className="pointer-events-auto bg-purple-600/80 hover:bg-purple-500/80 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-200 border-2 border-purple-400/50 shadow-lg hover:shadow-purple-400/50"
            style={{
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
            }}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      )}

      {/* Pause Overlay */}
      {isPaused && !isGameOver && (
        <div className="pause-overlay absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <h2
              className="text-6xl font-bold text-white mb-8"
              style={{
                textShadow:
                  '0 0 20px rgba(139, 92, 246, 0.8), 0 0 40px rgba(139, 92, 246, 0.4)',
              }}
            >
              PAUSED
            </h2>
            <div className="flex gap-4 justify-center">
              <button
                onClick={onResume}
                className="pointer-events-auto bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-8 py-4 rounded-lg font-bold text-xl uppercase tracking-wider transition-all duration-200 border-2 border-purple-400 shadow-lg hover:shadow-purple-400/50"
                style={{
                  boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
                }}
              >
                Resume
              </button>
              <button
                onClick={onRestart}
                className="pointer-events-auto bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white px-8 py-4 rounded-lg font-bold text-xl uppercase tracking-wider transition-all duration-200 border-2 border-pink-400 shadow-lg hover:shadow-pink-400/50"
                style={{
                  boxShadow: '0 0 30px rgba(236, 72, 153, 0.5)',
                }}
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {isGameOver && (
        <div className="game-over-overlay absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in">
          <div className="text-center max-w-md mx-auto p-8">
            <h2
              className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 mb-4 animate-pulse"
              style={{
                textShadow: '0 0 30px rgba(236, 72, 153, 0.5)',
              }}
            >
              GAME OVER
            </h2>

            {/* Final Score */}
            <div className="my-8 bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-sm rounded-lg p-6 border-2 border-purple-400/30">
              <div className="text-purple-300 text-lg font-semibold uppercase tracking-wider mb-2">
                Final Score
              </div>
              <div
                className="text-white text-5xl font-bold tabular-nums"
                style={{
                  textShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
                }}
              >
                {score.toLocaleString()}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-purple-900/30 backdrop-blur-sm rounded-lg p-4 border border-purple-400/20">
                <div className="text-purple-300 text-xs uppercase tracking-wider mb-1">
                  Distance
                </div>
                <div className="text-white text-2xl font-bold">
                  {Math.floor(gameState.cameraOffset / 10)}m
                </div>
              </div>
              <div className="bg-pink-900/30 backdrop-blur-sm rounded-lg p-4 border border-pink-400/20">
                <div className="text-pink-300 text-xs uppercase tracking-wider mb-1">
                  Difficulty
                </div>
                <div className="text-white text-2xl font-bold">
                  {gameState.currentLevel.difficulty}
                </div>
              </div>
            </div>

            {/* Restart Button */}
            <button
              onClick={onRestart}
              className="pointer-events-auto bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 hover:from-purple-500 hover:via-pink-500 hover:to-cyan-500 text-white px-10 py-5 rounded-lg font-bold text-2xl uppercase tracking-wider transition-all duration-300 border-2 border-white/30 shadow-lg hover:shadow-purple-400/50 transform hover:scale-105"
              style={{
                boxShadow:
                  '0 0 40px rgba(139, 92, 246, 0.6), 0 0 60px rgba(236, 72, 153, 0.4)',
              }}
            >
              Try Again
            </button>

            <p className="text-gray-400 text-sm mt-6 italic">
              Press SPACE or click to restart
            </p>
          </div>
        </div>
      )}

      {/* Level Indicator */}
      {!isGameOver && (
        <div className="level-indicator absolute bottom-6 left-6">
          <div className="bg-purple-900/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-purple-400/30">
            <div className="text-purple-300 text-xs uppercase tracking-wider">
              Level: {gameState.currentLevel.name}
            </div>
            <div className="text-white text-sm font-semibold">
              Segment {gameState.currentSegmentIndex + 1} /{' '}
              {gameState.currentLevel.segments.length}
            </div>
          </div>
        </div>
      )}

      {/* Instructions (visible at start) */}
      {!isGameOver && score === 0 && (
        <div className="instructions absolute bottom-6 right-6">
          <div className="bg-cyan-900/50 backdrop-blur-sm rounded-lg px-4 py-3 border border-cyan-400/30 max-w-xs">
            <div className="text-cyan-300 text-xs uppercase tracking-wider mb-1 font-bold">
              Controls
            </div>
            <div className="text-white text-sm space-y-1">
              <div>SPACE - Jump</div>
              <div>ESC - Pause</div>
              <div>Avoid obstacles and survive!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
`;
