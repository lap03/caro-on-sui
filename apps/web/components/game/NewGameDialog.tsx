import { useState } from 'react';
import { DIFFICULTY_EASY, DIFFICULTY_MEDIUM, DIFFICULTY_HARD } from '@/lib/constants';

interface NewGameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (difficulty: number) => void;
  isLoading: boolean;
}

const difficulties = [
  {
    value: DIFFICULTY_EASY,
    label: 'Easy',
    emoji: '🟢',
    description: 'AI plays randomly. Great for learning.',
    badgeClass: 'badge--easy',
  },
  {
    value: DIFFICULTY_MEDIUM,
    label: 'Medium',
    emoji: '🟡',
    description: '60% strategic, 40% random. A fair challenge.',
    badgeClass: 'badge--medium',
  },
  {
    value: DIFFICULTY_HARD,
    label: 'Hard',
    emoji: '🔴',
    description: '80% strategic moves. Can you beat the chain?',
    badgeClass: 'badge--hard',
  },
];

export function NewGameDialog({ isOpen, onClose, onStart, isLoading }: NewGameDialogProps) {
  const [selected, setSelected] = useState(DIFFICULTY_MEDIUM);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          fontWeight: 700,
          marginBottom: '0.5rem',
          textAlign: 'center',
        }}>
          New Game
        </h2>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.9rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          Choose your difficulty level
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {difficulties.map((diff) => (
            <button
              key={diff.value}
              onClick={() => setSelected(diff.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                border: selected === diff.value
                  ? '2px solid var(--color-accent)'
                  : '2px solid var(--color-border)',
                background: selected === diff.value
                  ? 'rgba(139, 92, 246, 0.08)'
                  : 'var(--color-surface)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                width: '100%',
                color: 'inherit',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{diff.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  marginBottom: '0.15rem',
                }}>
                  {diff.label}
                </div>
                <div style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '0.8rem',
                }}>
                  {diff.description}
                </div>
              </div>
              {selected === diff.value && (
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  color: 'white',
                  flexShrink: 0,
                }}>
                  ✓
                </div>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => onStart(selected)}
            style={{ flex: 1 }}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Start Game'}
          </button>
        </div>
      </div>
    </div>
  );
}
