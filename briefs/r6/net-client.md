# r6 job net-client — the game's side of online rooms: relay connection, room, lockstep driver (net unit; SPEC §28)

Online rooms are deterministic lockstep through a relay. Done: the protocol (`src/net/protocol.ts` — the contract,
do not change it), the relay (`relay/`, Deno; `deno run --allow-net relay/main.ts --port 8790`), the core side
(`src/core/contracts.ts`: `NetSystem`, `NetRoom`, `RaceConfig.online`, `Session.tick / present / hash / humans`;
`src/core/game.ts`: an online race calls `app.net.frame(dtReal)` every frame and never steps the sim itself;
`src/core/race-config.ts onlineRaceConfig`). The sim is being made identical across clients by another job right
now — your test does not depend on it being finished for a 20 s race, but read SPEC §28 to know the rules.
Today `src/net/index.ts` exports the stub. Read SPEC.md §28, `src/net/protocol.ts`, `relay/README.md`,
`src/core/contracts.ts` (the NetSystem doc comments are the spec of each method), `src/core/session.ts` (`tick()`),
`src/core/input.ts` (`peek`, `consumeEdges`, `scripted`), `src/data/{roster,loadouts,skills}.ts`, and
`tools/r6/net-client.mjs` (the acceptance test drives exactly this API).

## Build it (`src/net/`, each file ≤ 300 lines; no third-party modules, the browser's WebSocket)
- `index.ts`: `createNet(app): NetSystem` (replace the stub export; keep `stub.ts` as core's fallback).
- `client.ts` — the socket: relay URL = `app.params.get('relay')` ?? `import.meta.env.VITE_RELAY_URL` ??
  `ws://<location.hostname>:8790/ws`; `hello` → `welcome` (your member id); JSON frames typed `ClientMsg` /
  `RelayMsg`; `ping` every 2 s → `ping` (RTT ms); errors → `message` in Chinese (连接不上联机服务器 / 房间不存在 /
  房间满了 / 比赛已经开始 / 服务器断开了 …) and `state` (`connecting` → `online` / `error` / `offline`).
- `room.ts` — `createRoom / joinRoom / pick / ready / setup / leave` and the `room` state from `room` messages
  (`NetRoom.you` = your id); `onChange` listeners fire on any change.
- `start()` (host, every member ready) builds the RaceConfig: `trackId / weather / reverse` from the setup, a random
  `seed` (Math.random is fine HERE: the host decides and everyone receives the result), `traffic: true`, `level: 2`,
  the AI field = `RACERS` without the humans' characters, shuffled, 8 − humans of them, `rivalLoadouts` =
  `rivalLoadout(c, false)`, `online = { room: code, humans: the members in join order → { slot, member, name,
  character, bike, loadout }, local: 0 }`; sends `start { config, humans: member ids in slot order }`.
- On the relay's `start`: set `config.online.local` = your slot (index of your id in `humans`) and emit
  `flow:startRace` with it (core builds the race through `onlineRaceConfig`). When the race screen is up
  (`flow:screen` with `race`), send `loaded`. On `go` the race begins.
- `lockstep.ts` — `frame(dtReal)` during an online race:
  1. **Send the local input** at most 60 times a second: `app.input.peek(scratch)` → `packInput`, the edge bits OR-ed
     since the last send, then `app.input.consumeEdges()` (an edge is sent once). Send when something changed or an
     edge is pending, else at least every 100 ms (keeps the relay's idle timer happy).
  2. **Run ticks**: received ticks go in a queue. Accumulate dtReal; run one tick per TICK_DT of it while the queue has
     ticks; when the queue holds more than 4 run extra ticks (≤ 8 a frame) to catch up; an empty queue stalls (do not
     bank more than one tick of time). A tick: `unpackInput` each `i[slot]` into that slot's Controls, then
     `session.tick(controls, left)`. After tick n with `n % HASH_EVERY === 0`, send `hash { tick: n, h:
     session.hash() }` and keep `{ tick, h }` for the debug surface.
  3. Return how many ticks ran.
- Race end: when `race:end` fires in an online race send `done`. `desync` → toast 「联机不同步，比赛结束」 and end
  the race (`flow:quitRace`). The relay's `end` returns the room to the lobby state.
- `leave()`: in a race, quit it (`flow:quitRace`); send `leave`, close, `state = 'offline'`, `room = null`.
- Debug surface (tests): `window.__br.net = { hashes(): Array<{tick, h}>, ticks(): number, queued(): number }`
  (install it like `src/fx/debug.ts` hooks `window.__br`).

## Files you own
`src/net/index.ts`, `src/net/client.ts`, `src/net/room.ts`, `src/net/lockstep.ts`, `src/net/config.ts`,
`src/net/debug.ts` (new files as listed; split differently if you like, inside `src/net/` — but never
`src/net/protocol.ts`, `src/net/stub.ts`, `src/net/detmath*`).

## Acceptance (the runner runs these; read `tools/r6/net-client.mjs` first)
- `node tools/r4/tsc-own.mjs src/net/` → TSC-OWN OK
- `node tools/r6/net-client.mjs` → r6-net-client OK
- `node tools/r6/relay.mjs` → r6-relay OK
- `node tools/core-check.mjs` → core-check OK
