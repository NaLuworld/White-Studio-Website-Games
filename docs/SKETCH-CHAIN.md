# Sketch Chain（傳畫本 · 你畫我猜接龍）

Realtime multiplayer party game on `games.white-studio.org/games/sketch-chain/`.

玩法類 Gartic Phone：每人寫題 → 畫別人的題 → 猜別人的圖 → 再畫… N 輪後自動播放接龍大公開。

## Architecture

| Piece | Location |
|-------|----------|
| Frontend | This repo: `games/sketch-chain/` |
| Room + rules engine | `White-Studio-Website/website-worker/src/games/sketch-chain/` (Durable Object `SketchChainRoom`) |
| Image blobs (drawings) | v1：`dataURL` 存在 DO state（JPEG base64）；日後可改 R2 |
| Catalog | `website-worker/src/games/catalog.js` — **category `party`，無排行榜** |

**不要**另架 Socket.IO / Render 伺服器；對齊 `color-chain` 的 REST + WebSocket + DO 模式。

## Hub 分類

與未來 Uno、現有四色接龍同屬 **團康遊戲（party）** 區塊，與街機高分遊戲（Snake 等）分開展示。

## 規格來源

- 企劃書：`你畫我猜 多人連線企劃書.md`（玩法、事件、Reveal 時間軸）
- 前端 Demo：`pictionary.html`（Lobby / Stage / Reveal UI、畫布 Pointer Events、假資料流程）

## Local check

1. Worker：`npm test`（含 engine 單元測）→ `npx wrangler dev`
2. Games 頁 `meta ws-api-origin` 指向本機 Worker（例 `http://127.0.0.1:8787`）
3. 靜態 serve Games repo；開兩個分頁建立房間 / 加入房號，完成一局並看 Reveal 是否同步

## Deploy

1. Worker（`website-worker`）：

```bash
npx wrangler deploy
```

需套用 migration `v1-sketch-chain`（`SketchChainRoom` DO）。

2. Push Games `main` → Cloudflare Pages

3. Verify：

- `GET https://api.white-studio.org/api/games` → `sketch-chain`，`category: party`，`leaderboard: false`
- `POST https://api.white-studio.org/api/games/sketch-chain/rooms` 可建房
- `https://games.white-studio.org/games/sketch-chain/` 雙瀏覽器可完成一局 + Reveal

## API

| Method | Path |
|--------|------|
| `POST` | `/api/games/sketch-chain/rooms` |
| `POST` | `/api/games/sketch-chain/rooms/:code/join` |
| `GET` | `/api/games/sketch-chain/rooms/:code/ws?playerId=&token=` |

WebSocket 事件契約見 [`docs/prompts/IMPLEMENT-SKETCH-CHAIN.md`](prompts/IMPLEMENT-SKETCH-CHAIN.md)。

## Score / Leaderboard

**v1 不實作排行榜。** 不接 `mountLeaderboard`、不新增 `/scores` 路由、Catalog 標 `leaderboard: false`（或等價欄位）。
