'use client';

import { PrivyProvider, type PrivyClientConfig } from '@privy-io/react-auth';
import { useEffect, useState, type ReactNode } from 'react';
import { PrivyGlobalLogoutButton } from './components/PrivyGlobalLogoutButton';

type ProvidersProps = {
  children: ReactNode;
};

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

export function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!privyAppId || !privyAppId.trim()) {
    throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID. Add it to apps/web/.env.local to enable Privy wallets.');
  }

  if (!mounted) {
    return null;
  }

  const privyConfig: PrivyClientConfig = {
    loginMethods: ['email'],
    embeddedWallets: {
      // Backward-compatible top-level setting for apps still reading createOnLogin here.
      createOnLogin: 'users-without-wallets',
      solana: {
        createOnLogin: 'users-without-wallets',
      },
      ethereum: {
        createOnLogin: 'off',
      },
    },
    appearance: {
      walletChainType: 'solana-only',
    },
  };

  return (
    <PrivyProvider
      appId={privyAppId}
      {...(privyClientId ? { clientId: privyClientId } : {})}
      config={privyConfig}
    >
      {children}
      <PrivyGlobalLogoutButton />
    </PrivyProvider>
  );
}
