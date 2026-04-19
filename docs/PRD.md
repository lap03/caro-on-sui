# PRD: Caro On-Chain - Fully On-Chain Gomoku on Sui

> **Hackathon submission** | Target: Sui Testnet | Version 1.1 | April 2026

---

## 0. Changelog

### v1.2 — Seal integration deferred (current)

**Seal (encrypted commit-reveal / "Challenge Mode") is OUT OF SCOPE for the hackathon submission.**

- Scope reasons: focus delivery on Enoki + Walrus + on-chain randomness; Seal testnet key server instability; encrypt/decrypt round-trip adds UX latency we don't want to ship.
- Code left in place intentionally — `packages/move/sources/seal_policy.move`, `apps/web/lib/seal.ts`, `apps/web/hooks/useSeal.ts`, and the `NEXT_PUBLIC_SEAL_*` env vars remain so the setup context survives for a future re-enable. **Do not delete them.**
- `NEXT_PUBLIC_SEAL_ENABLED` should be treated as `false` for the demo; the `/play` "Challenge Mode" toggle must not be shipped to judges.
- All sections below that describe Seal (notably **§4.5**, **§6.3**, **§7.3 `useSeal`**, **§8 Phase 7**, **§9.2 / §9.3**, Sprint 3 Seal tasks, risk-mitigation/success-metrics rows) are kept for historical reference and are marked inline with `[OUT OF SCOPE — v1.2]`. Treat them as frozen design notes, not delivery targets.

### v1.1 — Next.js single-app architecture

The original v1.0 design shipped the frontend as a Vite SPA with a separate Hono backend at `apps/api` for Enoki sponsored-transaction relay. v1.1 collapses these into a **single Next.js 15 (App Router) application under `apps/web/`**:

- Frontend is Next.js App Router (`apps/web/app/`), not Vite SPA.
- Enoki `/api/sponsor` and `/api/execute` live as Next Route Handlers at `apps/web/app/api/sponsor/route.ts` and `apps/web/app/api/execute/route.ts`, served at the same origin as the UI in both `next dev` and Vercel.
- **`apps/api` (Hono) is retired and deleted.** The Bun workspace no longer contains a backend app; Vercel deploys one project that builds both UI and serverless routes.
- Env vars renamed `VITE_*` → `NEXT_PUBLIC_*`; server-only secrets (`ENOKI_SECRET_KEY`, `PACKAGE_ID`) stay unprefixed and live in `apps/web/.env` (+ Vercel project env).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (dropped `@tailwindcss/vite`). shadcn/ui bootstrapped in `apps/web/components/ui/`.
- Seal integration `[OUT OF SCOPE — v1.2]`: `seal_policy.move` upgraded from placeholder to real `seal_approve`; `apps/web/lib/seal.ts` + `hooks/useSeal.ts` + a "Challenge Mode" toggle on `/play` encrypt each move before submit and round-trip it through the Seal key server for a `🔒 → ✅ Verified` badge. (Code retained, feature not shipped — see v1.2.)

Sections below are written against the v1.1 architecture. Where v1.0 artifacts (Vite configs, Hono routes, `VITE_*` envs) still appear in code blocks, treat them as **historical reference only** — the running code uses the Next.js equivalents.

---

## 1. Executive Summary

**Caro On-Chain** is a fully on-chain Gomoku (Caro/Five-in-a-Row) game built on the Sui blockchain where players compete against an AI opponent powered by Sui's native on-chain randomness. The game leverages **Enoki** for gasless social login (Google/Twitch) and **Walrus** for decentralized storage of game replays and frontend hosting. ~~**Seal** for encrypted commit-reveal move mechanics~~ `[OUT OF SCOPE — v1.2]`.

**Tagline:** *"Play Caro against the blockchain itself - no wallet, no gas, fully on-chain."*

### Why Caro?

- Simple enough to be fully on-chain (board state fits in `vector<u8>`)
- Complex enough to showcase AI strategy with randomness (15x15 board, win-5)
- Familiar to Vietnamese/Asian gaming community
- Extends the hackathon prompt "Extended Tic Tac Toe or Chess on Chain (against AI on Sui)"

---

## 2. Problem Statement

| Problem | Our Solution |
|---------|-------------|
| Web3 games require wallet setup, seed phrases, gas tokens | Enoki zkLogin: sign in with Google, zero gas fees |
| Game logic runs off-chain, results can be manipulated | 100% on-chain Move smart contract, verifiable game state |
| AI opponents use centralized servers | AI uses Sui native randomness beacon (threshold BLS, unbiasable) |
| Game history is lost | Walrus decentralized storage for permanent replay data |
| No way to prove fair play | Seal encrypted commit-reveal for anti-cheat `[OUT OF SCOPE — v1.2]` |

---

## 3. Target Users

| Persona | Description |
|---------|-------------|
| **Web2 Gamer** | Casual player who wants to play Caro without crypto knowledge. Signs in with Google, plays immediately. |
| **Web3 Enthusiast** | Wants verifiable on-chain gaming. Connects Sui Wallet directly. |
| **Hackathon Judge** | Evaluates technical depth, Sui ecosystem integration, and innovation. |

---

## 4. Core Features

### 4.1 Game Mechanics

#### Board & Rules
- **Board size:** 15x15 (standard Caro) = 225 cells
- **Win condition:** 5 in a row (horizontal, vertical, diagonal)
- **Players:** Human (X) vs AI (O)
- **Turn system:** Human moves first, AI responds immediately in the same transaction
- **Draw condition:** Board full with no winner (extremely rare on 15x15)

#### AI Opponent (On-Chain Randomness)

The AI uses a **weighted random strategy** powered by `sui::random`:

| AI Level | Strategy | Description |
|----------|----------|-------------|
| **Easy** | Pure random | `generate_u8_in_range` picks from empty cells |
| **Medium** | Weighted random | 60% strategic (block/extend), 40% random |
| **Hard** | Strategic + random | 80% minimax-lite (check immediate threats/wins), 20% random for unpredictability |

**On-chain AI logic (Move):**
1. Scan board for immediate win (5th in a row) -> play it
2. Scan board for immediate block (opponent has 4) -> block it
3. Scan board for extend (AI has 3+) -> extend with weighted probability
4. Random selection from remaining cells with position weighting (center > edges)

> **Note:** Full minimax is too gas-expensive for on-chain. The weighted-random approach creates a challenging opponent while staying within gas limits. The randomness is provably fair via Sui's threshold BLS beacon.

#### How Sui On-Chain Randomness Works

- Sui validators run a **Distributed Key Generation (DKG)** protocol each epoch
- Randomness is generated via **threshold BLS signatures** - no single validator can predict or bias the output
- The `Random` object lives at reserved address `0x8`
- Functions using `&Random` **must** be `entry` (not `public`) - enforced by the Move compiler to prevent composability attacks
- Sui also rejects PTBs that have commands after a `MoveCall` using `Random` (prevents inspect-and-revert attacks)

### 4.2 Authentication & Onboarding (Enoki)

```
User clicks "Play Now"
    -> Google OAuth popup (Enoki zkLogin)
    -> Ephemeral key generated in browser
    -> ZK proof generated by Enoki proving service
    -> User gets a Sui address (deterministic per Google account per app)
    -> All transactions sponsored (user pays zero gas)
```

**Supported login methods:**
- Google (primary)
- Twitch (gaming audience)
- Sui Wallet (for Web3 users who prefer their own wallet)

**Key Enoki features used:**

| Feature | Usage |
|---------|-------|
| `registerEnokiWallets()` | Register social login wallets with dApp Kit |
| `createSponsoredTransaction()` | Backend sponsors all game transactions (requires private API key) |
| `executeSponsoredTransaction()` | Execute without user paying gas |
| zkLogin | Wallet-less address derivation from OAuth JWT |

**How zkLogin works under the hood:**
1. Frontend generates an ephemeral key pair and a nonce
2. User authenticates with Google, JWT is returned containing the nonce
3. JWT is sent to Enoki which acts as salt provider + ZK proving service
4. A Groth16 ZK proof verifies user identity without revealing it on-chain
5. Transactions signed with ephemeral key + ZKP

**Enoki pricing:** Sandbox tier (free) supports unlimited testnet usage - perfect for hackathon.

### 4.3 Fully On-Chain Game State (Move Smart Contract)

Every game action is a Sui transaction. The game state is a shared object:

