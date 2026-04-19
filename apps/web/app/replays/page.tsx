'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import {
  BOARD_SIZE,
  TOTAL_CELLS,
  CELL_EMPTY,
  CELL_PLAYER,
  CELL_AI,
  STATUS_PLAYER_WIN,
  STATUS_AI_WIN,
  DIFFICULTY_LABELS,
} from '@/lib/constants';
import { useReplays, useReplayLoader, type ReplayEntry } from '@/hooks/useReplays';
import { suiObjectUrl, walrusBlobUrl, shortId } from '@/lib/explorer';

function getResultLabel(result: number): { text: string; color: string; icon: string } {
  if (result === STATUS_PLAYER_WIN) return { text: 'Victory', color: '#34d399', icon: '🏆' };
  if (result === STATUS_AI_WIN) return { text: 'Defeat', color: '#f87171', icon: '😤' };
  return { text: 'Draw', color: '#facc15', icon: '🤝' };
}

function formatDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function truncate(str: string, head = 6, tail = 4): string {
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

export default function ReplaysPage() {
  const account = useCurrentAccount();
  const { replays, isLoading: listLoading, error: listError, refetch } = useReplays();
  const { payload, isLoading: blobLoading, error: blobError, load: loadBlob, reset: resetBlob } = useReplayLoader();

  const [selected, setSelected] = useState<ReplayEntry | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [board, setBoard] = useState<number[]>(new Array(TOTAL_CELLS).fill(CELL_EMPTY));
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(replays.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedReplays = useMemo(
    () => replays.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [replays, safePage],
  );

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  // Auto-refresh list when wallet connects/changes.
  useEffect(() => {
    if (account) refetch();
  }, [account, refetch]);

  // When user picks a replay, fetch its blob from Walrus.
  useEffect(() => {
    if (!selected) {
      resetBlob();
      setCurrentStep(0);
      setIsPlaying(false);
      return;
    }
    console.log('[replay viewer] loading blob', selected.blobId, 'for gameId', selected.gameId);
    loadBlob(selected.blobId);
    setIsPlaying(false);
  }, [selected, loadBlob, resetBlob]);

  const moves: number[] = useMemo(() => payload?.moves ?? [], [payload]);

  // When a blob finishes loading, jump to the final position by default so the
  // user actually sees the game immediately. They can scrub back / press reset
  // to step through. This avoids "empty board → thought there was no data" UX.
  useEffect(() => {
    if (payload) {
      console.log('[replay viewer] blob loaded, moves:', payload.moves.length);
      setCurrentStep(payload.moves.length);
    } else {
      setCurrentStep(0);
    }
  }, [payload]);

  // Rebuild board for the current step.
  useEffect(() => {
    const nb = new Array(TOTAL_CELLS).fill(CELL_EMPTY);
    for (let i = 0; i < currentStep && i < moves.length; i++) {
      nb[moves[i]] = i % 2 === 0 ? CELL_PLAYER : CELL_AI;
    }
    setBoard(nb);
  }, [moves, currentStep]);

  // Auto-play tick.
  useEffect(() => {
    if (!isPlaying || moves.length === 0) return;
    if (currentStep >= moves.length) {
      setIsPlaying(false);
      return;
    }
    const t = setTimeout(() => setCurrentStep((s) => s + 1), 800);
    return () => clearTimeout(t);
  }, [isPlaying, currentStep, moves.length]);

  const handleSelect = (r: ReplayEntry) => setSelected(r);
  const handleBack = () => setSelected(null);
  const handlePlay = () => {
    if (currentStep >= moves.length) setCurrentStep(0);
    setIsPlaying(true);
  };
  const handlePause = () => setIsPlaying(false);
  const handleStepFwd = () => currentStep < moves.length && setCurrentStep((s) => s + 1);
  const handleStepBack = () => currentStep > 0 && setCurrentStep((s) => s - 1);
  const handleReset = () => { setCurrentStep(0); setIsPlaying(false); };

  // ============ List view ============
  if (!selected) {
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
            <span className="gradient-text">Your Replays</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            Move-by-move playback · Stored on Walrus · Anchored on Sui
          </p>
        </div>

        {!account ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔗</div>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Connect your wallet to see your replays.
            </p>
          </div>
        ) : listLoading && replays.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', width: '24px', height: '24px' }} />
            <p style={{ color: 'var(--color-text-muted)' }}>Fetching replays from Sui…</p>
          </div>
        ) : listError ? (
          <div className="card" style={{ padding: '1.25rem', color: '#f87171' }}>
            ⚠️ {listError}
          </div>
        ) : replays.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎮</div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              No replays yet.
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Finish a game and your replay will be saved to Walrus automatically.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pagedReplays.map((r) => {
              const result = getResultLabel(r.status);
              return (
                <button
                  key={`${r.gameId}-${r.txDigest}`}
                  onClick={() => handleSelect(r)}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      marginBottom: '0.2rem',
                    }}>
                      <span style={{ color: result.color }}>{result.text}</span>
                      <span style={{ color: 'var(--color-text-muted)', margin: '0 0.5rem' }}>·</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {DIFFICULTY_LABELS[r.difficulty]}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.78rem',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}>
                      <span>{r.moveCount} moves</span>
                      <span>· {formatDate(r.timestampMs)}</span>
                      <span>·</span>
                      <a
                        href={walrusBlobUrl(r.blobId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={`Walrus blob id: ${r.blobId}`}
                        style={{
                          fontFamily: 'monospace',
                          color: 'var(--color-accent-hover)',
                          textDecoration: 'none',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--color-border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        blob {truncate(r.blobId, 6, 4)} <span>↗</span>
                      </a>
                      <a
                        href={suiObjectUrl(r.gameId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={`Sui game id: ${r.gameId}`}
                        style={{
                          fontFamily: 'monospace',
                          color: 'var(--color-accent-hover)',
                          textDecoration: 'none',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--color-border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        game {shortId(r.gameId, 4, 4)} <span>↗</span>
                      </a>
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
        )}

        {replays.length > PAGE_SIZE && (
          <div style={{
            marginTop: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
              title="First page"
            >
              ⏮
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
              title="Previous page"
            >
              ◀ Prev
            </button>
            <span style={{
              padding: '0 0.75rem',
              fontSize: '0.85rem',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
            }}>
              Page {safePage + 1} / {totalPages}
              <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.5rem', fontSize: '0.78rem', fontWeight: 400 }}>
                ({replays.length} total)
              </span>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
              title="Next page"
            >
              Next ▶
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
              title="Last page"
            >
              ⏭
            </button>
          </div>
        )}

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
            Move histories are stored as JSON blobs on Walrus testnet (~50 epochs).
            Blob ids are anchored on Sui via a <code>ReplaySaved</code> event so replays survive across devices.
          </span>
        </div>
      </div>
    );
  }

  // ============ Viewer ============
  const result = getResultLabel(selected.status);
  const progress = moves.length > 0 ? (currentStep / moves.length) * 100 : 0;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleBack} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          ← Back
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
          <span style={{ color: result.color, fontWeight: 600 }}>{result.icon} {result.text}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>·</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{DIFFICULTY_LABELS[selected.difficulty]}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>·</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{formatDate(selected.timestampMs)}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>·</span>
          <a
            href={walrusBlobUrl(selected.blobId)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Walrus blob id: ${selected.blobId}`}
            style={{
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              color: 'var(--color-accent-hover)',
              textDecoration: 'none',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            blob {truncate(selected.blobId, 8, 6)} <span>↗</span>
          </a>
          <a
            href={suiObjectUrl(selected.gameId)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Sui game id: ${selected.gameId}`}
            style={{
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              color: 'var(--color-accent-hover)',
              textDecoration: 'none',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            game {shortId(selected.gameId, 6, 6)} <span>↗</span>
          </a>
        </div>
      </div>

      {blobLoading ? (
        <div className="card" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', width: '28px', height: '28px' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Loading replay from Walrus…</p>
        </div>
      ) : blobError ? (
        <div className="card" style={{ padding: '1.5rem', color: '#f87171' }}>
          ⚠️ {blobError}
        </div>
      ) : (
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
                const isLastMove = moves[currentStep - 1] === idx;
                const moveIndex = moves.indexOf(idx);
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <ControlBtn onClick={handleReset} icon="⏮" label="Reset" />
              <ControlBtn onClick={handleStepBack} icon="◀" label="Back" disabled={currentStep === 0} />
              {isPlaying ? (
                <ControlBtn onClick={handlePause} icon="⏸" label="Pause" primary />
              ) : (
                <ControlBtn onClick={handlePlay} icon="▶" label="Play" primary />
              )}
              <ControlBtn onClick={handleStepFwd} icon="▶" label="Next" disabled={currentStep >= moves.length} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '1rem' }}>
              Move Timeline
            </h3>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
              Step {currentStep} / {moves.length}
            </div>

            <div className="move-list" style={{ maxHeight: '400px' }}>
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
                const playerIdx = i * 2;
                const aiIdx = i * 2 + 1;
                const playerMove = moves[playerIdx];
                const aiMove = aiIdx < moves.length ? moves[aiIdx] : null;

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
      )}
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
