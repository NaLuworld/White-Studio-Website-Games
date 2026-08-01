# Go-live checklist — games.white-studio.org

Code is ready in this repo (`main` commit present locally). Complete these Cloudflare / GitHub steps to publish.

## 1. GitHub repo

Create empty repo: `NaLuworld/White-Studio-Website-Games`

Then from this directory:

```bash
git remote add origin https://github.com/NaLuworld/White-Studio-Website-Games.git
git push -u origin main
```

## 2. Cloudflare Pages

1. Dashboard → Workers & Pages → Create → Connect to Git
2. Select `White-Studio-Website-Games`
3. Settings:
   - Framework preset: **None**
   - Build command: _(empty)_
   - Build output directory: `.`
   - Root directory: `/`
4. Save and Deploy

## 3. Custom domain

1. Pages project → Custom domains → Add `games.white-studio.org`
2. If DNS is not auto-created: Zone `white-studio.org` → `games` CNAME → `<project>.pages.dev` (Proxied)
3. Wait until certificate is **Active**

## 4. Worker (API + CORS + catalog)

From `White-Studio-Website/website-worker` (after `npx wrangler login`):

```bash
npx wrangler d1 migrations apply white-studio-auth --remote
npx wrangler deploy
```

Confirm `ALLOWED_ORIGINS` includes `https://games.white-studio.org` (already in `wrangler.toml`).

> Note: production D1 tables `game_scores` / `game_score_rate_limits` may already exist if applied via Dashboard/MCP. Prefer still recording migration `0003_game_scores` with wrangler so local/history stay aligned.

## 5. Verify

```bash
curl -s https://api.white-studio.org/api/games
curl -s -X POST https://api.white-studio.org/api/games/snake/scores \
  -H "content-type: application/json" \
  -H "origin: https://games.white-studio.org" \
  -d "{\"playerName\":\"LiveCheck\",\"score\":42}"
curl -s "https://api.white-studio.org/api/games/snake/leaderboard?limit=5"
```

Open:

- https://games.white-studio.org/
- https://games.white-studio.org/games/snake/
- https://games.white-studio.org/games/color-chain/

Expect: playable Snake, submit score, board updates, no CORS errors. Color Chain lobby can create a room (Worker DO) and play with AI fill or a second browser.
