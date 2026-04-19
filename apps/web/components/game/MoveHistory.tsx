import { CELL_PLAYER, CELL_AI } from '@/lib/constants';
import { formatMove } from '@/lib/utils';

interface MoveHistoryProps {
  moveHistory: number[];
}

export function MoveHistory({ moveHistory }: MoveHistoryProps) {
  if (moveHistory.length === 0) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
          flexShrink: 0,
        }}>
          Move History
        </h3>
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.82rem',
          textAlign: 'center',
          padding: '1rem 0',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          No moves yet. Click on the board!
        </p>
      </div>
    );
  }

  // Group moves into pairs (player move + AI response)
  const movePairs: { index: number; playerMove: number; aiMove?: number }[] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      index: Math.floor(i / 2) + 1,
      playerMove: moveHistory[i],
      aiMove: moveHistory[i + 1],
    });
  }

  return (
    <div className="card" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
        flexShrink: 0,
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          Move History
        </h3>
        <span style={{
          fontSize: '0.72rem',
          color: 'var(--color-text-muted)',
          fontWeight: 500,
        }}>
          {movePairs.length} turns
        </span>
      </div>
      <div className="move-list" style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {[...movePairs].reverse().map((pair) => (
          <div key={pair.index} className="move-item">
            <span style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.72rem',
              minWidth: '1.5rem',
              fontWeight: 600,
            }}>
              {pair.index}.
            </span>
            <span style={{
              color: 'var(--color-player-x)',
              fontWeight: 600,
              minWidth: '2.5rem',
              fontSize: '0.82rem',
            }}>
              ✕ {formatMove(pair.playerMove)}
            </span>
            {pair.aiMove !== undefined && (
              <span style={{
                color: 'var(--color-player-o)',
                fontWeight: 600,
                minWidth: '2.5rem',
                fontSize: '0.82rem',
              }}>
                ○ {formatMove(pair.aiMove)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
