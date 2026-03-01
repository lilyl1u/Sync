'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useModalStatus, usePrivy, useWallets, useSolanaWallets } from '@privy-io/react-auth';
import type { ConnectedSolanaWallet } from '@privy-io/react-auth';
import {
  GameEngine,
  Renderer,
  createInfiniteLevel,
  createBeatLevel,
  GameState,
} from '@geometrydash/game-engine';
import { Connection, PublicKey, type Transaction } from '@solana/web3.js';
import {
  estimateEarnedBaseUnits,
  extractOnChain,
  fetchPoolConfig,
  getExtractParams,
  recordDeathOnChain,
  startSessionOnChain,
  startSessionWithAmountOnChain,
  type PoolConfig,
} from '@/lib/gamblingClient';
import { RPC_URL } from '@/lib/solana';
import { requestAndWaitFulfilled } from '@/lib/oraoVrf';
import { db } from '@/lib/firebase';

import { detectBeats, DetectedBeat } from '../utils/beatDetector';
import { playMidi, stopMidi, pauseMidi as pauseMidiPlayback, resumeMidi as resumeMidiPlayback } from '../utils/midiPlayer';

type DuelLobbyData = {
  status?: string;
  terrainSeed?: number;
  startedAt?: { seconds: number };
  hostSurvivalTime?: number | null;
  joinerSurvivalTime?: number | null;
  hostStatus?: 'playing' | 'died' | 'extracted';
  joinerStatus?: 'playing' | 'died' | 'extracted';
  winner?: 'host' | 'joiner' | null;
  bet?: string;
  hostReady?: boolean;
  joinerReady?: boolean;
  hostWallet?: string | null;
  joinerWallet?: string | null;
};

const PLAYER_SPEED = 300;
const AUDIO_URL = '/song/song.mp3';
const LOFI_API = '/api/generate-lofi';

interface GeometryDashGameProps {
  width?: number;
  height?: number;
  duelCode?: string;
  role?: 'host' | 'joiner';
}

type PhantomProvider = {
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  publicKey: PublicKey | null;
  isPhantom?: boolean;
};

type WalletAdapterLike = {
  publicKey: PublicKey | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
};

