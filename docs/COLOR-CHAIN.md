# Color Chain（四色接龍）

Realtime multiplayer card game on `games.white-studio.org/games/color-chain/`.

## Architecture

| Piece | Location |
|-------|----------|
| Frontend | This repo: `games/color-chain/` + shared `assets/js/multiplayer/room-client.js` |
| Rooms (production) | Fly.io `https://rooms.white-studio.org` (`White-Studio-Website/website-games-rooms/`) |
| Rooms (DO v2 canary) | Worker Durable Object `ColorChainRoom` on `api.white-studio.org` when `COLOR_CHAIN_ROOM_TRANSPORT=do-v2` (or `GAMES_ROOMS_BACKEND=do`) |
| Legacy DO | Same Worker class path; pre-v2 behavior audited in `docs/architecture/DO-USAGE-AUDIT.md` |
| Rules engine | `website-games-rooms/.../engine.js` (+ Worker copy) |
| Catalog + scores | Worker `api.white-studio.org` |

Server-authoritative: clients send intents (`action:playCard`, …); the room validates and broadcasts personalized `game:state`.

Frontend rooms origin:

```html
<!-- Production / rollback: Fly -->
<meta name="ws-rooms-origin" content="https://rooms.white-studio.org" />
<meta name="ws-api-origin" content="https://api.white-studio.org" />

<!-- DO v2 canary: point rooms meta (or ?rooms=) at API + enable Worker canary var -->
<!-- <meta name="ws-rooms-origin" content="https://api.white-studio.org" /> -->
```

## Transports

| Transport | How to enable | Status |
|-----------|---------------|--------|
| **Fly** (default) | `ws-rooms-origin` → `rooms.white-studio.org`; Worker `GAMES_ROOMS_BACKEND=fly` | **Production** |
| **DO v2 canary** | Worker `COLOR_CHAIN_ROOM_TRANSPORT=do-v2` + frontend rooms origin → `api.white-studio.org` | Canary only — Sketch Chain stays Fly |
| **Legacy DO** | `GAMES_ROOMS_BACKEND=do` (both games) | Not production; Sketch still has large dataURL risk |

Rollback: set `COLOR_CHAIN_ROOM_TRANSPORT=fly` (or unset) and keep `ws-rooms-origin` on Fly — no need to revert unrelated architecture.

## Local check

1. Rooms: `cd website-games-rooms && npm start` (default `:8788`)
2. Set game page `ws-rooms-origin` to `http://127.0.0.1:8788`
3. Serve Games repo statically; open two tabs — create room / join (or AI fill for solo)

### Local DO v2

1. `cd website-worker && npx wrangler dev --var COLOR_CHAIN_ROOM_TRANSPORT:do-v2 --var GAMES_ROOMS_DEBUG:true`
2. Open Color Chain with `?rooms=http://127.0.0.1:8787` (or `staging-do.html`)

## Deploy

1. Rooms: `cd website-games-rooms && fly deploy` (see service README)
2. Push Games `main` → Pages deploy
3. Worker catalog/scores: `npx wrangler deploy` as needed

Legacy Worker `/api/games/color-chain/rooms*` returns **410** when Color Chain transport is Fly (default).

DO usage audit / benchmark: `docs/architecture/DO-USAGE-AUDIT.md`, `docs/architecture/DO-V2-BENCHMARK.md`.

## Score

Winner only: `1000 + sum(opponent hand points)` (num = face, skip/reverse/+2 = 20, wild/+4 = 50), max `50000`.
