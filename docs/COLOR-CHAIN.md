# Color Chain（四色接龍）

Realtime multiplayer card game on `games.white-studio.org/games/color-chain/`.

## Architecture

| Piece | Location |
|-------|----------|
| Frontend | This repo: `games/color-chain/` |
| Rooms (REST + WebSocket) | `White-Studio-Website/website-games-rooms/` (Fly.io Node) |
| Rules engine (source of truth copy) | `website-games-rooms/src/games/color-chain/engine.js` (+ Worker copy for tests) |
| Catalog + scores | Worker `api.white-studio.org` |

Server-authoritative: clients send intents (`action:playCard`, …); the Node room validates and broadcasts personalized `game:state`.

Frontend rooms origin:

```html
<meta name="ws-rooms-origin" content="https://rooms.white-studio.org" />
<meta name="ws-api-origin" content="https://api.white-studio.org" />
```

## Local check

1. Rooms: `cd website-games-rooms && npm start` (default `:8788`)
2. Set game page `ws-rooms-origin` to `http://127.0.0.1:8788`
3. Serve Games repo statically; open two tabs — create room / join (or AI fill for solo)

## Deploy

1. Rooms: `cd website-games-rooms && fly deploy` (see service README)
2. Push Games `main` → Pages deploy
3. Worker catalog/scores: `npx wrangler deploy` as needed

Legacy Worker `/api/games/color-chain/rooms*` returns **410** (rooms moved).

## Score

Winner only: `1000 + sum(opponent hand points)` (num = face, skip/reverse/+2 = 20, wild/+4 = 50), max `50000`.
