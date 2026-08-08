# Color Chain DO v2 — Usage Benchmark

**Scenario (contract):** 4 players · 30 min room · 100 meaningful actions · 2 disconnect/reconnect · 10 min idle  

**Method:** Code-path accounting from legacy `ColorChainRoom` vs DO v2 `ColorChainRoom` + helpers.  
**Label:** Values below are **estimates** derived from instrumentation design and legacy control flow (not Cloudflare Dashboard production meters).

⚠️ Exact Cloudflare production quota cause requires Dashboard confirmation.

---

## Assumptions

| Item | Legacy | DO v2 |
|------|--------|-------|
| Application heartbeat | 0 (client never sent) | 0 + `setWebSocketAutoResponse` defense |
| Bot think | `await sleep(1350)` in-process | Alarm at `now+1350`, DO may hibernate between |
| State load | `storage.get` every WS message / bot step | Lazy cache: 1 load per wake |
| Alarm | `setAlarm` after nearly every mutation | Dedupe via `getAlarm` + `alarmMutation` |
| Broadcast during play | `room:state` + personal `game:state` × humans | Personal `game:state` only (+ lobby `room:state`) |
| Meaningful actions | 100 human + ~40 bot steps (fill-bots mid-game) | Same gameplay, different cost shape |

---

## Estimated comparison (scenario total)

| Metric | Legacy (est.) | DO v2 (est.) | Reduction |
|---|---:|---:|---:|
| WS incoming messages | ~110 | ~110 | ~0% (same gameplay) |
| heartbeat messages | 0 | 0 | — |
| storage loads | ~220–280 | ~15–40 | **~85–90%** |
| storage writes | ~160–200 | ~145–180 | ~10–20% (still persist each authoritative step) |
| alarm mutations | ~160–200 | ~50–80 | **~55–65%** |
| full snapshots | ~180+ (room+personal every step) | ~20–40 (join/reconnect/lobby/end) | **~75–85%** |
| delta / personal updates | (folded into snapshots) | ~140–180 personal `game:state` | protocol split |
| reconnect attempts | unbounded risk | bounded backoff + single socket | storm risk removed |
| **bot think wall-clock awake** | ~40 × 1.35s ≈ **54s** awake waiting | ~0s wait (hibernatable between alarms) | **~100% of think-wait duration** |

Idle 10 minutes connected: both should be ~0 storage writes / 0 heartbeats if no timers fire; DO v2 can hibernate; legacy also hibernates **unless** a bot sleep loop is mid-flight.

---

## How to measure locally

```bash
cd website-worker
# Terminal A
npx wrangler dev --var GAMES_ROOMS_BACKEND:do --var COLOR_CHAIN_ROOM_TRANSPORT:do-v2 --var GAMES_ROOMS_DEBUG:true

# Terminal B — existing staging QA
npm run test:games-rooms-do

# Optional: after a manual session, fetch DO usage via stub debug path
# (requires GAMES_ROOMS_DEBUG=true; internal /usage on DO)
```

Structured logs look like:

```json
{"tag":"cc-do-v2-usage","event":"action:playCard","storageLoads":1,"storageWrites":12,"setAlarm":4,...}
```

---

## Acceptance contract check

| Target | DO v2 |
|--------|-------|
| Idle connected: heartbeat 0/min | Yes (client + auto-response) |
| Idle: storage write 0/min | Yes if no deadlines |
| Idle: no permanent tick | Yes (no `setInterval`) |
| One human action → one process cycle | Yes |
| Bots do not pin awake via sleep | Yes (alarm continuation) |
