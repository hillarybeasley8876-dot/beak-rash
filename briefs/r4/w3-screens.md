# r4 job w3-screens — five tracks, race options, the 3 × 5 career, the race report, 彩蛋 n/9 (ui-screens)

Read SPEC.md §10 (screens), §5 (art: P5 — skewed, jagged, red/black/white, ransom type), §18 (nemesis), §20 (maps:
weather, reverse, seeded routes, career), §21 (easter eggs) and §22. `TRACK_ORDER` now has five tracks
(`src/data/tracks.ts`, with `TRACK_WEATHER[id]` = the weathers a track allows, its own weather FIRST). A race asks for
weather / reverse / route through `flow:startRace { config: { …, weather, reverse, route } }` (core fills the rest;
`route` 0 = the authored layout, any other integer = a seeded route). Read `src/ui/screens/` (track-select, career,
records, results*, loading, menu, credits, eggs.ts), `src/ui/progress.ts`, `src/ui/nav.ts`, `src/ui/p5/`.

## Build it
1. **Quick race** (`track-select.ts`): five cards that fit 1280×720 and 1920×1080 (each `.br-tc` gets `data-track="<id>"`),
   and a race-options panel `.br-race-opts` with `data-for="<focused track id>"` and three rows
   `[data-opt="weather" | "reverse" | "route"]`, each with `data-value`: weather = `random` or a Weather id (the cycle is
   `random` + `TRACK_WEATHER[id]`, the default is the track's own weather), reverse = `0` / `1` (正向 / 反向),
   route = `0` / `random` (经典路线 / 随机路线). Keys: ←→ on the cards choose the track; ↓ goes into the rows
   (weather → direction → route), ↑ back up (from weather to the cards); ←→ on a row cycles its value (wrapping);
   Enter anywhere starts the race with the focused track and its options (随机 weather → one of the track's weathers;
   随机路线 → an integer seed 1–9999); Esc on a row → back to the cards, on the cards → menu. Mouse: click a row value
   to cycle it. Values are kept per track while the screen is open. Weather names 晴 / 雨 / 雪 / 雾 / 黄昏 + 随机, with a
   small P5 glyph each; the focused card's weather line shows the chosen weather.
2. **Career** (`progress.ts`, `career.ts`): `CareerEvent` gains `weather: Weather; reverse: boolean; route: number`.
   Cup 1 = each track in its own weather, forward, authored. Cup 2 = each track in one of its OTHER weathers. Cup 3 =
   reversed or a seeded route on every event (both kinds used; fixed route seeds, so every player races the same
   route). Unlocking must survive the change from 3 to 5 tracks (old saves store `career.unlocked` as an index into the
   old 9-event list): an event is open if it is the first one, or has a best place of its own, or the event before it
   has a top-3 best. Keep writing `career.unlocked` (the highest open index) for anything that reads it. The screen:
   a 3 × 5 grid (each event cell `data-event="<key>"`), all on screen at 1280×720 and 1920×1080, weather / 反向 / 路线
   chips on the cells, and the detail panel shows the event's weather in an element with `data-weather="<id>"` plus its
   direction and route; Enter starts it with its weather / reverse / route. Fix the chain-tape columns for 5 tracks.
3. **Race report on the results screen**: lines with `data-line="nemesis"` (the race had a nemesis: `宿敌 <name>`, and
   `已击倒 +150 小鱼干` when `race:nemesisDown` came from the player), `data-line="style"` (the player's
   `RaceResult.styleBest` > 0: `最佳连段 12,400`), `data-line="police"` (the player knocked corgis down — `police:down`
   with `attacker` = the player — and/or a bribe was accepted: `放倒柯基 ×2 · V我50 ×1`). A line only shows when its
   thing happened. Tally the race's events from the bus in ui (reset at every race start). The +150 is already in the
   player's coins (race adds it) — display only.
4. **彩蛋 n/9** on the records sheet (opened with Tab on the career screen): a section `[data-eggs]` reading `彩蛋 n/9`
   with nine cells `[data-egg="ducks" | "konami" | "bribe" | "svg" | "goose_poem" | "sloth" | "pelican_god" |
   "pelican_word" | "credits_thanks"]`, class `is-found` when found: ducks = any `duck_*` in `save.data.secrets`
   (the cell shows `n/5`), konami = `save.data.unlocks` has `llm`, svg = any `svg_*`, the rest = their id in
   `save.data.secrets`. Found = name + a one-line description; not found = `???` + a cryptic hint. It must be visible
   on the sheet (e.g. its own column or a second page) without breaking the achievements grid.
5. **The UI eggs are saved**: typing PELICAN on the menu and the 30 s credits line add `pelican_word` /
   `credits_thanks` to `save.data.secrets` (first time only, one `save.update`) and emit
   `secret:found { id, riderId: 0, pos: null, first }`.
6. **Loading screen**: the course number counts five tracks; the calendar card shows the race's modifiers in an
   element `data-line="mods"` (e.g. `雨 · 反向 · 路线 #4821`; absent for a plain race).
7. Update `tools/ui-*.mjs` where they assume three tracks (keep every existing check).

## Files you own
`src/ui/screens/` (folder), `src/ui/progress.ts`, `src/ui/copy.ts`, `src/ui/race-tracker.ts`, `tools/ui-tour.mjs`,
`tools/ui-input.mjs`, `tools/ui-results.mjs`, `tools/ui-comfort.mjs`, `sandbox/ui.html`, `sandbox/ui.ts`.

## Acceptance (the runner runs these; read `tools/r4/w3-screens.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/screens/ src/ui/progress.ts src/ui/copy.ts src/ui/race-tracker.ts` → TSC-OWN OK
- `node tools/r4/w3-screens.mjs` → w3-screens OK
- `node tools/ui-results.mjs` → all checks passed · `node tools/ui-input.mjs` → all checks passed
- `node tools/core-check.mjs` → core-check OK
Look at your work: screenshots of quick race (options open), career, results with the report, the records sheet at
1280×720 and 1920×1080 under `shots/r4-w3-screens/`.
