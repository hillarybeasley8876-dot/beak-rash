# r6-net-wake — the client waits out a sleeping relay

## Plan
1. `src/net/client.ts`: tuning (TRY 4 s, RETRY 2500 ms, WAIT 90 s, TICK 1 s) + `httpRoot(url)` + `relayWaitMs(app)` +
   `waitText()`. Proof: `node tools/r4/tsc-own.mjs src/net/ src/ui/screens/`.
2. `RelayClient.connect(name, url, waitMs)`: one wait = a poke + fresh sockets every 2.5 s, `connecting` +
   「联机服务器唤醒中……（已等 N 秒）」 every second, `giveUp()` at the deadline, `cancelWait()` on leave/new connect,
   a relay `error` before the welcome is never retried. Proof: `node tools/r6/net-wake.mjs`.
3. `src/net/index.ts`: `net.connect` passes `relayWaitMs(app)` (`?relayWait=<ms>`). Proof: the give-up timing in
   `tools/r6/net-wake.mjs` (3500–8000 ms with `?relayWait=4000`).
4. `src/ui/screens/online.ts` + `.css`: the waiting line paints (no ping appended while connecting, `.is-wait`),
   `live` guard so a 90 s connect cannot paint a disposed screen. Proof: net-wake part 4 + a 1280×720 screenshot.
5. Regressions: `tools/r6/net-client.mjs`, `net-e2e.mjs`, `lobby.mjs`, `tools/core-check.mjs`.

## Done
- all five steps; every acceptance command below was run and read.

## In progress / next
- nothing; ready for review.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/net/ src/ui/screens/`
- `node tools/r6/net-wake.mjs` · `node tools/r6/net-client.mjs` · `node tools/r6/net-e2e.mjs` · `node tools/r6/lobby.mjs`
- `node tools/core-check.mjs`
- visual: `node shots/r6-net-wake/shot.mjs` (sleepy host on 8796) → `shots/r6-net-wake/online-waiting.png`

## Evidence (key output lines)
- `TSC-OWN OK`
- net-wake: `PASS while the host is asleep connect() keeps trying and says so (state connecting, 「联机服务器唤醒中……（已等 2 秒）」)`,
  `GET / 1×, upgrades tried 3×`, `once the relay is up connect() resolves true and the state is online`,
  `leave() while waking stops the tries at once (connect → false, state offline, 6 ms)`,
  `it gives up after ?relayWait=4000 ms with 「连接不上…」 (4058 ms, 「连接不上联机服务器，稍后再试」)`,
  `the online screen shows the waking line while it waits` → `r6-net-wake OK`
- net-client `r6-net-client OK` (22 of 22 hashes equal) · net-e2e `r6-net-e2e OK` (19 of 19) ·
  lobby `r6-lobby OK` (incl. `a connection error is shown on the online screen`) · `core-check OK`
- screenshot: the line sits under the card on one line at 1280×720, `errors: []`

## Known issues
- a host that accepts the socket but never upgrades retries every ~6.5 s (4 s try timeout + 2.5 s gap); a host that
  refuses the upgrade retries every 2.5 s.

## Requests
- (none)
