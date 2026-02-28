'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { Renderer } from '../systems/Renderer';
import { GameState } from '../types';

interface GameCanvasProps {
  gameState: GameState;
  width?: number;
  height?: number;
  className?: string;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  width = 1200,
  height = 600,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      rendererRef.current = new Renderer({
        canvas: canvasRef.current,
        width,
        height,
      });

      console.log('Renderer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [width, height]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
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
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  // Render loop
  const render = useCallback(() => {
    if (rendererRef.current && gameState) {
      rendererRef.current.render(gameState);
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(render);
  }, [gameState]);

  // Start/stop render loop
  useEffect(() => {
    if (!gameState.isPaused) {
      animationFrameRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render, gameState.isPaused]);

  return (
    <canvas
      ref={canvasRef}
      className={`game-canvas ${className}`}
      style={{
        display: 'block',
        maxWidth: '100%',
        imageRendering: 'crisp-edges',
      }}
    />
  );
};
