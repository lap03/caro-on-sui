import {
  STATUS_ACTIVE,
  STATUS_PLAYER_WIN,
  STATUS_AI_WIN,
  STATUS_DRAW,
  STATUS_LABELS,
  DIFFICULTY_LABELS,
} from '@/lib/constants';
import type { GameState } from '@/hooks/useGame';

interface GameStatusProps {
  gameState: GameState;
  onNewGame: () => void;
  onResign: () => void;
  isLoading: boolean;
}

export function GameStatus({ gameState, onNewGame, onResign, isLoading }: GameStatusProps) {
  const { status, difficulty, moveCount } = gameState;
  const isGameOver = status !== STATUS_ACTIVE;

  return (
    <>
      {/* Status Header */}
      <div className="card" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600 }}>
            Game Info
          </h2>
          <span className={`badge badge--${difficulty === 0 ? 'easy' : difficulty === 1 ? 'medium' : 'hard'}`}>
            {DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Status</span>
            <span className="badge badge--status">{STATUS_LABELS[status]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Moves</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-display)' }}>{moveCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Your Mark</span>
            <span style={{ color: 'var(--color-player-x)', fontWeight: 700, fontSize: '1.1rem' }}>✕</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>AI Mark</span>
            <span style={{ color: 'var(--color-player-o)', fontWeight: 700, fontSize: '1.1rem' }}>○</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
        {isGameOver && (
          <button className="btn-primary" onClick={onNewGame} style={{ width: '100%' }}>
            New Game
          </button>
        )}
        {!isGameOver && (
          <button
            className="btn-danger"
            onClick={onResign}
            disabled={isLoading}
            style={{ width: '100%' }}
          >
            Resign
          </button>
        )}
      </div>

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="card" style={{
          marginTop: '0.75rem',
          background: status === STATUS_PLAYER_WIN
            ? 'rgba(52, 211, 153, 0.08)'
            : status === STATUS_AI_WIN
              ? 'rgba(244, 63, 94, 0.08)'
              : 'rgba(139, 92, 246, 0.08)',
          border: `1px solid ${status === STATUS_PLAYER_WIN
            ? 'rgba(52, 211, 153, 0.25)'
            : status === STATUS_AI_WIN
              ? 'rgba(244, 63, 94, 0.25)'
              : 'rgba(139, 92, 246, 0.25)'}`,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {status === STATUS_PLAYER_WIN ? '🎉' : status === STATUS_AI_WIN ? '🤖' : '🤝'}
            </div>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '0.25rem',
              color: status === STATUS_PLAYER_WIN
                ? 'var(--color-win-glow)'
                : status === STATUS_AI_WIN
                  ? 'var(--color-player-o)'
                  : 'var(--color-accent-hover)',
            }}>
              {STATUS_LABELS[status]}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              {status === STATUS_PLAYER_WIN
                ? 'Congratulations! You beat the AI!'
                : status === STATUS_AI_WIN
                  ? 'The AI won this time. Try again!'
                  : 'It\'s a draw! Well played!'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