```move
module caro::game {
    use sui::random::{Random, new_generator, RandomGenerator};

    // Constants
    const BOARD_SIZE: u64 = 15;
    const TOTAL_CELLS: u64 = 225;
    const WIN_LENGTH: u64 = 5;
    const EMPTY: u8 = 0;
    const PLAYER_X: u8 = 1; // Human
    const PLAYER_O: u8 = 2; // AI

    const STATUS_ACTIVE: u8 = 0;
    const STATUS_PLAYER_WIN: u8 = 1;
    const STATUS_AI_WIN: u8 = 2;
    const STATUS_DRAW: u8 = 3;

    public struct Game has key, store {
        id: UID,
        board: vector<u8>,          // 225 cells, flat array [row * 15 + col]
        player: address,            // human player address
        move_count: u64,            // total moves made
        status: u8,                 // game status
        difficulty: u8,             // 0=easy, 1=medium, 2=hard
        move_history: vector<u64>,  // all moves in order (flat indices)
        created_at: u64,            // epoch timestamp
    }

    public struct GameResult has key, store {
        id: UID,
        game_id: ID,
        player: address,
        status: u8,
        move_count: u64,
        board_snapshot: vector<u8>,
        difficulty: u8,
    }

    // Events
    public struct GameCreated has copy, drop { game_id: ID, player: address, difficulty: u8 }
    public struct MovePlayed has copy, drop { game_id: ID, player_move: u64, ai_move: u64, status: u8 }
    public struct GameEnded has copy, drop { game_id: ID, player: address, status: u8, move_count: u64 }

    // Create a new game (shared object)
    public fun new_game(difficulty: u8, clock: &Clock, ctx: &mut TxContext) { /* ... */ }

    // Player makes a move, AI responds using randomness
    // MUST be entry (not public) because it takes &Random
    entry fun play(game: &mut Game, row: u8, col: u8, r: &Random, ctx: &mut TxContext) { /* ... */ }

    // Resign
    public fun resign(game: &mut Game, ctx: &mut TxContext) { /* ... */ }

    // Delete finished game (reclaim storage rebate)
    public fun burn(game: Game) { /* ... */ }
}
```

**Key design decisions:**
- `play` is `entry` (not `public`) because it takes `&Random` - required by Sui compiler for security
- Human move + AI response happen in a **single atomic transaction**
- `move_history` stored on-chain for replay capability
- `GameResult` NFT minted on game completion as proof-of-play, transferred to the player
- Board is `vector<u8>` (225 bytes) - well within Sui object size limits

### 4.4 Walrus Integration

| Feature | Walrus Usage |
|---------|-------------|
| **Game Replays** | Store complete move history as JSON blobs on Walrus after game ends. Blob ID stored in `GameResult` event. |
| **Leaderboard Snapshots** | Periodic JSON snapshots of top players, stored permanently. |
| **Profile Avatars** | Player can upload avatar, stored on Walrus, served via aggregator URL. |
| **Frontend Hosting** | Deploy the entire Vite build as a Walrus Site for full decentralization. |

**Replay storage flow:**
```
Game ends -> Frontend serializes move_history to JSON
          -> PUT to Walrus publisher (/v1/blobs?epochs=50)
          -> Blob ID returned
          -> Blob ID emitted as event / stored locally
          -> Anyone can replay: GET aggregator/v1/blobs/{blobId}
```

**Walrus Sites deployment:**
```bash
bun run build
site-builder --context=testnet deploy ./apps/web/dist --epochs 50
# -> Site accessible at https://<object-id>.walrus.site
```

**Key Walrus details:**
- Official SDK: `@mysten/walrus` (TypeScript)
- HTTP endpoints (testnet): Publisher `https://publisher.walrus-testnet.walrus.space`, Aggregator `https://aggregator.walrus-testnet.walrus.space`
- Public publisher limit: 10 MiB per upload (more than enough for game data)
- Testnet is free for development
- `site-builder` CLI deploys static sites (Vite `dist/` output) to Walrus

### 4.5 Seal Integration (Encrypted Commit-Reveal) `[OUT OF SCOPE — v1.2]`

> **OUT OF SCOPE for the hackathon submission (v1.2).** This entire section is kept as frozen design notes — the `seal_policy.move` module, `apps/web/lib/seal.ts`, `hooks/useSeal.ts`, and related env vars remain in the codebase so setup context is preserved for a future re-enable. The "Challenge Mode" toggle must not be shipped. See §0 changelog v1.2.

Seal enables a **commit-reveal** pattern for competitive fairness in a "Challenge Mode":

**How it works:**
1. Player encrypts their move with Seal using the game ID as IBE identity
2. Encrypted move is submitted on-chain (nobody can see it, including the AI)
3. AI move is generated using on-chain randomness in a separate transaction
4. After AI commits, player's move is revealed via `seal_approve` policy evaluation
5. Both moves are applied and validated

**Why this matters:**
- Demonstrates advanced Sui ecosystem integration (Seal + on-chain randomness combined)
- Prevents any form of front-running or move inspection
- Proves the game is truly fair - neither side can react to the other's move

**Seal access policy (Move):**
```move
module caro::seal_policy {
    use seal::seal;

    // Only the game's player can decrypt their own committed moves
    entry fun seal_approve(id: vector<u8>, game: &caro::game::Game, ctx: &TxContext) {
        assert!(caro::game::player(game) == ctx.sender());
        seal::approve(id);
    }
}
```

**Frontend Seal flow:**
```typescript
import { SealClient, SessionKey } from '@mysten/seal';

// 1. Encrypt move
const { encryptedObject } = await sealClient.encrypt({
    threshold: 1,
    packageId: SEAL_POLICY_PACKAGE,
    id: gameId,
    data: encodedMove,
});

// 2. Submit encrypted move on-chain
tx.moveCall({ target: `${PKG}::game::commit_move`, arguments: [...] });

// 3. After AI responds, create session key and decrypt
const sessionKey = await SessionKey.create({
    address: suiAddress,
    packageId: SEAL_POLICY_PACKAGE,
    ttlMin: 10,
    suiClient,
});
const message = sessionKey.getPersonalMessage();
const { signature } = await wallet.signPersonalMessage(message);
sessionKey.setPersonalMessageSignature(signature);

const decrypted = await sealClient.decrypt({
    data: encryptedObject,
    sessionKey,
    txBytes: sealApproveTxBytes,
});
```

**Key Seal details:**
- Uses Identity-Based Encryption (Boneh-Franklin IBE with BLS12-381)
- Official SDK: `@mysten/seal`
- Testnet decentralized key server: `0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98`
- Aggregator: `https://seal-aggregator-testnet.mystenlabs.com`
- `seal_approve` functions are evaluated via `dry_run_transaction_block` on full nodes
- Session keys allow time-limited decryption without repeated wallet prompts

---

## 5. Technical Architecture

### 5.1 System Architecture

```
+------------------------------------------------------------------+
|                        Frontend (Vite + React)                     |
|  +------------+  +-------------+  +-----------+  +-------------+ |
|  | Game Board |  | Auth (Enoki)|  | Replays   |  | Leaderboard | |
|  | (shadcn)   |  | (zkLogin)   |  | (Walrus)  |  | (on-chain)  | |
|  +-----+------+  +------+------+  +-----+-----+  +------+------+ |
|        |                |               |                |        |
+--------|----------------|---------------|----------------|--------+
         |                |               |                |
    +----v----+     +-----v-----+   +-----v-----+   +-----v------+
    |   Sui   |     |  Enoki    |   |  Walrus   |   |   Seal     |
    | RPC     |     |  API      |   | Publisher |   | Key Server |
    | testnet |     | (sponsor) |   | Aggregator|   | (testnet)  |
    +---------+     +-----------+   +-----------+   +------------+
         |
    +----v--------------------------------------------+
    |              Sui Blockchain (Testnet)             |
    |  +----------+  +----------+  +----------------+  |
    |  | caro::   |  | caro::   |  | caro::         |  |
    |  | game     |  | leaderb. |  | seal_policy    |  |
    |  +----------+  +----------+  +----------------+  |
    |  | Game obj |  | Board obj|  | Seal approve   |  |
    |  | AI logic |  | Rankings |  | Commit-reveal  |  |
    |  | Random   |  |          |  |                |  |
    |  +----------+  +----------+  +----------------+  |
    +--------------------------------------------------+
```

