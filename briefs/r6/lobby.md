# r6 job lobby — the online rooms' screens: 联机, the lobby, the race's waiting cover, back to the room (ui; SPEC §28)

The user asked for online play with rooms ("1"). Read SPEC.md §28 (how online rooms work) and §5 / §10 (the P5 UI),
then `src/core/contracts.ts` — `NetSystem`, `NetRoom`, `NetMember` (the screens talk ONLY to `ctx.app.net`; its
doc comments say what each call does; read `ctx.app.net` when you use it, never cache it at module load: the test
swaps in a scripted fake), `src/net/protocol.ts` (`RoomSetup`, `MemberPick`, `normaliseCode`, CODE_LENGTH), the
screens you copy from (`menu.ts`, `roster.ts`, `track-select.ts`, `records-screen.ts`, `garage.ts`), `src/ui/nav.ts`,
`src/ui/p5/*`, `src/ui/confirm` (ctx.confirm), `src/data/{tracks,roster,loadouts}.ts`, and `tools/r6/lobby.mjs` (the
acceptance: the data attributes below are what it looks for). The net client itself is another job (until it lands
`app.net` is the stub: `connect()` fails with its message — your screens must show that, not break).

## Build it
1. **Menu** (`copy.ts` MENU): 「联机 ONLINE」 → `online`, right after 快速比赛, blurb 「拉上朋友，一个房间号就开跑。」.
   Everything still fits at 1280×720 (tools/r6/ui.mjs and tools/ui-tour.mjs walk the menu by name).
2. **`online` screen** (`screens/online.ts` + `online.css`, registered in `registry.ts`): title 「联机 ONLINE」; a
   name field (`<input data-net-name>`, ≤ 12 chars, remembered in localStorage `beak-rash.net.name`, default
   「骑手」); 「创建房间」 (`data-net-create`); a 4-letter code field (`<input data-net-code-input>`, upper-cased as
   typed) and 「加入房间」 (`data-net-join`, enabled when the code has CODE_LENGTH letters); a status line
   (`data-net-message`: `app.net.message`, the ping when online). Create = `await net.connect(name)` (if false:
   stay, show the message) then `net.createRoom()`; join = connect then `net.joinRoom(normaliseCode(code))`. When
   `net.room` appears (listen with `net.onChange`) go to `lobby`. Keyboard / pad: ↑↓ between the rows, typing goes
   to the focused field, Enter on a button presses it, Esc → menu (and `net.leave()` if connected). While a text
   field has the focus the screen must not treat letters as menu actions.
3. **`lobby` screen** (`screens/lobby.ts` + `lobby.css`):
   - the room code BIG (`data-net-code`, 「房间号」 + the 4 letters, ransom style) with 「把房间号发给朋友」;
   - one row per member (`data-net-member`): portrait of their racer, name, the racer's 中文名, a 「房主」 badge, a
     「准备好了」 badge when ready; the local one marked 「你」;
   - the setup (`data-net-track`: track name + weather + direction) — the host changes it: ←→ / `data-net-track-next`
     / `data-net-track-prev` cycle `TRACK_ORDER`, weather and reverse toggles; each change → `net.setup(...)`; a
     member who is not the host sees it read-only (the host controls disabled: class `is-disabled`);
   - 「准备」 (`data-net-ready`) toggles `net.ready`; 「换角色」 (`data-net-change`) → the roster screen, and the
     roster's Esc returns to the lobby when it came from there (`ctx.from === 'lobby'`; you own `roster.ts`); on
     entering the lobby (and on coming back) send `net.pick({ character: save.data.character, bike: save.data.bike
     (or the racer's default bike when the saved bike does not suit), loadout: validLoadout(save.data.loadouts[c], c) })`;
   - 「开始比赛」 (`data-net-start`): host only, enabled (no `is-disabled`) when every member is ready → `net.start()`;
   - Esc → `ctx.confirm('离开房间？', …)` → `net.leave()` and the menu. If the room disappears (`net.room` null) go
     back to `online` with the message.
   The race itself starts on its own (core: the relay's start → `flow:startRace` → loading → race).
4. **In the race** (`src/ui/hud/net.ts` + `css/net.css`, wired in `hud.ts`): while an online race has not ticked yet
   (or no tick for more than 0.5 s) a centred cover 「等待其他玩家…」 (`data-net-wait`) over the HUD; gone as soon as
   ticks run (`session.time` / the phase moves; or read the net debug counter if present). The ping in a corner.
5. **After the race** (`results.ts` / `results-flow.ts`): in an online race the results' only choice is 「回到房间」
   → `flow:quitRace` and the `lobby` screen (when `app.net.room` exists; else the menu). The pause screen
   (`pause.ts`) in an online race: 「继续」 and 「离开联机」 (leave + menu); no restart, no settings-quality change.

## Files you own
`src/ui/copy.ts`, `src/ui/screens/online.ts`, `online.css`, `lobby.ts`, `lobby.css`, `registry.ts`, `roster.ts`,
`results.ts`, `results-flow.ts`, `pause.ts`, `src/ui/hud/net.ts`, `src/ui/hud/css/net.css`, `src/ui/hud/hud.ts`.

## Acceptance (the runner runs these; read `tools/r6/lobby.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/` → TSC-OWN OK
- `node tools/r6/lobby.mjs` → r6-lobby OK
- `node tools/r6/roster.mjs` → r6-roster OK
- `node tools/r6/ui.mjs --skip net` → r6-ui OK
- `node tools/r4/w3-screens.mjs` → w3-screens OK
- `node tools/ui-input.mjs` → all checks passed
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/ui-results.mjs` → all checks passed
- `node tools/core-check.mjs` → core-check OK
