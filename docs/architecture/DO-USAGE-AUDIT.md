# Durable Objects Usage Audit (Color Chain / Sketch Chain)

**Date:** 2026-08-08  
**Repos:** `White-Studio-Website` (Worker + Fly rooms) + `White-Studio-Website-Games` (frontend)  
**Production transport (code-confirmed):** Fly.io `https://rooms.white-studio.org`  
**Worker room paths when `GAMES_ROOMS_BACKEND=fly`:** HTTP **410** `rooms_moved`  
**⚠️ Exact Cloudflare production quota cause requires Dashboard confirmation.**

---

## 0. End-to-end flow

```text
Browser (games.white-studio.org)
  ↓  meta ws-rooms-origin → https://rooms.white-studio.org  (default)
  ↓  optional ?rooms= / ws-rooms-origin → api.white-studio.org (DO canary)
Games frontend (room-client.js → color-chain|sketch-chain net.js)
  ↓  POST /api/games/{game}/rooms | …/join
  ↓  WS  /api/games/{game}/rooms/{code}/ws?playerId&token
Room service
  ├─ Fly: website-games-rooms (in-memory)     ← production
  └─ Worker → Durable Object stub             ← legacy / canary when enabled
       ↓
     ColorChainRoom | SketchChainRoom
       ↓
     engine.js (authoritative rules)
```

---

## 1. Durable Object inventory

| Class | Binding | Migration | Storage | Routes (Worker) | Production status |
|-------|---------|-----------|---------|-----------------|-------------------|
| `ColorChainRoom` | `COLOR_CHAIN_ROOMS` | `v1-color-chain` (`new_sqlite_classes`) | SQLite DO, key `"state"` | `/api/games/color-chain/rooms*` | **Deployed, idle** unless backend=`do` / `COLOR_CHAIN_ROOM_TRANSPORT=do-v2` |
| `SketchChainRoom` | `SKETCH_CHAIN_ROOMS` | `v1-sketch-chain` | SQLite DO, key `"state"` | `/api/games/sketch-chain/rooms*` | **Deployed, idle** unless `GAMES_ROOMS_BACKEND=do` |

| Item | Location |
|------|----------|
| DO classes | `website-worker/src/games/{color,sketch}-chain/room.js` |
| Engines | `website-worker/src/games/{color,sketch}-chain/engine.js` |
| HTTP→DO | `website-worker/src/games/{color,sketch}-chain/routes.js` |
| Backend switch | `website-worker/src/games/rooms-backend.js` |
| Games router | `website-worker/src/games/routes.js` (410 when not DO) |
| Wrangler | `website-worker/wrangler.toml` (`GAMES_ROOMS_BACKEND = "fly"`) |
| Fly rooms | `website-games-rooms/` → `rooms.white-studio.org` |

**Reachable confirmation:** With committed production vars, Worker does **not** stub-fetch DOs for room traffic; it returns 410. Clients use Fly meta origin. Local `.dev.vars` may set `GAMES_ROOMS_BACKEND=do` — local only.

---

## 2. Client request audit

Shared transport: `assets/js/multiplayer/room-client.js`.

| Logical op | Color Chain | Sketch Chain |
|------------|-------------|--------------|
| Create | POST `/rooms` + WS + `session:hello` (3) | + `room:rejoin` (4) |
| Join | POST `/join` + WS + `session:hello` (3) | + `room:rejoin` (4) |
| Page restore | POST `/join` (token) + WS + hello (3) | + `room:rejoin` (4) |
| Mid-session WS drop | WS + hello (2) | + `room:rejoin` (3) |
| HTTP `/state` | **0** (unused) | **0** |

**Amplification notes**

- Join = REST membership + WS session (necessary for auth + realtime).
- Sketch double-signals recovery (`session:hello` + `room:rejoin`).
- `connect()` previously did **not** close prior sockets → parallel CONNECTING/OPEN risk (fixed in DO v2 client pass).

---

## 3. Heartbeat audit

| Layer | Finding |
|-------|---------|
| Client | **No** application `ping` / interval heartbeat |
| Server | Reactive `ping` → `pong` only (no load/save) |
| Protocol ping | Cloudflare runtime auto pong; does **not** wake DO JS |
| Target | `application heartbeat = 0` — already met on client |

Defense-in-depth DO v2: `setWebSocketAutoResponse` for exact `{"type":"ping"}` so even app-level ping need not wake JS.

