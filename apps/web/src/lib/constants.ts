// ===== Contract IDs =====
// These will be updated after deploying the Move package to testnet
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x0';
// The original package id stays the same across `sui client upgrade`s. Use this
// when building event-type filters or struct-tag references; use PACKAGE_ID
// (published-at) when making move calls that should hit the latest bytecode.
export const ORIGINAL_PACKAGE_ID =
  import.meta.env.VITE_ORIGINAL_PACKAGE_ID || import.meta.env.VITE_PACKAGE_ID || '0x0';
export const LEADERBOARD_ID = import.meta.env.VITE_LEADERBOARD_ID || '0x0';

// ===== Network =====
export const SUI_NETWORK = (import.meta.env.VITE_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';

// ===== Walrus =====
export const WALRUS_PUBLISHER = import.meta.env.VITE_WALRUS_PUBLISHER || 'https://publisher.walrus-testnet.walrus.space';
export const WALRUS_AGGREGATOR = import.meta.env.VITE_WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space';

// ===== Seal =====
export const SEAL_PACKAGE_ID = import.meta.env.VITE_SEAL_PACKAGE_ID || '0x0';
export const SEAL_SERVER_OBJECT_ID = import.meta.env.VITE_SEAL_SERVER_OBJECT_ID || '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98';
export const SEAL_AGGREGATOR_URL = import.meta.env.VITE_SEAL_AGGREGATOR_URL || 'https://seal-aggregator-testnet.mystenlabs.com';

// ===== API =====
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ===== Enoki =====
export const ENOKI_API_KEY = import.meta.env.VITE_ENOKI_API_KEY || '';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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
