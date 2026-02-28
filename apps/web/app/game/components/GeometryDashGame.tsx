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
import { Connection, type PublicKey, type Transaction } from '@solana/web3.js';
import {
  estimatePayoutBaseUnits,
  extractOnChain,
  recordDeathOnChain,
  startSessionOnChain,
} from '@/lib/gamblingClient';
import {
  BUYIN_BASE_UNITS,
  GAMBLING_PROGRAM_ID,
  PAYOUT_RATE_BASE_UNITS_PER_SECOND,
  RPC_URL,
} from '@/lib/solana';

import { detectBeats, DetectedBeat } from '../utils/beatDetector';

const PLAYER_SPEED = 300;
const AUDIO_URL = '/song/song.mp3';

interface GeometryDashGameProps {
  width?: number;
  height?: number;
}

type PhantomProvider = {
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  publicKey: PublicKey | null;
  isPhantom?: boolean;
};

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
    solana?: PhantomProvider;
  }
}

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const provider = window.phantom?.solana ?? window.solana;
  if (!provider?.isPhantom) {
    return null;
  }

  return provider;
}

function formatSessionTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const E_HOLD_DURATION_MS = 3000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function GeometryDashGame({ width = 1200, height = 600 }: GeometryDashGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const hasSettledCurrentRunRef = useRef(false);
  const connectionRef = useRef<Connection | null>(null);
  const eHoldStartRef = useRef<number | null>(null);
  const eHoldRafRef = useRef<number | null>(null);
  const eHoldTriggeredRef = useRef(false);


  // Audio refs (not state — we don't want re-renders on audio changes)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartedRef = useRef(false);
  const beatsRef = useRef<DetectedBeat[]>([]);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [isPayingBuyIn, setIsPayingBuyIn] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [buyInSignature, setBuyInSignature] = useState<string | null>(null);
  const [settleSignature, setSettleSignature] = useState<string | null>(null);
  const [lastPayoutBaseUnits, setLastPayoutBaseUnits] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractHoldProgress, setExtractHoldProgress] = useState(0);

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
  const connectWallet = useCallback(async (): Promise<PhantomProvider> => {
    const provider = getPhantomProvider();
    if (!provider) {
      throw new Error('Phantom wallet not found. Install Phantom and try again.');
    }

    setIsWalletConnecting(true);
    try {
      const response = await withTimeout(
        provider.connect({ onlyIfTrusted: false }),
        30000,
        'Wallet connection timed out. Open Phantom and approve the connection request, then try again.',
      );
      setWalletAddress(response.publicKey.toBase58());
      return provider;
    } finally {
      setIsWalletConnecting(false);
    }
  }, []);

  const settleRun = useCallback(
    async ({ durationSeconds, died }: { durationSeconds: number; died: boolean }): Promise<boolean> => {
      if (hasSettledCurrentRunRef.current || !walletAddress) {
        return true;
      }

      hasSettledCurrentRunRef.current = true;
      setIsSettling(true);
      setErrorMessage(null);
      setStatusMessage(
        died
          ? 'Run ended. Recording death on-chain with 0 payout...'
          : 'Extracting and claiming on-chain payout...',
      );

      try {
        const walletProvider = getPhantomProvider();
        if (!walletProvider || !walletProvider.publicKey) {
          throw new Error('Wallet is not connected');
        }
        if (!connectionRef.current) {
          connectionRef.current = new Connection(RPC_URL, 'confirmed');
        }

        const signature = died
          ? await recordDeathOnChain({
              connection: connectionRef.current,
              wallet: walletProvider,
            })
          : await extractOnChain({
              connection: connectionRef.current,
              wallet: walletProvider,
            });

        const payout = died ? 0n : estimatePayoutBaseUnits(durationSeconds);

        setSettleSignature(signature);
        setLastPayoutBaseUnits(payout.toString());
        setStatusMessage(
          died
            ? 'Player died. Buy-in forfeited and payout is 0.'
            : `Extract successful. Paid ${payout.toString()} base units.`,
        );

        return true;
      } catch (error) {
        hasSettledCurrentRunRef.current = false;
        const message = error instanceof Error ? error.message : 'Failed to settle payout';
        setErrorMessage(message);
        setStatusMessage(null);
        return false;
      } finally {
        setIsSettling(false);
      }
    },
    [walletAddress],
  );

  const handleStart = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || hasStarted) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage('Connecting wallet...');

    try {
      const provider = await connectWallet();

      if (!connectionRef.current) {
        connectionRef.current = new Connection(RPC_URL, 'confirmed');
      }

      setStatusMessage('Submitting on-chain start transaction...');
      setIsPayingBuyIn(true);

      const signature = await startSessionOnChain({
        connection: connectionRef.current,
        wallet: provider,
      });

      setBuyInSignature(signature);
      setStatusMessage('Waiting for on-chain confirmation...');
      await connectionRef.current.confirmTransaction(signature, 'confirmed');

      setLastPayoutBaseUnits(null);
      setSettleSignature(null);
      hasSettledCurrentRunRef.current = false;

      setStatusMessage('Buy-in confirmed on-chain. Run started.');
      engine.start();
      setHasStarted(true);
      setIsGameOver(false);
      setHasExtracted(false);
      gameContainerRef.current?.focus();
      if (audioLoaded) playAudio();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Buy-in failed';
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsPayingBuyIn(false);
    }
  }, [connectWallet, hasStarted]);

  const triggerHoldExtract = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !hasStarted || isGameOver || hasExtracted || isSettling) {
      return;
    }

    engine.pause();

    const duration = engine.getState().elapsedTime;
    const settled = await settleRun({ durationSeconds: duration, died: false });
    if (settled) {
      setHasExtracted(true);
      return;
    }

    engine.resume();
  }, [hasExtracted, hasStarted, isGameOver, isSettling, settleRun]);

  const cancelExtractHold = useCallback(() => {
    if (eHoldRafRef.current !== null) {
      cancelAnimationFrame(eHoldRafRef.current);
      eHoldRafRef.current = null;
    }
    eHoldStartRef.current = null;
    eHoldTriggeredRef.current = false;
    setExtractHoldProgress(0);
  }, [audioLoaded, playAudio]);

  const startExtractHold = useCallback(() => {
    if (
      eHoldStartRef.current !== null ||
      !hasStarted ||
      isGameOver ||
      hasExtracted ||
      isSettling
    ) {
      return;
    }

    const start = performance.now();
    eHoldStartRef.current = start;
    eHoldTriggeredRef.current = false;
    setExtractHoldProgress(0);

    const tick = async (now: number) => {
      const holdStart = eHoldStartRef.current;
      if (holdStart === null) {
        return;
      }

      const elapsed = now - holdStart;
      const progress = Math.min(1, elapsed / E_HOLD_DURATION_MS);
      setExtractHoldProgress(progress);

      if (progress >= 1 && !eHoldTriggeredRef.current) {
        eHoldTriggeredRef.current = true;
        eHoldStartRef.current = null;
        eHoldRafRef.current = null;
        setExtractHoldProgress(1);
        await triggerHoldExtract();
        return;
      }

      eHoldRafRef.current = requestAnimationFrame((ts) => {
        void tick(ts);
      });
    };

    eHoldRafRef.current = requestAnimationFrame((ts) => {
      void tick(ts);
    });
  }, [hasExtracted, hasStarted, isGameOver, isSettling, triggerHoldExtract]);

  const handleRestart = useCallback(() => {
    cancelExtractHold();
    if (engineRef.current) {
      stopAudio();
      // Fully stop simulation until a new on-chain start is confirmed.
      engineRef.current.stop();
      engineRef.current.restart();
      setGameState(engineRef.current.getState());
      setIsGameOver(false);
      setHasExtracted(false);
      setHasStarted(false);
      setBuyInSignature(null);
      setSettleSignature(null);
      setLastPayoutBaseUnits(null);
      setStatusMessage(null);
      setErrorMessage(null);
      hasSettledCurrentRunRef.current = false;
      gameContainerRef.current?.focus();
      if (audioLoaded) playAudio();
    }
  }, [cancelExtractHold]);

  useEffect(() => {
    if (!isGameOver || !hasStarted) {
      return;
    }

    cancelExtractHold();
    const duration = engineRef.current?.getState().elapsedTime ?? 0;
    void settleRun({ durationSeconds: duration, died: true });
  }, [cancelExtractHold, hasStarted, isGameOver, settleRun]);

  useEffect(() => {
    if (hasExtracted) {
      cancelExtractHold();
    }
  }, [cancelExtractHold, hasExtracted]);

  // ------------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        handleRestart();
        return;
      }
      if (e.key === 'Enter' && !hasStarted && !loadingAudio) {
        e.preventDefault();
        void handleStart();
      }
      if ((e.key === 'e' || e.key === 'E') && !e.repeat && !loadingAudio) {
        e.preventDefault();
        startExtractHold();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && !eHoldTriggeredRef.current) {
        cancelExtractHold();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cancelExtractHold, handleRestart, handleStart, hasExtracted, hasStarted, isGameOver, startExtractHold, loadingAudio]);

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
            <p className="text-purple-200 mb-3 max-w-md">
              Start requires a buy-in on Solana devnet. Extract to cash out by survival time. Die and you lose the run balance.
            </p>
            <p className="text-purple-300 mb-8 max-w-md font-mono text-sm">
              Program: {GAMBLING_PROGRAM_ID.toBase58().slice(0, 4)}...{GAMBLING_PROGRAM_ID.toBase58().slice(-4)} | Buy-in: {BUYIN_BASE_UNITS.toString()} | Payout Rate: {PAYOUT_RATE_BASE_UNITS_PER_SECOND.toString()}/sec
            </p>
            <button
              onClick={() => {
                void handleStart();
              }}
              disabled={isWalletConnecting || isPayingBuyIn}
              className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isWalletConnecting
                ? 'Connecting Wallet...'
                : isPayingBuyIn
                  ? 'Waiting for Payment...'
                  : 'Pay Buy-In & Start'}
            </button>
            {statusMessage && (
              <p className="mt-4 text-cyan-300 text-sm font-mono max-w-md break-words">
                {statusMessage}
              </p>
            )}
            {errorMessage && (
              <p className="mt-3 text-red-300 text-sm font-mono max-w-md break-words">
                {errorMessage}
              </p>
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

          <div className="absolute top-8 right-8 bg-black/30 backdrop-blur-sm px-4 py-3 rounded-lg border border-purple-500/30 max-w-[30rem]">
            <div className="text-xs text-purple-200 font-mono space-y-1">
              <div>Wallet: {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Not connected'}</div>
              <div>Start Tx: {buyInSignature ? `${buyInSignature.slice(0, 8)}...` : 'Pending'}</div>
              <div>Settle Tx: {settleSignature ? `${settleSignature.slice(0, 8)}...` : 'Not settled'}</div>
              <div>Payout: {lastPayoutBaseUnits ?? '0'} base units</div>
              {statusMessage && <div className="text-cyan-300">{statusMessage}</div>}
              {errorMessage && <div className="text-red-300">{errorMessage}</div>}
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-8 left-8 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/30 pointer-events-none">
            <div className="text-xs text-purple-300 font-mono space-y-1">
              <div>SPACE / CLICK - Jump</div>
              <div>ENTER - Start Run</div>
              <div>HOLD E (3s) - Instant Extract</div>
              <div>R - Restart (new buy-in)</div>
            </div>
          </div>

          {extractHoldProgress > 0 && !hasExtracted && !isGameOver && (
            <div className="absolute bottom-8 right-8 bg-black/60 backdrop-blur-sm px-4 py-3 rounded-lg border border-emerald-400/40 w-72">
              <div className="text-xs text-emerald-300 font-mono mb-2">
                Hold E to extract
              </div>
              <div className="w-full h-2 bg-black/70 rounded overflow-hidden border border-emerald-400/30">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-[width] duration-75"
                  style={{ width: `${Math.round(extractHoldProgress * 100)}%` }}
                />
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
                  <div className="text-purple-200 mt-3 font-mono">Payout: {lastPayoutBaseUnits ?? '0'} base units</div>
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
                  <div className="text-red-300 mt-3 font-mono">Player died. Payout is 0 and buy-in is forfeited.</div>
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

          {isSettling && (
            <div className="absolute bottom-8 right-8 bg-black/60 px-4 py-2 rounded-lg border border-cyan-400/40 text-cyan-200 font-mono text-sm">
              Settling run on devnet...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
