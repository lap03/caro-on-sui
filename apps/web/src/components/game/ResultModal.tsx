import { STATUS_PLAYER_WIN, STATUS_AI_WIN, STATUS_DRAW } from '@/lib/constants';

interface ResultModalProps {
  status: number;
  moveCount: number;
  difficulty: number;
  onNewGame: () => void;
  onClose: () => void;
}

function getDifficultyLabel(d: number): string {
  if (d === 0) return 'Easy';
  if (d === 1) return 'Medium';
  return 'Hard';
}

export function ResultModal({ status, moveCount, difficulty, onNewGame, onClose }: ResultModalProps) {
  const isWin = status === STATUS_PLAYER_WIN;
  const isDraw = status === STATUS_DRAW;
  const isLoss = status === STATUS_AI_WIN;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${isWin ? 'celebrate' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: 'center' }}
      >
        {/* Icon */}
        <div style={{
          fontSize: '4rem',
          marginBottom: '1rem',
          filter: isWin ? 'drop-shadow(0 0 20px rgba(52, 211, 153, 0.5))' : 'none',
        }}>
          {isWin ? '🎉' : isDraw ? '🤝' : '😤'}
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem',
          fontWeight: 800,
          marginBottom: '0.5rem',
          background: isWin
            ? 'linear-gradient(135deg, #34d399, #3b82f6)'
            : isDraw
              ? 'linear-gradient(135deg, #facc15, #fb923c)'
              : 'linear-gradient(135deg, #f43f5e, #dc2626)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {isWin ? 'You Win!' : isDraw ? "It's a Draw!" : 'AI Wins!'}
        </h2>

        {/* Subtitle */}
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.95rem',
          marginBottom: '1.5rem',
          lineHeight: 1.6,
        }}>
          {isWin
            ? `Congratulations! You beat the ${getDifficultyLabel(difficulty)} AI!`
            : isDraw
              ? 'An impressive match — neither side could find the winning move.'
              : `The ${getDifficultyLabel(difficulty)} AI found a winning strategy.`}
        </p>

        {/* Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          marginBottom: '1.5rem',
          padding: '1rem',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
        }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {moveCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
              Total Moves
            </div>
          </div>
          <div style={{ width: '1px', background: 'var(--color-border)' }} />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {getDifficultyLabel(difficulty)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
              Difficulty
            </div>
          </div>
        </div>

        {/* NFT notice */}
        {isWin && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'rgba(52, 211, 153, 0.08)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            fontSize: '0.8rem',
            color: '#34d399',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'center',
          }}>
            <span>🏅</span>
            <span>Proof-of-Play NFT minted to your wallet!</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            View Board
          </button>
          <button
            className="btn-primary"
            onClick={onNewGame}
            style={{ flex: 1 }}
          >
            {isWin ? '🔥 Play Again' : '⚡ Try Again'}
          </button>
        </div>
      </div>
    </div>
  );
}
