import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@mysten/dapp-kit',
    '@mysten/enoki',
    '@mysten/sui',
    '@mysten/walrus',
    '@mysten/seal',
  ],
};

export default nextConfig;
