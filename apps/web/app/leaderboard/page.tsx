'use client';

import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';

import { useLeaderboard, type PlayerStats } from '@/hooks/useLeaderboard';
import { LEADERBOARD_ID } from '@/lib/constants';
import { suiAddressUrl, suiObjectUrl } from '@/lib/explorer';

function formatAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

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

export default function LeaderboardPage() {
  const account = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<'wins' | 'streaks' | 'winrate'>('wins');
  const { data: leaderboard, isLoading } = useLeaderboard();

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
        <StatCard 
          label="Total Games" 
          value={leaderboard.reduce((acc, p) => acc + p.wins + p.losses + p.draws, 0).toString()} 
          icon="🎮" 
        />
        <StatCard 
          label="Active Players" 
          value={leaderboard.length.toString()} 
          icon="👥" 
        />
        <StatCard 
          label="Longest Streak" 
          value={Math.max(...leaderboard.map(p => p.bestStreak), 0).toString()} 
          icon="🔥" 
        />
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
        {isLoading && leaderboard.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', width: '24px', height: '24px' }}></div>
            Fetching on-chain data...
          </div>
        ) : sortedData.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No players on the leaderboard yet. Be the first to play!
          </div>
        ) : (
          <>
            {sortedData.slice(0, 10).map((player, index) => (
              <PlayerRow 
                key={player.address} 
                player={player} 
                index={index} 
                activeTab={activeTab} 
                isUser={account?.address === player.address}
              />
            ))}
            
            {/* Show user at bottom if out of top 10 */}
            {account?.address && (() => {
              const userIdx = sortedData.findIndex(p => p.address === account.address);
              if (userIdx >= 10) {
                return (
                  <>
                    <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--color-text-muted)' }}>
                      •••
                    </div>
                    <PlayerRow 
                      player={sortedData[userIdx]} 
                      index={userIdx} 
                      activeTab={activeTab} 
                      isUser={true}
                    />
                  </>
                );
              }
              return null;
            })()}
          </>
        )}
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
          Win a game to appear on the leaderboard!{' '}
          {LEADERBOARD_ID !== '0x0' && (
            <a
              href={suiObjectUrl(LEADERBOARD_ID)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-accent-hover)',
                textDecoration: 'none',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                borderBottom: '1px dashed currentColor',
              }}
            >
              View Leaderboard object ↗
            </a>
          )}
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

function PlayerRow({ 
  player, 
  index, 
  activeTab, 
  isUser 
}: { 
  player: PlayerStats; 
  index: number; 
  activeTab: string; 
  isUser: boolean; 
}) {
  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 80px 80px 80px 80px',
        padding: '0.85rem 1.25rem',
        borderBottom: '1px solid var(--color-border)',
        transition: 'background 0.15s ease',
        cursor: 'default',
        animationDelay: `${index * 0.05}s`,
        background: isUser ? 'rgba(139, 92, 246, 0.15)' : (index < 3 ? `rgba(139, 92, 246, ${0.06 - index * 0.02})` : 'transparent'),
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = isUser ? 'rgba(139, 92, 246, 0.2)' : 'var(--color-surface-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = isUser ? 'rgba(139, 92, 246, 0.15)' : (index < 3 ? `rgba(139, 92, 246, ${0.06 - index * 0.02})` : 'transparent')}
    >
      <span style={{
        fontWeight: 700,
        fontSize: index < 3 ? '1.25rem' : '0.9rem',
        color: index < 3 ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
      }}>
        {player.rank > 0 ? getRankEmoji(player.rank) : getRankEmoji(index + 1)}
      </span>
      <span style={{
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        color: isUser ? 'var(--color-accent-hover)' : 'var(--color-text-primary)',
        display: 'flex',
        alignItems: 'center',
        fontWeight: isUser ? 'bold' : 'normal',
      }}>
        <a
          href={suiAddressUrl(player.address)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${player.address} on SuiVision`}
          style={{
            color: 'inherit',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {formatAddress(player.address)}
          <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>↗</span>
        </a>
        {isUser && <span style={{ marginLeft: '6px', fontSize: '10px', background: 'var(--color-accent)', color: '#fff', padding: '2px 6px', borderRadius: '10px' }}>YOU</span>}
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
  );
}