---

## 4. Storage amplification (legacy DO)

Single blob key `"state"`. Pattern: **every mutating event** → `get` + `put` + often `setAlarm` + full broadcast.

### Color Chain (legacy)

| Event | gets | puts | alarm | broadcast |
|-------|-----:|-----:|-------|-----------|
| create | 1 | 1 | rewrite/delete | none |
| join | 1 | 1 | none | `room:state` × N |
| WS connect | 1 | 1 | none | hello + snapshots + `room:state` all |
| configure / start / action | 1 | 1 | rewrite | `broadcastAll` (room + personal × humans) |
| ping | 0 | 0 | — | pong |
| disconnect | 1 | 1 | rewrite | `room:state` |
| **bot step** (× ≤24) | 1–2 | 1 | rewrite | `broadcastAll` |
| alarm timeout | 1+ | 0–1+ | rewrite | maybe + bot loop |

**Worst path:** human action → save + alarm + full broadcast → `runBotLoop` with `await sleep(1350)` × N → each step another full put + broadcast while DO **stays awake**.

### Sketch Chain (legacy)

Same get/put-per-event pattern; **draw submit** persists ≤ ~600KB JPEG dataURL inside `"state"`; reveal broadcasts full image chains. **Do not migrate Sketch to DO until Color Chain DO v2 is stable + asset-ref design exists.**

---

## 5. Alarm audit (legacy)

`scheduleAlarm(state)` always `deleteAlarm` or `setAlarm(min(deadlines))` after mutations — **no dedupe** against current alarm timestamp. Deadlines: turn/round, disconnect+90s, idle lobby+2h. Color also rewrote alarm after every bot step.

---

## 6. Broadcast audit (legacy)

| Helper | Payload |
|--------|---------|
| `broadcastRoom` | Full `room:state` / `publicRoomView` |
| `broadcastAll` (Color) | Full room + per-seat `personalGameView` (`game:state` with full `myHand`) + optional `game:end` |
| Sketch extras | progress deltas + reveal with full image chains |

Tiny state change → full personal snapshots to every human (correct but heavy). Target incremental: JOIN/RECONNECT = snapshot; normal action = compact delta when safe. DO v2 keeps authoritative full `game:state` for correctness, adds `seq`, skips redundant lobby `room:state` during play when personal views already carry seat counts.

---

## 7. Reconnect audit (legacy client)

- Backoff: `[1500, 3000, 6000, 10000, 15000]` — no jitter, no `navigator.onLine` gate.
- `connect()` could orphan sockets (no close-before-open).
- Target: max 1 CONNECTING + 1 OPEN; backoff `1s…30s` + jitter; pause when offline.

---

## 8. Bot runtime audit (Color legacy)

`runBotLoop` + `sleep(BOT_THINK_MS=1350)` holds the DO invocation awake for `n × 1.35s` of pure waiting. Hibernation cannot start mid-loop. **Primary duration amplification.**

DO v2: alarm-driven one-step bot continuation (`botContinueAt`); no `sleep` wait loop.

---

## 9. Sketch payload audit

Client export: JPEG q=0.7, max width 800 (`stage.js`). Server/docs cap ~600_000 chars dataURL. **Must use asset storage + room metadata before Sketch DO return.** Out of scope for Color Chain canary.

---

## 10. Major quota amplification mechanisms (code-level)

1. **Bot `sleep` loops** — billable duration while idle-thinking  
2. **`storage.get` on every WS message** — no in-memory cache across messages in same wake  
3. **`storage.put` of full room blob on every mutation + every bot step**  
4. **Alarm rewrite without dedupe** after nearly every event  
5. **Full snapshot fan-out** (`broadcastAll`) including redundant `room:state` during play  
6. **Sketch dataURL in room state** (Sketch only — not migrated)  
7. **Client reconnect storm / duplicate sockets** (fixed client-side)

Not primary (already good): application heartbeat (none); Hibernation API already used (`acceptWebSocket`).

---

## 11. DO v2 acceptance targets

| Scenario | Target |
|----------|--------|
| Idle connected room | heartbeat 0/min; storage write 0/min; no tick; DO can hibernate |
| One human action | one process cycle; persist once; compact/required broadcast; bots via alarms not sleep |
| Canary | Color Chain only; Fly remains rollback |

See `DO-V2-BENCHMARK.md` for estimated vs measured scenario numbers.
