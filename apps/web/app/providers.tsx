'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SuiClientProvider,
  WalletProvider,
  useSuiClientContext,
} from '@mysten/dapp-kit';
import { registerEnokiWallets, isEnokiNetwork } from '@mysten/enoki';
import { networkConfig } from '@/lib/sui';
import {
  SUI_NETWORK,
  ENOKI_API_KEY,
  GOOGLE_CLIENT_ID,
} from '@/lib/constants';
import '@mysten/dapp-kit/dist/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

/**
 * Register Enoki (Google zkLogin) wallets with dApp Kit before the WalletProvider
 * mounts so the Google option shows up in the connect modal. Pattern from the PRD §7.4.
 */
function RegisterEnokiWallets() {
  const { client, network } = useSuiClientContext();

  useEffect(() => {
    if (!ENOKI_API_KEY || !GOOGLE_CLIENT_ID) {
      console.warn(
        '⚠️ Enoki keys not configured. Google zkLogin disabled. Set NEXT_PUBLIC_ENOKI_API_KEY and NEXT_PUBLIC_GOOGLE_CLIENT_ID.',
      );
      return;
    }
    if (!isEnokiNetwork(network)) return;

    try {
      const { unregister } = registerEnokiWallets({
        apiKey: ENOKI_API_KEY,
        client,
        network,
        providers: {
          google: { clientId: GOOGLE_CLIENT_ID },
        },
      });

      console.log(`✅ Enoki zkLogin registered (Google) on ${network}`);
      return () => {
        unregister();
      };
    } catch (err) {
      console.error('Failed to register Enoki wallets:', err);
    }
  }, [client, network]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={SUI_NETWORK}>
        <RegisterEnokiWallets />
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
