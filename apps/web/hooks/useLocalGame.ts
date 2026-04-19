import { useState, useCallback } from 'react';
import {
  BOARD_SIZE,
  TOTAL_CELLS,
  CELL_EMPTY,
  CELL_PLAYER,
  CELL_AI,
  STATUS_ACTIVE,
  STATUS_PLAYER_WIN,
  STATUS_AI_WIN,
  STATUS_DRAW,
  DIFFICULTY_EASY,
  DIFFICULTY_MEDIUM,
} from '@/lib/constants';
import type { GameState } from '@/hooks/useGame';

const DIRECTIONS = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diagonal down-right
  [1, -1],  // diagonal down-left
];

function checkWin(board: number[], lastIdx: number, player: number): boolean {
  const row = Math.floor(lastIdx / BOARD_SIZE);
  const col = lastIdx % BOARD_SIZE;

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    // Forward
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r * BOARD_SIZE + c] !== player) break;
      count++;
    }
    // Backward
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r * BOARD_SIZE + c] !== player) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}

function getEmptyCells(board: number[]): number[] {
  const empty: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === CELL_EMPTY) empty.push(i);
  }
  return empty;
}

/** Score a cell for AI placement (higher = better) */
function scoreCell(board: number[], idx: number, player: number): number {
  const row = Math.floor(idx / BOARD_SIZE);
  const col = idx % BOARD_SIZE;
  let totalScore = 0;

  for (const [dr, dc] of DIRECTIONS) {
    let count = 0;
    let openEnds = 0;

    // Forward
    let blocked = false;
    for (let i = 1; i <= 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) { blocked = true; break; }
      const cell = board[r * BOARD_SIZE + c];
      if (cell === player) count++;
      else if (cell === CELL_EMPTY) { openEnds++; break; }
      else { blocked = true; break; }
    }

    // Backward
    for (let i = 1; i <= 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) { blocked = true; break; }
      const cell = board[r * BOARD_SIZE + c];
      if (cell === player) count++;
      else if (cell === CELL_EMPTY) { openEnds++; break; }
      else { blocked = true; break; }
    }

    // Score based on consecutive pieces and open ends
    if (count >= 4) totalScore += 100000;         // Win/block win
    else if (count === 3 && openEnds >= 2) totalScore += 10000;  // Open four threat
    else if (count === 3 && openEnds >= 1) totalScore += 5000;
    else if (count === 2 && openEnds >= 2) totalScore += 1000;   // Open three
    else if (count === 2 && openEnds >= 1) totalScore += 500;
    else if (count === 1 && openEnds >= 2) totalScore += 100;
  }

  // Center bias
  const centerDist = Math.abs(row - 7) + Math.abs(col - 7);
  totalScore += Math.max(0, 14 - centerDist) * 5;

  return totalScore;
}

function aiMove(board: number[], difficulty: number): number {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return -1;

  // Easy: mostly random
  if (difficulty === DIFFICULTY_EASY) {
    // 30% chance of smart move
    if (Math.random() > 0.3) {
      return empty[Math.floor(Math.random() * empty.length)];
    }
  }

  // Check AI immediate win
  for (const idx of empty) {
    board[idx] = CELL_AI;
    if (checkWin(board, idx, CELL_AI)) { board[idx] = CELL_EMPTY; return idx; }
    board[idx] = CELL_EMPTY;
  }

  // Check block player immediate win
  for (const idx of empty) {
    board[idx] = CELL_PLAYER;
    if (checkWin(board, idx, CELL_PLAYER)) { board[idx] = CELL_EMPTY; return idx; }
    board[idx] = CELL_EMPTY;
  }

  // Medium: 60% smart, 40% random
  if (difficulty === DIFFICULTY_MEDIUM && Math.random() > 0.6) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // Score all empty cells for both AI offense and player defense
  let bestIdx = empty[0];
  let bestScore = -1;

  for (const idx of empty) {
    const offenseScore = scoreCell(board, idx, CELL_AI);
    const defenseScore = scoreCell(board, idx, CELL_PLAYER) * 0.9; // slightly prefer offense
    const totalScore = offenseScore + defenseScore + Math.random() * 10; // add randomness

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

/**
 * Local game simulation hook — plays entirely in the browser
 * without any blockchain transactions. For demo/offline mode.
 */
export function useLocalGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGame = useCallback(async (difficulty: number) => {
    setGameState({
      gameId: `local-${Date.now()}`,
      board: new Array(TOTAL_CELLS).fill(CELL_EMPTY),
      moveCount: 0,
      status: STATUS_ACTIVE,
      difficulty,
      moveHistory: [],
      player: 'local-player',
      lastPlayerMove: null,
      lastAiMove: null,
    });
    setError(null);
  }, []);

  const play = useCallback(async (row: number, col: number) => {
    if (!gameState || gameState.status !== STATUS_ACTIVE) return;

    const idx = row * BOARD_SIZE + col;
    if (gameState.board[idx] !== CELL_EMPTY) {
      setError('Cell is already occupied');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Simulate slight delay for realism
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

    const newBoard = [...gameState.board];
    const newHistory = [...gameState.moveHistory, idx];

    // Player move
    newBoard[idx] = CELL_PLAYER;
    let newStatus = STATUS_ACTIVE;
    let newMoveCount = gameState.moveCount + 1;
    let lastAiMove: number | null = gameState.lastAiMove;

    // Check player win
    if (checkWin(newBoard, idx, CELL_PLAYER)) {
      newStatus = STATUS_PLAYER_WIN;
    } else if (getEmptyCells(newBoard).length === 0) {
      newStatus = STATUS_DRAW;
    } else {
      // AI responds
      const aiIdx = aiMove(newBoard, gameState.difficulty);
      if (aiIdx >= 0) {
        newBoard[aiIdx] = CELL_AI;
        newHistory.push(aiIdx);
        newMoveCount++;
        lastAiMove = aiIdx;

        if (checkWin(newBoard, aiIdx, CELL_AI)) {
          newStatus = STATUS_AI_WIN;
        } else if (getEmptyCells(newBoard).length === 0) {
          newStatus = STATUS_DRAW;
        }
      }
    }

    setGameState({
      ...gameState,
      board: newBoard,
      moveCount: newMoveCount,
      status: newStatus,
      moveHistory: newHistory,
      lastPlayerMove: idx,
      lastAiMove,
    });
    setIsLoading(false);
  }, [gameState]);

  const resign = useCallback(async () => {
    if (!gameState) return;
    setGameState({ ...gameState, status: STATUS_AI_WIN });
  }, [gameState]);

  const resetGame = useCallback(() => {
    setGameState(null);
    setError(null);
  }, []);

  return {
    gameState,
    isLoading,
    error,
    createGame,
    play,
    resign,
    resetGame,
  };
}
