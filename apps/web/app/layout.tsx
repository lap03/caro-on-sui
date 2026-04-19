import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from './providers';
import { Nav } from './nav';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Caro On-Chain | Fully On-Chain Gomoku on Sui',
  description:
    "Play Caro (Gomoku) against an AI powered by Sui blockchain's on-chain randomness. No wallet needed, fully on-chain, provably fair.",
  keywords: ['Caro', 'Gomoku', 'Sui', 'blockchain', 'on-chain', 'AI', 'game'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <Providers>
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div className="bg-glow bg-glow--purple" />
            <div className="bg-glow bg-glow--blue" />

            <Nav />

            <main style={{ flex: 1 }}>{children}</main>

            <Toaster
              position="top-right"
              theme="dark"
              richColors
              closeButton
              toastOptions={{
                style: {
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                },
              }}
            />
          </div>
        </Providers>
      </body>
    </html>
  );
}
