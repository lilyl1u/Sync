'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

type GameplayEvent = CustomEvent<{ active?: boolean }>;

export function PrivyGlobalLogoutButton() {
  const { ready, authenticated, logout } = usePrivy();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isGameplayActive, setIsGameplayActive] = useState(false);

  useEffect(() => {
    const onGameplayState = (event: Event) => {
      const customEvent = event as GameplayEvent;
      setIsGameplayActive(Boolean(customEvent.detail?.active));
    };

    window.addEventListener('geometrydash:gameplay-state', onGameplayState as EventListener);
    return () => {
      window.removeEventListener('geometrydash:gameplay-state', onGameplayState as EventListener);
    };
  }, []);

  if (!ready || !authenticated || isGameplayActive) {
    return null;
  }

  return (
    <button
      onClick={async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
          await logout();
        } finally {
          setIsLoggingOut(false);
        }
      }}
      disabled={isLoggingOut}
      className="fixed top-4 right-4 z-[100] pointer-events-auto px-4 py-2 border border-cyan-300/70 bg-black/60 text-cyan-100 rounded-lg font-mono text-xs sm:text-sm hover:bg-cyan-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label="Log out from Privy"
    >
      {isLoggingOut ? 'Logging out...' : 'Log out Privy'}
    </button>
  );
}
