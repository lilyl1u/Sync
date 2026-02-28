'use client';

import React from 'react';
import { Player as PlayerType } from '../types';

interface PlayerProps {
  player: PlayerType;
  cameraOffset: number;
}

/**
 * Player component - Provides React-based utilities for player rendering
 * Note: Actual rendering is done via Canvas in Renderer.ts
 * This component can be used for debugging or CSS-based overlays
 */
export const Player: React.FC<PlayerProps> = ({ player, cameraOffset }) => {
  // This component is primarily for logical purposes
  // The actual rendering happens in Renderer.ts using Canvas API

  // Can be used for debugging
  if (process.env.NODE_ENV === 'development') {
    return (
      <div
        className="player-debug"
        style={{
          position: 'absolute',
          left: player.position.x - cameraOffset,
          top: player.position.y,
          width: player.size.x,
          height: player.size.y,
          border: '2px dashed rgba(0, 255, 0, 0.3)',
          pointerEvents: 'none',
          display: 'none', // Hidden by default
        }}
        title={`Player - Health: ${player.health}, Score: ${player.score}`}
      />
    );
  }

  return null;
};

/**
 * Player rendering utilities for use in Renderer
 */
export const PlayerRenderer = {
  /**
   * Calculate player rotation based on velocity
   */
  getRotation: (player: PlayerType): number => {
    return player.velocity.y * 0.05;
  },

  /**
   * Get player color based on health
   */
  getColor: (player: PlayerType): string => {
    if (player.health <= 25) return '#ff0066'; // Low health - red
    if (player.health <= 50) return '#ffaa00'; // Medium health - orange
    return '#00f2ff'; // Full health - cyan
  },

  /**
   * Calculate animation frame based on movement
   */
  getAnimationFrame: (player: PlayerType, time: number): number => {
    const speed = Math.abs(player.velocity.x);
    const frameRate = Math.max(50, 200 - speed * 10);
    return Math.floor(time / frameRate) % 4;
  },

  /**
   * Check if player should show trail effect
   */
  shouldShowTrail: (player: PlayerType): boolean => {
    return Math.abs(player.velocity.x) > 3 || Math.abs(player.velocity.y) > 5;
  },

  /**
   * Get trail particles for player movement
   */
  getTrailParticles: (
    player: PlayerType,
    count: number = 3
  ): Array<{ x: number; y: number; alpha: number }> => {
    const particles: Array<{ x: number; y: number; alpha: number }> = [];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: player.position.x - (i + 1) * 10,
        y: player.position.y + player.size.y / 2,
        alpha: 0.3 - i * 0.1,
      });
    }

    return particles;
  },
};
