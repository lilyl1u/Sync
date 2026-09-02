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
      className="px-btn px-btn-sea fixed top-16 right-4 z-[100] pointer-events-auto"
      aria-label="Log out from Privy"
    >
      {isLoggingOut ? 'Logging out...' : 'Log out Privy'}
    </button>
  );
}