### 5.2 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Monorepo** | Bun Workspace | latest |
| **Framework** | Next.js 15 (App Router, RSC) | Next 15, React 19 |
| **UI** | Tailwind CSS v4 (`@tailwindcss/postcss`) + shadcn/ui | latest |
| **Sui SDK** | @mysten/sui, @mysten/dapp-kit | latest |
| **Auth** | @mysten/enoki (zkLogin + sponsored tx) | latest |
| **Storage** | @mysten/walrus (replays, avatars) | latest |
| **Encryption** | @mysten/seal (commit-reveal) | ^0.7 |
| **Smart Contract** | Sui Move | Sui CLI latest |
| **Sponsored TX relay** | Next.js Route Handlers (`app/api/sponsor`, `app/api/execute`) — same-origin, Node runtime | built-in |
| **Deploy** | Vercel (primary) / Walrus Sites (decentralized, stretch) | testnet |

### 5.3 Project Structure (Bun Workspace)

```
caro-on-sui/
├── package.json                 # Bun workspace root (scripts: dev, build, test:move, deploy:*)
├── bun.lock
│
├── apps/
│   └── web/                     # Next.js 15 App Router (frontend + API routes in one project)
│       ├── package.json
│       ├── next.config.ts       # transpilePackages: @mysten/*
│       ├── postcss.config.mjs   # @tailwindcss/postcss
│       ├── components.json      # shadcn/ui config
│       ├── tsconfig.json
│       ├── vercel.json          # thin — Vercel auto-detects Next
│       ├── .env / .env.example  # NEXT_PUBLIC_* (public) + ENOKI_SECRET_KEY, PACKAGE_ID (server-only)
│       ├── app/
│       │   ├── layout.tsx              # root layout, Providers, nav shell, <Toaster>
│       │   ├── providers.tsx           # 'use client' — QueryClient + SuiClientProvider + Enoki register + WalletProvider
│       │   ├── nav.tsx                 # top nav (next/link + usePathname)
│       │   ├── globals.css             # Tailwind v4 @import + @theme tokens + custom game CSS
│       │   ├── page.tsx                # '/' (Home)
│       │   ├── play/page.tsx           # '/play' (game board, Challenge Mode toggle)
│       │   ├── replays/page.tsx        # '/replays' (Walrus replay list/viewer)
│       │   ├── leaderboard/page.tsx    # '/leaderboard'
│       │   ├── auth/callback/page.tsx  # '/auth/callback' (Enoki zkLogin redirect)
│       │   └── api/
│       │       ├── sponsor/route.ts    # POST /api/sponsor — Enoki createSponsoredTransaction
│       │       └── execute/route.ts    # POST /api/execute — Enoki executeSponsoredTransaction
│       ├── components/
│       │   ├── ui/              # shadcn/ui primitives (button, card, badge, dialog, switch, separator, skeleton)
│       │   ├── auth/LoginButton.tsx
│       │   ├── board/{Cell,GameBoard,GameStatus}.tsx
│       │   └── game/{NewGameDialog,MoveHistory,ResultModal,Confetti}.tsx
│       ├── hooks/
│       │   ├── useGame.ts              # on-chain game state + sponsored-tx helper
│       │   ├── useLeaderboard.ts
│       │   ├── useReplays.ts           # fetches ReplaySaved events + Walrus blobs
│       │   ├── useLocalGame.ts         # local-only fallback (no contract required)
│       │   └── useSeal.ts              # SessionKey lifecycle + encrypt/decrypt wrappers
│       └── lib/
│           ├── sui.ts                  # dApp Kit network config
│           ├── constants.ts            # reads process.env.NEXT_PUBLIC_*; package ids, game constants
│           ├── walrus.ts               # uploadReplay / fetchReplay via publisher/aggregator
│           ├── seal.ts                 # SealClient + encryptMove/decryptMove/createSessionKey
│           ├── explorer.ts             # suiObjectUrl / walrusBlobUrl helpers
│           └── utils.ts                # cn() + game helpers (indexToPos, findWinningLine, …)
│
├── packages/
│   └── move/                    # Sui Move smart contracts
│       ├── Move.toml
│       ├── sources/
│       │   ├── game.move                   # Core game logic + AI
│       │   ├── leaderboard.move            # On-chain rankings
│       │   ├── seal_policy.move            # Seal access policy
│       │   └── utils.move                  # Board evaluation helpers
│       └── tests/
│           ├── game_tests.move             # Unit tests
│           └── ai_tests.move               # AI behavior tests
│
├── docs/
│   └── PRD.md                   # This document
│
└── scripts/
    ├── deploy.sh                # Deploy Move package to testnet
    ├── setup-enoki.md           # Enoki portal setup guide
    └── deploy-walrus-site.sh    # Deploy frontend to Walrus Sites
```

### 5.4 Bun Workspace Configuration

**Root `package.json`:**
```json
{
  "name": "caro-on-sui",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun --filter './apps/web' dev",
    "build": "bun --filter './apps/web' build",
    "test:move": "cd packages/move && sui move test",
    "deploy:move": "bash scripts/deploy.sh",
    "deploy:site": "bash scripts/deploy-walrus-site.sh"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

> Note: The v1.0 `dev:api` script is removed — sponsored-transaction relay now runs inside Next.js route handlers and ships with the frontend. `bun run dev` is the only dev command.

---

## 6. Smart Contract Design (Move)

### 6.1 Core Module: `game.move`

```move
module caro::game {
    use sui::random::{Self, Random, RandomGenerator};
    use sui::event;
    use sui::clock::Clock;

    // ===== Constants =====
    const BOARD_SIZE: u64 = 15;
    const TOTAL_CELLS: u64 = 225;
    const WIN_LENGTH: u64 = 5;

    const EMPTY: u8 = 0;
    const PLAYER: u8 = 1;
    const AI: u8 = 2;

    const STATUS_ACTIVE: u8 = 0;
    const STATUS_PLAYER_WIN: u8 = 1;
    const STATUS_AI_WIN: u8 = 2;
    const STATUS_DRAW: u8 = 3;

    const DIFFICULTY_EASY: u8 = 0;
    const DIFFICULTY_MEDIUM: u8 = 1;
    const DIFFICULTY_HARD: u8 = 2;

    // ===== Errors =====
    const ENotPlayer: u64 = 0;
    const EGameOver: u64 = 1;
    const EInvalidPosition: u64 = 2;
    const ECellOccupied: u64 = 3;
    const EInvalidDifficulty: u64 = 4;

    // ===== Structs =====

    /// The main game object. Shared so the player can mutate it directly.
    public struct Game has key, store {
        id: UID,
        board: vector<u8>,          // 225 cells, flat array
        player: address,
        move_count: u64,
        status: u8,
        difficulty: u8,
        move_history: vector<u64>,  // flat index of each move in order
        created_at: u64,
    }

    /// Minted when a game ends. Serves as proof-of-play NFT.
    public struct GameResult has key, store {
        id: UID,
        game_id: ID,
        player: address,
        status: u8,
        move_count: u64,
        difficulty: u8,
        board_snapshot: vector<u8>,
    }

    // ===== Events =====
    public struct GameCreated has copy, drop {
        game_id: ID,
        player: address,
        difficulty: u8,
    }

    public struct MovePlayed has copy, drop {
        game_id: ID,
        player_move: u64,
        ai_move: u64,
        status: u8,
    }

    public struct GameEnded has copy, drop {
        game_id: ID,
        player: address,
        status: u8,
        move_count: u64,
    }

    // ===== Public Functions =====

    /// Create a new game. Shared so both player and AI logic can access it.
    public fun new_game(
        difficulty: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(difficulty <= 2, EInvalidDifficulty);

        let mut board = vector[];
        let mut i = 0u64;
        while (i < TOTAL_CELLS) {
            board.push_back(EMPTY);
            i = i + 1;
        };

        let game = Game {
            id: object::new(ctx),
            board,
            player: ctx.sender(),
            move_count: 0,
            status: STATUS_ACTIVE,
            difficulty,
            move_history: vector[],
            created_at: clock.timestamp_ms(),
        };

        event::emit(GameCreated {
            game_id: object::id(&game),
            player: ctx.sender(),
            difficulty,
        });

        transfer::share_object(game);
    }

