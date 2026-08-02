# White Studio Games — 遊戲開發規範書

> **給誰看：** 負責產出「完整遊戲企劃書」的開發者（及其 Agent）  
> **你們的交付物：** 企劃書，不是程式碼  
> **誰實作：** NaLuWorld 收到合格企劃後，用 Cursor 在 `White-Studio-Website-Games`（+ 必要時 Worker）落地  
> **產品：** https://games.white-studio.org/  
> **本文件角色：** 告訴你「企劃要寫到什麼粒度、必須預留哪些節點」，好讓實作端一次接得住

---

## 0. 協作方式（必讀）

```
NaLuWorld
  └─ 提供本規範書（平台約束 + 企劃必填項 + 皮膚/排行榜預留）
       ↓
開發者（+ 自己的 Agent）
  └─ 產出「完整遊戲企劃書」（見 §11 模板 / docs/templates/GAME-DESIGN-BRIEF.md）
       ↓
NaLuWorld 審核企劃是否可實作
       ↓
Cursor 依企劃實作遊戲（前端 + Catalog / 分數 API 等）
```

| 角色 | 負責 | 不負責 |
|------|------|--------|
| **開發者** | 玩法、數值、關卡節奏、美術方向、皮膚商品規劃、排行榜呈現需求、驗收標準 | 直接改 Games repo / 部署 Worker（除非 NaLuWorld 另約） |
| **NaLuWorld + Cursor** | 依合格企劃實作頁面、API、素材接入、上線 | 替開發者腦補未寫清的玩法或商品規則 |

**合格企劃 = 另一位工程師（或 Agent）不需再問玩法細節，就能開工。**  
模糊、缺皮膚節點表、缺分數定義、缺排行榜規則的企劃會被退回補齊。

---

## 1. 平台現況（寫企劃時必須對齊）

企劃不必寫實作程式，但**不可設計與下列現實衝突**的系統（除非標成「需產品決策的例外」）。

| 項目 | 現況 | 對企劃的含義 |
|------|------|----------------|
| 前端 | 靜態 HTML + Vanilla JS + CSS（Canvas2D 迷你遊戲） | 優先設計「短局、清晰回饋」的街機小品；超大型 3D/引擎需標例外 |
| 託管 | Cloudflare Pages → `games.white-studio.org` | 資源以靜態資產為主 |
| 後端 | Worker + D1：目錄、guest 分數、Discord 身分 | 分數目前是單一 `number` + 暱稱；進階欄位要在企劃裡**明講需求** |
| 已上線 | `snake` | 結構參考，新遊戲企劃可對照其體驗密度 |
| 開放大廳 | 不登入可玩、可交分 | **不可**把「必須買皮才能玩」當核心；皮膚是加值 |
| Discord | 可選身分 | 未來 Marketplace / 已購皮膚綁定身分時，企劃需區分「訪客」與「已登入」行為 |
| 雙語 | `zh-Hant` + `en` | 企劃內所有玩家可見文案給中英稿（或明確標「實作時翻譯」的英文草案） |
| game-id | 小寫 kebab-case，永久 | 企劃第一欄就要定死 `id` |

細節子文件（實作端用，開發者可當附錄）：

- [`architecture/GAMES-PLATFORM.md`](./architecture/GAMES-PLATFORM.md)
- [`design/WHITE-STUDIO-SHARED-UI.md`](./design/WHITE-STUDIO-SHARED-UI.md)
- [`i18n/GAMES-I18N.md`](./i18n/GAMES-I18N.md)
- [`prompts/ADD-GAME-TO-GAMES-PLATFORM.md`](./prompts/ADD-GAME-TO-GAMES-PLATFORM.md)（實作 checklist，非企劃模板）

---

## 2. 產品硬性原則（企劃不可違反）

1. **任何人都能玩預設內容。** 遊玩與交分數不得綁死 Discord 或付費。  
2. **皮膚 / Marketplace 是加值，不是關卡鎖。** 未擁有皮膚時必須有完整可玩的 **default skin pack**。  
3. **預設外觀與付費外觀在玩法數值上必須對等**（禁止 Pay-to-Win：更粗判定、更高分倍率等）。  
4. **Navbar / 品牌 chrome** 維持平台規範；遊戲內 UI 文案走雙語。  
5. **分數權威在伺服器。** 企劃須定義單一主分數公式與上限；禁止「只存在客戶端、無法交榜」的核心目標卻宣稱有排行榜。  
6. **Naru 只教不擋。** 若需要第一次引導，企劃列出 tip 文案與時機，不可設計強制擋操作的教學牆（除非標例外並經 NaLuWorld 同意）。  
7. **每個會顯示的遊戲物件都要可換皮**（見 §4）。漏列節點 = 企劃不完整。

