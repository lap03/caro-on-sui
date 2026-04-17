import { useState } from 'react';
import { GameBoard } from '@/components/board/GameBoard';
import { GameStatus } from '@/components/board/GameStatus';
import { NewGameDialog } from '@/components/game/NewGameDialog';
import { MoveHistory } from '@/components/game/MoveHistory';
import { ResultModal } from '@/components/game/ResultModal';
import { Confetti } from '@/components/game/Confetti';
import { useLocalGame } from '@/hooks/useLocalGame';
import { PACKAGE_ID, STATUS_ACTIVE, STATUS_PLAYER_WIN } from '@/lib/constants';
// import { useGame } from '@/hooks/useGame'; // Enable when contract is deployed

export function Play() {
  // Use local game when contract is not deployed, on-chain game when it is
  const isContractDeployed = PACKAGE_ID !== '0x0';
  // const onChainGame = useGame(); // Enable when contract is deployed
  const localGame = useLocalGame();
  const game = localGame; // Switch to onChainGame when deployed

  const {
    gameState,
    isLoading,
    error,
    createGame,
    play,
    resign,
    resetGame,
  } = game;

  const [showNewGameDialog, setShowNewGameDialog] = useState(!gameState);
  const [showResult, setShowResult] = useState(false);
  const [dismissedResult, setDismissedResult] = useState(false);

  const handleStartGame = async (difficulty: number) => {
    await createGame(difficulty);
    setShowNewGameDialog(false);
    setDismissedResult(false);
    setShowResult(false);
  };

  const handleCellClick = (row: number, col: number) => {
    if (!isLoading && gameState) {
      play(row, col);
    }
  };

  const handleNewGame = () => {
    resetGame();
    setShowNewGameDialog(true);
    setShowResult(false);
    setDismissedResult(false);
  };

  // Show result modal when game ends
  const gameJustEnded = gameState && gameState.status !== STATUS_ACTIVE && !dismissedResult && !showResult;
  if (gameJustEnded) {
    setTimeout(() => setShowResult(true), 500);
  }

  const isPlayerWin = gameState?.status === STATUS_PLAYER_WIN;

  // No active game — show dialog
  if (!gameState) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '4rem 1.5rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎮</div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem',
          fontWeight: 700,
          marginBottom: '0.75rem',
        }}>
          Ready to Play?
        </h2>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '1rem',
          marginBottom: '2rem',
        }}>
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

  // Active game
  return (
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '1.5rem',
    }}>
      {/* Confetti on win */}
      <Confetti active={isPlayerWin && !dismissedResult} />

      {/* Game layout — responsive grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: '1.5rem',
        alignItems: 'start',
      }}
        className="game-layout"
      >
        {/* Board column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <GameBoard
            gameState={gameState}
            disabled={isLoading}
            onCellClick={handleCellClick}
          />

          {/* AI thinking — positioned under the board */}
          <div style={{
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}>
            {isLoading && (
              <div className="animate-fade-in" style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: '10px',
                padding: '0.4rem 1.25rem',
                color: 'var(--color-accent-hover)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}>
                <span className="spinner" style={{ width: '14px', height: '14px' }} />
                {isContractDeployed ? 'Processing on-chain...' : '🤖 AI is thinking...'}
              </div>
            )}
          </div>

          {/* Error — also under board */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
              padding: '0.4rem 1rem',
              color: '#f87171',
              fontSize: '0.82rem',
              width: '100%',
              textAlign: 'center',
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Sidebar — fixed height, no page scroll */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxHeight: '650px',
          height: '100%',
        }}>
          <GameStatus
            gameState={gameState}
            onNewGame={handleNewGame}
            onResign={resign}
            isLoading={isLoading}
          />
          {/* MoveHistory fills remaining space with internal scroll */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <MoveHistory moveHistory={gameState.moveHistory} />
          </div>
        </div>
      </div>

      {/* New Game Dialog */}
      <NewGameDialog
        isOpen={showNewGameDialog}
        onClose={() => setShowNewGameDialog(false)}
        onStart={handleStartGame}
        isLoading={isLoading}
      />

      {/* Result Modal */}
      {showResult && gameState.status !== STATUS_ACTIVE && (
        <ResultModal
          status={gameState.status}
          moveCount={gameState.moveCount}
          difficulty={gameState.difficulty}
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
