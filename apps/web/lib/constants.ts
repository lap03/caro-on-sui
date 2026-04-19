// ===== Contract IDs =====
// NEXT_PUBLIC_PACKAGE_ID is the *published-at* address — where `sui client call`
// should target. After `sui client upgrade`, this changes while ORIGINAL_PACKAGE_ID
// stays fixed; use ORIGINAL for event-type filters and struct-tag references.
// Today original == published-at because the package hasn't been upgraded yet.
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '0x0';
export const ORIGINAL_PACKAGE_ID = process.env.NEXT_PUBLIC_ORIGINAL_PACKAGE_ID || PACKAGE_ID;
export const LEADERBOARD_ID = process.env.NEXT_PUBLIC_LEADERBOARD_ID || '0x0';

// Boot-time log — guarded for the browser because Next runs modules in both
// the server and client environments.
if (typeof window !== 'undefined') {
  console.log(
    `%c[caro] PACKAGE_ID = ${PACKAGE_ID}
[caro] ORIGINAL_PACKAGE_ID = ${ORIGINAL_PACKAGE_ID}
[caro] LEADERBOARD_ID = ${LEADERBOARD_ID}`,
    'color:#8b5cf6;font-weight:bold',
  );
}

// ===== Network =====
export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';

// ===== Walrus =====
export const WALRUS_PUBLISHER = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER || 'https://publisher.walrus-testnet.walrus.space';
export const WALRUS_AGGREGATOR = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space';

// ===== Seal =====
export const SEAL_PACKAGE_ID = process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID || '0x0';
export const SEAL_SERVER_OBJECT_ID = process.env.NEXT_PUBLIC_SEAL_SERVER_OBJECT_ID || '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98';
export const SEAL_AGGREGATOR_URL = process.env.NEXT_PUBLIC_SEAL_AGGREGATOR_URL || 'https://seal-aggregator-testnet.mystenlabs.com';
export const SEAL_ENABLED = process.env.NEXT_PUBLIC_SEAL_ENABLED === 'true';

// ===== API =====
// Empty by default -> same-origin /api/sponsor (works in both `next dev` and Vercel).
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ===== Enoki =====
export const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY || '';
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

// ===== Game Constants =====
export const BOARD_SIZE = 15;
export const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;
export const WIN_LENGTH = 5;

export const CELL_EMPTY = 0;
export const CELL_PLAYER = 1;
export const CELL_AI = 2;

export const STATUS_ACTIVE = 0;
export const STATUS_PLAYER_WIN = 1;
export const STATUS_AI_WIN = 2;
export const STATUS_DRAW = 3;

export const DIFFICULTY_EASY = 0;
export const DIFFICULTY_MEDIUM = 1;
export const DIFFICULTY_HARD = 2;

export const DIFFICULTY_LABELS: Record<number, string> = {
  [DIFFICULTY_EASY]: 'Easy',
  [DIFFICULTY_MEDIUM]: 'Medium',
  [DIFFICULTY_HARD]: 'Hard',
};

export const STATUS_LABELS: Record<number, string> = {
  [STATUS_ACTIVE]: 'Playing',
  [STATUS_PLAYER_WIN]: 'You Won!',
  [STATUS_AI_WIN]: 'AI Won',
  [STATUS_DRAW]: 'Draw',
};

// ===== Sui System Objects =====
export const SUI_CLOCK_OBJECT_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';
export const SUI_RANDOM_OBJECT_ID = '0x0000000000000000000000000000000000000000000000000000000000000008';
