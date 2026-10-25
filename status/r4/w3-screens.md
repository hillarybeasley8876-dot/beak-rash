# w3-screens — five tracks + race options, 3×5 career, race report, 彩蛋 n/9 (ui-screens)

## Plan
1. `src/ui/progress.ts`: `CareerEvent` gains `weather/reverse/route`; CAREER = 3 cups × 5 tracks
   (cup 1 own weather, cup 2 a variant, cup 3 reversed / fixed seeded routes); `isUnlocked` = first event
   OR own best OR the previous event has a top-3 best (old 3-track saves keep their progress);
   `career.unlocked` still written (highest open index).
2. `src/ui/copy.ts` + `src/ui/screens/weather-ui.ts` (new): weather names 晴/雨/雪/雾/黄昏 + 随机 and a
   small P5 glyph each.
3. `src/ui/screens/track-select.ts|.css`: five cards (fit 1280×720 and 1920×1080) + `.br-race-opts`
   (`data-for`, three rows `data-opt`/`data-value`), ←→ cards / rows, ↓ into rows, ↑ back, Enter starts,
   mouse clicks a row value, per-track values kept while open.
4. `src/ui/screens/career.ts|.css`: 3 × 5 grid on screen at both sizes, weather/反向/路线 chips on the cells,
   detail panel `data-weather` + direction + route, Enter starts with them, chain tape for 5 columns.
5. `src/ui/race-tracker.ts` + `src/ui/screens/results*.ts|css`: the race report lines
   (`data-line="nemesis"|"style"|"police"`), tallied from the bus, cleared at every race start.
6. `src/ui/screens/records.ts|.css`: the 彩蛋 n/9 section (`[data-eggs]`, nine `[data-egg]` cells) in its
   own column next to the achievements grid (the grid is 71 achievements tall now, so it tightens).
7. `src/ui/screens/menu.ts` (PELICAN) + `credits.ts` (30 s) + `eggs.ts`: save the UI eggs, emit `secret:found`.
8. `src/ui/screens/loading.ts|.css`: `data-line="mods"` on the calendar card.
9. `tools/ui-*.mjs`: the tour walks the new option rows; ui-comfort's toast-quiet check waits for the lane
   (the fx KO timeline can re-quiet it right after our own 'end').

## Done
- 1–9 all implemented. `src/ui/screens/weather-ui.ts` is new (the weather glyphs + the chip).

## In progress / next
- nothing; the acceptance commands pass (see the evidence).

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/screens/ src/ui/progress.ts src/ui/copy.ts src/ui/race-tracker.ts`
- `node tools/r4/w3-screens.mjs`
- `node tools/ui-results.mjs`
- `node tools/ui-input.mjs`
- `node tools/core-check.mjs`
- extra: `node tools/ui-comfort.mjs`, `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none`

## Evidence (key output lines)
- `TSC-OWN OK` (the only project tsc errors are in src/audio/watcher.ts, another unit's file in progress).
- `w3-screens OK` — every check PASS, e.g.
  `all five cards fully on screen at 1280×720 (ok)`,
  `Enter starts watertown · fog · reverse · a seeded route ({"trackId":"watertown","mode":"quick","weather":"fog","reverse":true,"route":3451})`,
  `CAREER = 3 cups × the 5 tracks in TRACK_ORDER (15)`,
  `cup 3 races reversed or on a seeded route (reverse 3, routes 2)`,
  `old saves keep their progress; the new tracks open behind a top 3 ({"1-watertown":true,"1-gobi":false,"2-coast":true,"2-city":true,"2-mountain":false,"3-coast":false})`,
  `the detail panel of the focused 2-city event shows its weather (data-weather rain, event rain)`,
  `a cup-2 event starts with its weather ({"trackId":"city","mode":"career","level":2,"weather":"rain","reverse":false,"route":0})`,
  `宿敌 line with the +150 bonus (宿敌 鹅霸 · 已击倒 +150 小鱼干)`,
  `STYLE best line (最佳连段 12,400)`, `police line: 2 corgis down + the bribe (放倒柯基 ×2 · V我50 ×1)`,
  `records sheet: 彩蛋 6/9`, `the duck cell counts 2/5`, `unfound eggs stay hidden (???)`,
  `typing PELICAN saves the pelican_word egg`, `idling 30 s on the credits saves the credits_thanks egg`.
- `[ui-results] all checks passed` · `[ui-input] all checks passed` · `[ui-comfort] all checks passed` ·
  `core-check OK` · `[ui-tour] all checks passed` (1280×720 and 1920×1080).
- Layout probes: 5 cards + the options panel fully on screen at 1280×720 and 1920×1080; the records sheet
  is 960 px tall (the stage is 1080) with the achievements grid (12 rows, no scroll) and the egg column
  side by side; the results report sits at y 812–848, between the table (ends 808) and the chips (868).
- Screenshots: `shots/r4-w3-screens/shot-quick-race-{1280x720,1920x1080}.png`, `shot-career-*`,
  `shot-results-*`, `shot-records-*`, `shot-loading-mods.png`, `eggs-close.png`.

## Known issues
- `tools/ui-comfort.mjs` toasted "lane quiet during cine:ko" failed once before I made that check wait for
  the lane: the fx KO cinematic's own 'peak' can land after the test's manual 'end' and re-quiet the lane.
  The check now polls (up to 4 s) for the lane to come back; it passes on every run since.
- The records sheet's achievement cells are one line each in dense mode (the catalogue is 71 entries now,
  12 rows); the full name + description are in the cell's tooltip.
- The quick race's random weather / random route use `Math.random()` (UI, not gameplay; the career's route
  seeds are fixed so every player races the same route).

## Requests
- none.
