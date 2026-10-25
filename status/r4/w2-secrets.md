# r4 w2-secrets — easter eggs module (SPEC §21)

## Plan
1. `src/gameplay/secrets/tuning.ts` + `src/data/secret-lines.ts`: every number and every Chinese line in one place.
   Verify: `node tools/r4/tsc-own.mjs src/gameplay/secrets/ src/data/secret-lines.ts` → TSC-OWN OK
2. `src/gameplay/secrets/placement.ts`: seeded duck/easel spots (hash of the track id, no Math.random), clear of
   bridge/tunnel/ramp, duck on the asphalt edge, easel past the drivable bound on a grass/dirt verge.
3. `src/gameplay/secrets/mesh.ts`: toon + ink-outline duck, easel with the wrong-SVG canvas, cloud pelican god.
4. `src/gameplay/secrets/records.ts`: `secret:found` → SaveData.secrets (one save.update), 5 ducks → unlocks 'duck'.
5. `src/gameplay/secrets/props.ts` + `runner.ts` + `index.ts`: the module — ducks, easel, goose poem, sloth, pelican
   god, bribe, debug hook `window.__br.secrets` (list/forceGod/godPlanned), full cleanup on detach.
6. Race check: `node tools/r4/w2-secrets.mjs` → w2-secrets OK.
7. Regression: `node tools/core-check.mjs` → core-check OK; `node tools/race-soak.mjs --track coast` → SOAK OK.

## Done
- 小黄鸭 `duck_<track>` on all five tracks (coast/city/mountain/watertown/gobi): a yellow rubber duck (orange beak,
  black eyes, toon + ink outline, ~0.35 m) bobbing on the asphalt edge; riding within 1.2 m finds it once per race
  (quack `ui.coin`, toast `找到小黄鸭！(n/5)`); the five ducks add `duck` to `SaveData.unlocks` (the garage row).
