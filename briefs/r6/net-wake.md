# r6 job net-wake — the client waits out a sleeping relay (net unit; SPEC §28 hosting)

The online rooms' relay is hosted on a free Render web service (render.yaml, Singapore). A free instance sleeps
after 15 minutes without traffic and takes about a minute to wake; while it wakes, its address answers plain HTTP
with a loading page and refuses WebSocket upgrades. Today the client gives up after the first failed WebSocket
(`src/net/client.ts`: state `error`, 「连接不上联机服务器」) — so the first player of the evening can never get in.
Read SPEC.md §28, `src/net/client.ts`, `src/net/index.ts`, `src/net/protocol.ts`, `src/ui/screens/online.ts`, and
`tools/r6/net-wake.mjs` (the acceptance; it stands in for the sleeping host on the relay's port).

## Build it
1. **Wake and retry** (`src/net/client.ts` `connect(name, url)`): when the WebSocket does not open (error, close
   before `welcome`, or no `open` within 4 s), keep trying until it does or the wait runs out:
   - first, once per connect: poke the host's HTTP root to wake it — `fetch(<http(s) root of the relay URL>,
     { mode: 'no-cors', cache: 'no-store' })` (ws→http, wss→https, path `/`); ignore the result and any error;
   - retry the WebSocket every 2–3 s; each try is a fresh socket (close the failed one);
   - state stays `connecting`; `message` = 「联机服务器唤醒中……第一次大约要一分钟（已等 N 秒）」, updated about
     once a second (notify the listeners so the online screen re-renders);
   - the wait: 90 s, or `?relayWait=<ms>` (tests); when it runs out: state `error`, 「连接不上联机服务器，稍后再试」
     (keep the words 连接不上), `connect()` resolves `false`;
   - `leave()` (or a new `connect()`) while waiting cancels it at once: no more tries, the pending `connect()`
     resolves `false`, state `offline`, message ''.
   - Once a socket opens and `welcome` arrives: state `online`, message '', `connect()` resolves `true` — exactly as
     today. A relay that answers but rejects the hello (`error version`) is not retried.
2. **The online screen** (`src/ui/screens/online.ts`) shows `net.message` as it changes (it already listens to
   `onChange` — check that the waking line updates and stays readable at 1280×720) and Esc while waiting cancels
   (`net.leave()`) and goes back to the menu.
3. Keep everything else of the net unit as it is (`tools/r6/net-client.mjs` and `tools/r6/net-e2e.mjs` must stay
   green).

## Files you own
`src/net/client.ts`, `src/net/index.ts`, `src/ui/screens/online.ts`, `src/ui/screens/online.css`.

## Acceptance (the runner runs these; read `tools/r6/net-wake.mjs` first)
- `node tools/r4/tsc-own.mjs src/net/ src/ui/screens/` → TSC-OWN OK
- `node tools/r6/net-wake.mjs` → r6-net-wake OK
- `node tools/r6/net-client.mjs` → r6-net-client OK
- `node tools/r6/net-e2e.mjs` → r6-net-e2e OK
- `node tools/r6/lobby.mjs` → r6-lobby OK
- `node tools/core-check.mjs` → core-check OK
