'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { ConnectedSolanaWallet } from '@privy-io/react-auth';
import { usePrivyGame } from '@/app/lib/privy-bridge';
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
  getExtractParams,
  recordDeathOnChain,
  startSessionOnChain,
  startSessionWithAmountOnChain,
  type PoolConfig,
} from '@/lib/gamblingClient';
import { RPC_URL } from '@/lib/solana';
import { requestAndWaitFulfilled } from '@/lib/oraoVrf';
import { db } from '@/lib/firebase';

import type { DetectedBeat } from '../utils/beatDetector';
import { getPreloadedAssets, preloadGameAssets } from '../utils/gamePreload';
import * as Tone from 'tone';
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
/** Background track; always used for playback so game starts fast. */
const BG_MP4_URL = '/audio.mp4';
const BG_VOLUME = 0.5;
const MIDI_VOLUME = 0.5;

/** Synthetic beats when LOFI/song unavailable: one beat every 0.5s for 2 min. */
function syntheticBeats(): DetectedBeat[] {
  const beats: DetectedBeat[] = [];
  for (let t = 0; t < 120; t += 0.5) {
    beats.push({ time: t, intensity: 0.7 });
  }
  return beats;
}

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
    isConfigured: isPrivyConfigured,
    isPrivyReady,
    isPrivyAuthenticated,
    privyLogin,
    solanaWallets,
    solanaWalletsReady,
    createSolanaWallet,
  } = usePrivyGame();

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
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const hasStartedRef = useRef(false);
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
  const [soloBetInput, setSoloBetInput] = useState('0.005');
  const [soloBetLamports, setSoloBetLamports] = useState<bigint | null>(null);
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

  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  // ------------------------------------------------------------------
  // Load audio/beats quickly: try LOFI API with short timeout, else synthetic beats.
  // No heavy decode so "Ready to play" appears in ~1–2s.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    const renderer = new Renderer({ canvas, width, height });
    rendererRef.current = renderer;

    const preloaded = getPreloadedAssets();
    if (preloaded?.beats.length) {
      beatsRef.current = preloaded.beats;
      midiBase64Ref.current = preloaded.midiBase64;
    } else {
      beatsRef.current = syntheticBeats();
    }
    setAudioLoaded(true);
    setLoadingAudio(false);

    void preloadGameAssets().then((assets) => {
      if (cancelled || hasStartedRef.current) return;
      beatsRef.current = assets.beats;
      midiBase64Ref.current = assets.midiBase64;
    });

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
  // Audio playback helpers: generated MIDI (or fallback song) at 50% + audio.mp4 at 50%
  // ------------------------------------------------------------------
  const startBgMp4 = useCallback(() => {
    const el = bgAudioRef.current;
    if (!el) return;
    el.volume = BG_VOLUME;
    el.play().catch(() => {
      setTimeout(() => el.play().catch(() => {}), 150);
    });
  }, []);

  const stopBgMp4 = useCallback(() => {
    const el = bgAudioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }, []);

  const playAudio = useCallback(() => {
    console.log('[playAudio] called, midiBase64Ref.current:', !!midiBase64Ref.current, 'length:', midiBase64Ref.current?.length ?? 0);
    startBgMp4();

    const midiB64 = midiBase64Ref.current;
    if (midiB64) {
      console.log('[playAudio] Has MIDI, calling Tone.start() then playMidi');
      Tone.start()
        .then(() => {
          console.log('[playAudio] Tone.start() resolved, calling playMidi');
          return playMidi(midiB64, MIDI_VOLUME);
        })
        .then(() => console.log('[playAudio] playMidi() completed'))
        .catch((e) => console.log('[playAudio] Tone/playMidi error:', e));
      audioStartedRef.current = true;
      return;
    }
    console.log('[playAudio] No MIDI, buffer path not used (synthetic beats)');

    const audioCtx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (!audioCtx || !buffer) return;

    try { sourceNodeRef.current?.stop(); } catch { /* ignore */ }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = BG_VOLUME;
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.start(0);
    sourceNodeRef.current = source;
    audioStartedRef.current = true;

    if (audioCtx.state === 'suspended') audioCtx.resume();
  }, [startBgMp4]);

  const stopAudio = useCallback(() => {
    stopBgMp4();
    if (midiBase64Ref.current) {
      stopMidi();
      audioStartedRef.current = false;
      return;
    }
    try { sourceNodeRef.current?.stop(); } catch { /* ignore */ }
    sourceNodeRef.current = null;
    audioStartedRef.current = false;
  }, [stopBgMp4]);

  const pauseAudio = useCallback(() => {
    const el = bgAudioRef.current;
    if (el) el.pause();
    if (midiBase64Ref.current) {
      pauseMidiPlayback();
      return;
    }
    audioCtxRef.current?.suspend();
  }, []);

  const resumeAudio = useCallback(() => {
    const el = bgAudioRef.current;
    if (el) {
      el.volume = BG_VOLUME;
      el.play().catch(() => {});
    }
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
            (w: ConnectedSolanaWallet) => w.walletClientType === 'privy' || w.walletClientType === 'privy-v2',
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

  const duelRefund = useCallback(async () => {
    const provider = activeWalletRef.current;
    if (!provider?.publicKey || hasSettledCurrentRunRef.current) return;
    hasSettledCurrentRunRef.current = true;
    setIsSettling(true);
    setErrorMessage(null);
    setStatusMessage(`Refunding bet – confirm in ${walletProviderName === 'privy' ? 'Privy' : 'Phantom'}...`);
    try {
      if (!connectionRef.current) connectionRef.current = new Connection(RPC_URL, 'confirmed');
      const betAmount = BigInt(lobbyData?.bet ?? '0');
      const params = await getExtractParams(connectionRef.current, provider.publicKey, 9999);
      const refundAmount = params.payoutBaseUnits < betAmount ? params.payoutBaseUnits : betAmount;
      if (refundAmount <= 0n) {
        throw new Error('Refund amount is zero');
      }
      setDuelClaimAmount(refundAmount);
      const signature = await extractOnChain({
        connection: connectionRef.current,
        wallet: provider,
        payoutBaseUnits: refundAmount,
      });
      setSettleSignature(signature);
      setStatusMessage(`Refunded ${formatSol(refundAmount)} SOL`);
    } catch (err) {
      hasSettledCurrentRunRef.current = false;
      setErrorMessage(err instanceof Error ? err.message : 'Failed to refund');
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
      const duelRate = betBaseUnits / 15n || 1n;
      const signature = await startSessionWithAmountOnChain({
        connection: connectionRef.current,
        wallet: provider,
        amountBaseUnits: betBaseUnits,
        payoutRateBaseUnits: duelRate,
      });
      setBuyInSignature(signature);
      setStatusMessage('Confirming on chain...');
      await connectionRef.current.confirmTransaction(signature, 'confirmed');
      setPoolConfig({
        buyInBaseUnits: betBaseUnits,
        payoutRateBaseUnitsPerSecond: duelRate,
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
        initialPlayerSpeed: Math.round(PLAYER_SPEED * 0.55),
        speedRampDurationSeconds: 75,
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
    if (!isDuelMode || !hasStarted || !lobbyData) return;
    if (opponentDiedHandledRef.current) return;
    const myStatus = role === 'host' ? lobbyData.hostStatus : lobbyData.joinerStatus;
    const opponentStatus = role === 'host' ? lobbyData.joinerStatus : lobbyData.hostStatus;

    if (opponentStatus === 'died') {
      opponentDiedHandledRef.current = true;
      const engine = engineRef.current;
      if (engine) engine.pause();
      stopAudio();
      const elapsed = getElapsedSeconds(engine?.getState() ?? null);
      if (!isGameOver) setIsGameOver(true);

      if (myStatus === 'died') {
        const lobbyRef = doc(db, 'lobbies', duelCode!);
        void updateDoc(lobbyRef, { winner: null, status: 'finished' });
        void duelRefund();
      } else {
        void writeDuelSurvival(elapsed, 'extracted');
        const lobbyRef = doc(db, 'lobbies', duelCode!);
        void updateDoc(lobbyRef, { winner: role, status: 'finished' });
        void duelClaimPot();
      }
    }
  }, [isDuelMode, hasStarted, isGameOver, lobbyData, role, duelCode, stopAudio, writeDuelSurvival, duelClaimPot, duelRefund]);

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

      const betStr = soloBetInput.trim();
      const betSol = parseFloat(betStr);
      if (!betStr || !Number.isFinite(betSol) || betSol <= 0) {
        throw new Error('Enter a valid SOL bet amount.');
      }
      const betLamports = BigInt(Math.round(betSol * 1e9));
      const ratePerSec = betLamports / 15n || 1n;
      setSoloBetLamports(betLamports);

      setStatusMessage('Submitting on-chain start transaction...');
      const signature = await startSessionWithAmountOnChain({
        connection: connectionRef.current,
        wallet: provider,
        amountBaseUnits: betLamports,
        payoutRateBaseUnits: ratePerSec,
      });
      setBuyInSignature(signature);
      setStatusMessage('Waiting for on-chain confirmation...');
      await connectionRef.current.confirmTransaction(signature, 'confirmed');

      setPoolConfig({
        buyInBaseUnits: betLamports,
        payoutRateBaseUnitsPerSecond: ratePerSec,
      });

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
  }, [hasStarted, walletAddress, audioLoaded, playAudio, buildLevelAndEngine, isDuelMode, soloBetInput]);

  const handleStartPractice = useCallback(() => {
    if (hasStarted || isDuelMode) return;
    const seed = Math.floor(Math.random() * 1_000_000_000);
    setTerrainSeed(seed);
    const engine = buildLevelAndEngine(seed);
    if (!engine) {
      setErrorMessage('Failed to build level');
      return;
    }
    engineRef.current = engine;
    setPoolConfig(null);
    setSoloBetLamports(null);
    setBuyInSignature(null);
    setSettleSignature(null);
    setFrozenEarned(null);
    frozenEarnedRef.current = null;
    hasSettledCurrentRunRef.current = true;
    setDisplayElapsedFallback(0);
    setErrorMessage(null);
    setStatusMessage(null);
    engine.start();
    setHasStarted(true);
    setIsGameOver(false);
    setHasExtracted(false);
    gameContainerRef.current?.focus();
    if (audioLoaded) playAudio();
  }, [hasStarted, isDuelMode, buildLevelAndEngine, audioLoaded, playAudio]);

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
    setSoloBetLamports(null);
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

  useEffect(() => {
    const gameplayActive = hasStarted && !isGameOver && !hasExtracted;
    window.dispatchEvent(
      new CustomEvent('geometrydash:gameplay-state', { detail: { active: gameplayActive } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('geometrydash:gameplay-state', { detail: { active: false } }),
      );
    };
  }, [hasStarted, isGameOver, hasExtracted]);

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

  const embeddedPrivyWallet = solanaWallets.find(
    (w: ConnectedSolanaWallet) => w.walletClientType === 'privy' || w.walletClientType === 'privy-v2',
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div
      ref={gameContainerRef}
      tabIndex={0}
      className="relative w-full h-full flex items-center justify-center outline-none focus:outline-none"
      aria-label="Game"
    >
      <audio
        ref={bgAudioRef}
        src={BG_MP4_URL}
        preload="auto"
        loop
        playsInline
        className="hidden"
        aria-hidden
      />
      {/* Duel countdown overlay */}
      {duelCountdown !== null && duelCountdown > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-overlay">
          <div className="px-title text-7xl">{duelCountdown}</div>
        </div>
      )}
      {duelCountdown === 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="px-title text-5xl px-blink">GO!</div>
        </div>
      )}

      <div className="relative" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border-4 border-[var(--px-ink)] shadow-[6px_6px_0_var(--px-ink)]"
        />
        {gameState && extractHoldProgress > 0 && !hasExtracted && !isGameOver && (
          <div
            className="absolute pointer-events-none font-mono w-48"
            style={{
              left: gameState.player.position.x - gameState.cameraOffset + gameState.player.size.x / 2,
              top: gameState.player.position.y - 72,
              transform: 'translate(-50%, 0)',
            }}
          >
            <div className="text-[10px] mb-1 text-center">Hold E to extract</div>
            <div className="w-full h-3 bg-[var(--px-cream)] overflow-hidden border-2 border-[var(--px-ink)]">
              <div
                className="h-full bg-[var(--px-gold)]"
                style={{ width: `${Math.round(extractHoldProgress * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Initial loader: single stable screen until audio is ready to avoid layout thrash */}
      {!hasStarted && loadingAudio && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <p className="px-kicker px-blink">Preparing game...</p>
        </div>
      )}

      {/* Start screen: only after audio is loaded so content doesn't jump */}
      {!hasStarted && !loadingAudio && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10 animate-fade-in">
          <div className="px-panel p-8 text-center min-w-[22rem] min-h-[18rem] flex flex-col justify-center">
            <h2 className="px-title text-2xl mb-4">
              {isDuelMode ? 'DUEL' : 'READY?'}
            </h2>
            <p className="text-[10px] mb-3 max-w-md">
              {isDuelMode
                ? 'Both players must ready up. First to die loses the pot.'
                : 'Survive as long as you can. The longer you live, the more SOL you earn. Hold E to extract.'}
            </p>
            <div className="min-h-[4rem] flex flex-col justify-center">
            {walletBalanceLamports !== null && (
              <p className="mb-2 text-[10px]">
                Wallet: {formatSolBalance(walletBalanceLamports)} SOL
              </p>
            )}
            {!isDuelMode && walletAddress && (
              <div className="mb-4 w-full max-w-xs mx-auto">
                <label className="block text-[10px] mb-1">Bet amount (SOL)</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={soloBetInput}
                  onChange={(e) => setSoloBetInput(e.target.value)}
                  placeholder="e.g. 0.005"
                  className="px-input text-center"
                />
                {(() => {
                  const val = parseFloat(soloBetInput);
                  if (soloBetInput.trim() && Number.isFinite(val) && val > 0) {
                    const rateLam = BigInt(Math.round(val * 1e9)) / 15n || 1n;
                    return (
                      <p className="mt-2 text-[10px]">
                        Rate: {formatSol(rateLam)} SOL/sec (break even in 15s)
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            {!isDuelMode && !walletAddress && (
              <p className="mb-6 max-w-md text-[10px]">
                Connect wallet to set your bet — or play for fun.
              </p>
            )}
            {isDuelMode && lobbyData?.bet && (
              <p className="mb-4 max-w-md text-[10px]">
                Pot: {formatSol(BigInt(lobbyData.bet) * 2n)} SOL ({formatSol(BigInt(lobbyData.bet))} SOL each)
              </p>
            )}
            {/* Duel: ready status indicators */}
            {isDuelMode && walletAddress && (
              <div className="mb-6 space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-3 h-3 ${lobbyData?.hostReady ? 'bg-[var(--px-gold)]' : 'bg-[#888]'}`} />
                  <span className="text-[10px]">Host {lobbyData?.hostReady ? '- READY' : '- Not ready'}</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-3 h-3 ${lobbyData?.joinerReady ? 'bg-[var(--px-gold)]' : 'bg-[#888]'}`} />
                  <span className="text-[10px]">Joiner {lobbyData?.joinerReady ? '- READY' : '- Not ready'}</span>
                </div>
              </div>
            )}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isDuelMode ? (
                !walletAddress ? (
                  <>
                    <button
                      onClick={() => void handleConnectWallet('phantom')}
                      disabled={isWalletConnecting || loadingAudio}
                      className="px-btn px-btn-start disabled:opacity-60"
                    >
                      {isWalletConnecting && walletConnectTarget === 'phantom' ? 'Connecting Phantom...' : 'Connect Phantom'}
                    </button>
                    {isPrivyConfigured && (
                    <button
                      onClick={() => void handleConnectWallet('privy')}
                      disabled={isWalletConnecting || loadingAudio || !isPrivyReady}
                      className="px-btn px-btn-sea disabled:opacity-60"
                    >
                      {isWalletConnecting && walletConnectTarget === 'privy'
                        ? 'Signing in with email...'
                        : 'Use Email (Privy)'}
                    </button>
                    )}
                  </>
                ) : (() => {
                  const myReady = role === 'host' ? lobbyData?.hostReady : lobbyData?.joinerReady;
                  const opponentReady = role === 'host' ? lobbyData?.joinerReady : lobbyData?.hostReady;
                  if (myReady && opponentReady) {
                    return (
                      <div className="text-[10px] py-4 px-blink">
                        {isRequestingVrf ? 'Generating terrain...' : 'Starting countdown...'}
                      </div>
                    );
                  }
                  if (myReady) {
                    return (
                      <div className="text-[10px] py-4 px-blink">
                        Waiting for opponent to ready up...
                      </div>
                    );
                  }
                  return (
                    <button
                      onClick={() => void handleDuelReady()}
                      disabled={loadingAudio || isPayingBuyIn}
                      className="px-btn px-btn-gold disabled:opacity-60"
                    >
                      {isPayingBuyIn ? 'Confirm in wallet...' : "I'm Ready"}
                    </button>
                  );
                })()
              ) : !walletAddress ? (
                <>
                  <button
                    onClick={() => handleStartPractice()}
                    disabled={loadingAudio}
                    className="px-btn px-btn-start disabled:opacity-60"
                  >
                    Play without wallet
                  </button>
                  <button
                    onClick={() => void handleConnectWallet('phantom')}
                    disabled={isWalletConnecting || loadingAudio}
                    className="px-btn px-btn-start disabled:opacity-60"
                  >
                    {isWalletConnecting && walletConnectTarget === 'phantom' ? 'Connecting Phantom...' : 'Connect Phantom'}
                  </button>
                  {isPrivyConfigured && (
                  <button
                    onClick={() => void handleConnectWallet('privy')}
                    disabled={isWalletConnecting || loadingAudio || !isPrivyReady}
                    className="px-btn px-btn-sea disabled:opacity-60"
                  >
                    {isWalletConnecting && walletConnectTarget === 'privy'
                      ? 'Signing in with email...'
                      : 'Use Email (Privy)'}
                  </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => void handlePayAndStart()}
                  disabled={isPayingBuyIn || isRequestingVrf || loadingAudio}
                  className="px-btn px-btn-start disabled:opacity-60"
                >
                  {isRequestingVrf
                    ? 'Requesting VRF...'
                    : isPayingBuyIn
                      ? `Confirm in ${walletProviderName === 'privy' ? 'Privy' : 'Phantom'}...`
                      : `Bet ${soloBetInput.trim() || '?'} SOL & Start`}
                </button>
              )}
            </div>
            {statusMessage && <p className="mt-4 text-[10px] max-w-md break-words">{statusMessage}</p>}
            {errorMessage && <p className="mt-3 text-[10px] text-[#b42318] max-w-md break-words">{errorMessage}</p>}
          </div>
        </div>
      )}

      {/* HUD overlay while playing */}
      {gameState && hasStarted && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-8 left-8 px-hud px-5 py-3">
            <div className="text-[10px] text-[var(--px-gold)]">Time</div>
            <div className="text-xl text-white">
              {formatSessionTime(
                Math.max(getElapsedSeconds(gameState), displayElapsedFallback)
              )}
            </div>
          </div>

          {audioLoaded && (
            <div className="absolute top-24 left-8 px-hud px-4 py-2">
              <div className="text-[9px] flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-[var(--px-pink)] px-blink" />
                Beat Sync
              </div>
            </div>
          )}

          <div className="absolute top-8 right-8 px-hud px-4 py-3 max-w-xs">
            {hasStarted && !isGameOver && !hasExtracted && liveEarned !== null && !isDuelMode ? (
              <div>
                <div className="text-[9px] text-[var(--px-gold)] mb-1">SOL earned</div>
                <div className="text-sm tabular-nums">{formatSol(liveEarned)} SOL</div>
              </div>
            ) : (
              <div className="text-[9px] space-y-1">
                <div>Wallet: {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Not connected'}</div>
                {walletProviderName && <div>Provider: {walletProviderName === 'privy' ? 'Privy' : 'Phantom'}</div>}
                {walletBalanceLamports !== null && (
                  <div>Balance: {formatSolBalance(walletBalanceLamports)} SOL</div>
                )}
                {terrainSeed !== null && (
                  <div>
                    Seed: 0x{terrainSeed.toString(16).toUpperCase().padStart(8, '0')}
                  </div>
                )}
                {vrfRequestTx && (
                  <a
                    href={`https://solscan.io/tx/${vrfRequestTx}${RPC_URL.includes('devnet') ? '?cluster=devnet' : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline block pointer-events-auto"
                  >
                    Verified by ORAO VRF
                  </a>
                )}
                {statusMessage && <div>{statusMessage}</div>}
                {errorMessage && <div className="text-[#ffb4b4]">{errorMessage}</div>}
              </div>
            )}
          </div>

          <div className="absolute bottom-8 left-8 px-hud px-4 py-2">
            <div className="text-[9px] space-y-1">
              <div>SPACE / CLICK - Jump</div>
              <div>HOLD E (3s) - Extract</div>
              <div>R - Restart</div>
            </div>
          </div>


          {hasExtracted && frozenEarned !== null && !isDuelMode && (
            <div className="absolute inset-0 px-overlay flex items-center justify-center pointer-events-auto">
              <div className="px-panel p-8 max-w-md">
                <h2 className="px-title text-2xl mb-6 text-center">
                  Congrats!
                </h2>
                <div className="text-center mb-8 text-[10px]">
                  <div className="text-sm mb-2">
                    You earned {formatSol(frozenEarned)} SOL
                  </div>
                  <div>
                    Confirm in {walletProviderName === 'privy' ? 'Privy' : 'Phantom'} to receive this amount.
                  </div>
                  {vrfRequestTx && (
                    <a
                      href={`https://solscan.io/tx/${vrfRequestTx}${RPC_URL.includes('devnet') ? '?cluster=devnet' : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block underline"
                    >
                      Terrain verified by ORAO VRF
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={handleRestart} className="px-btn px-btn-start w-full">
                    Play Again
                  </button>
                  <Link href="/" className="px-btn w-full">
                    Back to Homepage
                  </Link>
                </div>
              </div>
            </div>
          )}

          {isDuelMode && (isGameOver || hasExtracted) && (() => {
            const myStatus = role === 'host' ? lobbyData?.hostStatus : lobbyData?.joinerStatus;
            const opponentStatus = role === 'host' ? lobbyData?.joinerStatus : lobbyData?.hostStatus;
            const iDied = myStatus === 'died';
            const opponentDied = opponentStatus === 'died';
            const isTie = iDied && opponentDied;
            const iWon = opponentDied && !iDied;
            const iLost = iDied && !opponentDied;
            const betBaseUnits = BigInt(lobbyData?.bet ?? '0');
            const potBaseUnits = betBaseUnits * 2n;

            return (
              <div className="absolute inset-0 px-overlay flex items-center justify-center pointer-events-auto">
                <div className="px-panel p-8 max-w-lg">
                  <h2 className="px-title text-xl mb-6 text-center">
                    {iWon ? 'YOU WIN!' : isTie ? 'DRAW!' : iLost ? 'YOU LOSE' : 'Waiting...'}
                  </h2>
                  <div className="text-center mb-6 text-[10px]">
                    {iWon ? (
                      <>
                        <div className="text-sm mb-2">
                          You win: {formatSol(duelClaimAmount ?? potBaseUnits)} SOL
                        </div>
                        {duelClaimAmount !== null && duelClaimAmount < potBaseUnits && (
                          <div className="mb-2">
                            Capped by current on-chain claimable amount.
                          </div>
                        )}
                        {isSettling && (
                          <div className="px-blink">
                            Claiming pot – confirm in wallet...
                          </div>
                        )}
                        {settleSignature && (
                          <div className="mt-1">
                            Pot claimed!
                          </div>
                        )}
                        {errorMessage && !settleSignature && !isSettling && (
                          <div className="text-[#b42318] mt-1">
                            {errorMessage}
                          </div>
                        )}
                      </>
                    ) : isTie ? (
                      <>
                        <div className="text-sm mb-2">
                          Both died! Each player gets their bet back.
                        </div>
                        <div className="mb-1">
                          Refund: {formatSol(duelClaimAmount ?? betBaseUnits)} SOL
                        </div>
                        {isSettling && (
                          <div className="px-blink">
                            Refunding – confirm in wallet...
                          </div>
                        )}
                        {settleSignature && (
                          <div className="mt-1">
                            Refund complete!
                          </div>
                        )}
                        {errorMessage && !settleSignature && !isSettling && (
                          <div className="text-[#b42318] mt-1">
                            {errorMessage}
                          </div>
                        )}
                      </>
                    ) : iLost ? (
                      <div className="text-sm mb-2">
                        You died first. Opponent wins the pot.
                      </div>
                    ) : (
                      <div className="px-blink">
                        Waiting for opponent...
                      </div>
                    )}
                  </div>
                  <div className="text-center mb-8 text-[10px]">
                    Your time: {formatSessionTime(Math.max(getElapsedSeconds(gameState), displayElapsedFallback))}
                  </div>
                  <div className="flex flex-col gap-3">
                    {iWon && !settleSignature && !isSettling && (
                      <button
                        onClick={() => void duelClaimPot()}
                        className="px-btn px-btn-gold w-full"
                      >
                        Claim Pot
                      </button>
                    )}
                    {isTie && !settleSignature && !isSettling && (
                      <button
                        onClick={() => void duelRefund()}
                        className="px-btn px-btn-gold w-full"
                      >
                        Claim Refund
                      </button>
                    )}
                    <Link
                      href="/duels"
                      className="px-btn px-btn-start w-full"
                    >
                      Back to Duels
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          {isGameOver && !isDuelMode && (
            <div className="absolute inset-0 px-overlay flex items-center justify-center pointer-events-auto">
              <div className="px-panel p-8">
                <h2 className="px-title text-2xl mb-4 text-center">
                  GAME OVER
                </h2>
                <div className="text-center mb-8 text-[10px]">
                  <div className="mb-2">Time Survived</div>
                  <div className="text-2xl">{formatSessionTime(getElapsedSeconds(gameState))}</div>
                  <div className="mt-3">You died. Payout is 0.</div>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={handleRestart} className="px-btn px-btn-start w-full">
                    Try Again
                  </button>
                  <Link href="/" className="px-btn w-full">
                    Back to Homepage
                  </Link>
                </div>
              </div>
            </div>
          )}

          {isSettling && (
            <div className="absolute bottom-8 right-8 px-hud px-4 py-2 text-[9px]">
              Settling on devnet...
            </div>
          )}
        </div>
      )}

    </div>
  );
}