    /// Player places a mark at (row, col), then AI responds using on-chain randomness.
    /// MUST be `entry` (not `public`) because it takes &Random - compiler enforced.
    entry fun play(
        game: &mut Game,
        row: u8,
        col: u8,
        r: &Random,
        ctx: &mut TxContext,
    ) {
        // Validate
        assert!(game.player == ctx.sender(), ENotPlayer);
        assert!(game.status == STATUS_ACTIVE, EGameOver);
        assert!((row as u64) < BOARD_SIZE && (col as u64) < BOARD_SIZE, EInvalidPosition);

        let player_idx = (row as u64) * BOARD_SIZE + (col as u64);
        assert!(game.board[player_idx] == EMPTY, ECellOccupied);

        // --- Player move ---
        *&mut game.board[player_idx] = PLAYER;
        game.move_history.push_back(player_idx);
        game.move_count = game.move_count + 1;

        // Check player win
        if (check_win(&game.board, player_idx, PLAYER)) {
            game.status = STATUS_PLAYER_WIN;
            emit_game_ended(game);
            mint_result(game, ctx);
            return
        };

        // Check draw
        if (game.move_count == TOTAL_CELLS) {
            game.status = STATUS_DRAW;
            emit_game_ended(game);
            mint_result(game, ctx);
            return
        };

        // --- AI move ---
        let mut generator = random::new_generator(r, ctx);
        let ai_idx = ai_select_move(game, &mut generator);

        *&mut game.board[ai_idx] = AI;
        game.move_history.push_back(ai_idx);
        game.move_count = game.move_count + 1;

        // Check AI win
        if (check_win(&game.board, ai_idx, AI)) {
            game.status = STATUS_AI_WIN;
            emit_game_ended(game);
            mint_result(game, ctx);
            return
        };

        // Check draw after AI move
        if (game.move_count == TOTAL_CELLS) {
            game.status = STATUS_DRAW;
            emit_game_ended(game);
            mint_result(game, ctx);
            return
        };

        // Emit move event
        event::emit(MovePlayed {
            game_id: object::id(game),
            player_move: player_idx,
            ai_move: ai_idx,
            status: game.status,
        });
    }

    /// Resign the current game.
    public fun resign(game: &mut Game, ctx: &mut TxContext) {
        assert!(game.player == ctx.sender(), ENotPlayer);
        assert!(game.status == STATUS_ACTIVE, EGameOver);
        game.status = STATUS_AI_WIN;
        emit_game_ended(game);
        mint_result(game, ctx);
    }

    /// Delete a finished game to reclaim storage rebate.
    public fun burn(game: Game) {
        assert!(game.status != STATUS_ACTIVE, EGameOver);
        let Game { id, board: _, player: _, move_count: _, status: _,
                   difficulty: _, move_history: _, created_at: _ } = game;
        object::delete(id);
    }

    // ===== AI Logic =====

    /// AI selects a move based on difficulty level.
    /// Easy = pure random. Medium = 60% strategic. Hard = 80% strategic.
    fun ai_select_move(game: &Game, gen: &mut RandomGenerator): u64 {
        let strategic_threshold = if (game.difficulty == DIFFICULTY_EASY) {
            0u8
        } else if (game.difficulty == DIFFICULTY_MEDIUM) {
            60u8
        } else {
            80u8
        };

        let roll = random::generate_u8_in_range(gen, 1, 100);

        if (roll <= strategic_threshold) {
            // Try strategic move: win > block > extend > block-3
            let strategic = find_strategic_move(game);
            if (strategic < TOTAL_CELLS) {
                return strategic
            };
        };

        // Fallback: random move from empty cells
        pick_random_empty(game, gen)
    }

    /// Find a strategic move by priority:
    /// 1. Win (AI has 4 in a row, complete it)
    /// 2. Block (Player has 4 in a row, block it)
    /// 3. Extend (AI has 3 in a row, extend it)
    /// 4. Block-3 (Player has 3 in a row, block it)
    fun find_strategic_move(game: &Game): u64 {
        // Priority 1: Can AI win?
        let win_move = find_threat(&game.board, AI, 4);
        if (win_move < TOTAL_CELLS) return win_move;

        // Priority 2: Must block player's 4?
        let block_move = find_threat(&game.board, PLAYER, 4);
        if (block_move < TOTAL_CELLS) return block_move;

        // Priority 3: Extend AI's 3
        let extend_move = find_threat(&game.board, AI, 3);
        if (extend_move < TOTAL_CELLS) return extend_move;

        // Priority 4: Block player's 3
        let block3 = find_threat(&game.board, PLAYER, 3);
        if (block3 < TOTAL_CELLS) return block3;

        TOTAL_CELLS // sentinel: no strategic move found
    }

    /// Scan board for a line of `count` consecutive `mark` with an empty cell
    /// at either end. Returns the empty cell index, or TOTAL_CELLS if none found.
    ///
    /// Scans all 4 directions: horizontal, vertical, diagonal-down-right, diagonal-down-left
    fun find_threat(board: &vector<u8>, mark: u8, count: u64): u64 {
        let directions: vector<vector<i64>> = vector[
            vector[0, 1],   // horizontal
            vector[1, 0],   // vertical
            vector[1, 1],   // diagonal \
            vector[1, -1],  // diagonal /
        ];

        let mut d = 0u64;
        while (d < 4) {
            let dr = directions[d][0];
            let dc = directions[d][1];

            let mut r = 0u64;
            while (r < BOARD_SIZE) {
                let mut c = 0u64;
                while (c < BOARD_SIZE) {
                    let result = check_line_threat(board, r, c, dr, dc, mark, count);
                    if (result < TOTAL_CELLS) return result;
                    c = c + 1;
                };
                r = r + 1;
            };
            d = d + 1;
        };

        TOTAL_CELLS
    }

    /// Check a specific line starting at (r, c) in direction (dr, dc)
    /// for `count` consecutive `mark` with an empty cell to complete it.
    fun check_line_threat(
        board: &vector<u8>,
        start_r: u64, start_c: u64,
        dr: i64, dc: i64,
        mark: u8, count: u64,
    ): u64 {
        let mut consecutive = 0u64;
        let mut empty_at = TOTAL_CELLS;
        let mut i = 0u64;

        while (i <= count) { // check count+1 cells (count marks + 1 empty)
            let r = (start_r as i64) + (i as i64) * dr;
            let c = (start_c as i64) + (i as i64) * dc;

            // Bounds check
            if (r < 0 || r >= (BOARD_SIZE as i64) || c < 0 || c >= (BOARD_SIZE as i64)) {
                return TOTAL_CELLS
            };

            let idx = (r as u64) * BOARD_SIZE + (c as u64);
            let cell = board[idx];

            if (cell == mark) {
                consecutive = consecutive + 1;
            } else if (cell == EMPTY && empty_at == TOTAL_CELLS) {
                empty_at = idx;
            } else {
                return TOTAL_CELLS // blocked or second empty
            };

            i = i + 1;
        };

        if (consecutive == count && empty_at < TOTAL_CELLS) {
            empty_at
        } else {
            TOTAL_CELLS
        }
    }

    /// Pick a random empty cell from the board.
    fun pick_random_empty(game: &Game, gen: &mut RandomGenerator): u64 {
        let mut empty_cells = vector[];
        let mut i = 0u64;
        while (i < TOTAL_CELLS) {
            if (game.board[i] == EMPTY) {
                empty_cells.push_back(i);
            };
            i = i + 1;
        };
        let count = empty_cells.length();
        let random_idx = random::generate_u64_in_range(gen, 0, count - 1);
        empty_cells[random_idx]
    }

    /// Check if placing `mark` at `idx` creates 5+ in a row.
    fun check_win(board: &vector<u8>, idx: u64, mark: u8): bool {
        let row = idx / BOARD_SIZE;
        let col = idx % BOARD_SIZE;

        // Check 4 directions: horizontal, vertical, diagonal \, diagonal /
        count_direction(board, row, col, mark, 0, 1) >= WIN_LENGTH ||
        count_direction(board, row, col, mark, 1, 0) >= WIN_LENGTH ||
        count_direction(board, row, col, mark, 1, 1) >= WIN_LENGTH ||
        count_direction(board, row, col, mark, 1, -1) >= WIN_LENGTH
    }

