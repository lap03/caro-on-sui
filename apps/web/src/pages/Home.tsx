import { useCurrentAccount } from '@mysten/dapp-kit';
import { Link } from 'react-router-dom';

export function Home() {
  const account = useCurrentAccount();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Hero Section */}
      <section style={{
        textAlign: 'center',
        paddingTop: '3rem',
        paddingBottom: '4rem',
      }}>
        {/* Floating game pieces */}
        <div style={{
          fontSize: '3rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
        }}>
          <span className="animate-float" style={{ animationDelay: '0s' }}>✕</span>
          <span className="animate-float" style={{ animationDelay: '0.5s', color: 'var(--color-player-o)' }}>○</span>
          <span className="animate-float" style={{ animationDelay: '1s' }}>✕</span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: '1.25rem',
        }}>
          <span className="gradient-text">Caro On-Chain</span>
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          color: 'var(--color-text-secondary)',
          maxWidth: '550px',
          margin: '0 auto 2rem',
          lineHeight: 1.6,
        }}>
          Play Caro against the blockchain itself — fully on-chain AI powered by
          Sui's provably fair randomness. No wallet setup, no gas fees.
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <Link to="/play">
            <button className="btn-primary" style={{
              fontSize: '1.1rem',
              padding: '1rem 2.5rem',
            }}>
              ⚡ Play Now
            </button>
          </Link>
          <Link to="/leaderboard">
            <button className="btn-secondary" style={{
              fontSize: '1.1rem',
              padding: '1rem 2.5rem',
            }}>
              🏆 Leaderboard
            </button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.25rem',
        marginBottom: '4rem',
      }}>
        <FeatureCard
          emoji="🔗"
          title="Fully On-Chain"
          description="Every move is a Sui transaction. Game state, AI logic, and win detection all happen on-chain."
          delay="0.1s"
        />
        <FeatureCard
          emoji="🎲"
          title="Provably Fair AI"
          description="AI uses Sui's native randomness beacon — threshold BLS signatures that no one can predict or manipulate."
          delay="0.2s"
        />
        <FeatureCard
          emoji="🔐"
          title="Zero-Friction Login"
          description="Sign in with Google via Enoki zkLogin. No wallet extension, no seed phrases, no gas fees."
          delay="0.3s"
        />
        <FeatureCard
          emoji="💾"
          title="Permanent Replays"
          description="Game replays stored on Walrus decentralized storage. Replay any game, forever."
          delay="0.4s"
        />
        <FeatureCard
          emoji="🛡️"
          title="Anti-Cheat (Seal)"
          description="Optional commit-reveal mode using Seal encryption for provably fair competitive play."
          delay="0.5s"
        />
        <FeatureCard
          emoji="🏆"
          title="On-Chain Rankings"
          description="Win streaks, stats, and leaderboard all tracked on Sui. Earn proof-of-play NFTs."
          delay="0.6s"
        />
      </section>

      {/* How It Works */}
      <section style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem',
          fontWeight: 700,
          marginBottom: '2rem',
        }}>
          How It Works
        </h2>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          flexWrap: 'wrap',
        }}>
          <StepCard step={1} title="Connect" description="Sign in with Google or connect your Sui wallet" />
          <StepCard step={2} title="Choose Difficulty" description="Easy, Medium, or Hard — each with different AI strategy" />
          <StepCard step={3} title="Play & Win" description="Place your marks, beat the AI, earn your proof-of-play NFT" />
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem 0',
        borderTop: '1px solid var(--color-border)',
        color: 'var(--color-text-muted)',
        fontSize: '0.85rem',
      }}>
        Built with Sui Move, Enoki, Walrus & Seal for the Sui Hackathon 2026
      </footer>
    </div>
  );
}

function FeatureCard({ emoji, title, description, delay }: {
  emoji: string;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div
      className="card animate-fade-in"
      style={{ animationDelay: delay }}
    >
      <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{emoji}</div>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: '1.05rem',
        marginBottom: '0.5rem',
      }}>
        {title}
      </h3>
      <p style={{
        color: 'var(--color-text-secondary)',
        fontSize: '0.85rem',
        lineHeight: 1.6,
      }}>
        {description}
      </p>
    </div>
  );
}

function StepCard({ step, title, description }: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      maxWidth: '200px',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--color-accent), var(--color-player-x))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: '1.2rem',
        marginBottom: '1rem',
      }}>
        {step}
      </div>
      <h4 style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        marginBottom: '0.35rem',
      }}>
        {title}
      </h4>
      <p style={{
        color: 'var(--color-text-secondary)',
        fontSize: '0.82rem',
        textAlign: 'center',
        lineHeight: 1.5,
      }}>
        {description}
      </p>
    </div>
  );
}
