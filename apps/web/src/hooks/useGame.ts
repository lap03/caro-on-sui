import { useState, useCallback, useEffect } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useSuiClient, useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import {
  PACKAGE_ID,
  BOARD_SIZE,
  TOTAL_CELLS,
  CELL_EMPTY,
  STATUS_ACTIVE,
  STATUS_AI_WIN,
  SUI_CLOCK_OBJECT_ID,
  SUI_RANDOM_OBJECT_ID,
} from '@/lib/constants';

export interface GameState {
  gameId: string;
  board: number[];
  moveCount: number;
  status: number;
  difficulty: number;
  moveHistory: number[];
  player: string;
  lastPlayerMove: number | null;
  lastAiMove: number | null;
}

const INITIAL_BOARD = () => new Array(TOTAL_CELLS).fill(CELL_EMPTY);

export function useGame() {
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore game from localStorage on mount
  useEffect(() => {
    const savedGameId = localStorage.getItem('caro_active_game_id');
    if (savedGameId) {
      setIsLoading(true);
      refreshGameState(savedGameId).finally(() => setIsLoading(false));
    }
  }, []); // refreshGameState is safe to omit or we can just use suiClient

  /**
   * Create a new game on-chain.
   */
  const createGame = useCallback(async (difficulty: number) => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.moveCall({
        target: `${PACKAGE_ID}::game::new_game`,
        arguments: [
          tx.pure.u8(difficulty),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });

      // Pre-build the transaction to resolve plugins using suiClient
      // This is necessary because Enoki's wallet wrapper might not pass the client during signTransaction
      const bytes = await tx.build({ client: suiClient });

      const result = await signAndExecute({
        transaction: Transaction.from(bytes),
      });

      // Await waitForTransaction instead of onSuccess to guarantee synchronous state update
      const txResult = await suiClient.waitForTransaction({
        digest: result.digest,
        options: {
          showObjectChanges: true,
          showEvents: true,
        },
      });

      const gameObject = txResult.objectChanges?.find(
        (change) => change.type === 'created' &&
          change.objectType?.includes('::game::Game')
      );

      if (gameObject && gameObject.type === 'created') {
        const newState = {
          gameId: gameObject.objectId,
          board: INITIAL_BOARD(),
          moveCount: 0,
          status: STATUS_ACTIVE,
          difficulty,
          moveHistory: [],
          player: account.address,
          lastPlayerMove: null,
          lastAiMove: null,
        };
        setGameState(newState);
        localStorage.setItem('caro_active_game_id', gameObject.objectId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create game');
      console.error('Create game error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [account, signAndExecute, suiClient]);

  /**
   * Play a move on-chain.
   */
  const play = useCallback(async (row: number, col: number) => {
    if (!account || !gameState) {
      setError('No active game');
      return;
    }

    if (gameState.status !== STATUS_ACTIVE) {
      setError('Game is already over');
      return;
    }

    const idx = row * BOARD_SIZE + col;
    if (gameState.board[idx] !== CELL_EMPTY) {
      setError('Cell is already occupied');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.moveCall({
        target: `${PACKAGE_ID}::game::play`,
        arguments: [
          tx.object(gameState.gameId),
          tx.pure.u8(row),
          tx.pure.u8(col),
          tx.object(SUI_RANDOM_OBJECT_ID),
        ],
      });

      const bytes = await tx.build({ client: suiClient });

      const result = await signAndExecute({
        transaction: Transaction.from(bytes),
      });

      await suiClient.waitForTransaction({ digest: result.digest });
      await refreshGameState(gameState.gameId);
    } catch (err: any) {
      setError(err.message || 'Failed to play move');
      console.error('Play error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [account, gameState, signAndExecute, suiClient]);

  /**
   * Resign the current game.
   */
  const resign = useCallback(async () => {
    if (!account || !gameState) return;

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.moveCall({
        target: `${PACKAGE_ID}::game::resign`,
        arguments: [tx.object(gameState.gameId)],
      });

      const bytes = await tx.build({ client: suiClient });

      const result = await signAndExecute({
        transaction: Transaction.from(bytes),
      });

      await suiClient.waitForTransaction({ digest: result.digest });
      setGameState((prev) =>
        prev ? { ...prev, status: STATUS_AI_WIN } : null
      );
      localStorage.removeItem('caro_active_game_id');
    } catch (err: any) {
      setError(err.message || 'Failed to resign');
    } finally {
      setIsLoading(false);
    }
  }, [account, gameState, signAndExecute]);

  /**
   * Refresh game state from the blockchain.
   */
  const refreshGameState = useCallback(async (gameId: string) => {
    try {
      const gameObject = await suiClient.getObject({
        id: gameId,
        options: { showContent: true },
      });

      if (gameObject.data?.content?.dataType === 'moveObject') {
        const fields = gameObject.data.content.fields as any;

        const board = (fields.board as string[]).map(Number);
        const moveHistory = (fields.move_history as string[]).map(Number);
        const moveCount = Number(fields.move_count);

        // Determine last moves
        let lastPlayerMove: number | null = null;
        let lastAiMove: number | null = null;
        if (moveHistory.length >= 2) {
          lastAiMove = moveHistory[moveHistory.length - 1];
          lastPlayerMove = moveHistory[moveHistory.length - 2];
        } else if (moveHistory.length === 1) {
          lastPlayerMove = moveHistory[0];
        }

        setGameState({
          gameId,
          board,
          moveCount,
          status: Number(fields.status),
          difficulty: Number(fields.difficulty),
          moveHistory,
          player: fields.player,
          lastPlayerMove,
          lastAiMove,
        });

        if (Number(fields.status) !== STATUS_ACTIVE) {
          localStorage.removeItem('caro_active_game_id');
        } else {
          localStorage.setItem('caro_active_game_id', gameId);
        }
      }
    } catch (err: any) {
      console.error('Refresh game state error:', err);
    }
  }, [suiClient]);

  /**
   * Reset to start a new game.
   */
  const resetGame = useCallback(() => {
    setGameState(null);
    setError(null);
    localStorage.removeItem('caro_active_game_id');
  }, []);

  return {
    gameState,
    isLoading: isLoading || isPending,
    error,
    createGame,
    play,
    resign,
    resetGame,
    refreshGameState,
  };
}