- SVG 画架 `svg_<track>`: a wooden easel past the drivable edge with a canvas that shows the deliberately wrong flat
  "SVG" pelican on a bicycle (mismatched wheels, the chain on its neck, the caption "Generate an SVG of a pelican
  riding a bicycle"). A non-solid Obstacle kind 'prop' (0.8/0.4/2.2). A THROWN `combat:obstacleHit` by the player
  spins it, finds it, +50 小鱼干, toast `致敬原作！+50 小鱼干`; a melee hit does nothing.
- 鹅鹅鹅 `goose_poem`: three raw bell presses (counted on `app.input.onAction`) within 5 s while the goose is within
  8 m → the goose gets an `angry` status (source = the player) + boostTime 8 at power 0.15 and recites
  `鹅鹅鹅，曲项向天歌——`.
- 比树懒还慢 `sloth`: 8 s without pedalling (throttle 0, speed < 1 m/s) after GO → found; the sloth stops for 2 s
  (a strong `slow` status), taunts `你也不急？` and then floors it (boostTime 3 at power 0.6).
- 鹈鹕神显灵 `pelican_god`: coast and mountain only, 1 race in 15 from the race seed (hash → 2 of 30 coast seeds);
  at a seeded 30–120 s a giant cloud pelican (`pelican-god`, fog-free) drifts across the sky for 12 s. A bell press
  while it is visible → found, +50 小鱼干, toast `心诚则灵 +50 小鱼干`.
- Records: every first find goes into `SaveData.secrets` with one `app.save.update`; an accepted `police:bribe` for
  the player is recorded as `bribe` (and emits `secret:found`).
- Debug hook `window.__br.secrets = { list(), forceGod(), godPlanned() }`, removed on detach. Everything the module
  adds to the world / `session.obstacles` is removed and disposed on detach.
- Probes: `shots/r4-w2-secrets/probe.mjs` (the spots of the five tracks, the cleanup, the pictures),
  `probe2.mjs` (the natural god at 45 s, the easel spin, the sloth's stop and boost), `probe3.mjs` (the easel picture),
  `probe4.mjs` (the eggs work with another unit stubbed).
- Round-2 hardening: the module has **no `throw` and no `console.*` left** — the 2D-canvas fallback returns a blank
  canvas instead of throwing, so nothing in `gameplay/secrets` can break a race boot or log to the console.

## In progress / next
- Nothing left for this job.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/secrets/ src/data/secret-lines.ts` → TSC-OWN OK
- `node tools/r4/w2-secrets.mjs` → w2-secrets OK
- `node tools/core-check.mjs` → core-check OK
- `node tools/race-soak.mjs --track coast` → SOAK OK
- `node shots/r4-w2-secrets/probe.mjs` / `probe2.mjs` → the spots, the cleanup, the god, the spin, the sloth

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/gameplay/secrets/ src/data/secret-lines.ts` → `TSC-OWN OK`
- `node tools/r4/w2-secrets.mjs` → 21 PASS, `w2-secrets OK` (duck found once + saved + toast; melee on the easel
  does nothing, thrown → `svg_coast` + 50 (0 → 50); three bells → `goose_poem`, `angry true, boost 7.33`,
  `鹅鹅鹅，曲项向天歌——`; `forceGod()` → a visible `pelican-god`; a bell under it → found + 50 (50 → 100); the bribe
  → `bribe` saved; 8 s without pedalling → `sloth` + `你也不急？`; the five ducks → `unlocks ["duck"]`;
  `pelican god planned in 2 of 30 coast races`; no console errors). Run 6× in a row after the round-2 fix, all OK.
- `node tools/core-check.mjs` → `core-check OK`
- `node tools/race-soak.mjs --track coast` → `SOAK OK` (seed 1 t=173.8 s, seed 2 t=178.6 s, seed 3 t=186.0 s)
- probe: `coast: duck s=1789/3300 x=6.09 surf=road … easel s=1594 x=10.70` + the same for city/mountain/watertown/gobi;
  `after end: {"session":false,"scene":2,"secrets":"undefined"}` (the world is clean, the hook is gone);
  `natural god: {"at":45,"visible":true}`; `easel group rotation after the hit: 1.842`;
  `sloth after the stop: {"slow":1}` → `sloth 3 s later: {"slow":0,"boost":0.63,"power":0.6}`; `console errors: 0`
- probe4 (the actors unit stubbed): `save.secrets: ["duck_coast"]`, `console errors: 0`

## Round-2 diagnosis of the failed run (the actors unit, not this job)
The failed check was `noErrors(h, 'eggs race 1')`; the captured error was
`[modules] unit "actors" failed to load, using its stub — Failed to fetch dynamically imported module:
http://127.0.0.1:5300/src/actors/index.ts`. That message is written by **core** (`core/modules.ts` `pick()`) when the
*actors* unit's dynamic import rejects — i.e. a file in the actors import graph did not transform at that moment. The
actors unit was being refactored in parallel at the time (`M src/actors/bikes/defs/llm.ts`,
`M src/actors/bikes/defs/llm-chain.ts`, `?? src/actors/bikes/defs/llm/` — the llm bike was being moved into a
folder, so the graph was momentarily broken). Evidence that it is not this module:
1. the error names the unit `actors`; a failure of this module would read `unit "secrets"` — none was logged;
2. this module's import graph is 12 modules, all transform with HTTP 200; the actors graph is 126 modules and now
   transforms cleanly (walked with a fetch over the dev server);
3. the check passes 6/6 consecutive runs now;
4. with `?stub=actors` the eggs still work and log nothing (`probe4`).
Fix applied in my own files anyway: the only `throw` (the 2D canvas context) now falls back to a blank canvas, so
`gameplay/secrets` can no longer break a race boot or write to the console.

## Known issues
- None in this module. (The coast soak failed for a while during the job — riders stuck at s≈2520 on seeds 2/3 — the
  same failure appeared with `?stub=secrets`, i.e. it came from the race/AI/police units being edited in parallel.
  It passes now: `SOAK OK`.)

## Requests
- If `node tools/r4/w2-secrets.mjs` fails again with `[modules] unit "<x>" failed to load`, the fix belongs to the
  unit named in the message (last time: the actors unit's llm-bike refactor), not to `gameplay/secrets`.
