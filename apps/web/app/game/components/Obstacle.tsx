'use client';

import React from 'react';
import { Obstacle as ObstacleType, GameObjectType } from '../types';

interface ObstacleProps {
  obstacle: ObstacleType;
  cameraOffset: number;
}

/**
 * Obstacle component - Provides React-based utilities for obstacle rendering
 * Note: Actual rendering is done via Canvas in Renderer.ts
 * This component can be used for debugging or CSS-based overlays
 */
export const Obstacle: React.FC<ObstacleProps> = ({ obstacle, cameraOffset }) => {
  // This component is primarily for logical purposes
  // The actual rendering happens in Renderer.ts using Canvas API

  // Can be used for debugging
  if (process.env.NODE_ENV === 'development') {
    return (
      <div
        className="obstacle-debug"
        style={{
          position: 'absolute',
          left: obstacle.position.x - cameraOffset,
          top: obstacle.position.y,
          width: obstacle.size.x,
          height: obstacle.size.y,
          border: '2px dashed rgba(255, 0, 0, 0.3)',
          pointerEvents: 'none',
          display: 'none', // Hidden by default
        }}
        title={`Obstacle - Type: ${obstacle.type}, Damage: ${obstacle.damage}`}
      />
    );
  }

  return null;
};

/**
 * Obstacle rendering utilities for use in Renderer
 */
export const ObstacleRenderer = {
  /**
   * Get spike vertices for drawing triangular spikes
   */
  getSpikeVertices: (
    x: number,
    y: number,
    width: number,
    height: number
  ): Array<{ x: number; y: number }> => {
    return [
      { x: x + width / 2, y }, // Top point
      { x: x + width, y: y + height }, // Bottom right
      { x, y: y + height }, // Bottom left
    ];
  },

  /**
   * Get block pattern for drawing decorative patterns
   */
  getBlockPattern: (
    x: number,
    y: number,
    width: number,
    height: number
  ): Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> => {
    return [
      {
        from: { x, y },
        to: { x: x + width, y: y + height },
      },
      {
        from: { x: x + width, y },
        to: { x, y: y + height },
      },
    ];
  },

  /**
   * Get obstacle color based on type and danger level
   */
  getColor: (obstacle: ObstacleType): { fill: string; glow: string; border: string } => {
    const baseDamage = obstacle.damage;

    if (baseDamage >= 100) {
      // Instant kill obstacles
      return {
        fill: '#ff0044',
        glow: '#ff1155',
        border: '#ff3366',
      };
    } else if (baseDamage >= 50) {
      // High damage obstacles
      return {
        fill: '#ff006e',
        glow: '#ff1a7f',
        border: '#ff3399',
      };
    } else {
      // Low damage obstacles
      return {
        fill: '#ff4488',
        glow: '#ff66aa',
        border: '#ff88bb',
      };
    }
  },

  /**
   * Calculate animation offset for moving obstacles
   */
  getAnimationOffset: (obstacle: ObstacleType, time: number): { x: number; y: number } => {
    // Some obstacles could have animated movement
    const shouldAnimate = obstacle.velocity.x !== 0 || obstacle.velocity.y !== 0;

    if (!shouldAnimate) {
      return { x: 0, y: 0 };
    }

    return {
      x: Math.sin(time * 0.002) * 5,
      y: Math.cos(time * 0.002) * 5,
    };
  },

  /**
   * Get rotation for spinning obstacles
   */
  getRotation: (obstacle: ObstacleType, time: number): number => {
    // Spikes don't rotate, blocks can rotate
    if (obstacle.type === GameObjectType.OBSTACLE_SPIKE) {
      return 0;
    }

    return (time * 0.001) % (Math.PI * 2);
  },

  /**
   * Get danger particles around high-damage obstacles
   */
  getDangerParticles: (
    obstacle: ObstacleType,
    time: number
  ): Array<{ x: number; y: number; size: number; alpha: number }> => {
    if (obstacle.damage < 75) return [];

    const particles: Array<{ x: number; y: number; size: number; alpha: number }> = [];
    const centerX = obstacle.position.x + obstacle.size.x / 2;
    const centerY = obstacle.position.y + obstacle.size.y / 2;
    const particleCount = 6;

    for (let i = 0; i < particleCount; i++) {
      const angle = (time * 0.002 + (i * Math.PI * 2) / particleCount) % (Math.PI * 2);
      const radius = 30 + Math.sin(time * 0.003) * 10;

      particles.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        size: 3 + Math.sin(time * 0.004 + i) * 1,
        alpha: 0.5 + Math.sin(time * 0.003 + i) * 0.3,
      });
    }

    return particles;
  },

  /**
   * Get warning indicator for upcoming obstacles
   */
  shouldShowWarning: (obstacle: ObstacleType, playerX: number): boolean => {
    const distance = obstacle.position.x - playerX;
    return distance > 0 && distance < 300 && obstacle.damage >= 50;
  },

  /**
   * Get scale multiplier for pulsing effect
   */
  getPulseScale: (time: number, speed: number = 0.003): number => {
    return 1 + Math.sin(time * speed) * 0.1;
  },
};

/**
 * Factory functions for creating different obstacle types
 */
export const ObstacleFactory = {
  /**
   * Create a spike obstacle
   */
  createSpike: (x: number, y: number, damage: number = 100): ObstacleType => {
    return {
      id: `spike_${Date.now()}_${Math.random()}`,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      size: { x: 40, y: 40 },
      type: GameObjectType.OBSTACLE_SPIKE,
      active: true,
      damage,
    };
  },

  /**
   * Create a block obstacle
   */
  createBlock: (x: number, y: number, damage: number = 50): ObstacleType => {
    return {
      id: `block_${Date.now()}_${Math.random()}`,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      size: { x: 50, y: 50 },
      type: GameObjectType.OBSTACLE_BLOCK,
      active: true,
      damage,
    };
  },

  /**
   * Create a moving block obstacle
   */
  createMovingBlock: (
    x: number,
    y: number,
    velocityX: number = 2,
    damage: number = 50
  ): ObstacleType => {
    return {
      id: `moving_block_${Date.now()}_${Math.random()}`,
      position: { x, y },
      velocity: { x: velocityX, y: 0 },
      size: { x: 50, y: 50 },
      type: GameObjectType.OBSTACLE_BLOCK,
      active: true,
      damage,
    };
  },
};
