# Prompt: Add a game to White Studio Games

Paste this into Cursor (Agent mode) when adding a new mini-game to `NaLuworld/White-Studio-Website-Games`.

---

## Goal

Add a new playable mini-game under `/games/<game-id>/` on `https://games.white-studio.org/`, wire it to the shared UI shell and the existing Worker leaderboard API, and list it on the hub.

## Hard constraints

1. **Repo**: work only in `White-Studio-Website-Games` for frontend; Worker catalog lives in `White-Studio-Website/website-worker/src/games/catalog.js`.
2. **Design**: use `/assets/css/ws-shared.css` + `/assets/css/games-chrome.css`. Read `docs/design/WHITE-STUDIO-SHARED-UI.md`. Do not invent new brand colors for chrome.
3. **API** (already deployed on `api.white-studio.org`):
   - `GET /api/games`
   - `GET /api/games/:gameId/leaderboard?limit=20`
   - `POST /api/games/:gameId/scores` body `{ "playerName": "...", "score": 123 }`
4. **Auth**: guest nickname only. Do **not** use Tools Discord admin cookies or account sessions.
5. **Deploy model**: static HTML/JS at repo root → Cloudflare Pages (preset None, output `.`). No React unless the platform already migrated.
6. **Do not** modify main site or Tools frontends.

## Implementation checklist

1. Create `games/<game-id>/index.html`, game script/CSS.
2. Reuse header/footer patterns from `games/demo-runner/index.html`.
3. Include:
   - `/assets/js/theme-boot.js` in `<head>`
   - `/assets/js/games-api.js` + `/assets/js/leaderboard-ui.js`
   - `WhiteStudioLeaderboard.mountLeaderboard({ gameId: "<game-id>", ... })`
4. Add a card on `/index.html` linking to `/games/<game-id>/`.
5. Update Worker `GAMES_CATALOG` in `website-worker/src/games/catalog.js` with matching `id`, `title`, `summary`, `path`, `maxScore`.
6. Keep `game-id` lowercase kebab-case, stable forever.
7. Validate locally: play → submit score → refresh board.
8. Push Games repo `main` (Pages auto-deploy). Deploy Worker if catalog changed.
9. Live check: `https://games.white-studio.org/games/<game-id>/` and CORS-free score POST.

## Acceptance

- [ ] Page matches shared chrome (tokens, nav, theme toggle)
- [ ] Game is playable on phone + desktop
- [ ] Scores persist and appear on leaderboard
- [ ] Hub lists the new game
- [ ] Worker catalog includes the game id
