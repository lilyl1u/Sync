'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  GameEngine,
  Renderer,
  createInfiniteLevel,
  createBeatLevel,
  GameState,
} from '@geometrydash/game-engine';
import { detectBeats, DetectedBeat } from '../utils/beatDetector';

const PLAYER_SPEED = 300;
const AUDIO_URL = '/song/song.mp3';

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

  // Audio refs (not state — we don't want re-renders on audio changes)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartedRef = useRef(false);
  const beatsRef = useRef<DetectedBeat[]>([]);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(true);

  // ------------------------------------------------------------------
  // Load & analyse audio on mount, then build the level
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    const renderer = new Renderer({ canvas, width, height });
    rendererRef.current = renderer;

    (async () => {
      let level;

      try {
        // Fetch and decode
        const response = await fetch(AUDIO_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;

        if (cancelled) return;

        // Detect beats
        const beats = await detectBeats(audioBuffer);
        beatsRef.current = beats;

        // Build beat-synced level
        level = createBeatLevel({
          beats: beats.map((b) => b.time),
          playerSpeed: PLAYER_SPEED,
          intensities: beats.map((b) => b.intensity),
        });

        setAudioLoaded(true);
      } catch {
        // No audio file found — fall back to infinite procedural level
        level = createInfiniteLevel();
        setAudioError(true);
      } finally {
        setLoadingAudio(false);
      }

      if (cancelled) return;

      const engine = new GameEngine(level, {
        canvasWidth: width,
        canvasHeight: height,
        playerSpeed: PLAYER_SPEED,
      });

      engine.onRender((state) => renderer.render(state));
      engine.onGameOver(() => {
        setIsGameOver(true);
        stopAudio();
      });

      renderer.render(engine.getState());
      engineRef.current = engine;
    })();

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      stopAudio();
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close();
      }
      audioCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // ------------------------------------------------------------------
  // Audio playback helpers
  // ------------------------------------------------------------------
  const playAudio = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (!audioCtx || !buffer) return;

    // Stop any existing source
    try { sourceNodeRef.current?.stop(); } catch { /* ignore */ }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
    sourceNodeRef.current = source;
    audioStartedRef.current = true;

    if (audioCtx.state === 'suspended') audioCtx.resume();
  }, []);

  const stopAudio = useCallback(() => {
    try { sourceNodeRef.current?.stop(); } catch { /* ignore */ }
    sourceNodeRef.current = null;
    audioStartedRef.current = false;
  }, []);

  const pauseAudio = useCallback(() => {
    audioCtxRef.current?.suspend();
  }, []);

  const resumeAudio = useCallback(() => {
    audioCtxRef.current?.resume();
  }, []);

  // ------------------------------------------------------------------
  // Poll engine state for HUD updates
  // ------------------------------------------------------------------
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const engine = engineRef.current;
      if (engine) setGameState(engine.getState());
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ------------------------------------------------------------------
  // Game lifecycle callbacks
  // ------------------------------------------------------------------
  const handleStart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.start();
      setHasStarted(true);
      gameContainerRef.current?.focus();
      if (audioLoaded) playAudio();
    }
  }, [audioLoaded, playAudio]);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      stopAudio();
      engineRef.current.restart();
      engineRef.current.start();
      setIsGameOver(false);
      setHasExtracted(false);
      setHasStarted(true);
      gameContainerRef.current?.focus();
      if (audioLoaded) playAudio();
    }
  }, [audioLoaded, playAudio, stopAudio]);

  const handleExtractConfirm = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
      pauseAudio();
      setHasExtracted(true);
      setShowExtractModal(false);
    }
  }, [pauseAudio]);

  const handleExtractCancel = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resume();
      resumeAudio();
    }
    setShowExtractModal(false);
  }, [resumeAudio]);

  // ------------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------------
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
          pauseAudio();
          setShowExtractModal(true);
        }
      }
      if (e.key === 'Enter' && !hasStarted && !loadingAudio) {
        e.preventDefault();
        handleStart();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleRestart, handleStart, pauseAudio, isGameOver, hasExtracted, hasStarted, showExtractModal, loadingAudio]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div
      ref={gameContainerRef}
      tabIndex={0}
      className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-purple-950 to-purple-900 outline-none focus:outline-none"
      aria-label="Game"
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border-4 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/50"
      />

      {/* Start / loading screen */}
      {!hasStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl border-2 border-purple-500 p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {loadingAudio ? 'Loading Audio...' : 'Ready to Play?'}
            </h2>
            <p className="text-purple-200 mb-8 max-w-md">
              {loadingAudio
                ? 'Analyzing beats — hang tight.'
                : audioLoaded
                  ? 'Obstacles are synced to the music. Survive the beat!'
                  : 'No audio file found — playing in infinite mode. Add /song.mp3 to enable beat sync.'}
            </p>
            {!loadingAudio && (
              <button
                onClick={handleStart}
                className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-xl"
              >
                {audioLoaded ? '▶ Start' : 'Start'}
              </button>
            )}
            {loadingAudio && (
              <div className="flex justify-center">
                <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* HUD & overlays */}
      {gameState && hasStarted && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Time */}
          <div className="absolute top-8 left-8 bg-black/30 backdrop-blur-sm px-6 py-3 rounded-lg border border-purple-500/30 pointer-events-none">
            <div className="text-white font-mono">
              <div className="text-sm text-purple-300">Time</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {formatSessionTime(gameState.elapsedTime)}
              </div>
            </div>
          </div>

          {/* Beat sync indicator */}
          {audioLoaded && (
            <div className="absolute top-8 right-8 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-pink-500/30 pointer-events-none">
              <div className="text-xs text-pink-300 font-mono flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
                Beat Sync
              </div>
            </div>
          )}

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
                <h2 className="text-2xl font-bold text-white mb-4 text-center">Confirm Extract</h2>
                <p className="text-purple-200 text-center mb-6">Cash out now with your current time? Your run will end.</p>
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

          {/* Extracted success */}
          {hasExtracted && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto">
              <div className="bg-gradient-to-br from-purple-900/90 to-green-900/90 p-12 rounded-2xl border-2 border-green-500 shadow-2xl shadow-green-500/50">
                <h2 className="text-5xl font-bold text-white mb-4 text-center bg-gradient-to-r from-green-300 to-cyan-300 bg-clip-text text-transparent">
                  EXTRACTED!
                </h2>
                <div className="text-center mb-8">
                  <div className="text-lg text-purple-300 mb-2">Time Cashed Out</div>
                  <div className="text-6xl font-bold text-white">{formatSessionTime(gameState.elapsedTime)}</div>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={handleRestart} className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg">
                    Play Again
                  </button>
                  <Link href="/" className="w-full px-8 py-4 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg text-center transition-all hover:border-purple-300 hover:bg-purple-500/20 hover:text-white hover:shadow-lg hover:shadow-purple-500/25">
                    Back to Homepage
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Game Over */}
          {isGameOver && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto">
              <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 p-12 rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50">
                <h2 className="text-5xl font-bold text-white mb-4 text-center bg-gradient-to-r from-red-300 to-pink-300 bg-clip-text text-transparent">
                  GAME OVER
                </h2>
                <div className="text-center mb-8">
                  <div className="text-lg text-purple-300 mb-2">Time Survived</div>
                  <div className="text-6xl font-bold text-white">{formatSessionTime(gameState.elapsedTime)}</div>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={handleRestart} className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50">
                    Try Again
                  </button>
                  <Link href="/" className="w-full px-8 py-4 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg text-center transition-all hover:border-purple-300 hover:bg-purple-500/20 hover:text-white hover:shadow-lg hover:shadow-purple-500/25">
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
