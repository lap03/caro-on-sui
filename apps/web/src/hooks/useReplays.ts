import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { ORIGINAL_PACKAGE_ID } from '@/lib/constants';
import {
  bytesToBlobId,
  fetchReplay,
  type ReplayPayload,
} from '@/lib/walrus';

/**
 * A single entry in the "my replays" list — built from a `ReplaySaved` event
 * emitted when the player called `attach_replay` after uploading to Walrus.
 * This is the metadata needed to render the list row without fetching the
 * (potentially large) Walrus blob.
 */
export interface ReplayEntry {
  gameId: string;
  blobId: string;
  moveCount: number;
  difficulty: number;
  status: number;
  timestampMs: number;
  txDigest: string;
}

function parseReplayEvent(ev: any): ReplayEntry | null {
  const j = ev?.parsedJson;
  if (!j || typeof j !== 'object') return null;
  if (!j.blob_id || !j.game_id) return null;

  // `blob_id` comes back as number[] (vector<u8> serialized as array of u8).
  const blobId = bytesToBlobId(j.blob_id as number[]);

  return {
    gameId: String(j.game_id),
    blobId,
    moveCount: Number(j.move_count ?? 0),
    difficulty: Number(j.difficulty ?? 0),
    status: Number(j.status ?? 0),
    timestampMs: Number(j.timestamp_ms ?? 0),
    txDigest: String(ev?.id?.txDigest ?? ''),
  };
}

/**
 * Hook: fetch the current player's replays and load a specific blob on demand.
 *
 * Strategy: query `ReplaySaved` events filtered by Sender = current address,
 * so we only see the user's own submissions. Events are authoritative — we
 * don't join with `GameResult` NFTs because ReplaySaved already inlines all
 * the metadata needed to render the list.
 */
export function useReplays() {
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const [replays, setReplays] = useState<ReplayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!account) {
      setReplays([]);
      return;
    }
    if (ORIGINAL_PACKAGE_ID === '0x0') return;

    setIsLoading(true);
    setError(null);

    try {
      const eventType = `${ORIGINAL_PACKAGE_ID}::game::ReplaySaved`;
      // Sui's `suix_queryEvents` doesn't accept compound filters in most versions,
      // so we filter by MoveEventType only and narrow to the current sender client-side.
      const res = await suiClient.queryEvents({
        query: { MoveEventType: eventType },
        limit: 50,
        order: 'descending',
      });

      const entries = (res.data ?? [])
        .filter((ev) => ev.sender === account.address)
        .map(parseReplayEvent)
        .filter((e): e is ReplayEntry => e !== null);

      // Dedupe by gameId — keep most recent per game (in case attach_replay was called twice).
      const byGame = new Map<string, ReplayEntry>();
      for (const e of entries) {
        const existing = byGame.get(e.gameId);
        if (!existing || existing.timestampMs < e.timestampMs) byGame.set(e.gameId, e);
      }

      setReplays(Array.from(byGame.values()).sort((a, b) => b.timestampMs - a.timestampMs));
    } catch (err: any) {
      console.error('Failed to load replays:', err);
      setError(err?.message ?? 'Failed to load replays');
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, account]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    replays,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Stand-alone loader — fetches a replay's full move history from Walrus.
 * UI components use this when the user clicks into a specific replay.
 */
export function useReplayLoader() {
  const [payload, setPayload] = useState<ReplayPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (blobId: string) => {
    setIsLoading(true);
    setError(null);
    setPayload(null);
    try {
      const p = await fetchReplay(blobId);
      setPayload(p);
    } catch (err: any) {
      console.error('Failed to load replay blob:', err);
      setError(err?.message ?? 'Failed to load replay');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPayload(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { payload, isLoading, error, load, reset };
}
