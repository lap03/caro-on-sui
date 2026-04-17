import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EnokiClient, registerEnokiWallets } from '@mysten/enoki';
import { SuiProvider } from '@/providers/SuiProvider';
import { App } from '@/App';
import './index.css';

// Register Enoki wallets BEFORE React renders.
// This adds Google as a wallet option in the dApp Kit ConnectButton.
const enokiApiKey = import.meta.env.VITE_ENOKI_API_KEY;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const suiNetwork = (import.meta.env.VITE_SUI_NETWORK as 'testnet' | 'mainnet') || 'testnet';

if (enokiApiKey && googleClientId) {
  try {
    const enokiClient = new EnokiClient({ apiKey: enokiApiKey });

    // Assign network property required by registerEnokiWallets
    const clientWithNetwork = Object.assign(enokiClient, { network: suiNetwork });

    const { unregister } = registerEnokiWallets({
      apiKey: enokiApiKey,
      client: clientWithNetwork,
      network: suiNetwork,
      providers: {
        google: {
          clientId: googleClientId,
        },
      },
    });

    console.log(`✅ Enoki zkLogin registered (Google) on ${suiNetwork}`);

    // Clean up on HMR
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        unregister();
      });
    }
  } catch (err) {
    console.error('Failed to register Enoki wallets:', err);
  }
} else {
  console.warn(
    '⚠️ Enoki keys not configured. Google zkLogin disabled.\n' +
    '   Set VITE_ENOKI_API_KEY and VITE_GOOGLE_CLIENT_ID in .env.local'
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SuiProvider>
      <App />
    </SuiProvider>
  </StrictMode>,
);
