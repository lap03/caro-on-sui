import { useState, useEffect, useCallback } from 'react';
import {
  BOARD_SIZE,
  TOTAL_CELLS,
  CELL_EMPTY,
  CELL_PLAYER,
  CELL_AI,
  STATUS_PLAYER_WIN,
  STATUS_AI_WIN,
  STATUS_DRAW,
  DIFFICULTY_LABELS,
} from '@/lib/constants';

interface ReplayData {
  id: string;
  moves: number[];
  difficulty: number;
  result: number;
  date: string;
  totalMoves: number;
}

// Mock replays for demo
const MOCK_REPLAYS: ReplayData[] = [
  {
    id: 'replay-001',
    moves: [112, 97, 113, 98, 114, 99, 115, 100, 116],
    difficulty: 0,
    result: STATUS_PLAYER_WIN,
    date: '2026-04-17',
    totalMoves: 9,
  },
  {
    id: 'replay-002',
    moves: [112, 113, 127, 128, 142, 143, 157, 158, 172],
    difficulty: 1,
    result: STATUS_PLAYER_WIN,
    date: '2026-04-16',
    totalMoves: 9,
  },
  {
    id: 'replay-003',
    moves: [112, 97, 98, 113, 83, 128, 68, 143, 53],
    difficulty: 2,
    result: STATUS_AI_WIN,
    date: '2026-04-15',
    totalMoves: 9,
  },
];

function getResultLabel(result: number): { text: string; color: string; icon: string } {
  if (result === STATUS_PLAYER_WIN) return { text: 'Victory', color: '#34d399', icon: '🏆' };
  if (result === STATUS_AI_WIN) return { text: 'Defeat', color: '#f87171', icon: '😤' };
  return { text: 'Draw', color: '#facc15', icon: '🤝' };
}

