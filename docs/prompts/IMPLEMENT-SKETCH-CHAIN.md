# Prompt: Implement Sketch Chain（傳畫本）— 團康遊戲

貼給 Cursor Agent，依序執行各 Phase。完整規格見企劃書與 Demo；架構見 [`docs/SKETCH-CHAIN.md`](../SKETCH-CHAIN.md)。

---

## 給 Cursor 的主 Prompt（開工前整段貼上）

```text
## Goal

在 White Studio Games 上線「傳畫本」（game-id: `sketch-chain`）—— Gartic Phone 式你畫我猜接龍，支援 2–8 人同房、Worker Durable Object 權威狀態、全自動 Reveal 播放。

本遊戲與四色接龍（color-chain）、未來 Uno 歸類為 **團康遊戲（party）**。v1 **不要**實作排行榜或交分 API。

## Repos

| Repo | 用途 |
|------|------|
| `NaLuworld/White-Studio-Website-Games` | 前端 `games/sketch-chain/`、Hub 團康區、i18n、OG |
| `NaLuworld/White-Studio-Website` → `website-worker` | DO room、REST、WebSocket、R2 存圖、catalog |

## 規格來源（實作前必讀）

1. 企劃：`你畫我猜 多人連線企劃書.md`（玩法、Socket 事件命名、Reveal 時間軸、房主畫畫時間）
2. Demo：`pictionary.html`（三畫面 UI、畫布、Reveal 聊天串邏輯——移植時保留 Pointer Events / lock-scroll / min-height:0 捲動結構）
3. 對照實作：`games/color-chain/` + `website-worker/src/games/color-chain/`（房間 REST/ws 契約）
4. 平台約束：`docs/prompts/ADD-GAME-TO-GAMES-PLATFORM.md`、`docs/design/WHITE-STUDIO-SHARED-UI.md`、`docs/i18n/GAMES-I18N.md`

## 玩法摘要（與一般你畫我猜不同）

- N 人 → N 輪；第 0 輪全員同時寫題（60s）；之後文字↔圖畫交替。
- 玩家 p 在第 i 輪處理接龍 `(p + i) % N`；每輪只看上一筆 prompt。
- 全員交齊立刻下一輪；逾時自動代交空白。
- 結束後伺服器算好 `revealSequence` + 絕對時間戳，一次 `game:reveal_start` 廣播；客戶端對齊播放。

## Hard constraints

1. **後端**：Cloudflare Worker + Durable Object + WebSocket（禁止另架 Socket.IO 主機）。
2. **排行榜**：v1 跳過——遊戲頁不 mount leaderboard、Worker 不新增 scores 路由。
3. **主題**：遊戲本體 **淺色**（`color-scheme: light` + Demo CSS 變數）；Hub 仍 dark。遊戲頁可用沉浸式殼隱藏 footer，但保留返回大廳。
4. **手機畫畫**：完整保留 Demo 的 `pointerdown/move/up`、`setPointerCapture`、`touch-action:none`、`body.lock-scroll`、全域 `touchmove` prevent。
5. **Reveal**：`SPLASH_MS=5000`、`IMAGE_DELAY_MS=3000`、`GROUP_HOLD_MS=4000`；無手動上一則/下一則。
6. **房主畫畫時間**：大廳滑桿 60–600s（步進 30s），預設 300s；僅房主可改，同步全房；伺服器驗證 30–900s。
7. **i18n**：所有玩家可見字串 `zh-Hant` + `en`。
8. **game-id** `sketch-chain` 永久不變。

## Acceptance

- [x] Hub 有「團康遊戲」區；`sketch-chain` 與 `color-chain` 卡片在該區（Snake 仍在街機區）
- [ ] 2+ 瀏覽器可開房、加入、完成 N 輪、Reveal 內容與進度一致（需手動壓測）
- [ ] 手機可畫畫且不捲動整頁；Reveal 聊天串自動捲到最新（需手動壓測）
- [x] 斷線重連（playerToken）、房主轉移、逾時代交
- [x] Catalog 列出遊戲，`category: party`，無排行榜 UI
- [x] OG / Twitter Card + `assets/images/games/sketch-chain/icon.png`
- [x] Worker 單元測涵蓋輪替公式與 reveal 序列生成
```

---

## Phase 0 — 準備與資產遷入

**範圍**：Games repo only

