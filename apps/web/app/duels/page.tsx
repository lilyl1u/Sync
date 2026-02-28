'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O, 1/I to avoid confusion
const LOBBIES_KEY = 'sync-duels-lobbies';

function generateLobbyCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

type LobbyState =
  | { type: 'idle' }
  | { type: 'create_waiting'; code: string; bet: string; playerCount: number }
  | { type: 'join_waiting'; code: string; bet: string; playerCount: number }
  | { type: 'ready'; code: string; bet: string };

export default function DuelsPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [createBet, setCreateBet] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState>({ type: 'idle' });

  const handleCreateLobby = (e: React.FormEvent) => {
    e.preventDefault();
    const bet = createBet.trim();
    if (!bet) return;
    const code = generateLobbyCode();
    // Store lobby for joiners to look up bet (frontend-only mock via localStorage)
    try {
      const lobbies: Record<string, { bet: string }> = JSON.parse(
        localStorage.getItem(LOBBIES_KEY) ?? '{}'
      );
      lobbies[code] = { bet };
      localStorage.setItem(LOBBIES_KEY, JSON.stringify(lobbies));
    } catch {
      // ignore
    }
    setLobbyState({
      type: 'create_waiting',
      code,
      bet,
      playerCount: 1,
    });
  };

  const handleJoinLobby = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    let bet: string;
    try {
      const lobbies: Record<string, { bet: string }> = JSON.parse(
        localStorage.getItem(LOBBIES_KEY) ?? '{}'
      );
      const lobby = lobbies[code];
      if (!lobby) {
        setJoinError('Lobby not found. Check the code or ask the host to create the lobby first.');
        return;
      }
      bet = lobby.bet;
    } catch {
      setJoinError('Could not look up lobby.');
      return;
    }
    setLobbyState({
      type: 'join_waiting',
      code,
      bet,
      playerCount: 2,
    });
  };

  const handleCopyCode = () => {
    if (lobbyState.type === 'create_waiting') {
      navigator.clipboard.writeText(lobbyState.code);
    }
  };

  const handleLeaveLobby = () => {
    setLobbyState({ type: 'idle' });
    setCreateBet('');
    setJoinCode('');
    setJoinError(null);
  };

  const isInLobby = lobbyState.type !== 'idle';

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background layers — matching home page */}
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

        {/* Back link */}
        <Link
          href="/"
          className="absolute top-6 left-6 text-purple-300 hover:text-white font-mono text-sm transition-colors"
        >
          ← Home
        </Link>

        {!isInLobby ? (
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
                onSubmit={handleCreateLobby}
                className="relative z-20 w-full max-w-md bg-black/40 backdrop-blur-lg rounded-2xl border-2 border-purple-500/40 p-8 shadow-2xl shadow-purple-500/20"
              >
                <h2 className="text-xl font-bold text-white mb-2 font-mono">Create a duel lobby</h2>
                <p className="text-purple-300 text-sm mb-6">Set your bet and share the code with your opponent.</p>
                <label className="block mb-4">
                  <span className="text-purple-200 text-sm font-mono mb-2 block">Bet amount (base units)</span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={createBet}
                    onChange={(e) => setCreateBet(e.target.value)}
                    placeholder="e.g. 5000000"
                    className="w-full px-4 py-3 bg-black/50 border border-purple-500/50 rounded-lg text-white font-mono placeholder:text-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  />
                </label>
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
                onSubmit={handleJoinLobby}
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
        ) : (
          /* In-lobby view */
          <div className="w-full max-w-md bg-black/40 backdrop-blur-lg rounded-2xl border-2 border-purple-500/40 p-8 shadow-2xl shadow-purple-500/20">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1 font-mono">
                {lobbyState.type === 'create_waiting'
                  ? 'Lobby created'
                  : lobbyState.type === 'join_waiting'
                    ? 'Joined lobby'
                    : 'Ready to duel'}
              </h2>
              <p className="text-purple-300 text-sm mb-6">
                {lobbyState.type === 'create_waiting'
                  ? 'Share the code below. Waiting for opponent...'
                  : lobbyState.type === 'join_waiting'
                    ? 'Host will start the duel when ready.'
                    : 'Both players are in. Start the game!'}
              </p>

              {/* Lobby code — prominent */}
              <div className="mb-6">
                <span className="text-purple-400 text-xs font-mono uppercase tracking-wider block mb-2">
                  Lobby code
                </span>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-bold font-mono tracking-[0.3em] text-white bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    {lobbyState.code}
                  </span>
                  {lobbyState.type === 'create_waiting' && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-3 py-1.5 text-xs font-mono bg-purple-600/60 hover:bg-purple-600 text-white rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>

              {/* Bet & players */}
              <div className="space-y-2 mb-8 text-left bg-black/30 rounded-xl p-4 border border-purple-500/20">
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-purple-400">Bet</span>
                  <span className="text-white">{lobbyState.bet} base units</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-purple-400">Players</span>
                  <span className="text-white">
                    {lobbyState.type === 'create_waiting'
                      ? '1/2'
                      : lobbyState.type === 'join_waiting'
                        ? '2/2'
                        : '2/2'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                {lobbyState.type === 'join_waiting' && (
                  <Link
                    href="/game"
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg font-mono hover:from-green-500 hover:to-emerald-500 transition-all shadow-lg text-center"
                  >
                    Start duel (placeholder)
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLeaveLobby}
                  className="w-full py-3 border-2 border-purple-400/60 text-purple-200 font-bold rounded-lg font-mono hover:border-purple-300 hover:bg-purple-500/20 hover:text-white transition-all"
                >
                  Leave lobby
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="mt-8 text-purple-400/70 text-sm font-mono max-w-md text-center">
          Duels UI only — no backend yet. Lobbies are stored in localStorage; join works across tabs in the same browser.
        </p>
      </div>
    </div>
  );
}
