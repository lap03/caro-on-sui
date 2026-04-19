'use client';

import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { GameBoard } from '@/components/board/GameBoard';
import { GameStatus } from '@/components/board/GameStatus';
import { NewGameDialog } from '@/components/game/NewGameDialog';
import { MoveHistory } from '@/components/game/MoveHistory';
import { ResultModal } from '@/components/game/ResultModal';
import { Confetti } from '@/components/game/Confetti';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { PACKAGE_ID, SEAL_ENABLED, STATUS_ACTIVE, STATUS_PLAYER_WIN } from '@/lib/constants';
import { useGame } from '@/hooks/useGame';
import { useSeal } from '@/hooks/useSeal';
import { toast } from 'sonner';

export default function PlayPage() {
  const account = useCurrentAccount();

  const isContractDeployed = PACKAGE_ID !== '0x0';
  const game = useGame();

  const { gameState, isLoading, error, replaySaveStatus, createGame, play, resign, resetGame } = game;
  const seal = useSeal();

  const [showNewGameDialog, setShowNewGameDialog] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [dismissedResult, setDismissedResult] = useState(false);
  const [challengeMode, setChallengeMode] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<
    'idle' | 'encrypting' | 'pending-reveal' | 'verified' | 'mismatch' | 'failed'
  >('idle');

  const handleStartGame = async (difficulty: number) => {
    await createGame(difficulty);
    setShowNewGameDialog(false);
    setDismissedResult(false);
    setShowResult(false);
  };

  const handleCellClick = async (row: number, col: number) => {
    if (isLoading || !gameState || gameState.status !== STATUS_ACTIVE) return;
    const idx = row * 15 + col;
    if (gameState.board[idx] !== 0) return;

    // Normal path — no Seal.
    if (!challengeMode || !SEAL_ENABLED) {
      play(row, col);
      return;
    }

    // Challenge Mode — encrypt → play → decrypt round-trip to prove the Seal
    // key server released the key only to the game's rightful player.
    setVerifyStatus('encrypting');
    try {
      const encrypted = await seal.encryptPlayerMove(PACKAGE_ID, gameState.gameId, row, col);
      setVerifyStatus('pending-reveal');
      await play(row, col);
      try {
        const revealed = await seal.decryptPlayerMove(encrypted, gameState.gameId);
        if (revealed.row === row && revealed.col === col) {
          setVerifyStatus('verified');
        } else {
          setVerifyStatus('mismatch');
          toast.error('Seal round-trip mismatch — reported move differs from committed.');
        }
      } catch (decryptErr) {
        console.error('Seal decrypt failed', decryptErr);
        setVerifyStatus('failed');
        toast.error('Seal decrypt failed. See console for details.');
      }
    } catch (encryptErr) {
      console.error('Seal encrypt failed', encryptErr);
      setVerifyStatus('failed');
      toast.error('Seal encrypt failed. Playing without encryption.');
      // Fall back to plain play so the user isn't stuck.
      play(row, col);
    }
  };

  const handleNewGame = () => {
    resetGame();
    setShowNewGameDialog(true);
    setShowResult(false);
    setDismissedResult(false);
  };

  const gameJustEnded =
    gameState && gameState.status !== STATUS_ACTIVE && !dismissedResult && !showResult;
  if (gameJustEnded) {
    setTimeout(() => setShowResult(true), 500);
  }

  const isPlayerWin = gameState?.status === STATUS_PLAYER_WIN;

  if (!account) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🔗</div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
          }}
        >
          Connect Your Wallet
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Connect your Sui wallet to start playing Caro On-Chain. Your moves will be recorded as on-chain
          transactions.
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Use the wallet button in the top right corner to connect.
        </p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎮</div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
          }}
        >
          Ready to Play?
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '2rem' }}>
          Create a new game and challenge the on-chain AI!
        </p>
        <button
          className="btn-primary"
          onClick={() => setShowNewGameDialog(true)}
          style={{ fontSize: '1.1rem', padding: '1rem 2.5rem' }}
        >
          ⚡ New Game
        </button>
        <NewGameDialog
          isOpen={showNewGameDialog}
          onClose={() => setShowNewGameDialog(false)}
          onStart={handleStartGame}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      <Confetti active={isPlayerWin && !dismissedResult} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: '1.5rem',
          alignItems: 'start',
        }}
        className="game-layout"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <GameBoard gameState={gameState} disabled={isLoading} onCellClick={handleCellClick} />

          <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {isLoading && (
              <div
                className="animate-fade-in"
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: '10px',
                  padding: '0.4rem 1.25rem',
                  color: 'var(--color-accent-hover)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                <span className="spinner" style={{ width: '14px', height: '14px' }} />
                {isContractDeployed ? 'Processing on-chain...' : '🤖 AI is thinking...'}
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                padding: '0.4rem 1rem',
                color: '#f87171',
                fontSize: '0.82rem',
                width: '100%',
                textAlign: 'center',
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '650px', height: '100%' }}>
          <GameStatus gameState={gameState} onNewGame={handleNewGame} onResign={resign} isLoading={isLoading} />

          {SEAL_ENABLED && (
            <div
              className="card"
              style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>🔒 Challenge Mode</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Seal-encrypt each move before submit
                  </div>
                </div>
                <Switch
                  checked={challengeMode}
                  onCheckedChange={(v) => {
                    setChallengeMode(v);
                    setVerifyStatus('idle');
                  }}
                />
              </div>
              {challengeMode && verifyStatus !== 'idle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {verifyStatus === 'encrypting' && <Badge variant="secondary">🔒 Encrypting…</Badge>}
                  {verifyStatus === 'pending-reveal' && <Badge variant="secondary">🔒 Awaiting reveal…</Badge>}
                  {verifyStatus === 'verified' && <Badge>🔒 → ✅ Verified</Badge>}
                  {verifyStatus === 'mismatch' && <Badge variant="destructive">⚠ Mismatch</Badge>}
                  {verifyStatus === 'failed' && <Badge variant="destructive">⚠ Seal failed</Badge>}
                </div>
              )}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <MoveHistory moveHistory={gameState.moveHistory} />
          </div>
        </div>
      </div>

      <NewGameDialog
        isOpen={showNewGameDialog}
        onClose={() => setShowNewGameDialog(false)}
        onStart={handleStartGame}
        isLoading={isLoading}
      />

      {showResult && gameState.status !== STATUS_ACTIVE && (
        <ResultModal
          status={gameState.status}
          moveCount={gameState.moveCount}
          difficulty={gameState.difficulty}
          replaySaveStatus={replaySaveStatus}
          onNewGame={handleNewGame}
          onClose={() => {
            setShowResult(false);
            setDismissedResult(true);
          }}
        />
      )}
    </div>
  );
}