- [x] 從 `pictionary.html` 抽出 CSS → `games/sketch-chain/game.css`（淺色主題獨立，不污染 `ws-shared` dark tokens）
- [x] 抽出 JS 模組建議：
  - `net.js` — REST + WebSocket（對齊 `color-chain/net.js` 命名）
  - `lobby.js` — 建立/加入/分享連結/房主設定
  - `stage.js` — write / draw / guess + 畫布
  - `reveal.js` — `playRevealStep` 邏輯（資料改吃伺服器 sequence）
  - `game.js` — 啟動與 phase 切換
- [x] `index.html`：hostname guard、`ws-api-origin`、OG meta、平台 header（可玩時隱藏）、**不**掛 `leaderboard-ui.js`
- [x] 複製 Demo 到 repo 時刪除 `fillMockEntries`、`add-mock-player-btn`、假玩家邏輯
- [x] 新增 `assets/images/games/sketch-chain/icon.png`（1024² placeholder OK）
- [x] `assets/images/og/manifest.json` 新增條目 → `python scripts/compose_og_cards.py`
- [x] `_redirects`：`/games/sketch-chain` → `/games/sketch-chain/` 301

**驗收**：本地靜態打開頁面，Lobby UI 正常；尚未連線時顯示連線錯誤提示即可。

---

## Phase 1 — Hub「團康遊戲」分類

**範圍**：Games repo — `index.html`、`assets/i18n/*.json`、`assets/css/games-chrome.css`（若需區塊樣式）

- [x] 將 `#cabinets` 拆成兩區（或兩個 grid）：
  - **街機**（arcade）：Snake 等高分遊戲
  - **團康遊戲**（party）：`color-chain`、`sketch-chain`（未來 `uno` 同區）
- [x] i18n 新增例：
  - `hub.section_arcade_title` / `hub.section_party_title`
  - `hub.section_party_lede`
  - `hub.card_sketch_chain_*`（eyebrow / title / body / meta）
- [x] 卡片 meta 寫「即時多人」而非「排行榜」
- [x] （可選）`games-api` catalog 若回傳 `category`，前端依 category 分組；否則 v1 手動維護兩區 HTML

**驗收**：Hub 視覺上兩區清晰；雙語切換正常。

---

## Phase 2 — Worker 房間骨架

**範圍**：`website-worker`

對照 `color-chain` 目錄結構新增：

```
src/games/sketch-chain/
  engine.js          # 純函式：stageType、chainForPlayer、reveal 序列
  room.js            # SketchChainRoom DO class
  routes.js          # HTTP: create / join
  ws.js              # WebSocket upgrade handler
  codes.js           # 4 碼房號（排除 0/O、1/I）
```

- [x] `wrangler.toml`：binding `SKETCH_CHAIN_ROOMS` → `SketchChainRoom`；migration `v1-sketch-chain`
- [ ] R2：`SKETCH_CHAIN_IMAGES` bucket（v1 改用 DO 內 JPEG dataURL，≤600KB）
- [x] REST：
  - `POST /api/games/sketch-chain/rooms` → `{ code, playerId, playerToken }`
  - `POST /api/games/sketch-chain/rooms/:code/join`
- [x] WS：`GET /api/games/sketch-chain/rooms/:code/ws?playerId=&token=`
- [x] 房間狀態 `lobby`；廣播 `room:state`（不含他人答案）
- [x] `playerToken` 存 localStorage；支援 `room:rejoin`
- [x] 單元測：`chainForPlayer(p,i,N)`、`stageType(i)`、`buildRevealSequence(chains)`

**驗收**：兩分頁 REST 建房 + WS 連上，玩家列表同步；`npm test` 通過。

---

## Phase 3 — 前端連線層

**範圍**：Games `games/sketch-chain/net.js` + `lobby.js`

- [x] 鏡像 `ColorChainNet` API：`createRoom`、`joinRoom`、`connect`、`send`、`on/emit`、自動重連
- [x] localStorage keys：`ws_sketch_chain_nick`、`ws_sketch_chain_token`、`ws_sketch_chain_code`、`ws_sketch_chain_player_id`
- [x] 分享連結：`/games/sketch-chain/?room=CODE`
- [x] Lobby：暱稱、房號顯示/複製、玩家列表、房主「開始遊戲」
- [x] 房主滑桿 `drawDurationSec`：`room:configure`；非房主唯讀顯示
- [x] 監聽 `room:state`、`room:error`