    /// Count consecutive `mark` in both directions along (dr, dc) from (row, col).
    /// Returns total count including the cell at (row, col) itself.
    fun count_direction(
        board: &vector<u8>,
        row: u64, col: u64,
        mark: u8,
        dr: i64, dc: i64,
    ): u64 {
        let mut total = 1u64; // count the placed cell

        // Count forward (positive direction)
        let mut step = 1i64;
        loop {
            let r = (row as i64) + step * dr;
            let c = (col as i64) + step * dc;
            if (r < 0 || r >= (BOARD_SIZE as i64) || c < 0 || c >= (BOARD_SIZE as i64)) break;
            let idx = (r as u64) * BOARD_SIZE + (c as u64);
            if (board[idx] != mark) break;
            total = total + 1;
            step = step + 1;
        };

        // Count backward (negative direction)
        step = 1;
        loop {
            let r = (row as i64) - step * dr;
            let c = (col as i64) - step * dc;
            if (r < 0 || r >= (BOARD_SIZE as i64) || c < 0 || c >= (BOARD_SIZE as i64)) break;
            let idx = (r as u64) * BOARD_SIZE + (c as u64);
            if (board[idx] != mark) break;
            total = total + 1;
            step = step + 1;
        };

        total
    }

    // ===== Internal Helpers =====

    fun emit_game_ended(game: &Game) {
        event::emit(GameEnded {
            game_id: object::id(game),
            player: game.player,
            status: game.status,
            move_count: game.move_count,
        });
    }

    fun mint_result(game: &Game, ctx: &mut TxContext) {
        let result = GameResult {
            id: object::new(ctx),
            game_id: object::id(game),
            player: game.player,
            status: game.status,
            move_count: game.move_count,
            difficulty: game.difficulty,
            board_snapshot: game.board,
        };
        transfer::transfer(result, game.player);
    }

    // ===== View Functions =====
    public fun player(game: &Game): address { game.player }
    public fun board(game: &Game): &vector<u8> { &game.board }
    public fun status(game: &Game): u8 { game.status }
    public fun move_count(game: &Game): u64 { game.move_count }
    public fun move_history(game: &Game): &vector<u64> { &game.move_history }
}
```

### 6.2 Leaderboard Module: `leaderboard.move`

```move
module caro::leaderboard {
    use sui::table::{Self, Table};
    use sui::event;

    /// Global leaderboard object (shared).
    public struct Leaderboard has key {
        id: UID,
        stats: Table<address, PlayerStats>,
        top_players: vector<PlayerEntry>, // top 10 sorted by wins
    }

    public struct PlayerStats has store, copy, drop {
        wins: u64,
        losses: u64,
        draws: u64,
        total_games: u64,
        win_streak: u64,
        best_streak: u64,
    }

    public struct PlayerEntry has store, copy, drop {
        player: address,
        wins: u64,
    }

    public struct StatsUpdated has copy, drop {
        player: address,
        wins: u64,
        losses: u64,
        total_games: u64,
    }

    /// Initialize the leaderboard (called once at deploy).
    public fun create(ctx: &mut TxContext) {
        let leaderboard = Leaderboard {
            id: object::new(ctx),
            stats: table::new(ctx),
            top_players: vector[],
        };
        transfer::share_object(leaderboard);
    }

    /// Record a game result. Called by the game module after a game ends.
    public fun record_result(
        board: &mut Leaderboard,
        player: address,
        won: bool,
        draw: bool,
    ) {
        if (!table::contains(&board.stats, player)) {
            table::add(&mut board.stats, player, PlayerStats {
                wins: 0, losses: 0, draws: 0,
                total_games: 0, win_streak: 0, best_streak: 0,
            });
        };

        let stats = table::borrow_mut(&mut board.stats, player);
        stats.total_games = stats.total_games + 1;

        if (won) {
            stats.wins = stats.wins + 1;
            stats.win_streak = stats.win_streak + 1;
            if (stats.win_streak > stats.best_streak) {
                stats.best_streak = stats.win_streak;
            };
        } else if (draw) {
            stats.draws = stats.draws + 1;
            stats.win_streak = 0;
        } else {
            stats.losses = stats.losses + 1;
            stats.win_streak = 0;
        };

        // Update top 10 (simplified: just emit event, frontend reads all stats)
        event::emit(StatsUpdated {
            player,
            wins: stats.wins,
            losses: stats.losses,
            total_games: stats.total_games,
        });
    }

    // ===== View =====
    public fun get_stats(board: &Leaderboard, player: address): &PlayerStats {
        table::borrow(&board.stats, player)
    }

    public fun top_players(board: &Leaderboard): &vector<PlayerEntry> {
        &board.top_players
    }
}
```

### 6.3 Seal Policy Module: `seal_policy.move` `[OUT OF SCOPE — v1.2]`

> Module source is retained in `packages/move/sources/seal_policy.move` for context. It compiles with the package but is not exercised by the shipped UI.


```move
module caro::seal_policy {
    use seal::seal;
    use caro::game::Game;

    /// Seal access policy: only the game's player can decrypt committed moves.
    /// This is evaluated by key servers via dry_run_transaction_block.
    entry fun seal_approve(
        id: vector<u8>,
        game: &Game,
        ctx: &TxContext,
    ) {
        assert!(caro::game::player(game) == ctx.sender());
        seal::approve(id);
    }
}
```

---

## 7. Frontend Design

### 7.1 Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Hero section, "Play Now" CTA, live stats overview |
| `/play` | Play | Difficulty selector -> starts new game |
| `/play/:gameId` | Active Game | Game board, move history, status |
| `/replays` | Replays | Browse past games from Walrus |
| `/replays/:blobId` | Replay Viewer | Step-through replay of a specific game |
| `/leaderboard` | Leaderboard | Top players, personal stats |

### 7.2 UI Components (shadcn/ui)

**Game Board:**
- 15x15 CSS Grid with `aspect-ratio: 1`
- Cell states: empty (clickable hover effect), X (blue), O (red)
- Last move highlighted with ring animation
- Winning 5-in-a-row highlighted with glow effect
- Responsive: scales down on mobile with pinch-to-zoom

**shadcn/ui components:**
| Component | Usage |
|-----------|-------|
| `Button` | Play, resign, new game actions |
| `Dialog` | New game difficulty selector, game result modal |
| `Card` | Game info panels, leaderboard player cards |
| `Badge` | Difficulty labels (Easy/Medium/Hard), status indicators |
| `Tabs` | Switch between play/replays/leaderboard |
| `Avatar` | Player profile display |
| `Separator`, `ScrollArea` | Layout utilities |
| `Sonner` (toast) | Move notifications, error messages, win/lose alerts |
| `Skeleton` | Loading states while fetching on-chain data |

**Color Palette (Tailwind):**
```
Background:  slate-950 (dark mode default)
Board:       amber-100 / amber-200 grid lines
Player X:    blue-500
AI O:        rose-500
Win glow:    emerald-400
Accent:      violet-500 (buttons, links)
```

### 7.3 Key React Hooks

```typescript
// useGame.ts - Core game state management
function useGame(gameId?: string) {
    // Fetches Game shared object from Sui RPC
    // Subscribes to events for real-time updates
    // Provides: board, status, moveCount, moveHistory, difficulty
    // Actions: createGame(difficulty), play(row, col), resign()
    // Uses useSuiClientQuery to poll game state
}

// useEnoki.ts - Auth wrapper
function useEnoki() {
    // Wraps dApp Kit + Enoki
    // Provides: address, isLoggedIn, isEnokiUser
    // Actions: login(provider), logout()
    // Handles sponsored transaction creation via backend API
}

// useWalrus.ts - Decentralized storage
function useWalrus() {
    // Upload: saveReplay(moveHistory, gameResult) -> blobId
    // Download: loadReplay(blobId) -> { moves, result }
    // Uses HTTP publisher/aggregator endpoints
}

// useSeal.ts - Commit-reveal (Challenge Mode) [OUT OF SCOPE — v1.2]
function useSeal(gameId: string) {
    // Provides: sessionKey, isReady
    // Actions: commitMove(row, col) -> encryptedBytes
    //          revealMove(encryptedBytes) -> { row, col }
    // Manages SealClient and SessionKey lifecycle
}
```

### 7.4 Provider Tree

```typescript
// src/providers/SuiProvider.tsx
function SuiProvider({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
                <RegisterEnokiWallets />
                <WalletProvider autoConnect>
                    {children}
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
    );
}

// RegisterEnokiWallets must render BEFORE WalletProvider
function RegisterEnokiWallets() {
    const { client, network } = useSuiClientContext();
    useEffect(() => {
        if (!isEnokiNetwork(network)) return;
        const { unregister } = registerEnokiWallets({
            apiKey: import.meta.env.VITE_ENOKI_API_KEY,
            client,
            network,
            providers: {
                google: { clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID },
            },
        });
        return unregister;
    }, [client, network]);
    return null;
}
```

### 7.5 Transaction Flow

```
1. CREATE GAME:
   Frontend: tx = new Transaction()
             tx.moveCall({ target: `${PKG}::game::new_game`, args: [difficulty, clock] })
             txBytes = await tx.build({ client, onlyTransactionKind: true })
   Backend:  POST /api/sponsor { txKindBytes: toB64(txBytes), sender: address }
             -> returns { digest, bytes }
   Frontend: { signature } = await signTransaction({ transaction: Transaction.from(bytes) })
   Backend:  POST /api/execute { digest, signature }
             -> returns { digest } (transaction executed!)

