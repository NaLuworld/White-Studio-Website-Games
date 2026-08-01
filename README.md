# White Studio Games

Static Cloudflare Pages site for `https://games.white-studio.org/`.

Mini-games + guest leaderboards. API: `https://api.white-studio.org` (shared White Studio Worker).

## Cloudflare Pages (Git) settings

Mirror the main site’s static deploy model (`White-Studio-Website/website-pages`):

| Setting | Value |
|---------|--------|
| Framework preset | `None` |
| Build command | _(leave empty)_ |
| Build output directory | `.` |
| Root directory | `/` |
| Production branch | `main` |
| Custom domain | `games.white-studio.org` |

Do **not** set `npx wrangler deploy` as the Pages build command.

## Local preview

Any static server from repo root, for example:

```bash
npx --yes serve -l 4173 .
```

Open `http://127.0.0.1:4173/`. Leaderboard calls production API unless you change:

```html
<meta name="ws-api-origin" content="https://api.white-studio.org" />
```

Dev origins `http://127.0.0.1:4173` / `http://localhost:4173` are allowlisted on the Worker via `ACCOUNT_DEV_ALLOWED_ORIGINS`.

## Custom domain checklist

1. Push this repo to `NaLuworld/White-Studio-Website-Games` on `main`
2. Cloudflare Dashboard → Workers & Pages → Create → Connect Git → this repo
3. Apply Pages settings above → Deploy
4. Custom domains → Add `games.white-studio.org`
5. DNS: `games` CNAME to the Pages project hostname (proxied) if not auto-created
6. Wait until SSL status is **Active**
7. Confirm Worker CORS includes `https://games.white-studio.org` and D1 migration `0003_game_scores` is applied

## Games

- Hub: `/`
- Snake: `/games/snake/` (貪食蛇)
- Color Chain: `/games/color-chain/` (四色接龍 — realtime rooms via Worker Durable Objects)

Realtime API (Worker): `POST /api/games/color-chain/rooms`, `…/join`, WebSocket `…/ws`. See [`docs/COLOR-CHAIN.md`](docs/COLOR-CHAIN.md).

## Developer handoff

協作：開發者交**完整遊戲企劃書** → NaLuWorld / Cursor 實作。

- 規範（含皮膚 Marketplace / 排行榜預留）：[`docs/GAME-DEVELOPMENT-SPEC.md`](docs/GAME-DEVELOPMENT-SPEC.md)
- 企劃繳交模板：[`docs/templates/GAME-DESIGN-BRIEF.md`](docs/templates/GAME-DESIGN-BRIEF.md)

## Design system

- CSS: [`assets/css/ws-shared.css`](assets/css/ws-shared.css)
- Guide: [`docs/design/WHITE-STUDIO-SHARED-UI.md`](docs/design/WHITE-STUDIO-SHARED-UI.md)
- Social cards: [`docs/design/SOCIAL-CARDS.md`](docs/design/SOCIAL-CARDS.md)
- Add-game prompt: [`docs/prompts/ADD-GAME-TO-GAMES-PLATFORM.md`](docs/prompts/ADD-GAME-TO-GAMES-PLATFORM.md)

See [`docs/GO-LIVE.md`](docs/GO-LIVE.md) for GitHub + Pages + domain + Worker publish steps.
