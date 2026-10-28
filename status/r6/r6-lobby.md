# r6-lobby — 联机 ONLINE: the menu entry, the online screen, the lobby, the race's waiting cover, the way back

## Plan
1. **copy.ts** — 「联机 ONLINE」 on the stair (right after 快速比赛), blurb 「拉上朋友，一个房间号就开跑。」; the
   online/lobby copy strings live here too. → `node tools/r6/lobby.mjs` (the menu walk).
2. **screens/online.ts + online.css** — the name field (`data-net-name`, ≤12, localStorage `beak-rash.net.name`),
   创建房间 (`data-net-create`), the room code field (`data-net-code-input`, upper-cased) + 加入房间
   (`data-net-join`), the status line (`data-net-message` = `app.net.message` + the ping). The screen talks only
   to `ctx.app.net` and reads it FRESH every time (the acceptance swaps in a fake); `net.onChange` is
   re-subscribed when the net object changes under the screen. → `node tools/r6/lobby.mjs` (walk 2).
3. **screens/lobby.ts + lobby.css** — the big room code (`data-net-code`), the member rows (`data-net-member` with
   the portrait, the name, the racer's 中文名, 房主 / 准备好了 / 你), the host's setup (`data-net-track`,
   `data-net-track-prev/next`, weather, reverse), 准备 (`data-net-ready`), 换角色 (`data-net-change` → the roster),
   开始比赛 (`data-net-start`, host only, enabled when everybody is ready), Esc → confirm → `net.leave()`.
   `net.pick` goes out when the lobby opens (and when it comes back from the roster). → `node tools/r6/lobby.mjs`.
4. **screens/registry.ts** — register `online` + `lobby`. → `node tools/r4/tsc-own.mjs src/ui/`.
5. **screens/roster.ts** — Esc returns to the lobby when it came from there (`ctx.from === 'lobby'`).
6. **screens/results.ts + results-flow.ts** — in an online race the results' only choice is 「回到房间」:
   `flow:quitRace` + the lobby (the menu when the room is gone). → `node tools/r6/lobby.mjs` (walk 3).
7. **screens/pause.ts** — in an online race: 继续 / 离开联机 (leave + menu); no restart, no settings.
8. **hud/net.ts + hud/css/net.css + hud/hud.ts** — the 「等待其他玩家…」 cover (`data-net-wait`) over the HUD
   until the relay's ticks run, and the ping in a corner.
9. **Acceptance** — every command in the brief.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/` → TSC-OWN OK
- `node tools/r6/lobby.mjs` → r6-lobby OK
- `node tools/r6/roster.mjs` → r6-roster OK
- `node tools/r6/ui.mjs --skip net` → r6-ui OK
- `node tools/r4/w3-screens.mjs` → w3-screens OK
- `node tools/ui-input.mjs` → all checks passed
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/ui-results.mjs` → all checks passed
- `node tools/core-check.mjs` → core-check OK
- my own probes: `node shots/r6-lobby/probe-shots.mjs` (the screens + the cover, with screenshots),
  `node shots/r6-lobby/probe-edges.mjs` (the room disappears, Esc leaves the relay),
  `node shots/r6-lobby/probe-ping.mjs` (the ping in the corner), `node shots/r6-lobby/probe-results.mjs`
  (the online results row).

## Done
- **Menu**: 「联机 ONLINE」 right after 快速比赛 (copy.ts). Nine entries still fit above the hint bar at
  1280×720 (`r6-ui`: "every menu entry is on screen above the hint bar at 1280×720").
- **Online screen** (`screens/online.ts`): the name (pre-filled 「骑手」, ≤ 12 chars, kept in
  `localStorage['beak-rash.net.name']`), 创建房间 → `connect(name)` + `createRoom()`, the room code (4 letters,
  upper-cased as typed) + 加入房间 → `connect(name)` + `joinRoom(normaliseCode(code))`, the status line
  (`data-net-message`: the relay's message, the ping when it is online). The room appears → the lobby.
  A letter typed in a field is text, not a menu action: the field's keydown stops the propagation, so the
  core's input never sees it (the core would otherwise preventDefault A/D/W/S/J/K/L/U/I/O/P/B/C and the
  character would never be typed). Ctrl/⌘ combos are stopped too, so Ctrl+A still selects.
  Esc → the menu (and `net.leave()` when the relay is open).
- **Lobby** (`screens/lobby.ts`): the room code big (ransom) with 「把房间号发给朋友」; one row per member
  (portrait, name, the racer's 中文名, 房主 / 准备好了 / 你); the host's setup (the track name, the weather and the
  direction; ←→ or the ◀ ▶ buttons cycle `TRACK_ORDER`, the weather and the direction toggle) — a member who is
  not the host sees the controls disabled (`is-disabled`); 准备 (`net.ready`), 换角色 (the roster screen; its Esc
  returns to the lobby), 开始比赛 (`net.start()`, host only, enabled when everybody is ready). The pick
  (`net.pick` with the saved racer, the bike that suits it and the valid kit) goes out when the lobby opens and
  again when it comes back from the roster. Esc → 「离开房间？」 → `net.leave()` → the menu. The room disappearing
  → the online screen again with 「房间没了（房主走了？）」.
- **In the race** (`hud/net.ts`): the centred 「等待其他玩家…」 cover (`data-net-wait`) while the relay's ticks
  have not run (and back when they stall for more than 0.5 s), the ping in the left corner.
- **After the race** (`results.ts` + `results-flow.ts`): an online race's results have one choice, 「回到房间」
  → `flow:quitRace` → the lobby (the menu when the room is gone). The pause menu of an online race has only
  继续 / 离开联机.
- **results.ts**: the show (the stamp, the coin count-up, the arming) now runs on the screen's own clock as well
  (a 50 ms fallback tick): the game's frame loop is frozen in the manual test mode, and the row never armed
  there — the acceptance drives an online race with `__br.manual(true)`.

## In progress / next
Nothing: every step of the brief is implemented and every acceptance command is green.

## Evidence (key output lines)
- `node tools/r6/lobby.mjs` → `r6-lobby OK` (all 30 assertions pass), among them:
  `PASS the lobby lists the members (["Alice阿鹕你房主"])`,
  `PASS a member who joins appears with name, racer and portrait ([{"t":"Alice阿鹕你房主","pic":true},{"t":"Bob弹跳猪准备好了","pic":true}])`,
  `PASS the host changes the track (setup ["setup",{"trackId":"city","weather":null,"reverse":false}])`,
  `PASS a member who is not the host cannot change the track or start (0 host controls enabled)`,
  `PASS Esc on the roster returns to the lobby, which sends the new racer ("hamster")`,
  `PASS Esc in the lobby asks, and leaving calls leave() and returns to the menu`,
  `PASS 加入房间 joins by the typed code, upper-cased ([["joinRoom","K7QX"]])`,
  `PASS a connection error is shown on the online screen ([data-net-message] 「连接不上联机服务器」)`,
  `PASS before the first tick the race shows 「等待其他玩家…」 ([data-net-wait] 「等待其他玩家…」)`,
  `PASS after an online race the results lead back to the lobby, not into another local race (回到房间ROOM)`.
- `node tools/r4/tsc-own.mjs src/ui/` → `TSC-OWN OK`; `node tools/r6/roster.mjs` → `r6-roster OK`;
  `node tools/r6/ui.mjs --skip net` → `r6-ui OK`; `node tools/r4/w3-screens.mjs` → `w3-screens OK`;
  `node tools/ui-input.mjs` → `[ui-input] all checks passed`; `node tools/ui-results.mjs` →
  `[ui-results] all checks passed`; `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` →
  `[ui-tour] all checks passed`; `node tools/core-check.mjs` → `core-check OK`.
- My own probes: `node shots/r6-lobby/probe-edges.mjs` → `the room is gone → online | the toast: !房间没了（房主走了？）。`,
  `Esc on the online screen → menu | leave calls: 1`, `errors: []`;
  `node shots/r6-lobby/probe-ping.mjs` → `the ping: {"text":"42 ms","off":false,...}`;
  `node shots/r6-lobby/probe-shots.mjs` → `the pause buttons: 继续RESUME | 离开联机LEAVE`.
- Screenshots: `shots/r6-lobby/01-menu.png`, `02-online.png`, `03-lobby.png`, `04-race-wait.png`,
  `05-pause-online.png` (the contact sheets `sheet1.jpg`, `sheet3.jpg`).

## Known issues
1. **The leave confirm opens on the safe answer** (`src/ui/confirm.ts` focuses 「再想想」). The lobby and the
   pause screen move the focus to 「离开」 right after the modal opens (`ctx.app.input.press('left')`), so
   Enter leaves the room — the acceptance expects exactly that ("Esc asks, and leaving calls leave() and
   returns to the menu"). The press goes through the shell's normal action routing, so the modal gets it.
2. **The results' fallback clock** (`results.ts`, a 50 ms `setInterval`): it only advances the show when the
   game's own loop has not advanced it for 120 ms, so a frozen game (the manual test mode) still gets its
   stamp, its coin count-up and its armed row. In a running game the interval never fires.
3. The online screens are not in `tools/ui-tour.mjs`'s walk (the tour's screen list is the lead's file); the
   lobby is checked by `tools/r6/lobby.mjs` and by my own probes instead.

## Requests
- The lead owns `src/ui/confirm.ts`: a confirm that opened on the safe answer would let the lobby's leave
  question be answered with one key less (Enter = leave). The two `input.press('left')` calls in
  `screens/lobby.ts` and `screens/pause.ts` are the workaround; they disappear if the confirm ever grows an
  option to pick the default answer.