2. PLAY MOVE:
   Frontend: tx.moveCall({
               target: `${PKG}::game::play`,
               args: [tx.object(gameId), row, col, tx.object.random()]
             })
   Same sponsored flow as above.
   Result: Player move + AI move in single atomic transaction.

3. SAVE REPLAY (after game ends):
   Frontend: const replay = JSON.stringify({ moves: moveHistory, result, difficulty })
             const resp = await fetch(WALRUS_PUBLISHER + '/v1/blobs?epochs=50', {
               method: 'PUT', body: replay
             })
             const { blobId } = await resp.json()
             // Store blobId locally or emit as custom event

4. LOAD REPLAY:
   Frontend: const resp = await fetch(WALRUS_AGGREGATOR + '/v1/blobs/' + blobId)
             const replay = await resp.json()
             // Render in ReplayViewer component
```

---

## 8. Step-by-Step Setup Guide

### Phase 0: Prerequisites

```bash
# 1. Install Bun (JavaScript runtime & package manager)
curl -fsSL https://bun.sh/install | bash
source ~/.zshrc  # or restart terminal

# 2. Install Sui CLI
brew install sui    # macOS (recommended)
# Alternative: cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# 3. Verify installations
bun --version       # should be >= 1.1
sui --version       # should be >= 1.x

# 4. Configure Sui CLI for testnet
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet

# 5. Create a Sui wallet (if not exists)
sui client new-address ed25519
# Save the address and recovery phrase!

# 6. Get testnet SUI from faucet
sui client faucet
# Or visit: https://faucet.testnet.sui.io

# 7. Install Walrus CLI & Site Builder
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
suiup install walrus@testnet
suiup install site-builder@testnet

# 8. Verify Walrus
walrus --version
site-builder --version
```

### Phase 1: Project Scaffold

```bash
# 1. Navigate to project root
cd /path/to/chess-on-sui

# 2. Initialize root package.json
bun init -y
# Edit package.json to add workspaces (see section 5.4)

# 3. Create directory structure
mkdir -p apps/web/src/{components/{ui,board,auth,game,replay,leaderboard},hooks,lib,pages,providers}
mkdir -p packages/move/sources packages/move/tests
mkdir -p scripts docs

# 4. Initialize frontend app
cd apps/web
bun init -y
bun add react react-dom react-router-dom
bun add -d @types/react @types/react-dom typescript vite @vitejs/plugin-react

# 5. Create vite.config.ts
cat > vite.config.ts << 'VITEEOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
VITEEOF

# 6. Install Tailwind CSS v4
bun add -d tailwindcss @tailwindcss/vite

# 7. Create src/index.css with Tailwind
cat > src/index.css << 'CSSEOF'
@import "tailwindcss";
CSSEOF

# 8. Initialize shadcn/ui
bunx shadcn@latest init
# When prompted: Style = New York, Base color = Slate, CSS variables = Yes

# 9. Add shadcn components
bunx shadcn@latest add button card dialog badge tabs avatar separator scroll-area sonner skeleton

# 10. Install Sui ecosystem packages
bun add @mysten/sui @mysten/dapp-kit @mysten/enoki @mysten/walrus @mysten/seal
bun add @tanstack/react-query

# 11. Return to root
cd ../..
```

### Phase 2: Sponsored-Transaction Route Handlers (Next.js)

The Enoki relay lives inside the Next.js app at `apps/web/app/api/`. No separate backend process — `next dev` serves these at `http://localhost:3000/api/sponsor` and `http://localhost:3000/api/execute`, and Vercel deploys them as serverless functions at the same paths on the production origin.

**Env (in `apps/web/.env`, or Vercel project env — never ship to the browser):**

```bash
ENOKI_SECRET_KEY=enoki_private_xxxxx
# Comma-separated to support package-upgrade windows (new + legacy id both allowlisted).
PACKAGE_ID=0xNEW,0xLEGACY
```

**`apps/web/app/api/sponsor/route.ts`:**
```typescript
import { EnokiClient } from '@mysten/enoki';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const enokiSecretKey = process.env.ENOKI_SECRET_KEY;
  if (!enokiSecretKey) {
    return Response.json(
      { error: 'Sponsored transactions not configured. Set ENOKI_SECRET_KEY.' },
      { status: 503 },
    );
  }

  const packageIds = (process.env.PACKAGE_ID || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const allowedMoveCallTargets = packageIds.flatMap((pkg) => [
    `${pkg}::game::new_game`,
    `${pkg}::game::play`,
    `${pkg}::game::resign`,
    `${pkg}::game::attach_replay`,
    `${pkg}::leaderboard::record_result`,
  ]);

  try {
    const { txKindBytes, sender } = (await req.json()) as { txKindBytes: string; sender: string };
    const enokiClient = new EnokiClient({ apiKey: enokiSecretKey });
    const sponsored = await enokiClient.createSponsoredTransaction({
      network: 'testnet',
      transactionKindBytes: txKindBytes,
      sender,
      allowedMoveCallTargets,
    });
    return Response.json(sponsored);
  } catch (error: any) {
    const enokiErrors = error?.errors as { code: string; message: string }[] | undefined;
    const detail = enokiErrors?.[0]?.message ?? error?.message ?? String(error);
    return Response.json({ error: detail, errors: enokiErrors }, { status: 500 });
  }
}
```

**`apps/web/app/api/execute/route.ts`:**
```typescript
import { EnokiClient } from '@mysten/enoki';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const enokiSecretKey = process.env.ENOKI_SECRET_KEY;
  if (!enokiSecretKey) {
    return Response.json({ error: 'Sponsored transactions not configured.' }, { status: 503 });
  }
  try {
    const { digest, signature } = (await req.json()) as { digest: string; signature: string };
    const enokiClient = new EnokiClient({ apiKey: enokiSecretKey });
    const result = await enokiClient.executeSponsoredTransaction({ digest, signature });
    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
```

Why this is enough: the client's `useGame` hook calls `fetch('/api/sponsor', ...)` without a host, so it always hits the same origin — works in `next dev`, works on Vercel, and removes CORS entirely. No Hono, no second port, no cross-origin headers.

### Phase 3: Move Smart Contract

```bash
cd packages/move

# Create Move.toml
cat > Move.toml << 'EOF'
[package]
name = "caro"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
caro = "0x0"
EOF

# Write source files (see section 6 for full code):
# - sources/game.move
# - sources/leaderboard.move
# - sources/seal_policy.move

# Build
sui move build

# Run tests
sui move test

# Deploy to testnet
sui client publish --gas-budget 500000000

# IMPORTANT: Save the output!
# - Package ID (e.g., 0xabc123...)
# - Leaderboard object ID (from the created shared object)
# - Update .env files with these IDs
```

**`scripts/deploy.sh`:**
```bash
#!/bin/bash
set -e

echo "Building Move package..."
cd packages/move
sui move build

echo "Running tests..."
sui move test

echo "Deploying to testnet..."
RESULT=$(sui client publish --gas-budget 500000000 --json)

PACKAGE_ID=$(echo $RESULT | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
echo "Package ID: $PACKAGE_ID"
echo ""
echo "Update your .env files with:"
echo "  NEXT_PUBLIC_PACKAGE_ID=$PACKAGE_ID"
echo "  PACKAGE_ID=$PACKAGE_ID"
```

### Phase 4: Enoki Portal Setup

