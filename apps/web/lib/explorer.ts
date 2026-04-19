// One-stop helpers for the "prove it's on-chain" UI affordances. Every link
// points at a public explorer so anyone can verify what's written on Sui /
// Walrus without having to trust our frontend.

const SUIVISION_BASE = 'https://testnet.suivision.xyz';
const WALRUSCAN_BASE = 'https://walruscan.com/testnet';
const WALRUS_AGGREGATOR_BASE = 'https://aggregator.walrus-testnet.walrus.space';

export const suiObjectUrl = (id: string) => `${SUIVISION_BASE}/object/${id}`;
export const suiTxUrl = (digest: string) => `${SUIVISION_BASE}/txblock/${digest}`;
export const suiAddressUrl = (addr: string) => `${SUIVISION_BASE}/account/${addr}`;

/**
 * Direct download URL: browser renders the raw blob content (our replay JSON).
 * This is the "click to see the actual data" link.
 */
export const walrusBlobContentUrl = (blobId: string) =>
  `${WALRUS_AGGREGATOR_BASE}/v1/blobs/${blobId}`;

/**
 * Explorer URL for metadata (epochs, storage object, registered tx, etc.).
 * Secondary link — walruscan shows Sui-level info about the blob, not the payload.
 */
export const walrusBlobExplorerUrl = (blobId: string) =>
  `${WALRUSCAN_BASE}/blob/${blobId}`;

/**
 * Back-compat alias. Default "view blob" now opens the raw content so users
 * see the data immediately. Keep call sites that imported `walrusBlobUrl`
 * working without edits.
 */
export const walrusBlobUrl = walrusBlobContentUrl;

/** Shorten a hex id for display: 0xabcd…1234 */
export function shortId(id: string, head = 6, tail = 4): string {
  if (!id) return '';
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
