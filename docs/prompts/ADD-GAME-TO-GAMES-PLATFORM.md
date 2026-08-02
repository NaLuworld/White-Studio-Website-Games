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
   - Games Discord identity (optional UI): `GET /auth/games/discord/start`, `GET /api/games/session`, `POST /api/games/logout`
4. **Auth**: guest nickname for scores. Navbar may show Games Discord identity (`ws_games_session`) from `api.white-studio.org`. Do **not** use Tools Discord admin cookies (`ws_tools_session`) or account sessions for scores.
5. **i18n**: handwritten dictionaries only (`zh-Hant` + `en`). Read `docs/i18n/GAMES-I18N.md`. Every new visible string needs keys in **both** JSON files + `data-i18n` / `t()`.
6. **Deploy model**: static HTML/JS at repo root → Cloudflare Pages (preset None, output `.`). No React unless the platform already migrated.
7. **Do not** modify main site or Tools frontends unless Worker catalog/auth changes are required.

## Implementation checklist

1. Create `games/<game-id>/index.html`, game script/CSS.
2. Reuse header/footer + chrome boot from `games/snake/index.html`:
   - the inline trailing-dot hostname guard as the first `<script>` in `<head>` (right after `<meta charset>`)
   - `<meta name="color-scheme" content="dark" />` (Games is dark-only)
   - `/assets/js/i18n.js`, `/assets/js/games-auth.js`, `/assets/js/games-api.js`, `/assets/js/site-chrome.js`, `/assets/js/leaderboard-ui.js`
   - `WhiteStudioGames.bootChrome({ nicknameInput })`
   - `WhiteStudioLeaderboard.mountLeaderboard({ gameId: "<game-id>", ... })`
3. Add bilingual keys for all new copy in `/assets/i18n/zh-Hant.json` and `/assets/i18n/en.json`.
4. Add a card on `/index.html` linking to `/games/<game-id>/` (with `data-i18n` keys).
5. Update Worker `GAMES_CATALOG` in `website-worker/src/games/catalog.js` with matching `id`, `title`, `summary`, `path`, `maxScore`.
6. Keep `game-id` lowercase kebab-case, stable forever.
7. **Social card** (required for shareable pages) — see [`docs/design/SOCIAL-CARDS.md`](../design/SOCIAL-CARDS.md):
   - Add `assets/images/games/<game-id>/icon.png` (1024²; cabinet placeholder OK)
   - Append the game to `assets/images/og/manifest.json`
   - Run `python scripts/compose_og_cards.py`
   - Paste OG + Twitter `summary_large_image` meta (absolute `og/<game-id>.png` URLs) into the game `index.html`
8. Validate locally: language switch, Discord login UI, play → submit score → refresh board.
9. Push Games repo `main` (Pages auto-deploy). Deploy Worker if catalog changed.
10. Live check: `https://games.white-studio.org/games/<game-id>/` and CORS-free score POST.

## Acceptance

- [ ] Page matches shared chrome (tokens, nav, language, Discord login)
- [ ] New strings exist in both locale dictionaries
- [ ] Game is playable on phone + desktop
- [ ] Scores persist and appear on leaderboard (guest nickname)
- [ ] Hub lists the new game
- [ ] Worker catalog includes the game id
- [ ] OG / Twitter Card meta present with `/assets/images/og/<game-id>.png`
