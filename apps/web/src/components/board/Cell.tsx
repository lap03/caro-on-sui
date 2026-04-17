import { BOARD_SIZE, CELL_EMPTY, CELL_PLAYER, CELL_AI } from '@/lib/constants';
import { getCellSymbol } from '@/lib/utils';

interface CellProps {
  index: number;
  value: number;
  isLastPlayerMove: boolean;
  isLastAiMove: boolean;
  isWinning: boolean;
  disabled: boolean;
  onClick: (row: number, col: number) => void;
}

export function Cell({
  index,
  value,
  isLastPlayerMove,
  isLastAiMove,
  isWinning,
  disabled,
  onClick,
}: CellProps) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;

  const isOccupied = value !== CELL_EMPTY;
  const isLastMove = isLastPlayerMove || isLastAiMove;

  const cellClasses = [
    'cell',
    value === CELL_PLAYER ? 'cell--player' : '',
    value === CELL_AI ? 'cell--ai' : '',
    isOccupied ? 'cell--occupied' : '',
    isLastMove ? 'cell--last-move' : '',
    isWinning ? 'cell--winning' : '',
    disabled ? 'cell--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={cellClasses}
      onClick={() => {
        if (!isOccupied && !disabled) {
          onClick(row, col);
        }
      }}
      disabled={isOccupied || disabled}
      aria-label={`Cell ${String.fromCharCode(65 + col)}${row + 1}${isOccupied ? ` - ${value === CELL_PLAYER ? 'Player' : 'AI'}` : ''}`}
      id={`cell-${row}-${col}`}
    >
      {getCellSymbol(value)}
    </button>
  );
}
