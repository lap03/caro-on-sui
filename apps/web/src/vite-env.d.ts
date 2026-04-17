/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUI_NETWORK: string;
  readonly VITE_ENOKI_API_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_PACKAGE_ID: string;
  readonly VITE_LEADERBOARD_ID: string;
  readonly VITE_WALRUS_PUBLISHER: string;
  readonly VITE_WALRUS_AGGREGATOR: string;
  readonly VITE_SEAL_PACKAGE_ID: string;
  readonly VITE_SEAL_SERVER_OBJECT_ID: string;
  readonly VITE_SEAL_AGGREGATOR_URL: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
