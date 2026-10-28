# r6-net-client — the net client: the relay connection, the room, the host's RaceConfig, the lockstep driver (SPEC §28)

## Plan
1. **config.ts** — `buildOnlineConfig(code, members, setup)`: the host's RaceConfig (track/weather/reverse from the
   setup, a random seed, traffic, level 2, the AI field = RACERS without the humans, `online.humans` in join order)
   + `parseStartConfig(raw)`: the config the relay forwards, validated. → `node tools/r4/tsc-own.mjs src/net/`
2. **client.ts** — `RelayClient`: the WebSocket, hello/welcome, the ping every 2 s, the Chinese error lines,
   the state (connecting → online / error / offline). → same tsc
3. **room.ts** — `RoomState`: the room from the relay's `room` messages (`you` = our member id) + the lobby
   commands (create/join/pick/ready/setup/leave). → same tsc
4. **lockstep.ts** — the tick queue, `frame(dtReal)`: the local input out (≤ 60/s, edges once), the ticks in
   (one per TICK_DT, catch up ≤ 8/frame, stall on an empty queue), the hashes every HASH_EVERY ticks. → same tsc
5. **index.ts** — `createNet(app)`: the NetSystem surface, the start (local slot → `flow:startRace`), `loaded`,
   `go`, `done`, `desync` (toast + quitRace), `end`, `leave`. → same tsc
6. **debug.ts** — `window.__br.net` (hashes / ticks / queued). → same tsc
7. **Acceptance** — `node tools/r6/net-client.mjs`, `node tools/r6/relay.mjs`, `node tools/core-check.mjs`.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/net/` → TSC-OWN OK
- `node tools/r6/net-client.mjs` → r6-net-client OK
- `node tools/r6/relay.mjs --port 8795` → r6-relay OK
- `node tools/core-check.mjs` → core-check OK
- `node shots/r6-net-client/probe.mjs` → r6-net-probe OK (the error paths: no relay, no room, the ping, leave())

## Done
- **src/net/index.ts** — `createNet(app)`: the whole NetSystem surface (`state` / `message` / `ping` / `room` /
  `onChange` / `connect` / `createRoom` / `joinRoom` / `pick` / `ready` / `setup` / `start` / `leave` / `frame`).
  The relay's `start` → the local slot (`humans.indexOf(our id)`) → `flow:startRace` with `online.local`; the
  `race` screen → `loaded`; `race:end` → `done`; `desync` → the toast 「联机不同步，比赛结束」 + `flow:quitRace`;
  the relay's `end` → the lobby; `leave()` → quit the race, `leave`, close, offline, no room.
- **src/net/client.ts** — the socket: `?relay=` → `VITE_RELAY_URL` → `ws://<host>:8790/ws`; hello/welcome (the
  member id), the ping every 2 s (the RTT in ms), the Chinese error lines (连接不上联机服务器 / 房间不存在 /
  房间满了 / 比赛已经开始 / 服务器断开了 …), the state (connecting → online / error / offline). Every socket gets
  a number, so the events of a replaced socket are ignored.
- **src/net/room.ts** — the lobby: the room from the relay's `room` messages (`NetRoom.you` = our member id) and
  the commands (create / join / pick / ready / setup / leave). The host's `start()` builds the config and sends
  `start { config, humans }` (the member ids in join order = the rider slots).
- **src/net/config.ts** — the host's config: the setup's track/weather/direction, a random seed, `traffic`,
  `level: 2`, the AI field (RACERS without the humans, shuffled, 8 − humans), `online.humans` in join order.
  `parseStartConfig` checks the config the relay forwards field by field.
- **src/net/lockstep.ts** — `frame(dtReal)`: the local input out (packed, the edges OR-ed since the last send and
  consumed after it, sent when it changed or an edge is pending, at least every 100 ms), the ticks in (a queue;
  one tick per TICK_DT of real time, ≤ 8 a frame to catch up, an empty queue stalls and banks at most one tick),
  `session.tick(...)` per tick, the state hash every HASH_EVERY ticks (sent to the relay, kept for the debug
  surface). It returns how many ticks ran.
- **src/net/debug.ts** — `window.__br.net` = `{ hashes(), ticks(), queued() }`.

## In progress / next
Nothing: the unit is done and the acceptance passes. The next step belongs to the lobby job (the screens) and
to the net-sim job (the sim's determinism — the hashes of Chromium and WebKit already agree).

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/net/` → `TSC-OWN OK`
- `node tools/r6/net-client.mjs` → `r6-net-client OK` (15/15), among them:
  - `PASS each client rides its own human (Alice slot 0, Bob slot 1)`
  - `PASS both race clocks run together (18.25 s vs 18.15 s)`
  - `PASS the state hashes agree on every common tick (22 of 22 equal; __br.net.hashes())` (Chromium ↔ WebKit)
  - `PASS Alice's skill press shows on Bob's screen (skill:cast from rider 0: 1, 41 ms after the press)`
  - `PASS Bob leaves: Alice's race goes on and Bob's bike is an AI rider (humans [0], time 18.25 → 21.1)`
  - `PASS alice: no console errors ()` / `PASS bob: no console errors ()`
- `node tools/r6/relay.mjs --port 8795` → `r6-relay OK`
- `node tools/core-check.mjs` → `core-check OK`
- `node tools/r6/net-det.mjs` (the net-sim job's test, it replaces `net.frame`) → `r6-net-det OK`
- `node shots/r6-net-client/probe.mjs` → `r6-net-probe OK`:
  - `PASS no relay: connect → false, the state is error ({"state":"error","message":"连接不上联机服务器"})`
  - `PASS a room that does not exist: 房间不存在 (房间不存在)`
  - `PASS createRoom: a code, this client is the host ({"code":"9AVA","host":2,"you":2})`
  - `PASS the ping to the relay (1 ms)`
  - `PASS leave: offline, no room, no line ({"state":"offline","room":null,"message":""})`

## Known issues
- The rival kits are **not** sent in the host's config: the core (`onlineRaceConfig`) validates a sent
  `rivalLoadouts` with `validLoadout`, which fills the empty slot and the ult — the AI would get its ult and
  could freeze a human. Not sending them, the core builds exactly `rivalLoadout(c, false)` (the same kit an
  offline race's rivals have) on every client. (config.ts, the comment above `buildOnlineConfig`.)
- The relay's `end` does not end a race that is still running locally: the client only stops the ticks and
  quits the race when the local race has not finished (`session.phase !== 'finished'`). The relay's `done` and
  `grace` end on the same tick as the local race, so the results screen stays.

## Requests
- **AppContext has no `session`**: the lockstep driver must call `session.tick(...)` / `session.hash()`, and the
  core gives the net unit no handle to the session. The net unit takes it from `app.ui.attach(session)` (the core
  calls it with the session when a race starts and with `null` when it ends) and falls back to
  `window.__br.session()`; if the core grows an `AppContext.session` field, the net unit prefers it (no change
  needed there). A `NetSystem.frame(dtReal, session)` signature would be the cleanest fix.
