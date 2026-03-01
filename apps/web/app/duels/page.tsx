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

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background layers */}
      <img
        src="/assets/backgrounds/first.svg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover -z-50"
        aria-hidden="true"
      />
      <img
        src="/assets/Ellipse 9.svg"
        alt=""
        className="absolute -right-32 top-1/4 w-[500px] opacity-40 -z-40 blur-sm"
        aria-hidden="true"
      />
      <img
        src="/assets/Ellipse 13.svg"
        alt=""
        className="absolute -left-40 top-1/3 w-[400px] opacity-30 -z-40 blur-sm"
        aria-hidden="true"
      />
      <img
        src="/assets/stars.svg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover -z-30 opacity-80"
        aria-hidden="true"
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-5xl lg:text-6xl font-bold mb-2 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
            Duels
          </h1>
          <p className="text-white/80 font-mono">
            1v1 · Winner takes the pot
          </p>
        </div>

        <Link
          href="/"
          className="absolute top-6 left-6 text-purple-300 hover:text-white font-mono text-sm transition-colors"
        >
          ← Home
        </Link>

        {!isInLobby && !isBusy ? (
          <>
            {/* Tab switcher */}
            <div className="flex gap-2 mb-8 p-1 bg-black/30 backdrop-blur-sm rounded-xl border border-purple-500/30">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-6 py-2.5 rounded-lg font-mono font-bold transition-all ${
                  activeTab === 'create'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'text-purple-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Create Lobby
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`px-6 py-2.5 rounded-lg font-mono font-bold transition-all ${
                  activeTab === 'join'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'text-purple-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Join Lobby
              </button>
            </div>

            {/* Create Lobby form */}
            {activeTab === 'create' && (
              <form
                onSubmit={(e) => { void handleCreateLobby(e); }}
                className="relative z-20 w-full max-w-md bg-black/40 backdrop-blur-lg rounded-2xl border-2 border-purple-500/40 p-8 shadow-2xl shadow-purple-500/20"
              >
                <h2 className="text-xl font-bold text-white mb-2 font-mono">Create a duel lobby</h2>
                <p className="text-purple-300 text-sm mb-6">Set your bet and share the code with your opponent.</p>
                <label className="block mb-4">
                  <span className="text-purple-200 text-sm font-mono mb-2 block">Bet amount (SOL)</span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={createBet}
                    onChange={(e) => setCreateBet(e.target.value)}
                    placeholder="e.g. 0.005"
                    className="w-full px-4 py-3 bg-black/50 border border-purple-500/50 rounded-lg text-white font-mono placeholder:text-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  />
                </label>
                {createError && (
                  <p className="mb-4 text-red-400 text-sm font-mono">{createError}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg font-mono hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Lobby
                </button>
              </form>
            )}

            {/* Join Lobby form */}
            {activeTab === 'join' && (
              <form
                onSubmit={(e) => { void handleJoinLobby(e); }}
                className="relative z-20 w-full max-w-md bg-black/40 backdrop-blur-lg rounded-2xl border-2 border-purple-500/40 p-8 shadow-2xl shadow-purple-500/20"
              >
                <h2 className="text-xl font-bold text-white mb-2 font-mono">Join a duel</h2>
                <p className="text-purple-300 text-sm mb-6">Enter the lobby code. Bet is set by the host.</p>
                <label className="block mb-4">
                  <span className="text-purple-200 text-sm font-mono mb-2 block">Lobby code</span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase());
                      setJoinError(null);
                    }}
                    placeholder="e.g. ABC123"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-black/50 border border-purple-500/50 rounded-lg text-white font-mono placeholder:text-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent uppercase tracking-widest text-center text-lg"
                  />
                </label>
                {joinError && (
                  <p className="mb-4 text-red-400 text-sm font-mono">{joinError}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg font-mono hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join Lobby
                </button>
              </form>
            )}
          </>
        ) : isBusy ? (
          <div className="w-full max-w-md bg-black/40 backdrop-blur-lg rounded-2xl border-2 border-purple-500/40 p-8 shadow-2xl shadow-purple-500/20 text-center">
            <div className="animate-pulse text-purple-300 font-mono text-lg">
              {lobbyState.type === 'creating' ? 'Creating lobby...' : 'Joining lobby...'}
            </div>
          </div>
        ) : lobbyState.type === 'in_lobby' ? (
          /* In-lobby view */
          <div className="w-full max-w-md bg-black/40 backdrop-blur-lg rounded-2xl border-2 border-purple-500/40 p-8 shadow-2xl shadow-purple-500/20">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1 font-mono">
                {lobbyState.playerCount < 2
                  ? 'Waiting for opponent...'
                  : 'Ready to duel!'}
              </h2>
              <p className="text-purple-300 text-sm mb-6">
                {lobbyState.playerCount < 2
                  ? 'Share the code below with your opponent.'
                  : 'Both players are in. Start the game!'}
              </p>

              {/* Lobby code */}
              <div className="mb-6">
                <span className="text-purple-400 text-xs font-mono uppercase tracking-wider block mb-2">
                  Lobby code
                </span>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-bold font-mono tracking-[0.3em] text-white bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    {lobbyState.code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 text-xs font-mono bg-purple-600/60 hover:bg-purple-600 text-white rounded-lg transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Bet & players */}
              <div className="space-y-2 mb-8 text-left bg-black/30 rounded-xl p-4 border border-purple-500/20">
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-purple-400">Bet</span>
                  <span className="text-white">
                    {formatLamportsToSol(BigInt(lobbyState.bet))} SOL
                  </span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-purple-400">Players</span>
                  <span className="text-white">{lobbyState.playerCount}/2</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-purple-400">Role</span>
                  <span className="text-white capitalize">{lobbyState.role}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Link
                  href={`/game?duel=${lobbyState.code}&role=${lobbyState.role}`}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg font-mono hover:from-green-500 hover:to-emerald-500 transition-all shadow-lg text-center"
                >
                  {lobbyState.playerCount === 2 ? 'Enter Arena' : 'Enter Arena (waiting for opponent)'}
                </Link>
                <button
                  type="button"
                  onClick={() => { void handleLeaveLobby(); }}
                  className="w-full py-3 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg font-mono hover:border-purple-300 hover:bg-purple-500/20 hover:text-white transition-all"
                >
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
