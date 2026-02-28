'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Connection, PublicKey, type Transaction } from '@solana/web3.js';
import { GameEngine, Renderer, createInfiniteLevel, GameState } from '@geometrydash/game-engine';
import {
  estimateEarnedBaseUnits,
  extractOnChain,
  fetchPoolConfig,
  recordDeathOnChain,
  startSessionOnChain,
  type PoolConfig,
} from '@/lib/gamblingClient';
import { RPC_URL } from '@/lib/solana';

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
  if (typeof window === 'undefined') return null;
  const provider = window.phantom?.solana ?? window.solana;
  if (!provider?.isPhantom) return null;
  return provider;
}

function formatSessionTime(seconds: number): string {
  const s = typeof seconds === 'number' && !Number.isNaN(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getElapsedSeconds(state: GameState | null): number {
  if (!state) return 0;
  return (state as GameState & { elapsedTime?: number }).elapsedTime ?? 0;
}

const LAMPORTS_PER_SOL = 1e9;

function formatSol(baseUnits: bigint): string {
  const sol = Number(baseUnits) / LAMPORTS_PER_SOL;
  if (sol >= 1) return sol.toFixed(2);
  if (sol >= 0.01) return sol.toFixed(4);
  return sol.toFixed(6);
}

function formatSolBalance(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol >= 1) return sol.toFixed(2);
  if (sol >= 0.01) return sol.toFixed(4);
  return sol.toFixed(6);
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
    if (timeoutId) clearTimeout(timeoutId);
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
  const frozenEarnedRef = useRef<bigint | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [isPayingBuyIn, setIsPayingBuyIn] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [buyInSignature, setBuyInSignature] = useState<string | null>(null);
  const [settleSignature, setSettleSignature] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractHoldProgress, setExtractHoldProgress] = useState(0);
  const [walletBalanceLamports, setWalletBalanceLamports] = useState<number | null>(null);
  const [displayElapsedFallback, setDisplayElapsedFallback] = useState(0);
  const [poolConfig, setPoolConfig] = useState<PoolConfig | null>(null);
  const [frozenEarned, setFrozenEarned] = useState<bigint | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  // Initialize game
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const level = createInfiniteLevel();
    const engine = new GameEngine(level, {
      canvasWidth: width,
      canvasHeight: height,
      playerSpeed: 300,
    });
    const renderer = new Renderer({ canvas, width, height });
    rendererRef.current = renderer;

    engine.onRender((state) => renderer.render(state));
    engine.onGameOver((score) => {
      setIsGameOver(true);
      console.log('Game Over! Final score:', score);
    });
    renderer.render(engine.getState());
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
      rendererRef.current = null;
    };
  }, [width, height]);

  // Poll engine state for UI
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

  // Fallback timer – stops when frozen
  useEffect(() => {
    if (!hasStarted || isGameOver || hasExtracted) {
      sessionStartRef.current = null;
      return;
    }
    sessionStartRef.current = performance.now() / 1000;
    const interval = setInterval(() => {
      if (frozenEarnedRef.current !== null) return;
      const start = sessionStartRef.current;
      if (start !== null) {
        setDisplayElapsedFallback(performance.now() / 1000 - start);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [hasStarted, isGameOver, hasExtracted]);

  // Fetch wallet balance
  useEffect(() => {
    if (!walletAddress) { setWalletBalanceLamports(null); return; }
    if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');
    const conn = connectionRef.current;
    const pubkey = new PublicKey(walletAddress);
    const fetchBalance = async () => {
      try { setWalletBalanceLamports(await conn.getBalance(pubkey)); }
      catch { setWalletBalanceLamports(null); }
    };
    void fetchBalance();
    const pollInterval = hasStarted && !hasExtracted && !isGameOver ? 3000 : 10000;
    const interval = setInterval(fetchBalance, pollInterval);
    return () => clearInterval(interval);
  }, [walletAddress, hasStarted, hasExtracted, isGameOver]);

  const connectWallet = useCallback(async (): Promise<PhantomProvider> => {
    const provider = getPhantomProvider();
    if (!provider) throw new Error('Phantom wallet not found. Install Phantom and try again.');
    setIsWalletConnecting(true);
    setErrorMessage(null);
    setStatusMessage('Open Phantom to approve the connection...');
    try {
      const response = await withTimeout(
        provider.connect({ onlyIfTrusted: false }),
        60000,
        'Wallet connection timed out.',
      );
      setWalletAddress(response.publicKey.toBase58());
      if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');
      setStatusMessage('Wallet connected. Click Pay Buy-In & Start to begin.');
      return provider;
    } catch (err) {
      setStatusMessage(null);
      throw err;
    } finally {
      setIsWalletConnecting(false);
    }
  }, []);

  // ---- EXTRACT: the one function that sends SOL ----
  const doExtract = useCallback(
    async (earned: bigint): Promise<boolean> => {
      if (hasSettledCurrentRunRef.current || !walletAddress) return true;
      hasSettledCurrentRunRef.current = true;
      setIsSettling(true);
      setErrorMessage(null);
      setStatusMessage('Extracting – confirm in Phantom...');

      try {
        const walletProvider = getPhantomProvider();
        if (!walletProvider?.publicKey) throw new Error('Wallet is not connected');
        if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');

        const signature = await extractOnChain({
          connection: connectionRef.current,
          wallet: walletProvider,
          payoutBaseUnits: earned,
        });

        setSettleSignature(signature);
        setStatusMessage(`Extract successful.`);
        return true;
      } catch (error) {
        hasSettledCurrentRunRef.current = false;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to extract');
        setStatusMessage(null);
        return false;
      } finally {
        setIsSettling(false);
      }
    },
    [walletAddress],
  );

  const handleConnectWallet = useCallback(async () => {
    try { await connectWallet(); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Connection failed'); }
  }, [connectWallet]);

  const handlePayAndStart = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || hasStarted || !walletAddress) return;
    const provider = getPhantomProvider();
    if (!provider?.publicKey) {
      setErrorMessage('Wallet disconnected. Please connect again.');
      setWalletAddress(null);
      return;
    }
    setErrorMessage(null);
    setStatusMessage('Submitting on-chain start transaction...');
    setIsPayingBuyIn(true);
    try {
      if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');
      const signature = await startSessionOnChain({ connection: connectionRef.current, wallet: provider });
      setBuyInSignature(signature);
      setStatusMessage('Waiting for on-chain confirmation...');
      await connectionRef.current.confirmTransaction(signature, 'confirmed');

      const config = await fetchPoolConfig(connectionRef.current);
      setPoolConfig(config);

      setSettleSignature(null);
      setFrozenEarned(null);
      frozenEarnedRef.current = null;
      hasSettledCurrentRunRef.current = false;
      setDisplayElapsedFallback(0);

      setStatusMessage('Buy-in confirmed. Run started.');
      engine.start();
      setHasStarted(true);
      setIsGameOver(false);
      setHasExtracted(false);
      gameContainerRef.current?.focus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Buy-in failed');
      setStatusMessage(null);
    } finally {
      setIsPayingBuyIn(false);
    }
  }, [hasStarted, walletAddress]);

  const FEE_BUFFER_LAMPORTS = 300_000n;

  /**
   * THE extract trigger. Captures the EXACT earned value from the icon, freezes everything, sends it.
   * Adds a fee buffer (0.0003 SOL) to compensate for tx fees / rent so wallet delta matches display.
   */
  const triggerHoldExtract = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !hasStarted || isGameOver || hasExtracted || isSettling) return;

    const secs = Math.max(getElapsedSeconds(engine.getState()), displayElapsedFallback);
    const earned = estimateEarnedBaseUnits(secs, poolConfig ?? undefined);

    const totalPayout = earned + FEE_BUFFER_LAMPORTS;
    frozenEarnedRef.current = totalPayout;
    engine.pause();
    setFrozenEarned(totalPayout);
    setHasExtracted(true);
    const ok = await doExtract(totalPayout);
    if (!ok) {
      frozenEarnedRef.current = null;
      setFrozenEarned(null);
      setHasExtracted(false);
      engine.resume();
    }
  }, [displayElapsedFallback, hasExtracted, hasStarted, isGameOver, isSettling, poolConfig, doExtract]);

  const cancelExtractHold = useCallback(() => {
    if (eHoldRafRef.current !== null) {
      cancelAnimationFrame(eHoldRafRef.current);
      eHoldRafRef.current = null;
    }
    eHoldStartRef.current = null;
    eHoldTriggeredRef.current = false;
    setExtractHoldProgress(0);
  }, []);

  const startExtractHold = useCallback(() => {
    if (eHoldStartRef.current !== null || !hasStarted || isGameOver || hasExtracted || isSettling) return;
    const start = performance.now();
    eHoldStartRef.current = start;
    eHoldTriggeredRef.current = false;
    setExtractHoldProgress(0);

    const tick = async (now: number) => {
      const holdStart = eHoldStartRef.current;
      if (holdStart === null) return;
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
      eHoldRafRef.current = requestAnimationFrame((ts) => { void tick(ts); });
    };
    eHoldRafRef.current = requestAnimationFrame((ts) => { void tick(ts); });
  }, [hasExtracted, hasStarted, isGameOver, isSettling, triggerHoldExtract]);

  const handleRestart = useCallback(() => {
    cancelExtractHold();
    frozenEarnedRef.current = null;
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    if (engine) {
      engine.stop();
      engine.restart();
      const state = engine.getState();
      setGameState(state);
      if (renderer) renderer.render(state);
      setIsGameOver(false);
      setHasExtracted(false);
      setHasStarted(false);
      setBuyInSignature(null);
      setSettleSignature(null);
      setFrozenEarned(null);
      setPoolConfig(null);
      setStatusMessage(null);
      setErrorMessage(null);
      setDisplayElapsedFallback(0);
      hasSettledCurrentRunRef.current = false;
      gameContainerRef.current?.focus();
    }
  }, [cancelExtractHold]);

  useEffect(() => {
    if (hasExtracted) cancelExtractHold();
  }, [cancelExtractHold, hasExtracted]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') { handleRestart(); return; }
      if (e.key === 'Enter' && !hasStarted) {
        e.preventDefault();
        if (walletAddress) void handlePayAndStart();
        else void handleConnectWallet();
      }
      if ((e.key === 'e' || e.key === 'E') && !e.repeat) {
        e.preventDefault();
        startExtractHold();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && !eHoldTriggeredRef.current) cancelExtractHold();
    };
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cancelExtractHold, handleConnectWallet, handlePayAndStart, handleRestart, hasExtracted, hasStarted, isGameOver, startExtractHold, walletAddress]);

  // ---- RENDER ----

  // Compute the live earned value (only used while playing, NOT after extract)
  const liveEarned: bigint | null = (gameState && hasStarted && !isGameOver && !hasExtracted)
    ? estimateEarnedBaseUnits(
        Math.max(getElapsedSeconds(gameState), displayElapsedFallback),
        poolConfig ?? undefined,
      )
    : null;

  const ratePerSec = poolConfig?.payoutRateBaseUnitsPerSecond
    ?? BigInt(process.env.NEXT_PUBLIC_PAYOUT_RATE_BASE_UNITS_PER_SECOND ?? '100000');

  return (
    <div
      ref={gameContainerRef}
      tabIndex={0}
      className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-purple-950 to-purple-900 outline-none focus:outline-none"
      aria-label="Game"
    >
      <div className="relative" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border-4 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/50"
        />
        {/* Player icon: shows earned SOL (starts at 0, ticks up per second) */}
        {gameState && liveEarned !== null && (
          <div
            className="absolute pointer-events-none font-mono text-sm font-bold text-emerald-400 drop-shadow-lg"
            style={{
              left: gameState.player.position.x - gameState.cameraOffset + gameState.player.size.x / 2,
              top: gameState.player.position.y - 40,
              transform: 'translate(-50%, 0)',
            }}
          >
            <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded border border-emerald-400/40 whitespace-nowrap">
              +{formatSol(ratePerSec)} SOL/s
            </div>
            <div className="text-emerald-300/90 text-xs mt-0.5 bg-black/50 px-2 py-0.5 rounded">
              Earned: {formatSol(liveEarned)} SOL
            </div>
          </div>
        )}
      </div>

      {/* Start screen */}
      {!hasStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl border-2 border-purple-500 p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Ready to Play?
            </h2>
            <p className="text-purple-200 mb-3 max-w-md">
              Survive as long as you can. The longer you live, the more SOL you earn. Hold E to extract.
            </p>
            {walletBalanceLamports !== null && (
              <p className="text-emerald-400 font-semibold mb-2 font-mono">
                Wallet: {formatSolBalance(walletBalanceLamports)} SOL
              </p>
            )}
            <p className="text-purple-300 mb-6 max-w-md font-mono text-sm">
              Rate: {formatSol(ratePerSec)} SOL/sec
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {!walletAddress ? (
                <button
                  onClick={() => void handleConnectWallet()}
                  disabled={isWalletConnecting}
                  className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isWalletConnecting ? 'Connecting... (check Phantom)' : 'Connect Wallet'}
                </button>
              ) : (
                <button
                  onClick={() => void handlePayAndStart()}
                  disabled={isPayingBuyIn}
                  className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPayingBuyIn ? 'Confirm in Phantom...' : 'Pay Buy-In & Start'}
                </button>
              )}
            </div>
            {statusMessage && <p className="mt-4 text-cyan-300 text-sm font-mono max-w-md break-words">{statusMessage}</p>}
            {errorMessage && <p className="mt-3 text-red-300 text-sm font-mono max-w-md break-words">{errorMessage}</p>}
          </div>
        </div>
      )}

      {/* HUD overlay while playing */}
      {gameState && hasStarted && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-8 left-8 bg-black/30 backdrop-blur-sm px-6 py-3 rounded-lg border border-purple-500/30">
            <div className="text-white font-mono">
              <div className="text-sm text-purple-300">Time</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {formatSessionTime(
                  hasExtracted
                    ? Math.max(getElapsedSeconds(gameState), displayElapsedFallback)
                    : Math.max(getElapsedSeconds(gameState), displayElapsedFallback)
                )}
              </div>
            </div>
          </div>

          <div className="absolute top-8 right-8 bg-black/30 backdrop-blur-sm px-4 py-3 rounded-lg border border-purple-500/30 max-w-[30rem]">
            <div className="text-xs text-purple-200 font-mono space-y-1">
              <div>Wallet: {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Not connected'}</div>
              {walletBalanceLamports !== null && (
                <div className="text-emerald-400 font-semibold">Balance: {formatSolBalance(walletBalanceLamports)} SOL</div>
              )}
              {statusMessage && <div className="text-cyan-300">{statusMessage}</div>}
              {errorMessage && <div className="text-red-300">{errorMessage}</div>}
            </div>
          </div>

          <div className="absolute bottom-8 left-8 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/30">
            <div className="text-xs text-purple-300 font-mono space-y-1">
              <div>SPACE / CLICK - Jump</div>
              <div>HOLD E (3s) - Extract</div>
              <div>R - Restart</div>
            </div>
          </div>

          {extractHoldProgress > 0 && !hasExtracted && !isGameOver && (
            <div className="absolute bottom-8 right-8 bg-black/60 backdrop-blur-sm px-4 py-3 rounded-lg border border-emerald-400/40 w-72">
              <div className="text-xs text-emerald-300 font-mono mb-2">Hold E to extract</div>
              <div className="w-full h-2 bg-black/70 rounded overflow-hidden border border-emerald-400/30">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-[width] duration-75"
                  style={{ width: `${Math.round(extractHoldProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* EXTRACT SUCCESS: one fixed number */}
          {hasExtracted && frozenEarned !== null && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto">
              <div className="bg-gradient-to-br from-purple-900/90 to-green-900/90 p-12 rounded-2xl border-2 border-green-500 shadow-2xl shadow-green-500/50">
                <h2 className="text-5xl font-bold text-white mb-6 text-center bg-gradient-to-r from-green-300 to-cyan-300 bg-clip-text text-transparent">
                  Congrats!
                </h2>
                <div className="text-center mb-8">
                  <div className="text-emerald-300 font-bold text-4xl mb-2">
                    You earned {formatSol(frozenEarned)} SOL
                  </div>
                  <div className="text-purple-200/80 text-sm">
                    Confirm in Phantom to receive this amount.
                  </div>
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
                  <div className="text-6xl font-bold text-white">{formatSessionTime(getElapsedSeconds(gameState))}</div>
                  <div className="text-red-300 mt-3 font-mono">You died. Payout is 0.</div>
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
              Settling on devnet...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
