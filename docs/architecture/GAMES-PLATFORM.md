# Games Platform Architecture

## Boundaries

| Piece | Location | Host |
|-------|----------|------|
| Games frontend | `NaLuworld/White-Studio-Website-Games` | Cloudflare Pages → `games.white-studio.org` |
| API / leaderboard | `White-Studio-Website/website-worker` | `api.white-studio.org` |
| Main site | `White-Studio-Website/website-pages` | `white-studio.org` |
| Tools | `White-Studio-Website-Tools` | `tools.white-studio.org` |

Games mirrors the **Tools** boundary: independent Pages repo, shared Worker API, CORS allowlist entry.

## Cross-product Discord identity

All Discord OAuth flows share `api.white-studio.org` + the same Discord application (`identify` scope).

| Product cookie | Start path | Purpose | Who can log in |
|----------------|------------|---------|----------------|
| `ws_tools_session` | `/auth/tools/discord/start` | Tools admin | Only IDs in `TOOLS_DISCORD_ALLOWED_IDS` |
| `ws_games_session` | `/auth/games/discord/start` | Games open identity | **Any Discord user** |
| Account Discord binding (`AUTH_DB`) | `/auth/discord/start` | Account login/link | Pre-seeded / linked accounts |

Cookies are separate so product permissions stay isolated. The **same Discord user is always identifiable** via `discordUserId` for a future White Studio family-bucket session merge.

Do not reuse Tools allowlist checks on Games routes. Games callback (`intent=games`) must issue `ws_games_session` without calling `isToolsDiscordUserAllowed`.

## Frontend

- Static site, no framework build for MVP
- Shared design: `assets/css/ws-shared.css` + arcade chrome `assets/css/games-chrome.css`
- Visual direction: black-purple neon arcade + pixel display font (see `docs/design/WHITE-STUDIO-SHARED-UI.md`)
- API client: `assets/js/games-api.js` → `https://api.white-studio.org`
- Chrome: `assets/js/site-chrome.js` + `assets/js/i18n.js` + `assets/js/games-auth.js`
- Bilingual docs: `docs/i18n/GAMES-I18N.md`
- Navbar: brand + in-site Games only (no Tools / Community / White Studio links)

## Player journey (open floor)

1. Land on hub arcade lobby — no Discord required
2. Pick a cabinet (e.g. Neon Runner)
3. Play as guest; submit score with nickname
4. Optional Discord login for identity / nickname prefill (`ws_games_session`)

## Future: About

Cross-product discovery (Tools, Community Discord, main `white-studio.org`) will move to an **About** / “other White Studio services” surface — not the top navbar. Do not re-add those links to primary nav without an explicit product decision.

## Backend

- Routes: `/api/games`, `/api/games/:id/leaderboard`, `/api/games/:id/scores`
- Games Discord identity: `/auth/games/discord/start`, `/api/games/session`, `/api/games/logout` (`ws_games_session`)
- Shared Discord OAuth app with Tools/account; join key = `discordUserId`
- Storage: D1 `AUTH_DB` tables `game_scores`, `game_score_rate_limits` (migration `0003_game_scores.sql`)
- Guest scores with IP-hashed rate limits
- Catalog: `website-worker/src/games/catalog.js`

## Cloudflare Pages settings

- Framework preset: **None**
- Build command: _(empty)_
- Build output directory: `/` or `.`
- Root directory: `/`
- Production branch: `main`
- Custom domain: `games.white-studio.org`

## DNS

- `games` CNAME → `<pages-project>.pages.dev` (proxied)
- SSL Active on Pages Custom Domains

## CORS

Worker `ALLOWED_ORIGINS` must include `https://games.white-studio.org`.
