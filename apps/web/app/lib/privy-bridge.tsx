'use client';

import {
  useModalStatus,
  usePrivy,
  useSolanaWallets,
  useWallets,
  type ConnectedSolanaWallet,
} from '@privy-io/react-auth';
import { createContext, useContext, type ReactNode } from 'react';

export const isPrivyConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim());

type PrivyGameApi = {
  isConfigured: boolean;
  isPrivyReady: boolean;
  isPrivyAuthenticated: boolean;
  privyLogin: ReturnType<typeof usePrivy>['login'];
  isPrivyModalOpen: boolean;
  privyWallets: ReturnType<typeof useWallets>['wallets'];
  solanaWallets: ConnectedSolanaWallet[];
  solanaWalletsReady: boolean;
  createSolanaWallet: ReturnType<typeof useSolanaWallets>['createWallet'];
};

const unavailable = () => {
  throw new Error(
    'Privy is not configured. Add NEXT_PUBLIC_PRIVY_APP_ID to apps/web/.env.local or connect Phantom.',
  );
};

const STUB: PrivyGameApi = {
  isConfigured: false,
  isPrivyReady: false,
  isPrivyAuthenticated: false,
  privyLogin: unavailable as PrivyGameApi['privyLogin'],
  isPrivyModalOpen: false,
  privyWallets: [],
  solanaWallets: [],
  solanaWalletsReady: true,
  createSolanaWallet: unavailable as PrivyGameApi['createSolanaWallet'],
};

const PrivyGameContext = createContext<PrivyGameApi>(STUB);

export function usePrivyGame(): PrivyGameApi {
  return useContext(PrivyGameContext);
}

export function PrivyGameBridge({ children }: { children: ReactNode }) {
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

  return (
    <PrivyGameContext.Provider
      value={{
        isConfigured: true,
        isPrivyReady,
        isPrivyAuthenticated,
        privyLogin,
        isPrivyModalOpen,
        privyWallets,
        solanaWallets,
        solanaWalletsReady,
        createSolanaWallet,
      }}
    >
      {children}
    </PrivyGameContext.Provider>
  );
}
