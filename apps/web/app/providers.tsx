'use client';

import { PrivyProvider, type PrivyClientConfig } from '@privy-io/react-auth';
import { useEffect, useState, type ReactNode } from 'react';
import { PrivyGlobalLogoutButton } from './components/PrivyGlobalLogoutButton';
import { isPrivyConfigured, PrivyGameBridge } from './lib/privy-bridge';

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

  if (!mounted) {
    return null;
  }

  if (!isPrivyConfigured || !privyAppId?.trim()) {
    return <>{children}</>;
  }

  const privyConfig: PrivyClientConfig = {
    loginMethods: ['email'],
    embeddedWallets: {
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
      <PrivyGameBridge>
        {children}
        <PrivyGlobalLogoutButton />
      </PrivyGameBridge>
    </PrivyProvider>
  );
}