---

## 3. 路線圖：街機 Marketplace（皮膚商店）— 企劃必納入

> **產品方向：** 每個街機遊戲將規劃獨立（或共用入口、按遊戲分櫃）的 Marketplace，讓玩家購買／裝備皮膚。  
> **現況：** 商店與庫存 API **尚未上線**。企劃仍必須把皮膚當一等公民來設計，好讓 v1 實作就預留替換點，避免日後整包重寫。

### 3.1 企劃必須回答的商店問題

| 問題 | 企劃要寫清楚 |
|------|----------------|
| 賣什麼 | 皮膚包 / 單件 / 特效 / 排行榜頭像框……清單與 `skinId` |
| 誰能買 | 訪客僅瀏覽？購買是否要求 Discord（或未來帳號）？ |
| 貨幣 | 法幣 / 平台幣 / 僅展示「即將推出」——須標階段（v1 預留 vs v1 販售） |
| 裝備位置 | 大廳預覽、局內、排行榜列、結算畫面各顯示哪些皮膚欄位 |
| 預設 | `skinId: "default"` 的完整內容；未登入／未購買時的行為 |
| 公平 | 聲明：皮膚不影響判定、分數公式、掉落率等 |

### 3.2 實作預留原則（寫進企劃「技術預留」段即可）

企劃應要求實作端遵守：

1. **所有可視節點經 Skin Resolver：** `resolveVisual(nodeId, equippedSkinId) → 資源鍵`，禁止把唯一貼圖路徑寫死在玩法邏輯裡。  
2. **皮膚資料與玩法邏輯分離：** 顏色、sprites、SFX、粒子、trail 放在 skin pack 描述；碰撞／分數只讀 gameplay config。  
3. **Default pack 必須完整可玩**，不依賴 Marketplace API。  
4. **裝備狀態** 預留：本機暫存（訪客預覽）+ 未來伺服器庫存（已登入）；企劃需寫兩種模式下的 UX。  
5. **排行榜列** 預留顯示欄位：至少 `equippedSkinId` 或 `showcaseSkinId`（見 §5），即使 v1 API 先回 `null`。

---

## 4. 皮膚節點表（每個遊戲企劃的核心附件）

開發者必須提交 **Skin Node Inventory**：列出所有「將來可能被皮膚替換」的物件節點。  
沒有這張表，企劃視為未完成。

### 4.1 節點定義

| 欄位 | 說明 |
|------|------|
| `nodeId` | 穩定 id，kebab 或 snake，終身不改（例：`player.body`, `food.orb`, `fx.eat_burst`） |
| 類型 | `sprite` / `color` / `animation` / `particles` / `audio` / `shader-tint` / `ui-frame` / `board-badge` … |
| 預設資源描述 | default pack 長什麼樣（可用文字 + 參考圖說明） |
| 可被皮膚覆寫？ | 是／否（若否，說明為什麼永遠固定） |
| 出現場景 | `in-game` / `hud` / `overlay` / `hub-cabinet` / `leaderboard-row` / `marketplace-preview` |
| 備註 | 層級、混合、是否允許多皮膚疊加等 |

### 4.2 最低覆蓋（依遊戲類型勾選，但「有畫出來的東西」原則上都要列）

- 玩家／操控主體（每段、每個配件分開列，若可單件賣）  
- 敵方／障礙／道具／食物  
- 場景背景、場地邊框、網格／軌道  
- 吃到／受傷／通關等 **VFX**  
- 關鍵 **SFX**（若企劃有聲音）  
- HUD 裝飾（分數板外框、進度條造型——注意：數字本身通常不換皮）  
- 結算／Game Over 面板裝飾  
- **排行榜列裝飾**（頭像框、名稱色、列背景、排名徽章）  
- Hub 機台螢幕預覽用的代表視覺（若與局內皮連動）

### 4.3 範例（Snake 方向，示意）

| nodeId | 類型 | 預設 | 可覆寫 | 場景 |
|--------|------|------|--------|------|
| `snake.head` | color/sprite | 品牌霓虹紫塊 | 是 | in-game, marketplace-preview |
| `snake.body` | color/sprite | 同系紫 | 是 | in-game |
| `food.orb` | color/sprite | 亮咬一口 | 是 | in-game |
| `fx.eat` | particles | 短火花 | 是 | in-game |
| `stage.grid` | color | 暗網格 | 是 | in-game |
| `board.row_frame` | ui-frame | 無／細線 | 是 | leaderboard-row |
| `board.name_tint` | color | token 文字色 | 可選 | leaderboard-row |