export function Replay() {
  const [selectedReplay, setSelectedReplay] = useState<ReplayData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [board, setBoard] = useState<number[]>(new Array(TOTAL_CELLS).fill(CELL_EMPTY));

  // Build board up to currentStep
  useEffect(() => {
    if (!selectedReplay) {
      setBoard(new Array(TOTAL_CELLS).fill(CELL_EMPTY));
      return;
    }
    const newBoard = new Array(TOTAL_CELLS).fill(CELL_EMPTY);
    for (let i = 0; i < currentStep && i < selectedReplay.moves.length; i++) {
      newBoard[selectedReplay.moves[i]] = i % 2 === 0 ? CELL_PLAYER : CELL_AI;
    }
    setBoard(newBoard);
  }, [selectedReplay, currentStep]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying || !selectedReplay) return;
    if (currentStep >= selectedReplay.moves.length) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCurrentStep((s) => s + 1), 800);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, selectedReplay]);

  const handleSelectReplay = (replay: ReplayData) => {
    setSelectedReplay(replay);
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const handlePlay = () => {
    if (currentStep >= (selectedReplay?.moves.length ?? 0)) {
      setCurrentStep(0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => setIsPlaying(false);
  const handleStepForward = () => {
    if (selectedReplay && currentStep < selectedReplay.moves.length) {
      setCurrentStep((s) => s + 1);
    }
  };
  const handleStepBackward = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };
  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  // Replay list view
  if (!selectedReplay) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📼</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 800,
            marginBottom: '0.5rem',
          }}>
            <span className="gradient-text">Game Replays</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            Watch previous games move-by-move · Stored on Walrus
          </p>
        </div>

        {/* Replay list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {MOCK_REPLAYS.map((replay) => {
            const result = getResultLabel(replay.result);
            return (
              <button
                key={replay.id}
                onClick={() => handleSelectReplay(replay)}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{result.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    marginBottom: '0.2rem',
                  }}>
                    <span style={{ color: result.color }}>{result.text}</span>
                    <span style={{ color: 'var(--color-text-muted)', margin: '0 0.5rem' }}>·</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {DIFFICULTY_LABELS[replay.difficulty]}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted)',
                  }}>
                    {replay.totalMoves} moves · {replay.date}
                  </div>
                </div>
                <span style={{
                  color: 'var(--color-accent-hover)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}>
                  ▶ Watch
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          marginTop: '2rem',
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
          <span style={{ fontSize: '1.1rem' }}>💾</span>
          <span>
            After contract deployment, replays will be stored permanently on Walrus decentralized storage.
          </span>
        </div>
      </div>
    );
  }

  // Replay viewer
  const result = getResultLabel(selectedReplay.result);
  const progress = selectedReplay.moves.length > 0
    ? (currentStep / selectedReplay.moves.length) * 100
    : 0;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <button
          onClick={() => { setSelectedReplay(null); setCurrentStep(0); setIsPlaying(false); }}
          className="btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ color: result.color, fontWeight: 600 }}>{result.icon} {result.text}</span>
          <span style={{ color: 'var(--color-text-muted)', margin: '0 0.5rem' }}>·</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{DIFFICULTY_LABELS[selectedReplay.difficulty]}</span>
          <span style={{ color: 'var(--color-text-muted)', margin: '0 0.5rem' }}>·</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{selectedReplay.date}</span>
        </div>
      </div>

      {/* Game layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: '1.5rem',
        alignItems: 'start',
      }}>
        {/* Board */}
        <div>
          <div className="game-board" style={{ margin: '0 auto' }}>
            {board.map((cell, idx) => {
              const isLastMove = selectedReplay.moves[currentStep - 1] === idx;
              const moveIndex = selectedReplay.moves.indexOf(idx);
              const isVisible = moveIndex >= 0 && moveIndex < currentStep;

              return (
                <div
                  key={idx}
                  className={`cell ${
                    isVisible && cell === CELL_PLAYER ? 'cell--player' : ''
                  } ${
                    isVisible && cell === CELL_AI ? 'cell--ai' : ''
                  } ${
                    isLastMove ? 'cell--last-move' : ''
                  }`}
                >
                  {cell === CELL_PLAYER && isVisible ? '✕' : ''}
                  {cell === CELL_AI && isVisible ? '○' : ''}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div style={{
            marginTop: '1rem',
            background: 'var(--color-surface)',
            borderRadius: '6px',
            height: '6px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--color-accent), var(--color-player-x))',
              borderRadius: '6px',
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '1rem',
          }}>
            <ControlBtn onClick={handleReset} icon="⏮" label="Reset" />
            <ControlBtn onClick={handleStepBackward} icon="◀" label="Back" disabled={currentStep === 0} />
            {isPlaying ? (
              <ControlBtn onClick={handlePause} icon="⏸" label="Pause" primary />
            ) : (
              <ControlBtn onClick={handlePlay} icon="▶" label="Play" primary />
            )}
            <ControlBtn onClick={handleStepForward} icon="▶" label="Next" disabled={currentStep >= selectedReplay.moves.length} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="card">
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            marginBottom: '1rem',
          }}>
            Move Timeline
          </h3>
          <div style={{
            fontSize: '0.82rem',
            color: 'var(--color-text-muted)',
            marginBottom: '0.75rem',
          }}>
            Step {currentStep} / {selectedReplay.moves.length}
          </div>

          <div className="move-list" style={{ maxHeight: '400px' }}>
            {Array.from({ length: Math.ceil(selectedReplay.moves.length / 2) }).map((_, i) => {
              const playerIdx = i * 2;
              const aiIdx = i * 2 + 1;
              const playerMove = selectedReplay.moves[playerIdx];
              const aiMove = aiIdx < selectedReplay.moves.length ? selectedReplay.moves[aiIdx] : null;

              const isCurrentPlayer = currentStep === playerIdx + 1;
              const isCurrentAi = currentStep === aiIdx + 1;

              return (
                <div
                  key={i}
                  className="move-item"
                  style={{
                    background: (isCurrentPlayer || isCurrentAi) ? 'var(--color-surface-hover)' : 'transparent',
                    opacity: playerIdx < currentStep ? 1 : 0.4,
                  }}
                >
                  <span style={{ color: 'var(--color-text-muted)', minWidth: '24px' }}>
                    {i + 1}.
                  </span>
                  <span style={{ color: 'var(--color-player-x)', fontWeight: 600 }}>
                    ✕ {String.fromCharCode(65 + Math.floor(playerMove / BOARD_SIZE))}{(playerMove % BOARD_SIZE) + 1}
                  </span>
                  {aiMove !== null && (
                    <span style={{ color: 'var(--color-player-o)', fontWeight: 600 }}>
                      ○ {String.fromCharCode(65 + Math.floor(aiMove / BOARD_SIZE))}{(aiMove % BOARD_SIZE) + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlBtn({ onClick, icon, label, primary, disabled }: {
  onClick: () => void;
  icon: string;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={primary ? 'btn-primary' : 'btn-secondary'}
      style={{
        padding: '0.5rem 1rem',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}
      title={label}
    >
      {icon}
    </button>
  );
}