**驗收**：兩瀏覽器同房，大廳玩家列表與畫畫時間同步。

---

## Phase 4 — 寫題目輪（round 0）

**範圍**：Worker engine + 前端 stage

- [x] `game:start` payload `{ drawDurationSec }`；`roundTotal = players.length`
- [x] `round:start` 個人化：`{ roundNow, roundTotal, stageType: "write", deadlineAt, prompt: null }`
- [x] `round:submit` `{ content: { type:"text", text } }`
- [x] `submittedThisRound`；全員齊 → `round:all_done` → 下一輪
- [x] 伺服器逾時 60s；未交 → 空白文字
- [x] 前端：`enterStage` 改聽 `round:start`；計時用 `deadlineAt` 不算本地固定秒數
- [x] `round:player_submitted` → waiting overlay 顯示「x/N 已完成」

**驗收**：2 人房，兩邊寫題後自動進 round 1（即使只實作 draw 佔位也可）。

---

## Phase 5 — 畫畫輪 + 圖片儲存

- [x] `stageType(1)` = `draw`；`roundDurationSec = room.drawDurationSec`
- [x] `prompt` 只含上一筆 `{ type:"text", text, authorName }`
- [x] 前端送出前壓縮：max 寬 800px、JPEG q≈0.7
- [x] 上傳路徑 v1：**A** `round:submit` 內 JPEG dataURL（≤600KB）
- [ ] **B（後續）**：`POST .../upload` 得 URL，再 `round:submit { imageUrl }`
- [x] DO 存 `chains[c]` 條目 `{ type:"image", dataURL, authorId, authorName }`
- [x] 前端：完整移植 Demo 畫布（`setupCanvas`、`resizeCanvas`、`exportCanvas`）

**驗收**：一人畫完，另一人 round 2 能看到該圖（仍看不到完整 chain 歷史）。

---

## Phase 6 — 猜圖輪 + 完整狀態機

- [x] `stageType` 偶數輪（≥2）= `guess`；`GUESS_DURATION_SEC` = 60s
- [x] 交替直到 `roundNow === roundTotal - 1` 結束
- [x] 每輪驗證：玩家只能提交自己該 chain 的內容；拒絕非法 chain index
- [x] 房主斷線 → 轉移 `hostId` 給下一在線玩家

**驗收**：3 人房完整跑完 N 輪，chains 在伺服器完整、客戶端仍看不到別組內容。

---

## Phase 7 — Reveal（伺服器驅動）

- [x] 伺服器 `buildRevealSequence(chains, players)` 對齊 Demo：
  - `{ type:"splash" }`
  - 每組 `{ type:"group", chainIndex, isFirstOfChain, entries[], startIndex }`
- [x] 為每一步算 `revealAt`（ms timestamp）：splash 5s；group 內文字 instant、圖 +3s、停留 +4s
- [x] `game:reveal_start` `{ sequence: RevealStepWithTime[] }`
- [x] 前端 `reveal.js`：用 `Date.now()` 對齊 `revealAt` 播放
- [x] 保留 `#screen-reveal` 固定高度 + `.reveal-stage { min-height:0; overflow-y:auto }` + `scrollTop = scrollHeight`
- [x] 結束：「全部公開完畢」+「再玩一輪」→ 回 lobby、清空 chains

**驗收**：兩裝置 Reveal 同一秒切換；聊天串自動捲動。

---

## Phase 8 — 邊界、Catalog、上線

- [x] 斷線重連：補發當輪 `round:start` 若未交；已交則 `round:waiting`
- [x] 房間人數 2–8；滿房拒絕 join
- [x] Catalog `GAMES_CATALOG` 新增 `sketch-chain`（`category: party`, `leaderboard: false`）

```js
{
  id: "sketch-chain",
  title: "傳畫本",
  titleEn: "Sketch Chain",
  summary: "...",
  path: "/games/sketch-chain/",
  category: "party",
  leaderboard: false,
  maxScore: 0, // 或省略 scores
}
```

- [x] `color-chain` catalog 加 `category: "party"`（若尚未有）
- [x] Naru tips：`naru.tip_sketch_chain_*` 大廳 / 畫畫 / reveal
- [ ] 更新 `docs/SKETCH-CHAIN.md`、`README.md`
- [x] Deploy Worker（`api.white-studio.org` Version `0c6a3390`）
- [ ] push Games `main`（前端 reconnect 等變更尚未 push）
- [ ] Live：兩手機 + 一桌機 4–8 人壓測

