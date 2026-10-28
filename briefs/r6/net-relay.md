# r6 job net-relay — the relay server for online rooms (relay unit, Deno; SPEC §28)

The user chose online rooms through a relay ("1"). Online play is deterministic lockstep: every client runs the whole
race; only inputs travel. The relay has NO game logic. It keeps rooms (a 4-letter code, 2–4 humans), forwards the
host's RaceConfig untouched, waits until every human has loaded, then paces the race: 60 times a second it sends one
`tick` message to every member with the latest input of every human. Read SPEC.md §28 and `src/net/protocol.ts`
(the protocol, constants and the input packing — it is the contract: do not change it; ask under `## Requests` if
something is missing) and `tools/r6/relay.mjs` (the acceptance test: every behaviour below is checked there).

## Build it (Deno 2.7, `deno` is on PATH; no third-party modules — only the Deno runtime and the Web platform)
- `relay/main.ts`: `Deno.serve({ port, hostname: '0.0.0.0' }, handler)`; `GET /` → `beak-rash relay ok`; `/ws` →
  `Deno.upgradeWebSocket`. Flags: `--port` (default 8790), `--idle-ms`, `--load-ms`, `--grace-ms` (default the
  protocol's IDLE_TIMEOUT_MS / LOAD_TIMEOUT_MS / FINISH_GRACE_MS; the test passes short ones). Log one line per room
  event (created, joined, started, go, ended + reason, closed) with a timestamp; never log inputs.
- `relay/rooms.ts` (rooms, members, the lobby) and `relay/race.ts` (the tick loop), each ≤ 300 lines, plain classes,
  imported with explicit `.ts` extensions; the protocol is `import … from '../src/net/protocol.ts'`.
- **Connections**: the first message must be `hello` with `v === PROTOCOL_VERSION` (else `error version` and
  close); answer `welcome` with a member id unique for the relay's lifetime; names trimmed to NAME_MAX, empty →
  「骑手」. Every message: ≤ MAX_MESSAGE_BYTES (`error too_big`, keep the connection), valid JSON of a known shape
  (`error bad_message`, keep it), ≤ MAX_MESSAGES_PER_SECOND over a sliding second (`error rate` and close), any
  message resets the idle timer (`error idle` and close when silent for --idle-ms). `ping` → `pong {at, now}`.
- **Rooms**: `create` → a fresh code (CODE_ALPHABET, CODE_LENGTH, never one in use), the creator is host, state
  `lobby`; `join` (any case: `normaliseCode`) → `no_room` / `full` (MAX_HUMANS) / `started` (not in lobby) or the
  member is added. After any change every member gets `room` (code, host, members with their pick + ready, setup,
  state). `pick` / `ready` from any member, `setup` only from the host (`not_host`). A member that leaves or closes
  is removed; the host's role passes to the oldest remaining member; the room is deleted with its last member.
- **Start**: from the host only, every member ready (`not_ready`), `humans` exactly the member ids (any order, each
  once: `bad_humans`). Broadcast `start {config, humans}` (config forwarded byte-for-byte as JSON), state `loading`.
- **Load barrier**: when every human in `humans` has sent `loaded`, broadcast `go` and start the tick loop at tick 0.
  If --load-ms passes first, start anyway: the humans that did not load are marked left in tick 0.
- **Tick loop** (`race.ts`): drift-corrected — tick n is due at start + n/TICK_RATE s (performance.now()); one timer
  that emits every due tick (a late timer emits two in a row, never skips a number). Per human slot keep the latest
  analog + held values of its last valid `in` (`isTickInput`) and the OR of the edge bits of every `in` since the
  previous tick; a tick carries `i[slot]` = [steer, throttle, brake, held, edges] and then clears that slot's edges
  (an edge press lands in exactly one tick). A slot whose human left sends `IDLE_INPUT` forever after; the tick right
  after the leave carries `left: [slot]` (once). Ticks go to every member still connected.
- **Hashes**: `hash {tick, h}` from each active human; once every active human has reported tick n, compare: if they
  differ broadcast `desync {tick}` and end the race (`end {reason: 'desync'}`). Keep at most the last 8 hashed ticks.
- **End**: `done` from a human marks it done; when every active human is done → `end {reason: 'done'}`; after the
  first done, if --grace-ms passes → `end {reason: 'grace'}`; when no human of the race is connected → `end
  {reason: 'empty'}`. On end: stop the loop, the room goes back to `lobby` with every member's ready = false, and a
  `room` message goes out.

## Check it
`deno check relay/main.ts` (type errors) and `node tools/r6/relay.mjs` (behaviour). Also run the relay yourself and
connect two `new WebSocket('ws://127.0.0.1:8790/ws')` clients from a Node script under `shots/r6-net-relay/` to see
the tick rate over 10 s (it must stay 60 ± 1 per second). Run your own relays on ports 8795–8799 only (the test uses
8791) and stop every relay you start before you finish (`Ctrl-C` / kill the deno process you spawned).

## Files you own
`relay/main.ts`, `relay/rooms.ts`, `relay/race.ts`, `relay/README.md` (how to run and deploy: `deno run --allow-net
relay/main.ts --port 8790`; any host with Deno and a public port; behind HTTPS the client uses `wss://host/ws`).

## Acceptance (the runner runs these; read `tools/r6/relay.mjs` first)
- `deno check relay/main.ts` → exit 0
- `node tools/r6/relay.mjs` → r6-relay OK
