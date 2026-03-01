'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LAMPORTS_PER_SOL = 1_000_000_000n;

function parseSolToLamports(input: string): bigint | null {
  const value = input.trim();
  if (!/^\d+(\.\d{1,9})?$/.test(value)) return null;
  const [wholePart, fracPart = ''] = value.split('.');
  const whole = BigInt(wholePart);
  const frac = BigInt(fracPart.padEnd(9, '0'));
  return whole * LAMPORTS_PER_SOL + frac;
}

function formatLamportsToSol(lamports: bigint): string {
  const sol = Number(lamports) / Number(LAMPORTS_PER_SOL);
  if (sol >= 1) return sol.toFixed(3);
  if (sol >= 0.01) return sol.toFixed(4);
  return sol.toFixed(6);
}

function generateLobbyCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

type LobbyState =
  | { type: 'idle' }
  | { type: 'creating' }
  | { type: 'joining' }
  | { type: 'in_lobby'; code: string; bet: string; role: 'host' | 'joiner'; playerCount: number };

export default function DuelsPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [createBet, setCreateBet] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState>({ type: 'idle' });
  const unsubRef = useRef<(() => void) | null>(null);

  // Clean up Firestore listener on unmount or lobby leave
  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  const subscribeTo = useCallback((code: string, role: 'host' | 'joiner') => {
    unsubRef.current?.();
    const unsub = onSnapshot(
      doc(db, 'lobbies', code),
      (snap) => {
        if (!snap.exists()) {
          setLobbyState({ type: 'idle' });
          return;
        }
        const data = snap.data();
        const playerCount = data.joinerWallet ? 2 : 1;
        setLobbyState({
          type: 'in_lobby',
          code,
          bet: data.bet,
          role,
          playerCount,
        });
      },
      (err) => {
        console.error('Lobby listener error:', err);
        setLobbyState({ type: 'idle' });
      }
    );
    unsubRef.current = unsub;
  }, []);

  const handleCreateLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const betLamports = parseSolToLamports(createBet);
    if (!betLamports || betLamports <= 0n) {
      setCreateError('Enter a valid SOL amount (up to 9 decimals).');
      return;
    }
    const bet = betLamports.toString();

    setLobbyState({ type: 'creating' });
    const code = generateLobbyCode();
    try {
      await setDoc(doc(db, 'lobbies', code), {
        code,
        bet,
        hostWallet: null,
        joinerWallet: null,
        hostReady: false,
        joinerReady: false,
        hostStatus: null,
        joinerStatus: null,
        hostSurvivalTime: null,
        joinerSurvivalTime: null,
        terrainSeed: null,
        winner: null,
        status: 'waiting',
        createdAt: serverTimestamp(),
      });
      // Optimistically show lobby — don't wait for onSnapshot
      setLobbyState({
        type: 'in_lobby',
        code,
        bet,
        role: 'host',
        playerCount: 1,
      });
      subscribeTo(code, 'host');
    } catch (err) {
      console.error('Failed to create lobby:', err);
      setCreateError('Failed to create lobby. Check your connection.');
      setLobbyState({ type: 'idle' });
    }
  };

  const handleJoinLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    setLobbyState({ type: 'joining' });
    try {
      const lobbyRef = doc(db, 'lobbies', code);
      const snap = await getDoc(lobbyRef);
      if (!snap.exists()) {
        setJoinError('Lobby not found. Check the code and try again.');
        setLobbyState({ type: 'idle' });
        return;
      }
      const data = snap.data();
      if (data.joinerWallet) {
        setJoinError('Lobby is already full.');
        setLobbyState({ type: 'idle' });
        return;
      }
      if (data.status !== 'waiting') {
        setJoinError('Lobby is already in progress.');
        setLobbyState({ type: 'idle' });
        return;
      }
      await updateDoc(lobbyRef, {
        joinerWallet: 'joined',
      });
      // Optimistically show lobby — don't wait for onSnapshot
      setLobbyState({
        type: 'in_lobby',
        code,
        bet: data.bet,
        role: 'joiner',
        playerCount: 2,
      });
      subscribeTo(code, 'joiner');
    } catch (err) {
      console.error('Failed to join lobby:', err);
      setJoinError('Failed to join lobby. Check your connection.');
      setLobbyState({ type: 'idle' });
    }
  };

  const handleCopyCode = () => {
    if (lobbyState.type === 'in_lobby') {
      navigator.clipboard.writeText(lobbyState.code);
    }
  };

  const handleLeaveLobby = async () => {
    if (lobbyState.type === 'in_lobby') {
      unsubRef.current?.();
      unsubRef.current = null;
      const { code, role } = lobbyState;
      try {
        if (role === 'host') {
          await deleteDoc(doc(db, 'lobbies', code));
        } else {
          await updateDoc(doc(db, 'lobbies', code), {
            joinerWallet: null,
            status: 'waiting',
          });
        }
      } catch {
        // best-effort cleanup
      }
    }
    setLobbyState({ type: 'idle' });
    setCreateBet('');
    setJoinCode('');
    setJoinError(null);
    setCreateError(null);
  };

  const isInLobby = lobbyState.type === 'in_lobby';
  const isBusy = lobbyState.type === 'creating' || lobbyState.type === 'joining';

  const cardClass =
    'w-full max-w-md rounded-2xl border border-[var(--arcade-border)] border-t-2 border-t-[var(--arcade-cyan)] p-8 shadow-[var(--arcade-glow-cyan)] bg-[var(--arcade-glass)] backdrop-blur-xl';
  const inputClass =
    'w-full px-4 py-3 bg-black/40 border border-[rgba(0,255,255,0.25)] rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--arcade-cyan)] focus:border-[var(--arcade-cyan)]';
  const btnPrimary =
    'w-full py-4 text-black font-bold rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] bg-[linear-gradient(135deg,var(--arcade-cyan),#00cccc)] hover:shadow-[0_0_24px_rgba(0,255,255,0.4)]';
  const tabActive =
    'bg-[linear-gradient(135deg,var(--arcade-cyan),#00cccc)] text-black shadow-[0_0_16px_rgba(0,255,255,0.35)]';
  const tabInactive =
    'text-[rgba(255,255,255,0.7)] hover:text-white hover:bg-white/5';

  return (
    <div className="page-arcade min-h-screen relative overflow-hidden">
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 pt-24">
        <Link
          href="/"
          className="absolute top-20 left-6 text-sm font-medium transition-opacity hover:opacity-100 opacity-90"
          style={{ color: 'var(--arcade-cyan)' }}
        >
          ← Home
        </Link>

        <div className="mb-10 text-center">
          <h1
            className="text-5xl lg:text-6xl font-bold mb-2 font-[family-name:var(--font-display)]"
            style={{
              background: 'linear-gradient(90deg, var(--arcade-cyan), var(--arcade-magenta))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Duels
          </h1>
          <p className="text-white/80 text-sm">1v1 · Winner takes the pot</p>
        </div>

        {!isInLobby && !isBusy ? (
          <>
            <div className="flex gap-2 mb-8 p-1 rounded-xl border border-[var(--arcade-border)] bg-black/30 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-6 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'create' ? tabActive : tabInactive}`}
              >
                Create Lobby
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`px-6 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'join' ? tabActive : tabInactive}`}
              >
                Join Lobby
              </button>
            </div>

            {activeTab === 'create' && (
              <form onSubmit={(e) => { void handleCreateLobby(e); }} className={`relative z-20 ${cardClass}`}>
                <h2 className="text-xl font-bold text-white mb-2 font-[family-name:var(--font-display)]">Create a duel lobby</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--arcade-cyan)' }}>Set your bet and share the code with your opponent.</p>
                <label className="block mb-4">
                  <span className="text-white/80 text-sm mb-2 block">Bet amount (SOL)</span>
                  <input type="text" autoComplete="off" value={createBet} onChange={(e) => setCreateBet(e.target.value)} placeholder="e.g. 0.005" className={inputClass} />
                </label>
                {createError && <p className="mb-4 text-red-400 text-sm">{createError}</p>}
                <button type="submit" className={btnPrimary}>Create Lobby</button>
              </form>
            )}

            {activeTab === 'join' && (
              <form onSubmit={(e) => { void handleJoinLobby(e); }} className={`relative z-20 ${cardClass}`}>
                <h2 className="text-xl font-bold text-white mb-2 font-[family-name:var(--font-display)]">Join a duel</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--arcade-cyan)' }}>Enter the lobby code. Bet is set by the host.</p>
                <label className="block mb-4">
                  <span className="text-white/80 text-sm mb-2 block">Lobby code</span>
                  <input type="text" autoComplete="off" value={joinCode} onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }} placeholder="e.g. ABC123" maxLength={6} className={`${inputClass} uppercase tracking-widest text-center text-lg`} />
                </label>
                {joinError && <p className="mb-4 text-red-400 text-sm">{joinError}</p>}
                <button type="submit" className={btnPrimary}>Join Lobby</button>
              </form>
            )}
          </>
        ) : isBusy ? (
          <div className={`${cardClass} text-center`}>
            <p className="animate-pulse text-lg" style={{ color: 'var(--arcade-cyan)' }}>
              {lobbyState.type === 'creating' ? 'Creating lobby...' : 'Joining lobby...'}
            </p>
          </div>
        ) : lobbyState.type === 'in_lobby' ? (
          <div className={cardClass}>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1 font-[family-name:var(--font-display)]">
                {lobbyState.playerCount < 2 ? 'Waiting for opponent...' : 'Ready to duel!'}
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--arcade-cyan)' }}>
                {lobbyState.playerCount < 2 ? 'Share the code below with your opponent.' : 'Both players are in. Start the game!'}
              </p>
              <div className="mb-6">
                <span className="text-xs uppercase tracking-wider block mb-2" style={{ color: 'var(--arcade-cyan)' }}>Lobby code</span>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-bold tracking-[0.2em]" style={{ background: 'linear-gradient(90deg, var(--arcade-cyan), var(--arcade-magenta))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{lobbyState.code}</span>
                  <button type="button" onClick={handleCopyCode} className="px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors bg-[rgba(0,255,255,0.2)] border border-[var(--arcade-cyan)] hover:bg-[rgba(0,255,255,0.3)]">Copy</button>
                </div>
              </div>
              <div className="space-y-2 mb-8 text-left bg-black/30 rounded-xl p-4 border border-[var(--arcade-border)]">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--arcade-cyan)' }}>Bet</span>
                  <span className="text-white">{formatLamportsToSol(BigInt(lobbyState.bet))} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--arcade-cyan)' }}>Players</span>
                  <span className="text-white">{lobbyState.playerCount}/2</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--arcade-cyan)' }}>Role</span>
                  <span className="text-white capitalize">{lobbyState.role}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Link href={`/game?duel=${lobbyState.code}&role=${lobbyState.role}`} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-black font-bold rounded-lg text-center transition-all shadow-lg hover:shadow-green-500/40 active:scale-[0.98]">
                  {lobbyState.playerCount === 2 ? 'Enter Arena' : 'Enter Arena (waiting for opponent)'}
                </Link>
                <button type="button" onClick={() => { void handleLeaveLobby(); }} className="w-full py-3 border-2 border-white/40 text-white font-bold rounded-lg hover:border-[var(--arcade-cyan)] hover:bg-[rgba(0,255,255,0.08)] transition-all">
                  Leave lobby
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