企劃應附上「建議販售的皮膚包」列表：每個 `skinId` 覆寫哪些 `nodeId`、稀有度、價格欄位（可先寫「TBD／展示用」）、商店卡文案中英。

---

## 5. 排行榜系統（企劃必寫，含皮膚預留）

### 5.1 現況（寫企劃時的真實約束）

| 項目 | 現況 |
|------|------|
| 提交 | `POST { playerName, score }` |
| 讀取 | 依分數排序的列表（guest 暱稱） |
| Catalog | Worker `GAMES_CATALOG` 需有該 `gameId` + `maxScore` |
| 身分 | Discord 可選；分數列目前**不**綁死 Discord id |

### 5.2 企劃必須定義的排行榜規則

1. **主分數：** 唯一 number 的計算公式（逐步加分、倍率、上限）。  
2. **maxScore：** 建議伺服器上限與「理論極限局」說明（防灌榜敘事）。  
3. **提交時機：** 何時允許交榜（死亡、通關、主動提交）；是否允許同一局重送。  
4. **同分：** 接受平台預設（分數 desc、時間 asc）或提出產品需求。  
5. **顯示列：** 名次、暱稱、分數、時間——以及**皮膚相關欄位**（下表）。  
6. **反作弊敘事：** 企劃層面可接受的防護（僅 maxScore / 之後 replay——標階段即可）。  
7. **與 Marketplace 關係：** 排行榜是否展示裝備皮；未登入高分者顯示 default。

### 5.3 排行榜 × 皮膚（必須預留在企劃）

即使 v1 只做 guest 暱稱分，企劃仍需規定未來資料形狀，例如：

```text
LeaderboardEntry (目標形狀)
- rank
- playerName
- score
- createdAt
- discordUserId?          // 可選，已登入時
- showcaseSkinId?         // 該列展示用皮膚；null → default
- showcaseNodes?          // 可選：僅同步徽章類 node 的精簡資訊
```

企劃要寫清：

- 榜上展示的是「交分當下裝備皮」還是「目前裝備皮」  
- 訪客交分：`showcaseSkinId` 是否固定 `default`，或允許本機預覽皮上榜（產品選擇，須明示）  
- 皮膚是否出現在結算分享卡／OG（通常 OG 靜態，不隨皮變——若要變，標例外）

### 5.4 禁止在企劃中假設的事

- 假設已有完整付款與庫存 API（應寫「依賴 Marketplace 階段 2」）  
- 假設可用多維分數物件卻不定義伺服器欄位需求  
- 假設排行榜可拿來驗證「誰買過皮」卻不寫隱私／展示規則

---

## 6. 遊戲體驗與平台殼（企劃應對齊的體驗邊界）

| 區塊 | 企劃要描述 | 平台已有（實作端接） |
|------|------------|----------------------|
| Hub 機台卡 | 標題、短介紹、機台視覺方向 | `index.html` 卡片 + cabinet 圖 |
| 遊戲頁 HUD | 分數、狀態、按鈕文案；手機沉浸式 HUD | `.ws-game-hud` / `.arcade-play-bar` |
| 遊玩舞台 | 規則、操作、回饋、失敗／重開；Pointer + 可選虛擬鍵；背景自動暫停 | `.ws-game-stage` + canvas |
| 排行榜面板 | 文案、提交 UX、皮膚展示需求；手機卡片列 | `WhiteStudioLeaderboard` |
| 語系 | 無額外需求則寫「跟隨平台」 | i18n |
| Discord | 登入後要多做什麼（預填、未來庫存） | `ws_games_session` |
| Naru tip | 時機 + 中英文案 | Hub／可擴到遊戲頁 |
| OG 分享 | 標題、描述方向 | 靜態 OG 卡流程 |

視覺方向摘要：90s 日系街機 × White Studio 黑紫霓虹。詳見 Shared UI 文件。  
**遊戲 canvas 可有獨立調色；皮膚包仍應能融入該遊戲的視覺語言。**

---

## 7. 開發者交付物清單（Definition of Done — 企劃）

繳交企劃時請附（可用一份 MD／PDF + 圖檔包）：

| # | 交付物 | 必備 |
|---|--------|------|
| 1 | 完整企劃正文（依 §11 / 模板填滿） | ✅ |
| 2 | **Skin Node Inventory** 完整表 | ✅ |
| 3 | 建議皮膚包列表（含 default + ≥1 付費構想） | ✅ |
| 4 | 排行榜規則 + 皮膚展示規格 | ✅ |
| 5 | 所有玩家可見文案中英（或英稿+譯註） | ✅ |
| 6 | 操作說明（鍵鼠 + 觸控） | ✅ |
| 7 | 驗收標準（給實作端 QA） | ✅ |
| 8 | 參考圖／情緒板／節點示意（連結或附件） | 強烈建議 |
| 9 | 標註「需產品決策」的例外清單 | 若有則 ✅ |

