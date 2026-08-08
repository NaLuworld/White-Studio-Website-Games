# 你畫我猜（Draw & Guess · game-id: `sketch-chain`）

Realtime multiplayer party game on `games.white-studio.org/games/sketch-chain/`.

玩法類 Gartic Phone：每人寫題 → 畫別人的題 → 猜別人的圖 → 再畫… N 輪後自動播放接龍大公開。

**顯示名稱**：中文「你畫我猜」、英文「Draw & Guess」。`game-id` 仍為 `sketch-chain`（URL / API 不變）。

## Visual

- Dark arcade shell — `games/sketch-chain/game.css`（scoped `.sketch-chain-page`，用 `--ws-*` tokens）
- 對齊 [`docs/design/WHITE-STUDIO-SHARED-UI.md`](./design/WHITE-STUDIO-SHARED-UI.md)；畫布紙面維持淺色以便作畫

## Architecture

| Piece | Location |
|-------|----------|
| Frontend | This repo: `games/sketch-chain/` |
| Rooms (REST + WebSocket) | **Production:** Fly `rooms.white-studio.org`. **Not** on Color Chain DO v2 canary. Legacy Worker DO only if `GAMES_ROOMS_BACKEND=do` — do not cut over until drawings use asset refs (see `docs/architecture/DO-USAGE-AUDIT.md`). |
| Rules engine | `website-games-rooms/src/games/sketch-chain/engine.js` |
| Image blobs (drawings) | v1：JPEG `dataURL` in room memory（≤600KB）；日後可改物件儲存 |
| Catalog | Worker `catalog.js` — **category `party`，無排行榜** |

Frontend:

```html
<meta name="ws-rooms-origin" content="https://rooms.white-studio.org" />
<meta name="ws-api-origin" content="https://api.white-studio.org" />
```

## Hub 分類

與四色接龍同屬 **團康遊戲（party）** 區塊，與街機高分遊戲（Snake 等）分開展示。

## Local check

1. Rooms：`cd website-games-rooms && npm start`（`:8788`）
2. Games 頁 `ws-rooms-origin` → `http://127.0.0.1:8788`
3. 靜態 serve；兩分頁建房／加入，完成一局並確認 Reveal 同步

## Deploy

1. `website-games-rooms` → `fly deploy`
2. Games Pages push
3. Worker：房間 API 已改 **410**；catalog 仍由 Worker 提供

Legacy DO 房間路徑在 `GAMES_ROOMS_BACKEND=fly`（預設）時回 **410**。Color Chain DO v2 canary（`COLOR_CHAIN_ROOM_TRANSPORT=do-v2`）**不會**啟用 Sketch Chain DO；Sketch 維持 Fly，直到 asset-reference 架構就緒。
