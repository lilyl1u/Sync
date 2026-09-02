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
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
        <div className="pointer-events-auto px-hud px-4 py-2">
          <div className="text-[9px] text-[var(--px-gold)]">Score</div>
          <div className="text-white text-lg tabular-nums">{score.toLocaleString()}</div>
        </div>

        <div className="pointer-events-auto px-hud px-4 py-2">
          <div className="text-[9px] text-[var(--px-gold)]">Health</div>
          <div className="flex items-center gap-3">
            <div className="text-white text-lg tabular-nums">{player.health}%</div>
            <div className="w-28 h-3 bg-[var(--px-cream)] overflow-hidden border-2 border-[var(--px-ink)]">
              <div
                className="h-full"
                style={{
                  width: `${player.health}%`,
                  background: player.health > 50 ? '#3d8fd6' : player.health > 25 ? '#e8c547' : '#e85d6c',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {!isGameOver && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <button
            onClick={isPaused ? onResume : onPause}
            className="px-btn px-btn-sea pointer-events-auto"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      )}

      {isPaused && !isGameOver && (
        <div className="absolute inset-0 px-overlay flex items-center justify-center">
          <div className="px-panel p-8 text-center">
            <h2 className="px-title text-3xl mb-8">PAUSED</h2>
            <div className="flex gap-3 justify-center">
              <button onClick={onResume} className="px-btn px-btn-start pointer-events-auto">
                Resume
              </button>
              <button onClick={onRestart} className="px-btn pointer-events-auto">
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {isGameOver && (
        <div className="absolute inset-0 px-overlay flex items-center justify-center">
          <div className="px-panel p-8 text-center max-w-md">
            <h2 className="px-title text-2xl mb-4">GAME OVER</h2>
            <div className="my-6">
              <div className="text-[10px] mb-2">Final Score</div>
              <div className="text-2xl tabular-nums">{score.toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8 text-[10px]">
              <div className="px-hud p-3">
                <div className="text-[var(--px-gold)] mb-1">Distance</div>
                <div>{Math.floor((gameState.elapsedTime ?? 0) * 30)}m</div>
              </div>
              <div className="px-hud p-3">
                <div className="text-[var(--px-gold)] mb-1">Difficulty</div>
                <div>{gameState.currentLevel.difficulty}</div>
              </div>
            </div>
            <button onClick={onRestart} className="px-btn px-btn-start pointer-events-auto">
              Try Again
            </button>
            <p className="text-[9px] mt-6">Press SPACE or click to restart</p>
          </div>
        </div>
      )}

      {!isGameOver && (
        <div className="absolute bottom-6 left-6 px-hud px-3 py-2">
          <div className="text-[9px] text-[var(--px-gold)]">
            Level: {gameState.currentLevel.name}
          </div>
          <div className="text-[9px] text-white">
            Segment {gameState.currentSegmentIndex + 1} / {gameState.currentLevel.segments.length}
          </div>
        </div>
      )}

      {!isGameOver && score === 0 && (
        <div className="absolute bottom-6 right-6 px-hud px-3 py-2 max-w-xs">
          <div className="text-[9px] text-[var(--px-gold)] mb-1">Controls</div>
          <div className="text-[9px] text-white space-y-1">
            <div>SPACE - Jump</div>
            <div>ESC - Pause</div>
            <div>Avoid obstacles and survive!</div>
          </div>
        </div>
      )}
    </div>
  );
};