**不完整即退回。** 尤其缺 §4 節點表或 §5 排行榜×皮膚者，不進入 Cursor 實作排程。

---

## 8. NaLuWorld 實作端會做的事（供開發者預期）

企劃通過後，實作端大致會：

1. 建立 `games/<id>/`（對齊 Snake 殼）  
2. 依節點表實作 default skin resolver  
3. 掛 Hub 卡、i18n、OG  
4. Worker `GAMES_CATALOG` 登記 + 分數 API  
5. 排行榜 UI 預留皮膚欄位（API 未就緒則安全降級 default）  
6. Marketplace UI／購買 API：依產品階段另開，**但局內換皮架構已依你的節點表就緒**

開發者若使用自己的 Agent：請把**本規範 + 企劃模板**丟給 Agent，產出物應是「填好的企劃書」，不是直接 PR 程式（除非 NaLuWorld 明確要求 code contribution）。

---

## 9. 命名慣例（企劃內統一）

| 種類 | 慣例 | 範例 |
|------|------|------|
| game id | kebab-case | `neon-runner` |
| skin id | kebab-case | `default`, `neon-fox-pro` |
| node id | dot 分段 | `player.head`, `fx.clear_line` |
| i18n 前綴 | `gameid.snake_case` | `neon_runner.start` |
| 商店商品 id | 可與 skin id 相同或 `sku.*` | 企劃內自洽即可 |

---

## 10. 常見退回原因

1. 只有玩法故事，沒有分數公式與 maxScore  
2. 沒有 Skin Node Inventory，或只寫「之後再換皮」  
3. 皮膚影響勝負／分數（Pay-to-Win）  
4. 未登入不能玩或不能交預設榜  
5. 排行榜完全沒提皮膚展示／降級行為  
6. 文案只有單語  
7. 操作在手機不可行卻宣稱「支援移動」  
8. 把未存在的支付 API 寫成 v1 必備卻無階段劃分  

---

## 11. 完整遊戲企劃書 — 大綱

請直接複製填寫：[`docs/templates/GAME-DESIGN-BRIEF.md`](./templates/GAME-DESIGN-BRIEF.md)

大綱結構如下（模板內有填空）：

1. 文件資訊（作者、game id、版本、狀態）  
2. 一句話賣點 + 目標體驗時長  
3. 核心循環與勝敗條件  
4. 操作（桌機／手機）  
5. 分數與排行榜（含皮膚欄位）  
6. **Skin Node Inventory** + 皮膚包／Marketplace  
7. 畫面與流程（Hub → 遊玩 → 結算 → 交榜 → 商店預留）  
8. 文案表（中英）  
9. Naru／新手引導  
10. 美術與音效方向  
11. 技術預留需求（給 Cursor 的明確要求）  
12. 分階段：v1 可玩 / v1.5 換皮資料 / v2 購買  
13. 驗收清單  
14. 開放問題與需 NaLuWorld 決策項  

---

## 12. 子文件地圖

| 文件 | 誰讀 |
|------|------|
| **本規範** | 開發者（主） |
| [`templates/GAME-DESIGN-BRIEF.md`](./templates/GAME-DESIGN-BRIEF.md) | 開發者填寫後交回 |
| `architecture/` `design/` `i18n/` | 實作端；開發者寫企劃時作約束參考 |
| [`prompts/ADD-GAME-TO-GAMES-PLATFORM.md`](./prompts/ADD-GAME-TO-GAMES-PLATFORM.md) | NaLuWorld / Cursor 實作時 |

---

## 13. 給開發者 Agent 的最短指令（可複製）

```text
你是 White Studio Games 的企劃助手。請依
docs/GAME-DEVELOPMENT-SPEC.md
與
docs/templates/GAME-DESIGN-BRIEF.md
產出「完整遊戲企劃書」，不要寫專案程式碼。
硬性要求：
- 開放大廳：不登入可玩、可交預設榜
- 禁止 Pay-to-Win
- 必須含完整 Skin Node Inventory（每個可視物件可換皮）
- 必須規劃 Marketplace 皮膚商品與 default pack
- 排行榜必須定義分數公式，並預留 showcaseSkinId 等展示欄位
- 玩家文案中英齊備
產出填好的 GAME-DESIGN-BRIEF 全文。
```
