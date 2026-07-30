# Games Platform Architecture

## Boundaries

| Piece | Location | Host |
|-------|----------|------|
| Games frontend | `NaLuworld/White-Studio-Website-Games` | Cloudflare Pages → `games.white-studio.org` |
| API / leaderboard | `White-Studio-Website/website-worker` | `api.white-studio.org` |
| Main site | `White-Studio-Website/website-pages` | `white-studio.org` |
| Tools | `White-Studio-Website-Tools` | `tools.white-studio.org` |

Games mirrors the **Tools** boundary: independent Pages repo, shared Worker API, CORS allowlist entry.

## Frontend

- Static site, no framework build for MVP
- Shared design: `assets/css/ws-shared.css`
- API client: `assets/js/games-api.js` → `https://api.white-studio.org`

## Backend

- Routes: `/api/games`, `/api/games/:id/leaderboard`, `/api/games/:id/scores`
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
