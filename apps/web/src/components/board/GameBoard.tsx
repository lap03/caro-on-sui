import { Cell } from './Cell';
import { TOTAL_CELLS, STATUS_ACTIVE, CELL_PLAYER, CELL_AI } from '@/lib/constants';
import { findWinningLine } from '@/lib/utils';
import type { GameState } from '@/hooks/useGame';

interface GameBoardProps {
  gameState: GameState;
  disabled: boolean;
  onCellClick: (row: number, col: number) => void;
}

export function GameBoard({ gameState, disabled, onCellClick }: GameBoardProps) {
  const { board, status, lastPlayerMove, lastAiMove } = gameState;

  // Find winning cells for highlight
  let winningCells: Set<number> = new Set();
  if (status !== STATUS_ACTIVE) {
    // Check player win
    if (lastPlayerMove !== null) {
      const playerWin = findWinningLine(board, lastPlayerMove, CELL_PLAYER);
      if (playerWin) playerWin.forEach((idx) => winningCells.add(idx));
    }
    // Check AI win
    if (lastAiMove !== null) {
      const aiWin = findWinningLine(board, lastAiMove, CELL_AI);
      if (aiWin) aiWin.forEach((idx) => winningCells.add(idx));
    }
  }

  const isDisabled = disabled || status !== STATUS_ACTIVE;

  return (
    <div className="game-board" id="game-board">
      {Array.from({ length: TOTAL_CELLS }, (_, index) => (
        <Cell
          key={index}
          index={index}
          value={board[index]}
          isLastPlayerMove={lastPlayerMove === index}
          isLastAiMove={lastAiMove === index}
          isWinning={winningCells.has(index)}
          disabled={isDisabled}
          onClick={onCellClick}
        />
      ))}
    </div>
  );
}
