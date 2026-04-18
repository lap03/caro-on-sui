import { WALRUS_PUBLISHER, WALRUS_AGGREGATOR } from '@/lib/constants';

/**
 * Canonical replay payload stored on Walrus.
 * `version` lets us evolve the schema without breaking old blobs.
 */
export interface ReplayPayload {
  version: 1;
  gameId: string;
  player: string;
  moves: number[];       // flat indices [0..224], in order played (player first, then AI, alternating)
  status: number;        // 1=PLAYER_WIN, 2=AI_WIN, 3=DRAW
  difficulty: number;    // 0=EASY, 1=MEDIUM, 2=HARD
  moveCount: number;
  createdAt: number;     // ms since epoch
}

const DEFAULT_EPOCHS = 50;

/**
 * Upload a replay JSON to Walrus via the public publisher.
 * Returns the blob id (base64url string like "kE7aH...").
 *
 * Walrus publisher response shape is one of:
 *  { newlyCreated: { blobObject: { blobId } } }
 *  { alreadyCertified: { blobId, ... } }
 */
export async function uploadReplay(
  payload: ReplayPayload,
  epochs: number = DEFAULT_EPOCHS,
): Promise<string> {
  const body = JSON.stringify(payload);
  const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Walrus upload failed (${res.status}): ${text || res.statusText}`);
  }

  const json: any = await res.json();
  const blobId =
    json?.newlyCreated?.blobObject?.blobId ??
    json?.alreadyCertified?.blobId;

  if (!blobId || typeof blobId !== 'string') {
    throw new Error(`Walrus upload: unexpected response shape: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return blobId;
}

/**
 * Fetch a replay JSON from the Walrus aggregator by blob id.
 * Validates the minimum shape and version.
 */
export async function fetchReplay(blobId: string): Promise<ReplayPayload> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${encodeURIComponent(blobId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Walrus fetch failed (${res.status}): ${res.statusText}`);
  }
  const json: any = await res.json();
  if (!json || json.version !== 1 || !Array.isArray(json.moves)) {
    throw new Error('Invalid replay payload (missing version/moves)');
  }
  return json as ReplayPayload;
}

/**
 * Convert a Walrus blob id (base64url string) to the UTF-8 byte vector that
 * Move's `attach_replay` expects. This is symmetric with how the event parses
 * back to string on read.
 */
export function blobIdToBytes(blobId: string): number[] {
  return Array.from(new TextEncoder().encode(blobId));
}

/**
 * Decode a `vector<u8>` event field (array of numbers) back to the blob id string.
 */
export function bytesToBlobId(bytes: number[] | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new TextDecoder().decode(arr);
}