---

## 資料結構（前後端共用契約）

```ts
type RoomStatus = "lobby" | "in_round" | "revealing";

interface Player {
  id: string;
  name: string;
  avatar: string;   // emoji 或未來 skin
  color: string;
  isHost: boolean;
  connected: boolean;
}

interface ChainEntry {
  type: "text" | "image";
  text?: string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
}

interface RoomPublic {
  code: string;
  hostId: string;
  status: RoomStatus;
  roundTotal: number;
  roundNow: number;
  drawDurationSec: number;
  players: Player[];
  submittedCount?: number;
  revealStartedAt?: number;
}

// 輪替（必須與 engine 單元測一致）
function chainForPlayer(playerIndex: number, roundIndex: number, n: number) {
  return (playerIndex + roundIndex) % n;
}
function stageType(roundIndex: number) {
  if (roundIndex === 0) return "write";
  return roundIndex % 2 === 1 ? "draw" : "guess";
}
```

## Socket / WS 訊息（JSON `type` 欄位）

### Client → Server

| type | payload |
|------|---------|
| `room:configure` | `{ drawDurationSec }`（僅房主、lobby） |
| `game:start` | `{ drawDurationSec }`（僅房主） |
| `round:submit` | `{ content: { type, text?, imageUrl? } }` |
| `room:rejoin` | `{ playerToken }` |

### Server → Client

| type | payload |
|------|---------|
| `room:state` | `RoomPublic` |
| `room:error` | `{ message }` |
| `round:start` | `{ roundNow, roundTotal, stageType, deadlineAt, prompt?: ChainEntry }` |
| `round:player_submitted` | `{ playerId, submittedCount, totalCount }` |
| `round:all_done` | `{}` |
| `game:reveal_start` | `{ sequence, revealStartedAt }` |

**安全**：進行中絕不廣播完整 `chains`；`prompt` 僅目標玩家收到（個人化 WS 或 filter）。

---

## 前端移植清單（Demo → 連線版）

| Demo 函式 | 動作 |
|-----------|------|
| `fillMockEntries` | **刪除** |
| `enterStage(i)` | 改由 `round:start` 觸發 `renderStageBody` |
| `startTimer(sec)` | 改 `deadlineAt` 倒數 |
| `submitFn` | `net.send({ type:"round:submit", content })` |
| `advance()` | 僅在 `round:all_done` 後由伺服器推下一輪 |
| `buildRevealSequence` | **伺服器算**；客戶端只播放 |
| `playRevealStep` / `appendChatBubble` | **保留** |
| `setupCanvas` 等 | **原樣保留** |
| `showScreen` + `lock-scroll` | **原樣保留** |

---

## 團康遊戲 vs 街機遊戲（產品決策紀錄）

| | 街機（arcade） | 團康（party） |
|--|----------------|---------------|
| 範例 | Snake | color-chain、sketch-chain、未來 uno |
| 排行榜 | 有 | **v1 無** |
| 單局目標 | 高分 | 社交娛樂、接龍笑點 |
| Hub 區塊 | 街機機台 | 團康遊戲 |
| Catalog | `category: "arcade"` | `category: "party"` |

---

## 建議 Cursor 會話切割

| 會話 | Phase | 預估 |
|------|-------|------|
| 1 | 0 + 1 | 前端殼 + Hub 分類 |
| 2 | 2 | Worker 骨架 + 測試 |
| 3 | 3 + 4 | 連線 + 寫題輪 |
| 4 | 5 + 6 | 畫畫/猜圖 + 狀態機 |
| 5 | 7 + 8 | Reveal + 邊界 + 上線 |

每個會話結束跑：`npm test`（Worker）、靜態手動測兩分頁。

---

## 風險與 ⚠️ 假設

- ⚠️ Uno 尚未在 repo；Hub 僅預留區塊與 catalog 欄位，不實作 Uno。
- ⚠️ R2 公開 URL 需 Worker 簽名或 public bucket 政策——實作時確認既有 Worker 慣例。
- ⚠️ 猜圖輪秒數企劃寫「依需求」；v1 建議 **60s**，寫入 engine 常數以便日後調整。
- 淺色遊戲頁與 dark 平台 header 並存時，檢查 header 文字對比；必要時遊戲進行中隱藏 header（對齊 color-chain `is-cc-playing`）。