```
1. Go to https://portal.enoki.mystenlabs.com/
2. Sign in / Create account
3. Click "Create New App"
   - App name: "Caro On-Chain"
   - Network: Testnet
4. You'll see two API keys:
   - Public API Key -> copy to NEXT_PUBLIC_ENOKI_API_KEY in apps/web/.env
   - Private API Key -> copy to ENOKI_SECRET_KEY in apps/web/.env (and Vercel project env)

5. Configure Auth Providers:
   a. Google:
      - Go to https://console.cloud.google.com/apis/credentials
      - Create OAuth 2.0 Client ID (type: Web application)
      - Add Authorized JavaScript origins: http://localhost:5173
      - Add Authorized redirect URIs: http://localhost:5173/auth
      - Copy the Client ID
      - In Enoki Portal, add Google provider with this Client ID
      - Save as NEXT_PUBLIC_GOOGLE_CLIENT_ID in apps/web/.env

   b. Twitch (optional):
      - Go to https://dev.twitch.tv/console/apps
      - Create a new app
      - Set OAuth Redirect URL: http://localhost:5173/auth
      - Copy the Client ID
      - In Enoki Portal, add Twitch provider with this Client ID

6. Configure Sponsored Transactions:
   - Go to "Sponsored Transactions" tab
   - Add allowed Move call targets:
     - {PACKAGE_ID}::game::new_game
     - {PACKAGE_ID}::game::play
     - {PACKAGE_ID}::game::resign
   - Gas budget per transaction: 50,000,000 MIST (0.05 SUI)
```

### Phase 5: Frontend Implementation

```bash
cd apps/web

# Create apps/web/.env with all required values (see §13 for the full template).
cat > .env << 'EOF'
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_ENOKI_API_KEY=enoki_public_xxxxx
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
NEXT_PUBLIC_PACKAGE_ID=0x_YOUR_DEPLOYED_PACKAGE_ID
NEXT_PUBLIC_LEADERBOARD_ID=0x_YOUR_LEADERBOARD_OBJECT_ID
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_SEAL_PACKAGE_ID=0x_YOUR_SEAL_POLICY_PACKAGE_ID
NEXT_PUBLIC_SEAL_SERVER_OBJECT_ID=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
NEXT_PUBLIC_SEAL_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com
NEXT_PUBLIC_SEAL_ENABLED=true
ENOKI_SECRET_KEY=enoki_private_xxxxx
PACKAGE_ID=0x_YOUR_DEPLOYED_PACKAGE_ID
EOF

# Start dev server
bun run dev
# -> Open http://localhost:5173

# No separate backend needed. `next dev` serves /api/sponsor and /api/execute at
# http://localhost:3000/api/* inside the same process as the UI.
```

### Phase 6: Walrus Integration

```bash
# Verify Walrus is working by storing a test file
echo '{"test": true}' > /tmp/test.json
walrus store /tmp/test.json --epochs 5
# Should return a blob ID

# In the app, replays are stored via HTTP API:
# Upload:
curl -X PUT "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=50" \
  -H "Content-Type: application/json" \
  -d '{"moves":[112,97,113,98],"result":"player_win","difficulty":1}'

# Download:
curl "https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}"
```

**Frontend Walrus helper (`src/lib/walrus.ts`):**
```typescript
const PUBLISHER = import.meta.env.VITE_WALRUS_PUBLISHER;
const AGGREGATOR = import.meta.env.VITE_WALRUS_AGGREGATOR;

export async function saveReplay(data: {
    moves: number[];
    result: string;
    difficulty: number;
    gameId: string;
}): Promise<string> {
    const resp = await fetch(`${PUBLISHER}/v1/blobs?epochs=50`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    const result = await resp.json();
    // Response contains either newlyCreated or alreadyCertified
    const blobId = result.newlyCreated?.blobObject?.blobId
        ?? result.alreadyCertified?.blobId;
    return blobId;
}

export async function loadReplay(blobId: string): Promise<any> {
    const resp = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
    return resp.json();
}
```

### Phase 7: Seal Integration (Challenge Mode) `[OUT OF SCOPE — v1.2]`

> Skip this phase for the hackathon submission. The helper file still exists at `apps/web/lib/seal.ts`; leave it untouched.

**Frontend Seal helper (`src/lib/seal.ts`):**
```typescript
import { SealClient, SessionKey } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

export const sealClient = new SealClient({
    suiClient,
    serverConfigs: [
        {
            objectId: import.meta.env.VITE_SEAL_SERVER_OBJECT_ID,
            aggregatorUrl: import.meta.env.VITE_SEAL_AGGREGATOR_URL,
            weight: 1,
        },
    ],
    verifyKeyServers: false, // testnet
});

export async function encryptMove(
    packageId: string,
    gameId: string,
    move: { row: number; col: number },
): Promise<Uint8Array> {
    const moveData = new TextEncoder().encode(JSON.stringify(move));
    const { encryptedObject } = await sealClient.encrypt({
        threshold: 1,
        packageId: new Uint8Array(Buffer.from(packageId.slice(2), 'hex')),
        id: new Uint8Array(Buffer.from(gameId.slice(2), 'hex')),
        data: moveData,
    });
    return encryptedObject;
}

export async function createSessionKey(
    address: string,
    packageId: string,
    signPersonalMessage: (msg: Uint8Array) => Promise<{ signature: string }>,
): Promise<SessionKey> {
    const sessionKey = await SessionKey.create({
        address,
        packageId: new Uint8Array(Buffer.from(packageId.slice(2), 'hex')),
        ttlMin: 10,
        suiClient,
    });
    const message = sessionKey.getPersonalMessage();
    const { signature } = await signPersonalMessage(message);
    sessionKey.setPersonalMessageSignature(signature);
    return sessionKey;
}
```

### Phase 8: Deploy Frontend to Walrus Sites

```bash
# 1. Build the frontend
cd apps/web
bun run build
# Output: dist/

# 2. Deploy to Walrus Sites
site-builder --context=testnet deploy ./dist --epochs 50

# Output will contain the site object ID and URL
# Example: https://<object-id>.walrus.site

# 3. For updates, use the same command (it detects existing deployment via ws-resources.json)
site-builder --context=testnet deploy ./dist --epochs 50
```

**`scripts/deploy-walrus-site.sh`:**
```bash
#!/bin/bash
set -e

echo "Building frontend..."
cd apps/web
bun run build

echo "Deploying to Walrus Sites..."
site-builder --context=testnet deploy ./dist --epochs 50

echo "Done! Site is live on Walrus."
```

---

## 9. Walrus & Seal Feasibility Analysis

### 9.1 Walrus Feasibility

| Use Case | Feasibility | Notes |
|----------|-------------|-------|
| Game replay storage | **High** | JSON < 1KB per game. Free on testnet. Blob ID in GameResult event. |
| Frontend hosting (Walrus Sites) | **High** | `site-builder deploy ./dist` -- fully decentralized. Works with Vite output. |
| Player avatars | **Medium** | Upload via publisher (< 10 MiB limit). Serve via `<img src="aggregator/v1/blobs/{id}">`. |
| Leaderboard snapshots | **Medium** | Periodic JSON dumps for historical analysis. Nice-to-have. |
| Game assets (sprites/sounds) | **Low priority** | Can be bundled in the Walrus Site build. |

### 9.2 Seal Feasibility `[OUT OF SCOPE — v1.2]`

> Kept for reference — none of the rows below are delivery targets in v1.2.


| Use Case | Feasibility | Notes |
|----------|-------------|-------|
| Commit-reveal moves (anti-cheat) | **High** | Main use case. Encrypt move client-side, reveal after AI commits. Impressive for hackathon. |
| Hidden game state (fog-of-war) | **Medium** | Encrypt partial board per player. Complex but doable. |
| Tournament sealed submissions | **Medium** | Time-lock encryption until round ends. Uses `tle.move` pattern. |
| Token-gated replays (premium) | **Low priority** | Subscription pattern from Seal examples. Out of scope for hackathon. |

### 9.3 Recommendation

**Must have:** Walrus (replays + Walrus Sites). ~~Seal (commit-reveal Challenge Mode)~~ `[OUT OF SCOPE — v1.2]`
**Nice to have:** Walrus (avatars). ~~Seal (fog-of-war variant)~~ `[OUT OF SCOPE — v1.2]`

Walrus is fully usable on testnet and free for development. Seal was de-scoped in v1.2 (see §0 changelog) but the code scaffolding is preserved so it can be re-enabled later without re-implementing setup.

---

## 10. Development Phases & Milestones

### Sprint 1: Core Game (Days 1-2)
- [ ] Bun workspace scaffold (root + apps/web + packages/move)
- [ ] Move contract: `game.move` with basic AI (random only)
- [ ] `sui move build && sui move test`
- [ ] Deploy to testnet
- [ ] Frontend: Vite + Tailwind + shadcn/ui setup
- [ ] Game board component (15x15 grid)
- [ ] Direct wallet connection (Sui Wallet, no Enoki yet)
- [ ] Play a complete game end-to-end on testnet

