import { useState, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';

interface PlayerStats {
  address: string;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  rank: number;
}

// Mock data for display until contract is deployed
const MOCK_LEADERBOARD: PlayerStats[] = [
  { address: '0xabcd...1234', wins: 42, losses: 8, draws: 2, currentStreak: 7, bestStreak: 12, rank: 1 },
  { address: '0xefgh...5678', wins: 38, losses: 12, draws: 1, currentStreak: 3, bestStreak: 9, rank: 2 },
  { address: '0xijkl...9012', wins: 35, losses: 15, draws: 3, currentStreak: 5, bestStreak: 8, rank: 3 },
  { address: '0xmnop...3456', wins: 30, losses: 18, draws: 2, currentStreak: 1, bestStreak: 7, rank: 4 },
  { address: '0xqrst...7890', wins: 28, losses: 20, draws: 4, currentStreak: 2, bestStreak: 6, rank: 5 },
  { address: '0xuvwx...1357', wins: 25, losses: 22, draws: 1, currentStreak: 0, bestStreak: 5, rank: 6 },
  { address: '0xyzab...2468', wins: 22, losses: 25, draws: 3, currentStreak: 1, bestStreak: 4, rank: 7 },
  { address: '0xcdef...3579', wins: 20, losses: 28, draws: 2, currentStreak: 0, bestStreak: 3, rank: 8 },
];

function getRankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function getWinRate(stats: PlayerStats): string {
  const total = stats.wins + stats.losses + stats.draws;
  if (total === 0) return '0%';
  return `${Math.round((stats.wins / total) * 100)}%`;
}

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'wins' | 'streaks' | 'winrate'>('wins');
  const [leaderboard] = useState<PlayerStats[]>(MOCK_LEADERBOARD);

  const sortedData = [...leaderboard].sort((a, b) => {
    if (activeTab === 'wins') return b.wins - a.wins;
    if (activeTab === 'streaks') return b.bestStreak - a.bestStreak;
    const aRate = a.wins / Math.max(a.wins + a.losses + a.draws, 1);
    const bRate = b.wins / Math.max(b.wins + b.losses + b.draws, 1);
    return bRate - aRate;
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🏆</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          fontWeight: 800,
          marginBottom: '0.5rem',
        }}>
          <span className="gradient-text">Leaderboard</span>
        </h1>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.95rem',
        }}>
          On-chain player rankings · Updated in real-time
        </p>
      </div>

      {/* Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <StatCard label="Total Games" value="156" icon="🎮" />
        <StatCard label="Active Players" value="24" icon="👥" />
        <StatCard label="Longest Streak" value="12" icon="🔥" />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        background: 'var(--color-surface)',
        borderRadius: '12px',
        padding: '4px',
        marginBottom: '1.5rem',
        border: '1px solid var(--color-border)',
      }}>
        {(['wins', 'streaks', 'winrate'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '0.6rem 1rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              background: activeTab === tab
                ? 'linear-gradient(135deg, var(--color-accent), var(--color-player-x))'
                : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {tab === 'wins' ? '🏅 Most Wins' : tab === 'streaks' ? '🔥 Best Streaks' : '📊 Win Rate'}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr 80px 80px 80px 80px',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <span>Rank</span>
          <span>Player</span>
          <span style={{ textAlign: 'center' }}>Wins</span>
          <span style={{ textAlign: 'center' }}>Losses</span>
          <span style={{ textAlign: 'center' }}>Streak</span>
          <span style={{ textAlign: 'center' }}>Win %</span>
        </div>

        {/* Data rows */}
        {sortedData.map((player, index) => (
          <div
            key={player.address}
            className="animate-fade-in"
            style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 80px 80px 80px 80px',
              padding: '0.85rem 1.25rem',
              borderBottom: index < sortedData.length - 1 ? '1px solid var(--color-border)' : 'none',
              transition: 'background 0.15s ease',
              cursor: 'default',
              animationDelay: `${index * 0.05}s`,
              background: index < 3 ? `rgba(139, 92, 246, ${0.06 - index * 0.02})` : 'transparent',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = index < 3 ? `rgba(139, 92, 246, ${0.06 - index * 0.02})` : 'transparent'}
          >
            <span style={{
              fontWeight: 700,
              fontSize: index < 3 ? '1.25rem' : '0.9rem',
              color: index < 3 ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
            }}>
              {getRankEmoji(index + 1)}
            </span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
            }}>
              {player.address}
            </span>
            <span style={{
              textAlign: 'center',
              fontWeight: 600,
              color: 'var(--color-player-x)',
            }}>
              {player.wins}
            </span>
            <span style={{
              textAlign: 'center',
              fontWeight: 500,
              color: 'var(--color-player-o)',
            }}>
              {player.losses}
            </span>
            <span style={{
              textAlign: 'center',
              fontWeight: 600,
              color: player.currentStreak > 0 ? '#facc15' : 'var(--color-text-muted)',
            }}>
              {activeTab === 'streaks' ? player.bestStreak : player.currentStreak}
              {player.currentStreak > 2 && activeTab !== 'streaks' ? ' 🔥' : ''}
            </span>
            <span style={{
              textAlign: 'center',
              fontWeight: 600,
              color: 'var(--color-win-glow)',
            }}>
              {getWinRate(player)}
            </span>
          </div>
        ))}
      </div>

      {/* Info notice */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        background: 'rgba(139, 92, 246, 0.05)',
        fontSize: '0.85rem',
        color: 'var(--color-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
        <span>
          Rankings are stored entirely on-chain via Sui Move smart contracts.
          Win a game to appear on the leaderboard!
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="card" style={{
      textAlign: 'center',
      padding: '1.25rem 1rem',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.5rem',
        fontWeight: 700,
        background: 'linear-gradient(135deg, var(--color-accent), var(--color-player-x))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        {value}
      </div>
      <div style={{
        color: 'var(--color-text-muted)',
        fontSize: '0.75rem',
        fontWeight: 500,
        marginTop: '0.25rem',
      }}>
        {label}
      </div>
    </div>
  );
}
