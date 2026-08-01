# Color Chain（四色接龍）

Realtime multiplayer card game on `games.white-studio.org/games/color-chain/`.

## Architecture

| Piece | Location |
|-------|----------|
| Frontend | This repo: `games/color-chain/` |
| Rules engine + Durable Object room | `White-Studio-Website/website-worker/src/games/color-chain/` |
| Catalog + scores | same Worker (`GAMES_CATALOG`, `/api/games/color-chain/scores`) |

Server-authoritative: clients send intents (`action:playCard`, …); the `ColorChainRoom` DO validates and broadcasts personalized `game:state`.

## Local check

1. In `website-worker`: `npm test` (includes engine unit tests) then `npx wrangler dev`
2. Point the game page meta `ws-api-origin` at the local Worker origin (e.g. `http://127.0.0.1:8787`)
3. Serve Games repo statically; open two tabs — create room / join with code (or enable AI fill for solo)

## Deploy

1. Deploy Worker (applies DO migration `v1-color-chain`):

```bash
cd website-worker
npx wrangler deploy
```

2. Push Games `main` → Cloudflare Pages auto-deploy.

3. Verify:

- `GET https://api.white-studio.org/api/games` lists `color-chain`
- `https://games.white-studio.org/games/color-chain/` loads lobby
- Two browsers can complete a match; winner can submit score

## Score

Winner only: `1000 + sum(opponent hand points)` (num = face, skip/reverse/+2 = 20, wild/+4 = 50), max `50000`.
