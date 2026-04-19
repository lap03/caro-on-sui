import { useState, useCallback, useEffect } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { useSuiClient, useSignTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { toast } from 'sonner';
import {
  PACKAGE_ID,
  ORIGINAL_PACKAGE_ID,
  BOARD_SIZE,
  TOTAL_CELLS,
  CELL_EMPTY,
  STATUS_ACTIVE,
  STATUS_PLAYER_WIN,
  STATUS_AI_WIN,
  STATUS_DRAW,
  SUI_CLOCK_OBJECT_ID,
  SUI_RANDOM_OBJECT_ID,
  LEADERBOARD_ID,
} from '@/lib/constants';
import { uploadReplay, blobIdToBytes, type ReplayPayload } from '@/lib/walrus';
import { suiObjectUrl, suiTxUrl, walrusBlobUrl, shortId } from '@/lib/explorer';

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
  const { mutateAsync: signTransaction, isPending } = useSignTransaction();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Status of the async Walrus + on-chain anchor flow that runs after a game
   * ends. Exposed so UI can render a "Saving replay…" / "Replay saved" /
   * "Failed to save" indicator next to the result modal instead of relying
   * on the toast alone.
   */
  const [replaySaveStatus, setReplaySaveStatus] =
    useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  /**
   * Helper to execute a sponsored transaction
   */
  const executeSponsored = async (tx: Transaction) => {
    if (!account) throw new Error('Not connected');
    
    // 1. Build only the transaction kind
    const txKindBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
    
    // 2. Request sponsorship.
    // Next.js owns /api/* at the same origin in both `next dev` and Vercel, so
    // apiBase is usually empty. Override with NEXT_PUBLIC_API_URL only if you're
    // pointing at an external backend.
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const sponsorRes = await fetch(`${apiBase}/api/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txKindBytes: toBase64(txKindBytes),
        sender: account.address,
      }),
    });
    
    if (!sponsorRes.ok) {
      const err = await sponsorRes.json();
      throw new Error(err.error || 'Failed to sponsor transaction');
    }
    const sponsored = await sponsorRes.json();
    
    // 3. Sign the sponsored transaction
    const signed = await signTransaction({
      transaction: Transaction.from(sponsored.bytes || sponsored.transactionBlockBytes),
    });
    
    // 4. Execute the sponsored transaction (same base as step 2).
    const executeRes = await fetch(`${apiBase}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        digest: sponsored.digest,
        signature: signed.signature,
      }),
    });
    
    if (!executeRes.ok) {
      const err = await executeRes.json();
      throw new Error(err.error || 'Failed to execute transaction');
    }
    return executeRes.json();
  };

  /**
   * Locate the just-minted `GameResult` NFT for a given gameId. Queries the
   * player's owned objects filtered by struct type, then matches on the
   * `game_id` field. Returns null if not found (e.g. indexer not caught up).
   */
  const findGameResultId = async (gameId: string): Promise<string | null> => {
    if (!account) return null;
    try {
      const res = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${ORIGINAL_PACKAGE_ID}::game::GameResult` },
        options: { showContent: true },
        limit: 50,
      });
      for (const o of res.data ?? []) {
        const fields = (o.data?.content as any)?.fields;
        if (!fields) continue;
        if (String(fields.game_id) === String(gameId) && o.data?.objectId) {
          return o.data.objectId;
        }
      }
    } catch (err) {
      console.error('findGameResultId failed:', err);
    }
    return null;
  };

  /**
   * Fire-and-forget: upload the final move history to Walrus, then anchor the
   * blob id on-chain via `attach_replay`. Runs after a terminal game tx (win,
   * loss, draw, or resign). Failures are logged only — they never block gameplay.
   *
   * Note: we don't require the caller to pre-resolve the GameResult id. This
   * function looks it up from the player's owned objects so it's robust even
   * if the surrounding tx response didn't include `objectChanges`.
   */
  const saveReplayFireAndForget = async (gameId: string) => {
    console.log('[replay] saveReplayFireAndForget entered for gameId', gameId);
    if (!account) {
      console.warn('[replay] aborted — no account');
      return;
    }
    try {
      // 1. Read authoritative final game state from chain.
      const obj = await suiClient.getObject({
        id: gameId,
        options: { showContent: true },
      });
      if (obj.data?.content?.dataType !== 'moveObject') {
        console.warn('[replay] game object not accessible', gameId, obj);
        return;
      }
      const fields = obj.data.content.fields as any;

      const payload: ReplayPayload = {
        version: 1,
        gameId,
        player: account.address,
        moves: (fields.move_history as string[] | number[]).map((x) => Number(x)),
        status: Number(fields.status),
        difficulty: Number(fields.difficulty),
        moveCount: Number(fields.move_count),
        createdAt: Date.now(),
      };

      // 2. Upload to Walrus.
      const blobId = await uploadReplay(payload);
      console.log('[replay] uploaded to Walrus, blobId:', blobId);

      // 3. Find the matching GameResult NFT. Indexer can lag a beat after the
      //    win tx, so retry a few times before giving up.
      let gameResultId: string | null = null;
      for (let i = 0; i < 4 && !gameResultId; i++) {
        gameResultId = await findGameResultId(gameId);
        if (!gameResultId) await new Promise((r) => setTimeout(r, 1000));
      }
      if (!gameResultId) {
        console.warn('[replay] GameResult NFT not found; skipping on-chain anchor');
        return;
      }

      // 4. Anchor blob id on-chain via attach_replay.
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.moveCall({
        target: `${PACKAGE_ID}::game::attach_replay`,
        arguments: [
          tx.object(gameResultId),
          tx.pure.vector('u8', blobIdToBytes(blobId)),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
      await executeSponsored(tx);
      console.log('[replay] anchored on-chain for gameId', gameId);

      toast.success('Replay saved to Walrus', {
        description: `blob ${shortId(blobId, 8, 6)} · anchored on-chain`,
        action: {
          label: 'View on WalrusScan',
          onClick: () => window.open(walrusBlobUrl(blobId), '_blank'),
        },
        duration: 8000,
      });
    } catch (err) {
      console.error('Replay save failed:', err);
    }
  };

  // Restore game from localStorage on mount
  useEffect(() => {
    const savedGameId = localStorage.getItem('caro_active_game_id');
    if (savedGameId) {
      setIsLoading(true);
      refreshGameState(savedGameId).finally(() => setIsLoading(false));
    }
  }, []); // refreshGameState is safe to omit or we can just use suiClient

  /**
   * Pure fetcher: pulls the Game object from chain and returns a GameState,
   * or null if the object doesn't exist / is from an orphan package. No
   * side effects (no setState) — used internally when we need to inspect
   * state before deciding whether to commit it.
   */
  const fetchGameState = useCallback(
    async (gameId: string): Promise<GameState | null> => {
      try {
        const gameObject = await suiClient.getObject({
          id: gameId,
          options: { showContent: true },
        });

        if (gameObject.data?.content?.dataType !== 'moveObject') return null;

        // Guard: stale game from an old (now-orphaned) package.
        const typeTag: string = gameObject.data.content.type ?? '';
        const expectedPrefix = `${ORIGINAL_PACKAGE_ID}::game::Game`;
        if (ORIGINAL_PACKAGE_ID !== '0x0' && !typeTag.startsWith(expectedPrefix)) {
          console.warn(
            `[useGame] Ignoring stale game ${gameId} — type "${typeTag}" does not match current package`,
          );
          localStorage.removeItem('caro_active_game_id');
          return null;
        }

        const fields = gameObject.data.content.fields as any;
        const board = (fields.board as string[]).map(Number);
        const moveHistory = (fields.move_history as string[]).map(Number);
        const moveCount = Number(fields.move_count);

        let lastPlayerMove: number | null = null;
        let lastAiMove: number | null = null;
        if (moveHistory.length >= 2) {
          lastAiMove = moveHistory[moveHistory.length - 1];
          lastPlayerMove = moveHistory[moveHistory.length - 2];
        } else if (moveHistory.length === 1) {
          lastPlayerMove = moveHistory[0];
        }

        return {
          gameId,
          board,
          moveCount,
          status: Number(fields.status),
          difficulty: Number(fields.difficulty),
          moveHistory,
          player: fields.player,
          lastPlayerMove,
          lastAiMove,
        };
      } catch (err: any) {
        console.error('fetchGameState error:', err);
        return null;
      }
    },
    [suiClient],
  );

  /**
   * Refresh: fetch + commit. Keeps the old public behavior for localStorage
   * restore and other non-critical callers.
   */
  const refreshGameState = useCallback(
    async (gameId: string) => {
      const state = await fetchGameState(gameId);
      if (state === null) {
        setGameState(null);
        return;
      }
      setGameState(state);
      if (state.status !== STATUS_ACTIVE) {
        localStorage.removeItem('caro_active_game_id');
      } else {
        localStorage.setItem('caro_active_game_id', gameId);
      }
    },
    [fetchGameState],
  );

  /**
   * Post-tx reconciliation with retry. Different fullnodes can have slight
   * read-after-write lag — a fresh `getObject` right after `waitForTransaction`
   * sometimes returns the pre-tx version. Poll until `move_count` advances
   * past `minExpectedMoveCount` (or give up after `maxAttempts`). Returns the
   * latest state observed whether or not it advanced, plus whether it did.
   */
  const reconcileAfterTx = useCallback(
    async (
      gameId: string,
      minExpectedMoveCount: number,
      maxAttempts = 8,
      delayMs = 400,
    ): Promise<{ state: GameState | null; advanced: boolean }> => {
      let latest: GameState | null = null;
      for (let i = 0; i < maxAttempts; i++) {
        latest = await fetchGameState(gameId);
        if (latest && latest.moveCount >= minExpectedMoveCount) {
          return { state: latest, advanced: true };
        }
        if (i < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      return { state: latest, advanced: false };
    },
    [fetchGameState],
  );

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
    setReplaySaveStatus('idle');

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

      const result = await executeSponsored(tx);

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

        toast.success('Game created on-chain', {
          description:
            `ID ${shortId(gameObject.objectId)} · tx ${shortId(result.digest)} · ` +
            `gas sponsored by Enoki`,
          action: {
            label: 'View on SuiVision',
            onClick: () => window.open(suiObjectUrl(gameObject.objectId), '_blank'),
          },
          duration: 10000,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create game');
      console.error('Create game error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient]);

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

      const result = await executeSponsored(tx);

      const txResult = await suiClient.waitForTransaction({
        digest: result.digest,
        options: { showEvents: true, showObjectChanges: true },
      });

      // Event-driven UI update. MovePlayed fires on the continue-path (game still
      // active). GameEnded fires on every terminal path (win/loss/draw) — use it
      // to trigger the leaderboard update regardless of whether MovePlayed was emitted.
      const moveEvent = txResult.events?.find(e => e.type.includes('::game::MovePlayed'));
      const endedEvent = txResult.events?.find(e => e.type.includes('::game::GameEnded'));

      // Chain is the source of truth. Events from waitForTransaction can come
      // back empty due to fullnode indexing lag — poll the Game object until
      // move_count advances (player move counts as +1; AI reply makes it +2).
      const prevMoveCount = gameState.moveCount;
      const { state: reconciled, advanced } = await reconcileAfterTx(
        gameState.gameId,
        prevMoveCount + 1,
      );

      if (!advanced) {
        // Ran out of polling attempts without seeing the new move — either the
        // tx genuinely didn't land (Enoki rejected, sponsor failed server-side)
        // or the RPC is severely lagged. Tell the user so they can retry.
        console.warn(
          '[play] tx reconciliation did not advance move_count',
          { digest: result.digest, prevMoveCount, seen: reconciled?.moveCount, events: txResult.events },
        );
        toast.error('Move not confirmed on-chain', {
          description: 'The transaction may not have landed. Please try that move again.',
          duration: 6000,
        });
        // Commit whatever state we saw (even if stale) so UI doesn't show a
        // phantom pending state indefinitely.
        if (reconciled) setGameState(reconciled);
        return;
      }

      // Advanced = we have fresh on-chain state. Commit it.
      if (reconciled) {
        setGameState(reconciled);
        if (reconciled.status !== STATUS_ACTIVE) {
          localStorage.removeItem('caro_active_game_id');
        }
      }

      // Prefer the event for determining game-ended side effects (leaderboard +
      // replay). If the event is missing but reconciled.status says the game
      // ended, still fire the flow.
      const endedFromChain = reconciled && reconciled.status !== STATUS_ACTIVE;
      if (endedEvent || endedFromChain) {
        const endedStatus = endedEvent
          ? Number((endedEvent.parsedJson as any).status)
          : (reconciled as GameState).status;

        const txLb = new Transaction();
        txLb.setSender(account.address);
        txLb.moveCall({
          target: `${PACKAGE_ID}::leaderboard::record_result`,
          arguments: [
            txLb.object(LEADERBOARD_ID),
            txLb.pure.address(account.address),
            txLb.pure.bool(endedStatus === STATUS_PLAYER_WIN),
            txLb.pure.bool(endedStatus === STATUS_DRAW),
          ],
        });
        executeSponsored(txLb).catch(e =>
          console.error('Failed to record leaderboard stat:', e)
        );

        // Save replay to Walrus + anchor on-chain.
        console.log('[replay] GameEnded detected, kicking off replay save for', gameState.gameId);
        setReplaySaveStatus('saving');
        saveReplayFireAndForget(gameState.gameId)
          .then(() => setReplaySaveStatus((s) => (s === 'saving' ? 'success' : s)))
          .catch((e) => {
            console.error('[replay] unhandled error in save:', e);
            setReplaySaveStatus('error');
          });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to play move');
      console.error('Play error:', err);
      toast.error('Move failed', {
        description: err?.message?.slice(0, 160) || 'Please try again.',
        duration: 6000,
      });
      // Recovery: tx may have actually landed even if our pipeline errored.
      if (gameState?.gameId) {
        refreshGameState(gameState.gameId).catch(() => {});
      }
    } finally {
      setIsLoading(false);
    }
  }, [account, gameState, suiClient, reconcileAfterTx, refreshGameState]);

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

      const result = await executeSponsored(tx);

      const txResult = await suiClient.waitForTransaction({
        digest: result.digest,
        options: { showEvents: true, showObjectChanges: true },
      });

      // Update UI state
      setGameState((prev) =>
        prev ? { ...prev, status: STATUS_AI_WIN } : null
      );
      localStorage.removeItem('caro_active_game_id');

      // Save replay (same pattern as play() terminal path).
      setReplaySaveStatus('saving');
      saveReplayFireAndForget(gameState.gameId)
        .then(() => setReplaySaveStatus((s) => (s === 'saving' ? 'success' : s)))
        .catch((e) => {
          console.error('[replay] unhandled error in save:', e);
          setReplaySaveStatus('error');
        });

      // Update leaderboard
      const txLb = new Transaction();
      txLb.setSender(account.address);
      txLb.moveCall({
        target: `${PACKAGE_ID}::leaderboard::record_result`,
        arguments: [
          txLb.object(LEADERBOARD_ID),
          txLb.pure.address(account.address),
          txLb.pure.bool(false), // won = false
          txLb.pure.bool(false), // draw = false
        ],
      });
      executeSponsored(txLb).catch(e => console.error("Leaderboard update failed:", e));

    } catch (err: any) {
      setError(err.message || 'Failed to resign');
    } finally {
      setIsLoading(false);
    }
  }, [account, gameState, suiClient]);

  // `fetchGameState`, `refreshGameState`, `reconcileAfterTx` moved earlier
  // (above createGame) so play()'s useCallback deps can reference them without
  // hitting a const temporal-dead-zone ReferenceError during render.

  /**
   * Reset to start a new game.
   */
  const resetGame = useCallback(() => {
    setGameState(null);
    setError(null);
    setReplaySaveStatus('idle');
    localStorage.removeItem('caro_active_game_id');
  }, []);

  return {
    gameState,
    isLoading: isLoading || isPending,
    error,
    replaySaveStatus,
    createGame,
    play,
    resign,
    resetGame,
    refreshGameState,
  };
}
