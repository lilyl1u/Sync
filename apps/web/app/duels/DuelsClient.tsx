'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { preloadGameAssets } from '@/app/game/utils/gamePreload';

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

async function loadFirestore() {
  const [{ db }, fs] = await Promise.all([
    import('@/lib/firebase'),
    import('firebase/firestore'),
  ]);
  return { db, ...fs };
}

type LobbyState =
  | { type: 'idle' }
  | { type: 'joining' }
  | { type: 'in_lobby'; code: string; bet: string; role: 'host' | 'joiner'; playerCount: number };

export function DuelsClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [createBet, setCreateBet] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState>({ type: 'idle' });
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void preloadGameAssets();
    router.prefetch('/game');
    void loadFirestore();
    return () => {
      unsubRef.current?.();
    };
  }, [router]);

  const subscribeTo = useCallback((code: string, role: 'host' | 'joiner') => {
    unsubRef.current?.();
    void loadFirestore().then(({ db, doc, onSnapshot }) => {
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
    });
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
    const code = generateLobbyCode();

    setLobbyState({
      type: 'in_lobby',
      code,
      bet,
      role: 'host',
      playerCount: 1,
    });
    router.prefetch(`/game?duel=${code}&role=host`);

    try {
      const { db, doc, setDoc, serverTimestamp } = await loadFirestore();
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
      const { db, doc, getDoc, updateDoc } = await loadFirestore();
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
      setLobbyState({
        type: 'in_lobby',
        code,
        bet: data.bet,
        role: 'joiner',
        playerCount: 2,
      });
      router.prefetch(`/game?duel=${code}&role=joiner`);
      await updateDoc(lobbyRef, {
        joinerWallet: 'joined',
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
        const { db, doc, deleteDoc, updateDoc } = await loadFirestore();
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
  const isBusy = lobbyState.type === 'joining';

  const cardClass = 'px-panel w-full max-w-md p-8';
  const inputClass = 'px-input';
  const btnPrimary = 'px-btn px-btn-start w-full';
  const tabActive = 'px-btn px-btn-start';
  const tabInactive = 'px-btn';

  return (
    <>
      {!isInLobby && !isBusy ? (
        <>
          <div className="flex gap-2 mb-8">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={activeTab === 'create' ? tabActive : tabInactive}
            >
              Create Lobby
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className={activeTab === 'join' ? tabActive : tabInactive}
            >
              Join Lobby
            </button>
          </div>

          {activeTab === 'create' && (
            <form onSubmit={(e) => { void handleCreateLobby(e); }} className={`relative z-20 ${cardClass}`}>
              <h2 className="text-sm mb-2">Create a duel lobby</h2>
              <p className="text-[10px] mb-6">Set your bet and share the code with your opponent.</p>
              <label className="block mb-4">
                <span className="text-[10px] mb-2 block">Bet amount (SOL)</span>
                <input type="text" autoComplete="off" value={createBet} onChange={(e) => setCreateBet(e.target.value)} placeholder="e.g. 0.005" className={inputClass} />
              </label>
              {createError && <p className="mb-4 text-[10px] text-[#b42318]">{createError}</p>}
              <button type="submit" className={btnPrimary}>Create Lobby</button>
            </form>
          )}

          {activeTab === 'join' && (
            <form onSubmit={(e) => { void handleJoinLobby(e); }} className={`relative z-20 ${cardClass}`}>
              <h2 className="text-sm mb-2">Join a duel</h2>
              <p className="text-[10px] mb-6">Enter the lobby code. Bet is set by the host.</p>
              <label className="block mb-4">
                <span className="text-[10px] mb-2 block">Lobby code</span>
                <input type="text" autoComplete="off" value={joinCode} onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }} placeholder="e.g. ABC123" maxLength={6} className={`${inputClass} uppercase tracking-widest text-center text-lg`} />
              </label>
              {joinError && <p className="mb-4 text-[10px] text-[#b42318]">{joinError}</p>}
              <button type="submit" className={btnPrimary}>Join Lobby</button>
            </form>
          )}
        </>
      ) : isBusy ? (
        <div className={`${cardClass} text-center`}>
          <p className="px-blink text-sm">Joining lobby...</p>
        </div>
      ) : lobbyState.type === 'in_lobby' ? (
        <div className={cardClass}>
          <div className="text-center">
            <h2 className="text-sm mb-2">
              {lobbyState.playerCount < 2 ? 'Waiting for opponent...' : 'Ready to duel!'}
            </h2>
            <p className="text-[10px] mb-6">
              {lobbyState.playerCount < 2 ? 'Share the code below with your opponent.' : 'Both players are in. Start the game!'}
            </p>
            <div className="mb-6">
              <span className="text-[10px] uppercase block mb-2">Lobby code</span>
              <div className="flex items-center justify-center gap-3">
                <span className="px-title text-2xl tracking-widest">{lobbyState.code}</span>
                <button type="button" onClick={handleCopyCode} className="px-btn px-btn-gold">Copy</button>
              </div>
            </div>
            <div className="space-y-2 mb-8 text-left px-hud p-4 text-[10px]">
              <div className="flex justify-between">
                <span>Bet</span>
                <span>{formatLamportsToSol(BigInt(lobbyState.bet))} SOL</span>
              </div>
              <div className="flex justify-between">
                <span>Players</span>
                <span>{lobbyState.playerCount}/2</span>
              </div>
              <div className="flex justify-between">
                <span>Role</span>
                <span className="capitalize">{lobbyState.role}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href={`/game?duel=${lobbyState.code}&role=${lobbyState.role}`}
                prefetch
                className="px-btn px-btn-start w-full"
              >
                {lobbyState.playerCount === 2 ? 'Enter Arena' : 'Enter Arena (waiting)'}
              </Link>
              <button type="button" onClick={() => { void handleLeaveLobby(); }} className="px-btn w-full">
                Leave lobby
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