### Sprint 2: Enoki + AI (Days 3-4)
- [ ] Enoki Portal setup (Google OAuth)
- [ ] `registerEnokiWallets()` in frontend
- [ ] Sponsored-tx relay: Next.js route handlers at `app/api/sponsor` + `app/api/execute`
- [ ] Google zkLogin working end-to-end
- [ ] Improved AI: weighted strategic moves (medium/hard difficulty)
- [ ] Move history sidebar component
- [ ] Win/lose/draw detection and animations
- [ ] `GameResult` NFT minting

### Sprint 3: Walrus + Seal (Days 5-6)
- [ ] Walrus: Save replay after game ends (PUT to publisher)
- [ ] Walrus: Load and display replay (GET from aggregator)
- [ ] Replay viewer with step-through controls
- [ ] ~~Seal: `seal_policy.move` deployed~~ `[OUT OF SCOPE — v1.2]`
- [ ] ~~Seal: Challenge Mode commit-reveal flow~~ `[OUT OF SCOPE — v1.2]`
- [ ] Leaderboard module + UI
- [ ] Deploy frontend to Walrus Sites

### Sprint 4: Polish & Demo (Day 7)
- [ ] Bug fixes and edge case handling
- [ ] Mobile responsive layout
- [ ] Loading states and error handling
- [ ] Demo video recording
- [ ] README with setup instructions
- [ ] Final testnet deployment (contract + Walrus Site)

---

## 11. Hackathon Judging Criteria Alignment

| Criteria | How We Score |
|----------|-------------|
| **Technical Complexity** | Fully on-chain game logic with AI using native randomness; 3 Sui ecosystem integrations shipped (Enoki, Walrus, sui::random). ~~Seal~~ `[OUT OF SCOPE — v1.2]` |
| **Innovation** | Wallet-less onboarding via Enoki zkLogin; AI opponent using on-chain randomness beacon. ~~Commit-reveal with Seal for provably fair AI gaming~~ `[OUT OF SCOPE — v1.2]` |
| **User Experience** | Zero-friction: Google login, no gas, instant play. Modern UI with shadcn/ui. Mobile responsive. |
| **Sui Ecosystem Usage** | Enoki (auth + gas sponsoring), Walrus (storage + decentralized hosting), sui::random (AI), shared objects, events, NFT results. ~~Seal (encryption)~~ `[OUT OF SCOPE — v1.2]` |
| **Completeness** | Playable game, leaderboard, replays, 3 AI difficulties, deployed on testnet + Walrus Sites. ~~commit-reveal mode~~ `[OUT OF SCOPE — v1.2]` |
| **Code Quality** | Move unit tests, TypeScript types, clean Bun monorepo structure, separation of concerns |

---

## 12. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| AI move gas cost too high on 15x15 board | High | Limit strategic scan depth; cap loop iterations. Fallback: reduce board to 11x11. Profile gas usage early. |
| Enoki free tier limits | Low | Sandbox tier has unlimited testnet usage. Only mainnet has MAU caps. |
| Walrus testnet data wipe | Low | Replays are enhancement, not core. Game works fully without Walrus. |
| Seal testnet key server instability | N/A `[OUT OF SCOPE — v1.2]` | Resolved by de-scoping Seal entirely in v1.2. Normal mode works without Seal. |
| Move compilation errors with `Random` | Medium | Strictly follow `entry fun` pattern. Move compiler gives clear errors. Test early. |
| Board state too large for events | Low | `vector<u8>` with 225 elements = 225 bytes. Well within Sui limits. |
| Google OAuth redirect issues | Medium | Test redirect URIs thoroughly. Support Sui Wallet as fallback auth. |
| Slow RPC / testnet congestion | Medium | Add loading states. Use `useSuiClientQuery` with refetch intervals. Retry logic. |

---

## 13. Environment Variables Summary

All env vars live in **one place**: `apps/web/.env` locally and the Vercel project env in production. `NEXT_PUBLIC_*` is inlined into the browser bundle; the unprefixed keys (`ENOKI_SECRET_KEY`, `PACKAGE_ID`) stay server-side and are only read inside `app/api/*/route.ts`.

### `apps/web/.env` (combined frontend + server)
```bash
# ===== Public (exposed to browser) =====

# Sui
NEXT_PUBLIC_SUI_NETWORK=testnet

# Enoki (public key only!)
NEXT_PUBLIC_ENOKI_API_KEY=enoki_public_xxxxx
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com

# Smart Contract
NEXT_PUBLIC_PACKAGE_ID=0x...
NEXT_PUBLIC_ORIGINAL_PACKAGE_ID=0x...
NEXT_PUBLIC_LEADERBOARD_ID=0x...

# Walrus
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space

# Seal — [OUT OF SCOPE — v1.2]. Keys retained so lib/seal.ts + useSeal.ts still compile.
# Leave NEXT_PUBLIC_SEAL_ENABLED=false (or unset) for the hackathon demo.
NEXT_PUBLIC_SEAL_PACKAGE_ID=0x...
NEXT_PUBLIC_SEAL_SERVER_OBJECT_ID=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
NEXT_PUBLIC_SEAL_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com
NEXT_PUBLIC_SEAL_ENABLED=false

# Optional override. Leave unset to use same-origin /api/*. Set only if you point
# the UI at a remote backend host (rare).
# NEXT_PUBLIC_API_URL=

# ===== Server-only (do NOT prefix with NEXT_PUBLIC_) =====

# Enoki PRIVATE key — consumed by app/api/sponsor/route.ts + app/api/execute/route.ts
ENOKI_SECRET_KEY=enoki_private_xxxxx

# Comma-separated to keep both the new + legacy package ids in the allowlist
# during an upgrade window.
PACKAGE_ID=0xNEW,0xLEGACY
```

---

## 14. Key Links & References

| Resource | URL |
|----------|-----|
| Sui Docs | https://docs.sui.io |
| Sui Move Randomness | https://docs.sui.io/guides/developer/advanced/randomness-onchain |
| `sui::random` API | https://docs.sui.io/references/framework/sui_sui/random |
| Enoki Docs | https://docs.enoki.mystenlabs.com |
| Enoki Portal | https://portal.enoki.mystenlabs.com |
| Enoki Example App | https://github.com/sui-foundation/enoki-example-app |
| Walrus Docs | https://docs.wal.app |
| Walrus Sites Guide | https://docs.wal.app/docs/sites |
| @mysten/walrus SDK | https://sdk.mystenlabs.com/walrus |
| Seal Docs | https://seal-docs.wal.app |
| Seal GitHub | https://github.com/MystenLabs/seal |
| @mysten/seal npm | https://www.npmjs.com/package/@mysten/seal |
| Sui TypeScript SDK | https://sdk.mystenlabs.com/typescript |
| dApp Kit | https://sdk.mystenlabs.com/dapp-kit |
| Tic-Tac-Toe Example | https://docs.sui.io/guides/developer/app-examples/tic-tac-toe |
| Satoshi Coin Flip | https://github.com/MystenLabs/satoshi-coin-flip |
| Blackjack on Sui | https://github.com/MystenLabs/blackjack-sui |
| shadcn/ui | https://ui.shadcn.com |
| Sui Testnet Faucet | https://faucet.testnet.sui.io |
| Walrus Cost Calculator | https://costcalculator.wal.app |
| Next.js App Router | https://nextjs.org/docs/app |
| Vercel Deploy Next.js | https://vercel.com/docs/frameworks/nextjs |

---

## 15. Success Metrics

| Metric | Target |
|--------|--------|
| Game playable on testnet | End-to-end: create game -> play moves -> win/lose/draw |
| Google login working (Enoki) | Zero-gas UX, no wallet extension needed |
| AI responds with randomness | 3 difficulty levels, provably fair via sui::random |
| Replay saved to Walrus | Retrievable by blob ID, viewable in replay viewer |
| ~~Commit-reveal with Seal~~ `[OUT OF SCOPE — v1.2]` | ~~Challenge Mode working with encrypted moves~~ (deferred) |
| Frontend on Walrus Sites | Fully decentralized hosting, accessible via .walrus.site |
| Move unit tests passing | >80% coverage on game logic (win detection, AI, board ops) |
| Mobile responsive | Playable on phone browser |
| Leaderboard functional | Shows win/loss stats per player |
| Sponsored transactions | All game actions are gasless for the player |

---

*Built with Sui Move, Enoki, and Walrus for the Sui Hackathon 2026.* (Seal scaffolded in-code but out-of-scope for v1.2 — see §0 changelog.)