type PrivySolanaWallet = {
  address: string;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
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

function toWalletAdapter(wallet: PrivySolanaWallet): WalletAdapterLike {
  return {
    publicKey: new PublicKey(wallet.address),
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  };
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

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

export function GeometryDashGame({ width = 1200, height = 600, duelCode, role }: GeometryDashGameProps) {
  const isDuelMode = Boolean(duelCode && role);
  const {
    ready: isPrivyReady,
    authenticated: isPrivyAuthenticated,
    login: privyLogin,
  } = usePrivy();
  const { isOpen: isPrivyModalOpen } = useModalStatus();
  const { wallets: privyWallets } = useWallets();
  const {
    wallets: solanaWallets,
    ready: solanaWalletsReady,
    createWallet: createSolanaWallet,
  } = useSolanaWallets();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const hasSettledCurrentRunRef = useRef(false);
  const connectionRef = useRef<Connection | null>(null);
  const activeWalletRef = useRef<WalletAdapterLike | null>(null);
  const solanaWalletsRef = useRef<ConnectedSolanaWallet[]>(solanaWallets);
  const isPrivyAuthenticatedRef = useRef(isPrivyAuthenticated);
  const eHoldStartRef = useRef<number | null>(null);
  const eHoldRafRef = useRef<number | null>(null);
  const eHoldTriggeredRef = useRef(false);
  const frozenEarnedRef = useRef<bigint | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartedRef = useRef(false);
  const beatsRef = useRef<DetectedBeat[]>([]);
  const midiBase64Ref = useRef<string | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletProviderName, setWalletProviderName] = useState<'phantom' | 'privy' | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [walletConnectTarget, setWalletConnectTarget] = useState<'phantom' | 'privy' | null>(null);
  const [autoStartAfterPrivyConnect, setAutoStartAfterPrivyConnect] = useState(false);
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
  const [duelClaimAmount, setDuelClaimAmount] = useState<bigint | null>(null);
  const [terrainSeed, setTerrainSeed] = useState<number | null>(null);
  const [vrfRequestTx, setVrfRequestTx] = useState<string | null>(null);
  const [isRequestingVrf, setIsRequestingVrf] = useState(false);
  const sessionStartRef = useRef<number | null>(null);

  // Duel mode: lobby state from Firestore
  const [lobbyData, setLobbyData] = useState<DuelLobbyData | null>(null);
  const [duelCountdown, setDuelCountdown] = useState<number | null>(null);
  const duelLobbyUnsubRef = useRef<(() => void) | null>(null);
  const opponentDiedHandledRef = useRef(false);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const countdownInitiatedRef = useRef(false);
  const duelReadyInFlightRef = useRef(false);

  useEffect(() => {
    solanaWalletsRef.current = solanaWallets;
  }, [solanaWallets]);
  useEffect(() => {
    isPrivyAuthenticatedRef.current = isPrivyAuthenticated;
  }, [isPrivyAuthenticated]);

  // ------------------------------------------------------------------
  // Duel mode: subscribe to lobby
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!duelCode || !role) {
      setLobbyData(null);
      return;
    }
    duelLobbyUnsubRef.current?.();
    const unsub = onSnapshot(doc(db, 'lobbies', duelCode), (snap) => {
      if (!snap.exists()) {
        setLobbyData(null);
        return;
      }
      setLobbyData(snap.data() as DuelLobbyData);
    }, (err) => {
      console.error('Duel lobby listener error:', err);
      setLobbyData(null);
    });
    duelLobbyUnsubRef.current = unsub;
    return () => {
      duelLobbyUnsubRef.current?.();
      duelLobbyUnsubRef.current = null;
    };
  }, [duelCode, role]);

  // ------------------------------------------------------------------
  // Load & analyse audio on mount (level/engine created on Pay & Start after VRF)
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
      try {
        // Try Lofi API first (AI-generated beat track)
        const lofiRes = await fetch(LOFI_API, { method: 'POST' });
        if (cancelled) return;
        if (lofiRes.ok) {
          const data = await lofiRes.json();
          const beats: DetectedBeat[] = (data.beats as number[]).map((time: number, i: number) => ({
            time,
            intensity: (data.intensities as number[])?.[i] ?? 0.5,
          }));
          if (beats.length > 0) {
            beatsRef.current = beats;
            midiBase64Ref.current = data.midiBase64 ?? null;
            setAudioLoaded(true);
            return;
          }
        }

        // Fallback: static audio + beat detection
        midiBase64Ref.current = null;
        const response = await fetch(AUDIO_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;

        if (cancelled) return;

        const beats = await detectBeats(audioBuffer);
        beatsRef.current = beats;

        setAudioLoaded(true);
      } catch {
        setAudioError(true);
      } finally {
        setLoadingAudio(false);
      }
    })();

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      rendererRef.current = null;
      stopAudio();
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close();
      }
      audioCtxRef.current = null;
    };
  }, [width, height]);

  // ------------------------------------------------------------------
  // Audio playback helpers
  // ------------------------------------------------------------------
  const playAudio = useCallback(() => {
    const midiB64 = midiBase64Ref.current;
    if (midiB64) {
      void playMidi(midiB64);
      audioStartedRef.current = true;
      return;
    }

    const audioCtx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (!audioCtx || !buffer) return;

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
    if (midiBase64Ref.current) {
      stopMidi();
      audioStartedRef.current = false;
      return;
    }
    try { sourceNodeRef.current?.stop(); } catch { /* ignore */ }
    sourceNodeRef.current = null;
    audioStartedRef.current = false;
  }, []);

  const pauseAudio = useCallback(() => {
    if (midiBase64Ref.current) {
      pauseMidiPlayback();
      return;
    }
    audioCtxRef.current?.suspend();
  }, []);

  const resumeAudio = useCallback(() => {
    if (midiBase64Ref.current) {
      resumeMidiPlayback();
      return;
    }
    audioCtxRef.current?.resume();
  }, []);

  // ------------------------------------------------------------------
  // Poll engine state for UI
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

  // ------------------------------------------------------------------
  // Game lifecycle callbacks
  // ------------------------------------------------------------------
  const connectWallet = useCallback(async (target: 'phantom' | 'privy'): Promise<WalletAdapterLike> => {
    setIsWalletConnecting(true);
    setWalletConnectTarget(target);
    setErrorMessage(null);
    try {
      let connectedWallet: WalletAdapterLike;

      if (target === 'phantom') {
        const provider = getPhantomProvider();
        if (!provider) throw new Error('Phantom wallet not found. Install Phantom and try again.');
        setStatusMessage('Open Phantom to approve the connection...');
        const response = await withTimeout(
          provider.connect({ onlyIfTrusted: false }),
          60000,
          'Wallet connection timed out.',
        );
        connectedWallet = provider;
        setWalletAddress(response.publicKey.toBase58());
        setWalletProviderName('phantom');
      } else {
        if (!isPrivyReady) {
          throw new Error('Privy is still loading. Please try again.');
        }
        const getEmbeddedSolanaWallet = (): ConnectedSolanaWallet | undefined =>
          solanaWalletsRef.current.find(
            (w) => w.walletClientType === 'privy' || w.walletClientType === 'privy-v2',
          );
        if (!isPrivyAuthenticated) {
          setStatusMessage('Open Privy and sign in with your email code...');
          privyLogin({ loginMethods: ['email'], walletChainType: 'solana-only' });
          await withTimeout(
            new Promise<void>((resolve) => {
              const poll = () => {
                if (isPrivyAuthenticatedRef.current) {
                  resolve();
                  return;
                }
                setTimeout(poll, 250);
              };
              poll();
            }),
            60000,
            'Email sign-in timed out. Please try again.',
          );
        }
        let embeddedWallet = getEmbeddedSolanaWallet();
        if (!embeddedWallet) {
          setStatusMessage('Creating your Solana wallet...');
          await withTimeout(
            new Promise<void>((resolve) => {
              const poll = () => {
                if (solanaWalletsRef.current.length > 0 && getEmbeddedSolanaWallet()) {
                  resolve();
                  return;
                }
                setTimeout(poll, 250);
              };
              poll();
            }),
            15000,
            'Waiting for Solana wallet.',
          );
          embeddedWallet = getEmbeddedSolanaWallet();
        }
        if (!embeddedWallet) {
          try {
            await createSolanaWallet();
          } catch {
            // Wallet may already exist and appear on next tick
          }
          await withTimeout(
            new Promise<void>((resolve) => {
              const poll = () => {
                if (getEmbeddedSolanaWallet()) {
                  resolve();
                  return;
                }
                setTimeout(poll, 250);
              };
              poll();
            }),
            20000,
            'Privy Solana wallet was not created. Enable Solana embedded wallets in the Privy dashboard and try again.',
          );
          embeddedWallet = getEmbeddedSolanaWallet();
        }
        if (!embeddedWallet) {
          throw new Error(
            'Privy login succeeded but no Solana embedded wallet was found. Enable Solana embedded wallets in the Privy dashboard.',
          );
        }
        connectedWallet = toWalletAdapter(embeddedWallet as unknown as PrivySolanaWallet);
        if (!connectedWallet.publicKey) {
          throw new Error('Privy wallet is not connected.');
        }
        setWalletAddress(connectedWallet.publicKey.toBase58());
        setWalletProviderName('privy');
      }

      activeWalletRef.current = connectedWallet;
      if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');
      setStatusMessage('Wallet connected. Click Pay Buy-In & Start to begin.');
      return connectedWallet;
    } catch (err) {
      if (!walletAddress) {
        activeWalletRef.current = null;
        setWalletProviderName(null);
      }
      setStatusMessage(null);
      throw err;
    } finally {
      setIsWalletConnecting(false);
      setWalletConnectTarget(null);
    }
  }, [isPrivyAuthenticated, isPrivyReady, createSolanaWallet, privyLogin, walletAddress]);

  const doExtract = useCallback(
    async (earned: bigint): Promise<boolean> => {
      if (hasSettledCurrentRunRef.current || !walletAddress) return true;
      hasSettledCurrentRunRef.current = true;
      setIsSettling(true);
      setErrorMessage(null);
      setStatusMessage(`Extracting – confirm in ${walletProviderName === 'privy' ? 'Privy' : 'Phantom'}...`);

      try {
        const walletProvider = activeWalletRef.current;
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
    [walletAddress, walletProviderName],
  );

  const duelClaimPot = useCallback(async () => {
    const provider = activeWalletRef.current;
    if (!provider?.publicKey || hasSettledCurrentRunRef.current) return;
    hasSettledCurrentRunRef.current = true;
    setIsSettling(true);
    setErrorMessage(null);
    setStatusMessage(`Claiming pot – confirm in ${walletProviderName === 'privy' ? 'Privy' : 'Phantom'}...`);
    try {
      if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');
      const betAmount = BigInt(lobbyData?.bet ?? '0');
      const potAmount = betAmount * 2n;
      const params = await getExtractParams(connectionRef.current, provider.publicKey, 9999);
      const payoutBaseUnits = params.payoutBaseUnits < potAmount ? params.payoutBaseUnits : potAmount;
      if (payoutBaseUnits <= 0n) {
        throw new Error('Claimable amount is zero');
      }
      setDuelClaimAmount(payoutBaseUnits);
      const signature = await extractOnChain({
        connection: connectionRef.current,
        wallet: provider,
        payoutBaseUnits,
      });
      setSettleSignature(signature);
      setStatusMessage(`Claimed ${formatSol(payoutBaseUnits)} SOL`);
    } catch (err) {
      hasSettledCurrentRunRef.current = false;
      setErrorMessage(err instanceof Error ? err.message : 'Failed to claim pot');
      setStatusMessage(null);
    } finally {
      setIsSettling(false);
    }
  }, [walletProviderName, lobbyData?.bet]);

  const handleConnectWallet = useCallback(async (target: 'phantom' | 'privy') => {
    if (target === 'privy') {
      setAutoStartAfterPrivyConnect(true);
    }
    try {
      await connectWallet(target);
    } catch (error) {
      setAutoStartAfterPrivyConnect(false);
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
    }
  }, [connectWallet]);

  const writeDuelSurvival = useCallback(
    async (survivalTimeSeconds: number, status: 'died' | 'extracted') => {
      if (!duelCode || !role) return;
      const lobbyRef = doc(db, 'lobbies', duelCode);
      const timeField = role === 'host' ? 'hostSurvivalTime' : 'joinerSurvivalTime';
      const statusField = role === 'host' ? 'hostStatus' : 'joinerStatus';
      try {
        await updateDoc(lobbyRef, { [timeField]: survivalTimeSeconds, [statusField]: status });
      } catch (err) {
        console.error('Failed to write duel survival:', err);
      }
    },
    [duelCode, role],
  );

  // ------------------------------------------------------------------
  // Duel: press "I'm Ready"
  // ------------------------------------------------------------------
  const handleDuelReady = useCallback(async () => {
    if (!duelCode || !role || !walletAddress) return;
    if (duelReadyInFlightRef.current) return;
    const myReady = role === 'host' ? lobbyData?.hostReady : lobbyData?.joinerReady;
    if (myReady) return;
    const provider = activeWalletRef.current;
    if (!provider?.publicKey) {
      setErrorMessage('Wallet not connected.');
      return;
    }
    setErrorMessage(null);
    duelReadyInFlightRef.current = true;
    setIsPayingBuyIn(true);
    setStatusMessage('Confirm your bet in wallet...');
    try {
      if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');
      const betBaseUnits = BigInt(lobbyData?.bet ?? '0');
      if (betBaseUnits <= 0n) {
        throw new Error('Invalid duel bet amount.');
      }
      const signature = await startSessionWithAmountOnChain({
        connection: connectionRef.current,
        wallet: provider,
        amountBaseUnits: betBaseUnits,
      });
      setBuyInSignature(signature);
      setStatusMessage('Confirming on chain...');
      await connectionRef.current.confirmTransaction(signature, 'confirmed');
      const config = await fetchPoolConfig(connectionRef.current);
      setPoolConfig({
        ...config,
        buyInBaseUnits: betBaseUnits,
      });

      const lobbyRef = doc(db, 'lobbies', duelCode);
      const readyField = role === 'host' ? 'hostReady' : 'joinerReady';
      const walletField = role === 'host' ? 'hostWallet' : 'joinerWallet';
      await updateDoc(lobbyRef, { [readyField]: true, [walletField]: walletAddress });
      setStatusMessage('Bet paid! Waiting for opponent...');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to pay bet');
      setStatusMessage(null);
    } finally {
      duelReadyInFlightRef.current = false;
      setIsPayingBuyIn(false);
    }
  }, [duelCode, role, walletAddress, lobbyData?.hostReady, lobbyData?.joinerReady, lobbyData?.bet]);

  // ------------------------------------------------------------------
  // Duel: when both ready, host triggers VRF → countdown
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isDuelMode || role !== 'host' || !lobbyData) return;
    if (!lobbyData.hostReady || !lobbyData.joinerReady) return;
    if (lobbyData.status === 'countdown' || lobbyData.status === 'playing' || lobbyData.status === 'finished') return;

    const provider = activeWalletRef.current;
    if (!provider?.publicKey) return;

    let cancelled = false;
    (async () => {
      setIsRequestingVrf(true);
      setStatusMessage('Both ready! Generating terrain...');
      try {
        if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');
        const vrfResult = await requestAndWaitFulfilled(connectionRef.current, provider);
        if (cancelled) return;
        setTerrainSeed(vrfResult.seed);
        setVrfRequestTx(vrfResult.requestTx);
        const lobbyRef = doc(db, 'lobbies', duelCode!);
        await updateDoc(lobbyRef, {
          terrainSeed: vrfResult.seed,
          status: 'countdown',
        });
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'VRF failed');
          setStatusMessage(null);
        }
      } finally {
        if (!cancelled) setIsRequestingVrf(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDuelMode, role, lobbyData?.hostReady, lobbyData?.joinerReady, lobbyData?.status, duelCode]);

  const buildLevelAndEngine = useCallback(
    (seed: number) => {
      const renderer = rendererRef.current;
      if (!renderer) return null;

      let level;
      if (audioError || !beatsRef.current.length) {
        level = createInfiniteLevel();
      } else {
        level = createBeatLevel({
          beats: beatsRef.current.map((b) => b.time),
          playerSpeed: PLAYER_SPEED,
          intensities: beatsRef.current.map((b) => b.intensity),
          seed,
        });
      }

      const engine = new GameEngine(level, {
        canvasWidth: width,
        canvasHeight: height,
        playerSpeed: PLAYER_SPEED,
        initialChunkSeed: seed,
      });

      engine.onRender((state) => renderer.render(state));
      engine.onGameOver(() => {
        setIsGameOver(true);
        stopAudio();
        if (duelCode && role) {
          const elapsed = getElapsedSeconds(engine.getState());
          void writeDuelSurvival(elapsed, 'died');
          const wallet = activeWalletRef.current;
          if (wallet?.publicKey && connectionRef.current) {
            void recordDeathOnChain({ connection: connectionRef.current, wallet });
          }
        }
      });

      renderer.render(engine.getState());
      return engine;
    },
    [audioError, width, height, stopAudio, duelCode, role, writeDuelSurvival],
  );

  // ------------------------------------------------------------------
  // Duel: countdown 3-2-1 then start (timers stored in ref to survive status changes)
  // ------------------------------------------------------------------
  const startDuelEngine = useCallback((seed: number) => {
    const newEngine = buildLevelAndEngine(seed);
    if (!newEngine) return;
    engineRef.current = newEngine;
    opponentDiedHandledRef.current = false;
    setSettleSignature(null);
    setDuelClaimAmount(null);
    setFrozenEarned(null);
    frozenEarnedRef.current = null;
    hasSettledCurrentRunRef.current = false;
    setDisplayElapsedFallback(0);
    setStatusMessage(null);
    newEngine.start();
    setHasStarted(true);
    setIsGameOver(false);
    setHasExtracted(false);
    gameContainerRef.current?.focus();
    if (audioLoaded) playAudio();
    if (role === 'host' && duelCode) {
      void updateDoc(doc(db, 'lobbies', duelCode), {
        status: 'playing',
        startedAt: serverTimestamp(),
        hostStatus: 'playing',
        joinerStatus: 'playing',
      });
    }
  }, [buildLevelAndEngine, audioLoaded, playAudio, role, duelCode]);

  useEffect(() => {
    if (!isDuelMode || !lobbyData || hasStarted) return;
    if (countdownInitiatedRef.current) return;

    const seed = lobbyData.terrainSeed;
    if (typeof seed !== 'number') return;

    if (lobbyData.status === 'countdown') {
      countdownInitiatedRef.current = true;
      setTerrainSeed(seed);
      setDuelCountdown(3);
      countdownTimersRef.current = [
        setTimeout(() => setDuelCountdown(2), 1000),
        setTimeout(() => setDuelCountdown(1), 2000),
        setTimeout(() => { setDuelCountdown(0); startDuelEngine(seed); }, 3000),
        setTimeout(() => setDuelCountdown(null), 3600),
      ];
    } else if (lobbyData.status === 'playing') {
      countdownInitiatedRef.current = true;
      setTerrainSeed(seed);
      startDuelEngine(seed);
    }
  }, [isDuelMode, lobbyData, hasStarted, startDuelEngine]);

  useEffect(() => {
    return () => {
      countdownTimersRef.current.forEach(clearTimeout);
      countdownTimersRef.current = [];
    };
  }, []);

  // ------------------------------------------------------------------
  // Duel: detect opponent death → stop local game, show YOU WIN
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isDuelMode || !hasStarted || isGameOver || !lobbyData) return;
    const opponentStatus = role === 'host' ? lobbyData.joinerStatus : lobbyData.hostStatus;
    if (opponentStatus === 'died' && !opponentDiedHandledRef.current) {
      opponentDiedHandledRef.current = true;
      const engine = engineRef.current;
      if (engine) engine.pause();
      stopAudio();
      const elapsed = getElapsedSeconds(engine?.getState() ?? null);
      setIsGameOver(true);
      void writeDuelSurvival(elapsed, 'extracted');
      const lobbyRef = doc(db, 'lobbies', duelCode!);
      void updateDoc(lobbyRef, { winner: role, status: 'finished' });
      void duelClaimPot();
    }
  }, [isDuelMode, hasStarted, isGameOver, lobbyData, role, duelCode, stopAudio, writeDuelSurvival, duelClaimPot]);

  const handlePayAndStart = useCallback(async () => {
    if (hasStarted || !walletAddress) return;
    if (isDuelMode) return;
    const provider = activeWalletRef.current;
    if (!provider?.publicKey) {
      setErrorMessage('Wallet disconnected. Please connect again.');
      setWalletAddress(null);
      setWalletProviderName(null);
      activeWalletRef.current = null;
      return;
    }
    setErrorMessage(null);
    setIsPayingBuyIn(true);

    try {
      if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');

      let engine = engineRef.current;

      if (!engine) {
        setIsRequestingVrf(true);
        setStatusMessage('Requesting verified randomness...');
        const vrfResult = await requestAndWaitFulfilled(connectionRef.current, provider);
        setTerrainSeed(vrfResult.seed);
        setVrfRequestTx(vrfResult.requestTx);

        const newEngine = buildLevelAndEngine(vrfResult.seed);
        if (!newEngine) throw new Error('Failed to build level');
        engineRef.current = newEngine;
        engine = newEngine;
        setIsRequestingVrf(false);
      }

      setStatusMessage('Submitting on-chain start transaction...');
      const signature = await startSessionOnChain({
        connection: connectionRef.current,
        wallet: provider,
      });
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
      if (audioLoaded) playAudio();
    } catch (error) {
      setIsRequestingVrf(false);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start');
      setStatusMessage(null);
    } finally {
      setIsPayingBuyIn(false);
    }
  }, [hasStarted, walletAddress, audioLoaded, playAudio, buildLevelAndEngine, isDuelMode]);

  useEffect(() => {
    if (!autoStartAfterPrivyConnect) return;
    if (!walletAddress || hasStarted || loadingAudio || isWalletConnecting || isPayingBuyIn || isRequestingVrf) return;
    if (isDuelMode) return;

    setAutoStartAfterPrivyConnect(false);
    setStatusMessage('Privy connected. Starting game...');
    void handlePayAndStart();
  }, [
    autoStartAfterPrivyConnect,
    walletAddress,
    hasStarted,
    loadingAudio,
    isWalletConnecting,
    isPayingBuyIn,
    isRequestingVrf,
    isDuelMode,
    handlePayAndStart,
  ]);

  const FEE_BUFFER_LAMPORTS = 300_000n;

  const triggerHoldExtract = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !hasStarted || isGameOver || hasExtracted || isSettling) return;

    const secs = Math.max(getElapsedSeconds(engine.getState()), displayElapsedFallback);

    if (isDuelMode && duelCode && role) {
      // Duel mode: write survival time, no on-chain extract
      frozenEarnedRef.current = null;
      engine.pause();
      stopAudio();
      setFrozenEarned(null);
      setHasExtracted(true);
      await writeDuelSurvival(secs, 'extracted');
      return;
    }

    const earned = estimateEarnedBaseUnits(secs, poolConfig ?? undefined);
    const totalPayout = earned + FEE_BUFFER_LAMPORTS;
    frozenEarnedRef.current = totalPayout;
    engine.pause();
    stopAudio();
    setFrozenEarned(totalPayout);
    setHasExtracted(true);
    const ok = await doExtract(totalPayout);
    if (!ok) {
      frozenEarnedRef.current = null;
      setFrozenEarned(null);
      setHasExtracted(false);
      engine.resume();
      if (audioLoaded) resumeAudio();
    }
  }, [displayElapsedFallback, hasExtracted, hasStarted, isGameOver, isSettling, poolConfig, doExtract, stopAudio, audioLoaded, resumeAudio, isDuelMode, duelCode, role, writeDuelSurvival]);

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
    stopAudio();
    frozenEarnedRef.current = null;
    const engine = engineRef.current;
    if (engine) {
      engine.destroy();
      engineRef.current = null;
    }
    setGameState(null);
    setIsGameOver(false);
    setHasExtracted(false);
    setHasStarted(false);
    setBuyInSignature(null);
    setSettleSignature(null);
    setFrozenEarned(null);
    setDuelClaimAmount(null);
    setPoolConfig(null);
    setTerrainSeed(null);
    setVrfRequestTx(null);
    setStatusMessage(null);
    setErrorMessage(null);
    setDisplayElapsedFallback(0);
    hasSettledCurrentRunRef.current = false;
    countdownInitiatedRef.current = false;
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
    setDuelCountdown(null);
    gameContainerRef.current?.focus();
  }, [cancelExtractHold, stopAudio]);

  useEffect(() => {
    if (hasExtracted) cancelExtractHold();
  }, [cancelExtractHold, hasExtracted]);

  // ------------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === 'r' || e.key === 'R') { handleRestart(); return; }
      if (e.key === 'Enter' && !hasStarted && !loadingAudio) {
        e.preventDefault();
        if (isDuelMode) {
          if (walletAddress) void handleDuelReady();
          else void handleConnectWallet('phantom');
        } else {
          if (walletAddress) void handlePayAndStart();
          else void handleConnectWallet('phantom');
        }
      }
      if ((e.key === 'e' || e.key === 'E') && !e.repeat && !loadingAudio) {
        e.preventDefault();
        startExtractHold();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if ((e.key === 'e' || e.key === 'E') && !eHoldTriggeredRef.current) cancelExtractHold();
    };
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cancelExtractHold, handleConnectWallet, handlePayAndStart, handleDuelReady, handleRestart, hasExtracted, hasStarted, isGameOver, startExtractHold, walletAddress, loadingAudio, isDuelMode, role]);

  // Compute the live earned value (only used while playing, NOT after extract)
  const liveEarned: bigint | null = (gameState && hasStarted && !isGameOver && !hasExtracted)
    ? estimateEarnedBaseUnits(
        Math.max(getElapsedSeconds(gameState), displayElapsedFallback),
        poolConfig ?? undefined,
      )
    : null;

  const ratePerSec = poolConfig?.payoutRateBaseUnitsPerSecond
    ?? BigInt(process.env.NEXT_PUBLIC_PAYOUT_RATE_BASE_UNITS_PER_SECOND ?? '100000');
  const embeddedPrivyWallet = solanaWallets.find(
    (w) => w.walletClientType === 'privy' || w.walletClientType === 'privy-v2',
  );

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
      {/* Duel countdown overlay */}
      {duelCountdown !== null && duelCountdown > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-9xl font-bold text-white animate-ping" style={{ animationDuration: '0.8s' }}>
            {duelCountdown}
          </div>
        </div>
      )}
      {duelCountdown === 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-7xl font-bold text-emerald-400 animate-pulse">GO!</div>
        </div>
      )}

      <div className="relative" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border-4 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/50"
        />
        {gameState && liveEarned !== null && !isDuelMode && (
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

      {/* Start / loading screen */}
      {!hasStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl border-2 border-purple-500 p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {loadingAudio
                ? 'Loading Audio...'
                : isDuelMode
                  ? 'Duel Arena'
                  : 'Ready to Play?'}
            </h2>
            <p className="text-purple-200 mb-3 max-w-md">
              {isDuelMode
                ? 'Both players must ready up. First to die loses the pot.'
                : 'Survive as long as you can. The longer you live, the more SOL you earn. Hold E to extract.'}
            </p>
            {walletBalanceLamports !== null && (
              <p className="text-emerald-400 font-semibold mb-2 font-mono">
                Wallet: {formatSolBalance(walletBalanceLamports)} SOL
              </p>
            )}
            {!isDuelMode && (
              <p className="text-purple-300 mb-6 max-w-md font-mono text-sm">
                Rate: {formatSol(ratePerSec)} SOL/sec
              </p>
            )}
            {isDuelMode && lobbyData?.bet && (
              <p className="text-purple-300 mb-4 max-w-md font-mono text-sm">
                Pot: {formatSol(BigInt(lobbyData.bet) * 2n)} SOL ({formatSol(BigInt(lobbyData.bet))} SOL each)
              </p>
            )}
            {/* Duel: ready status indicators */}
            {isDuelMode && walletAddress && (
              <div className="mb-6 space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${lobbyData?.hostReady ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="text-white font-mono text-sm">Host {lobbyData?.hostReady ? '- READY' : '- Not ready'}</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${lobbyData?.joinerReady ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="text-white font-mono text-sm">Joiner {lobbyData?.joinerReady ? '- READY' : '- Not ready'}</span>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isDuelMode ? (
                !walletAddress ? (
                  <>
                    <button
                      onClick={() => void handleConnectWallet('phantom')}
                      disabled={isWalletConnecting || loadingAudio}
                      className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isWalletConnecting && walletConnectTarget === 'phantom' ? 'Connecting Phantom...' : 'Connect Phantom'}
                    </button>
                    <button
                      onClick={() => void handleConnectWallet('privy')}
                      disabled={isWalletConnecting || loadingAudio || !isPrivyReady}
                      className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/30 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isWalletConnecting && walletConnectTarget === 'privy'
                        ? 'Signing in with email...'
                        : 'Use Email (Privy)'}
                    </button>
                  </>
                ) : (() => {
                  const myReady = role === 'host' ? lobbyData?.hostReady : lobbyData?.joinerReady;
                  const opponentReady = role === 'host' ? lobbyData?.joinerReady : lobbyData?.hostReady;
                  if (myReady && opponentReady) {
                    return (
                      <div className="text-emerald-400 font-mono font-bold py-4 animate-pulse">
                        {isRequestingVrf ? 'Generating terrain...' : 'Starting countdown...'}
                      </div>
                    );
                  }
                  if (myReady) {
                    return (
                      <div className="text-emerald-400 font-mono font-bold py-4 animate-pulse">
                        Waiting for opponent to ready up...
                      </div>
                    );
                  }
                  return (
                    <button
                      onClick={() => void handleDuelReady()}
                      disabled={loadingAudio || isPayingBuyIn}
                      className="px-12 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:from-green-500 hover:to-emerald-500 transition-all shadow-lg text-xl disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isPayingBuyIn ? 'Confirm in wallet...' : "I'm Ready"}
                    </button>
                  );
                })()
              ) : !walletAddress ? (
                <>
                  <button
                    onClick={() => void handleConnectWallet('phantom')}
                    disabled={isWalletConnecting || loadingAudio}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isWalletConnecting && walletConnectTarget === 'phantom' ? 'Connecting Phantom...' : 'Connect Phantom'}
                  </button>
                  <button
                    onClick={() => void handleConnectWallet('privy')}
                    disabled={isWalletConnecting || loadingAudio || !isPrivyReady}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/30 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isWalletConnecting && walletConnectTarget === 'privy'
                      ? 'Signing in with email...'
                      : 'Use Email (Privy)'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => void handlePayAndStart()}
                  disabled={isPayingBuyIn || isRequestingVrf || loadingAudio}
                  className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50 text-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRequestingVrf
                    ? 'Requesting VRF...'
                    : isPayingBuyIn
                      ? `Confirm in ${walletProviderName === 'privy' ? 'Privy' : 'Phantom'}...`
                      : 'Pay Buy-In & Start'}
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

          {audioLoaded && (
            <div className="absolute top-24 left-8 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-pink-500/30">
              <div className="text-xs text-pink-300 font-mono flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
                Beat Sync
              </div>
            </div>
          )}

          <div className="absolute top-8 right-8 bg-black/30 backdrop-blur-sm px-4 py-3 rounded-lg border border-purple-500/30 max-w-[30rem]">
            <div className="text-xs text-purple-200 font-mono space-y-1">
              <div>Wallet: {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Not connected'}</div>
              {walletProviderName && <div>Provider: {walletProviderName === 'privy' ? 'Privy (Embedded)' : 'Phantom'}</div>}
              {walletBalanceLamports !== null && (
                <div className="text-emerald-400 font-semibold">Balance: {formatSolBalance(walletBalanceLamports)} SOL</div>
              )}
              {terrainSeed !== null && (
                <div className="text-cyan-300/90">
                  Terrain seed: 0x{terrainSeed.toString(16).toUpperCase().padStart(8, '0')}
                </div>
              )}
              {vrfRequestTx && (
                <a
                  href={`https://solscan.io/tx/${vrfRequestTx}${RPC_URL.includes('devnet') ? '?cluster=devnet' : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline block pointer-events-auto"
                >
                  Verified by ORAO VRF
                </a>
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

          {hasExtracted && frozenEarned !== null && !isDuelMode && (
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
                    Confirm in {walletProviderName === 'privy' ? 'Privy' : 'Phantom'} to receive this amount.
                  </div>
                  {vrfRequestTx && (
                    <a
                      href={`https://solscan.io/tx/${vrfRequestTx}${RPC_URL.includes('devnet') ? '?cluster=devnet' : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block text-cyan-400 hover:text-cyan-300 text-sm font-mono underline"
                    >
                      Terrain verified by ORAO VRF
                    </a>
                  )}
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

          {isDuelMode && (isGameOver || hasExtracted) && (() => {
            const opponentStatus = role === 'host' ? lobbyData?.joinerStatus : lobbyData?.hostStatus;
            const iDied = (role === 'host' ? lobbyData?.hostStatus : lobbyData?.joinerStatus) === 'died';
            const opponentDied = opponentStatus === 'died';
            const iWon = opponentDied && !iDied;
            const iLost = iDied && !opponentDied;
            const betBaseUnits = BigInt(lobbyData?.bet ?? '0');
            const potBaseUnits = betBaseUnits * 2n;

            return (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto">
                <div className={`p-12 rounded-2xl border-2 shadow-2xl max-w-lg ${
                  iWon
                    ? 'bg-gradient-to-br from-purple-900/90 to-green-900/90 border-green-500 shadow-green-500/50'
                    : 'bg-gradient-to-br from-purple-900/90 to-red-900/90 border-red-500 shadow-red-500/50'
                }`}>
                  <h2 className={`text-6xl font-bold mb-6 text-center bg-clip-text text-transparent ${
                    iWon
                      ? 'bg-gradient-to-r from-green-300 to-cyan-300'
                      : iLost
                        ? 'bg-gradient-to-r from-red-300 to-pink-300'
                        : 'bg-gradient-to-r from-purple-400 to-pink-400'
                  }`}>
                    {iWon ? 'YOU WIN!' : iLost ? 'YOU LOSE' : 'Waiting...'}
                  </h2>
                  <div className="text-center mb-6">
                    {iWon ? (
                      <>
                        <div className="text-emerald-300 font-bold text-2xl mb-2">
                          You win: {formatSol(duelClaimAmount ?? potBaseUnits)} SOL
                        </div>
                        {duelClaimAmount !== null && duelClaimAmount < potBaseUnits && (
                          <div className="text-purple-300/80 font-mono text-xs mb-2">
                            Capped by current on-chain claimable amount.
                          </div>
                        )}
                        {isSettling && (
                          <div className="text-cyan-300 font-mono text-sm animate-pulse">
                            Claiming pot – confirm in wallet...
                          </div>
                        )}
                        {settleSignature && (
                          <div className="text-emerald-400 font-mono text-sm mt-1">
                            Pot claimed!
                          </div>
                        )}
                        {errorMessage && !settleSignature && !isSettling && (
                          <div className="text-red-300 font-mono text-sm mt-1">
                            {errorMessage}
                          </div>
                        )}
                      </>
                    ) : iLost ? (
                      <div className="text-red-300 font-bold text-xl mb-2">
                        You died first. Opponent wins the pot.
                      </div>
                    ) : (
                      <div className="text-purple-300 font-mono animate-pulse">
                        Waiting for opponent...
                      </div>
                    )}
                  </div>
                  <div className="text-center mb-8">
                    <div className="text-purple-200/70 font-mono text-sm">
                      Your time: {formatSessionTime(Math.max(getElapsedSeconds(gameState), displayElapsedFallback))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {iWon && !settleSignature && !isSettling && (
                      <button
                        onClick={() => void duelClaimPot()}
                        className="w-full px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:from-green-500 hover:to-emerald-500 transition-all shadow-lg text-center"
                      >
                        Claim Pot
                      </button>
                    )}
                    <Link
                      href="/duels"
                      className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg text-center hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg"
                    >
                      Back to Duels
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          {isGameOver && !isDuelMode && (
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
