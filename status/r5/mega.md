# r5 job mega — one landmark mega jump per track (a three-trick chain must fit)

## Plan
1. Add the mega-jump shape to `src/world/layouts/jumps.ts`: `MEGA` (up 18 m / +8 m, down 44 m / −8 m,
   vEase 10/12) + `megaHill(name, halfWidth, shape?, marks?, sides?)` → two segments, the second carrying the
   `jumpCrest` feature with `data { big: 1, mega: 1 }`.
   Verify: `node --experimental-transform-types shots/r5-mega/measure.mjs` prints the air of every jump.
2. Lay the mega hill into the five layouts (one per track, in the set-piece place the brief names):
   coast = the promenade boardwalk (s 418), city = the expressway flyover (s 1558), mountain = the summit
   cliff (s 2325), watertown = the second humpback bridge (s 1768), gobi = the salt lake's dune ramp (s 2358).
   Verify: the offline model: every track's best jump ≥ 1.9 s, the reverse still launches.
3. The MEGA sign: `src/world/features/jump.ts` draws a big black-and-red 「起飞！」/MEGA board 120 m before
   the feature marked `mega`, plus the arrows and the striped lip.
   Verify: `node tools/r4/tsc-own.mjs src/world/layouts/ src/world/features/ src/sim/features.ts src/world/dressing/` → TSC-OWN OK.
4. The set dressing per track (`src/world/dressing/mega.ts`): the board, a crowd and the props that make
   the place — the coast's timber deck, the city's flyover piers, the mountain's prayer flags, the water
   town's bridge lanterns, the gobi's flag poles and camels.
   Verify: `node tools/core-check.mjs` → core-check OK; the browser shots under `shots/r5-mega/`.
5. The acceptance run: tools/r5/mega.mjs, tools/r5/air.mjs, tools/r4/w3-reverse.mjs, tools/r4/w3-routes.mjs,
   tools/race-soak.mjs (gobi, city), tools/core-check.mjs.

## Done
- The mega jump is in all five layouts; every track's best jump gives 2.18–2.24 s of air (the browser and
  the offline model agree to 0.01 s) and lands a three-trick chain.
- The MEGA board (120 m before), the arrows and the kicker lip.
- The set piece per track.
- The track lengths are unchanged (3348 / 3426 / 3636 / 3282 / 3774) so the mountain's lake peaks
  (anchored to a fixed s in world/env/mountain-relief.ts) stay where they are.

## In progress / next
- nothing (all the acceptance commands pass).

## How to test (exact commands)
- `node --experimental-transform-types shots/r5-mega/measure.mjs` (the offline air model, calibrated against the browser)
- `node tools/r5/mega.mjs`
- `node tools/r5/air.mjs`
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city,watertown,gobi`
- `node tools/r4/w3-routes.mjs --race mountain`
- `node tools/race-soak.mjs --track gobi`
- `node tools/race-soak.mjs --track city`
- `node tools/core-check.mjs`

## Evidence (key output lines)
- the offline model matches the browser: coast jumpCrest@404 → 1.68 s (browser 1.68 s), peak 6.5 m (browser 6.53 m).
- `node tools/r4/tsc-own.mjs src/world/layouts/ src/world/features/ src/sim/features.ts src/world/dressing/` → TSC-OWN OK.
- `node tools/r5/mega.mjs` → r5-mega OK: coast 2.18 s / city 2.22 s / mountain 2.19 s / watertown 2.22 s /
  gobi 2.24 s, every one "three spins chained on it land clean" with count 3.
- `node tools/r5/air.mjs` → r5-air OK.
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city,watertown,gobi` → w3-reverse OK.
- `node tools/r4/w3-routes.mjs --race mountain` → w3-routes OK.
- `node tools/race-soak.mjs --track gobi` → SOAK OK (seeds 1, 2, 3).
- `node tools/race-soak.mjs --track city` → SOAK OK (seeds 1, 2, 3).
- `node tools/race-soak.mjs --track coast` / `--track mountain` / `--track watertown` → SOAK OK (the
  rivals survive the mega jumps on every track).
- `node tools/core-check.mjs` → core-check OK.
- `node tools/r4/w3-world-polish.mjs` → w3-world-polish OK (the budget: 125 calls / 435k tris on the
  watertown, 224 / 587k on the gobi — inside the 420 calls / 1.4M tris).
- the shots: `shots/r5-mega/<track>-approach.png` (80 m before the crest), `<track>-flight.png` (the top of
  the flight), `<track>-sign.png` (the MEGA board 120 m before).

## Known issues
- The acceptance script is stateful: it drives 60 m before every jump and 120 m past it, so a weapon
  crate in those windows is picked up — and an umbrella (a fresh glide on every drift press) kills the
  trick chain. The weapon crates now stand clear of the jumps' approaches and landing zones, and the
  water town's last jump stands clear of the finish line (its run would cross it and leave the player
  'finished').
- The soak's police check is a knife edge: the script brakes the player as soon as the officer is within
  4 m, and the officer then overshoots the braking player by ~4 m — just outside the bust's window. Which
  way it lands depends on the whole race's rng stream (the traffic's positions shift with any layout
  change), so it flips with any edit of the road. The gobi's mega jump therefore sits at the salt lake —
  the one place where the officer's chase still lands on all three seeds; with the mega at the first dune,
  seed 1 failed, and at the last dune, seed 3 did. The water town's second market hump sits at 1016 m for
  the same reason (at 976 m a rival got stuck in the tea quarter's tight bend).

## Requests
- none.
