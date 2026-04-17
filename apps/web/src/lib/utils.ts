import {
  BOARD_SIZE,
  CELL_PLAYER,
  CELL_AI,
  WIN_LENGTH,
} from './constants';

/**
 * Convert flat index to (row, col) tuple.
 */
export function indexToPos(index: number): [number, number] {
  return [Math.floor(index / BOARD_SIZE), index % BOARD_SIZE];
}

/**
 * Convert (row, col) to flat index.
 */
export function posToIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

/**
 * Format a move index as human-readable coordinates like "H8".
 */
export function formatMove(index: number): string {
  const [row, col] = indexToPos(index);
  const colLetter = String.fromCharCode(65 + col); // A-O
  return `${colLetter}${row + 1}`;
}

/**
 * Get the cell display character.
 */
export function getCellSymbol(value: number): string {
  if (value === CELL_PLAYER) return '✕';
  if (value === CELL_AI) return '○';
  return '';
}

/**
 * Check for a winning line from a position (client-side preview).
 * Returns the winning cell indices or null.
 */
export function findWinningLine(
  board: number[],
  lastIndex: number,
  mark: number
): number[] | null {
  const row = Math.floor(lastIndex / BOARD_SIZE);
  const col = lastIndex % BOARD_SIZE;

  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1],  // diagonal /
  ];

  for (const [dr, dc] of directions) {
    const line: number[] = [lastIndex];

    // Forward
    for (let step = 1; step < WIN_LENGTH; step++) {
      const r = row + step * dr;
      const c = col + step * dc;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      const idx = r * BOARD_SIZE + c;
      if (board[idx] !== mark) break;
      line.push(idx);
    }

    // Backward
    for (let step = 1; step < WIN_LENGTH; step++) {
      const r = row - step * dr;
      const c = col - step * dc;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      const idx = r * BOARD_SIZE + c;
      if (board[idx] !== mark) break;
      line.push(idx);
    }

    if (line.length >= WIN_LENGTH) {
      return line;
    }
  }

  return null;
}

/**
 * Shorten a Sui address for display.
 */
export function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format timestamp to relative time.
 */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
