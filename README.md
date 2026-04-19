# Caro On-Chain

> Play Caro (Gomoku, five-in-a-row) against an AI that lives entirely on the Sui blockchain. No wallet extension, no gas fees, no off-chain game server — your moves go straight into a `sui::random`-driven Move contract and the AI replies in the same transaction.

[Sui Hackathon 2026](https://sui.io) submission. Built on Sui testnet with **Enoki** (Google zkLogin + sponsored transactions), **Walrus** (replay storage), **Seal** (encrypted commit-reveal), and the native **`sui::random`** beacon.

- Frontend + API: Next.js 15 (App Router) → Vercel
- Smart contract: Sui Move, 15×15 board, weighted-random AI across 3 difficulties
- Auth: Enoki zkLogin (Google) — players never see a seed phrase or pay gas
- Storage: Walrus decentralized blobs for complete replay history
- Anti-cheat: optional **Challenge Mode** encrypts moves via Seal before submission

See [`docs/PRD.md`](docs/PRD.md) for the full design doc.

---

## Requirements

- [Bun](https://bun.sh/) ≥ 1.1
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) (any recent testnet build) — only needed if you publish the Move package yourself
- Optional: [Walrus CLI + `site-builder`](https://docs.wal.app/) if you plan to publish replays or deploy to Walrus Sites
- An [Enoki](https://portal.enoki.mystenlabs.com) project (sandbox tier is free) + a Google OAuth 2.0 Client ID

## Quick start (using the existing deployment)

```bash
git clone <this-repo>
cd caro-on-sui

# 1. Install the whole workspace
bun install

# 2. Configure env (see Environment section below for the full list).
cp apps/web/.env.example apps/web/.env
# → Fill in NEXT_PUBLIC_ENOKI_API_KEY, NEXT_PUBLIC_GOOGLE_CLIENT_ID, ENOKI_SECRET_KEY.
#   The PACKAGE_ID / LEADERBOARD_ID / SEAL_* defaults in .env.example already
#   point at the testnet deployment — you can leave them as-is for a first run.

# 3. Boot the app
bun run dev       # → http://localhost:3000
```

That's it. One process serves the UI **and** the sponsored-transaction relay (`/api/sponsor`, `/api/execute`). Connect with Google, pick a difficulty, make a move.

## What runs where

```
apps/web/                       # Next.js 15 App Router (frontend + serverless routes)
├── app/
│   ├── layout.tsx              # root shell, Providers, top nav, <Toaster>
│   ├── providers.tsx           # QueryClient + SuiClientProvider + Enoki register + WalletProvider
│   ├── page.tsx                # /
│   ├── play/page.tsx           # /play — game board + Challenge Mode
│   ├── replays/page.tsx        # /replays — Walrus replay list/viewer
│   ├── leaderboard/page.tsx    # /leaderboard
│   ├── auth/callback/page.tsx  # /auth/callback — Enoki zkLogin redirect
│   └── api/
│       ├── sponsor/route.ts    # POST /api/sponsor — Enoki createSponsoredTransaction
│       └── execute/route.ts    # POST /api/execute — Enoki executeSponsoredTransaction
├── components/                 # feature components + components/ui/ (shadcn primitives)
├── hooks/                      # useGame, useLeaderboard, useReplays, useSeal
└── lib/                        # constants, sui, walrus, seal, explorer, utils (incl. cn())

packages/move/                  # Sui Move smart contracts
├── sources/
│   ├── game.move               # Game state + on-chain AI (sui::random)
│   ├── leaderboard.move        # On-chain stats aggregation
│   └── seal_policy.move        # `seal_approve` gate for Challenge Mode

scripts/
├── deploy.sh                   # `sui client publish` wrapper for the Move package
└── deploy-walrus-site.sh       # Optional — deploy the built site to Walrus Sites

docs/PRD.md                     # Full product/architecture doc
```

The v1.0 design had a separate Hono backend at `apps/api` for sponsored-tx relay. That's been retired — Next.js route handlers own the relay now (same origin, no CORS, one deploy).

## Environment variables

All vars live in `apps/web/.env` locally and in the Vercel project env in production.

`NEXT_PUBLIC_*` is inlined into the browser bundle. The other two (`ENOKI_SECRET_KEY`, `PACKAGE_ID`) are **server-only** and are read exclusively inside `app/api/*/route.ts`.

| Var | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUI_NETWORK` | client | `testnet` / `mainnet` / `devnet` |
| `NEXT_PUBLIC_ENOKI_API_KEY` | client | Enoki **public** key — powers zkLogin wallet registration |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | client | Google OAuth 2.0 Client ID (type: Web app) |
| `NEXT_PUBLIC_PACKAGE_ID` | client | Latest published Move package id (`sui client upgrade`-aware) |
| `NEXT_PUBLIC_ORIGINAL_PACKAGE_ID` | client | First-publish id — used for event-type / struct-tag filters |
| `NEXT_PUBLIC_LEADERBOARD_ID` | client | Shared `Leaderboard` object id |
| `NEXT_PUBLIC_WALRUS_PUBLISHER` | client | Walrus publisher URL (replay uploads) |
| `NEXT_PUBLIC_WALRUS_AGGREGATOR` | client | Walrus aggregator URL (replay reads) |
| `NEXT_PUBLIC_SEAL_PACKAGE_ID` | client | Published id of the `seal_policy` package |
| `NEXT_PUBLIC_SEAL_SERVER_OBJECT_ID` | client | Testnet Seal key-server object |
| `NEXT_PUBLIC_SEAL_AGGREGATOR_URL` | client | Seal aggregator for key-share retrieval |
| `NEXT_PUBLIC_SEAL_ENABLED` | client | `true` to show the Challenge Mode toggle |
| `NEXT_PUBLIC_API_URL` | client | Usually empty — leave unset to hit same-origin `/api/*` |
| `ENOKI_SECRET_KEY` | **server** | Enoki **private** key — signs sponsored transactions |
| `PACKAGE_ID` | **server** | Comma-separated package ids for the sponsored-tx allowlist (supports both pre- and post-upgrade ids during a rollover window) |

On Vercel: put every var into the project env (Settings → Environment Variables). Only the `NEXT_PUBLIC_*` ones need to be exposed in the Preview/Development environments for contributors.

## Deploying

### Smart contract (required once, and after any Move change)

```bash
# 1. Put your Sui CLI on testnet and top up with the faucet:
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet
sui client faucet

# 2. Build + test + publish:
bun run deploy:move
# → prints the package id and tells you which env vars to update.
```

After publishing:
- Paste the new package id into `NEXT_PUBLIC_PACKAGE_ID` **and** `PACKAGE_ID` in `apps/web/.env` (and in Vercel).
- Find the `Leaderboard` shared object id in the publish output and set `NEXT_PUBLIC_LEADERBOARD_ID`.
- If you published `seal_policy` in the same package, update `NEXT_PUBLIC_SEAL_PACKAGE_ID`.

During an upgrade window, set `PACKAGE_ID="0xNEW,0xLEGACY"` so the sponsored-tx allowlist covers both.

### Frontend + API (Vercel)

```bash
# From the repo root, either:
vercel --prod                         # one-off

# Or push to `main` after connecting the repo to Vercel — it auto-detects Next.js,
# builds apps/web, and deploys the API routes as serverless functions.
```

`apps/web/vercel.json` keeps the install step working inside the Bun workspace:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "cd ../.. && bun install"
}
```

Framework, build command, and output directory are auto-detected — no further config needed.

### Walrus Sites (optional, decentralized alternative)

```bash
bun run deploy:site
```

This runs `next build` then hands the static output to `site-builder`. Note: Walrus Sites is a **static** host — it does not run the Next.js server, so the `/api/sponsor` and `/api/execute` routes won't work. If you publish to Walrus Sites, also deploy the route handlers somewhere that runs them (Vercel, Cloudflare Workers, a Bun server, …) and point `NEXT_PUBLIC_API_URL` at that origin.

## Development workflow

```bash
bun run dev                           # apps/web, next dev on :3000
bun --filter './apps/web' run typecheck
bun --filter './apps/web' run build   # production build locally
bun run test:move                     # sui move test in packages/move
```

Useful pages while debugging:
- `http://localhost:3000/play` — start a game, watch `POST /api/sponsor` and `POST /api/execute` in the Network tab.
- Browser console logs the active `PACKAGE_ID`, `ORIGINAL_PACKAGE_ID`, `LEADERBOARD_ID` on first render (from `lib/constants.ts`).
- `sui client objects` lists your `GameResult` NFTs after finishing a game.

### Challenge Mode (Seal)

Toggle on `/play` when `NEXT_PUBLIC_SEAL_ENABLED=true`. Each move is:
1. Encrypted client-side (`sealClient.encrypt`, threshold 1, IBE id = game object id).
2. Submitted on-chain through the normal `game::play` path.
3. Decrypted after the transaction lands by dry-running `caro::seal_policy::seal_approve` (key server gates on sender == game.player).

A `🔒 → ✅ Verified` badge confirms the round-trip. First move per session prompts the wallet once to sign a session-key challenge; subsequent moves reuse the 10-minute session.

## Troubleshooting

- **"Failed to sponsor transaction"** — `ENOKI_SECRET_KEY` is missing on the server, or the Move call target isn't in the allowlist. Check the Vercel function logs, or the terminal running `next dev`. The allowlist is built from `PACKAGE_ID` and includes `::game::new_game`, `::game::play`, `::game::resign`, `::game::attach_replay`, `::leaderboard::record_result`.
- **Google wallet not showing in the connect modal** — `NEXT_PUBLIC_ENOKI_API_KEY` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` must both be set at build time (client env vars are inlined, so a restart of `next dev` is required after editing `.env`).
- **`sui::random` compiler error** — `play` must be declared `entry fun` (not `public fun`) because it takes `&Random`. Compiler-enforced.
- **Seal key server rejects** — the `seal_policy` package id in `NEXT_PUBLIC_SEAL_PACKAGE_ID` must match a package that actually defines `seal_policy::seal_approve` (the v1.0 placeholder doesn't — republish with the Seal dep added; see `packages/move/Move.toml`).

## Tech stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · `@mysten/sui` · `@mysten/dapp-kit` · `@mysten/enoki` · `@mysten/seal` · Sui Move · Bun workspace.

## License

Built for the Sui Hackathon. See individual dependency licenses for the SDKs.
