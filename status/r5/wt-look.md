# r5 · wt-look — 江南水乡: flagstones across the lane, stone shoulders, a soft drizzle

## Plan
1. Read SPEC §5/§20, road/, weather/, env/watertown-look.ts, tools/r5/wt-look.mjs. `node tools/r5/wt-look.mjs` (baseline).
2. Fix the flagstone paving: the slab course loop starts at x≈0 instead of −halfWidth, so only the
   right half of the lane gets slabs and the left is the dark joint colour. Cover −hw..+hw.
   Proof: `node tools/r5/wt-look.mjs` (left mean ≥ 80, left edges ≥ 0.02).
3. Make the slabs a light cool grey (青石板), with visible dark joints, per-slab tint, worn slabs,
   a drain line down the middle, no tiling seam. Proof: `node tools/r5/wt-look.mjs`.
4. Shoulders: granite setts for the water town (no brown dirt).
   Proof: `node tools/r5/wt-look.mjs` + a look at the stills.
5. Drizzle: the wet road shader darkens too much for the town's soft drizzle and eats the joints;
   give the town its own wet amount (darker but joint-preserving, sky sheen) and a mistier haze.
   Proof: `node tools/r5/wt-look.mjs` (rain frame luminance ≥ 0.8·clear, rain left edges ≥ 0.015).
6. Acceptance: tsc-own, wt-look, w3-world-polish, w1-weather, core-check + a contact sheet in
   `shots/r5-wt-look/`.

## Done
- **root cause found**: `road/flagstone.ts` laid its courses from `x ≈ 0` to `x = 2·halfWidth`
  while the texture's X() maps `−halfWidth..+halfWidth` onto the canvas, so the left 2.85 m of the
  7.2 m lane was bare joint colour (`#3b434e`) — the "dark asphalt". The courses now run
  `−halfWidth..+halfWidth` and the whole lane is paved.
- `road/flagstone.ts` rewritten: 0.75 m courses of 1.2–2.4 m blue-grey slabs (hsl 206±9, 7–14 %,
  57–67 % l) over the full lane width, staggered per course, 0.03 m near-black joints, a lit
  chamfer on every slab, 30 % worn (darker) slabs, wear patches, a drain line of smaller darker
  stones down the middle. 64 px/m, tiles every 24 m (32 whole courses → no seam), generated once
  per build.
- `road/sett.ts` (new): the granite sett pavement for the shoulders (cool grey setts, dark joints,
  staggered courses, 4 m tile = the shoulder's own u = x/4, v = s/4 mapping).
- `road/road.ts`: the water town's shoulders use the sett texture (and a white vertex colour — the
  setts carry their own); the other tracks keep the plain grain. No other track touched.
- `weather/wet.ts`: the wet look is now per track (`wetLookFor`) — the town's drizzle darkens the
  stone 0.86 (not 0.6), a softer sheen (0.5) and a smaller specular, so the joints survive the
  rain; the town's shoulders get the wet look too, the other tracks are unchanged. Each material
  is patched once (the two shoulders share one material — patching it twice broke the shader) and
  the program cache key now carries the track id, so the town's road (which has no detail shader)
  never reuses another track's program.
- `weather/table.ts`: the new `softRain` tuning block.
- `weather/look.ts`: the town's drizzle now carries the light (ambient ×1.15) and its haze comes a
  little closer (fog near ×0.9, far ×0.85) — a soft misty drizzle, not a dark grey wash. The other
  tracks' rain look is unchanged.

## In progress / next
Nothing left in the brief. The lead may want a look at the drain line (it runs under the rider)
and at the warm stone of the town's landmarks, which I left as they were.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/world/road/ src/world/env/watertown-look.ts src/world/weather/ src/world/dressing/watertown/`
- `node tools/r5/wt-look.mjs`
- `node tools/r4/w3-world-polish.mjs --shots shots/r5-wt-look/polish`
- `node tools/r4/w1-weather.mjs --tracks coast,watertown`
- `node tools/core-check.mjs`
- Look: `shots/r5-wt-look/after-sheet.jpg` (8 stills, clear + rain), `shots/r5-wt-look/town-720.jpg`
  (1280×720), `shots/r5-wt-look/after-clear-left.jpg` (the lane up close).

## Evidence (key output lines)
- baseline (before): `FAIL the lane is light stone … (mean ≥ 80 left and middle: s257 L 55/0.001
  M 57/0.000 R 61/0.004 …)`, `FAIL slab joints show across the lane`, `r5-wt-look FAILED (3)`.
- after: `PASS the lane is light stone, not dark asphalt (mean ≥ 80 left and middle: s263 L 123/0.074
  M 126/0.074 R 120/0.054 · s1313 L 125/0.062 M 123/0.057 R 122/0.064 · s1838 L 119/0.073 M 112/0.063
  R 121/0.079 · s2954 L 120/0.066 M 122/0.076 R 120/0.065)`, `PASS slab joints show across the lane`,
  `PASS the paving is even across the lane`, `PASS the drizzle is soft, not a dark wash (frame
  luminance 114 vs clear 139, ≥ 80 %)`, `PASS the wet slabs still show their joints in the drizzle
  (0.032, 0.036, 0.032, 0.034)`, `r5-wt-look OK`.
- `node tools/r4/tsc-own.mjs …` → `TSC-OWN OK` (2 errors ignored: `src/world/layouts/gobi.ts`,
  the layouts job's file, not mine).
- `node tools/r4/w3-world-polish.mjs --shots shots/r5-wt-look/polish` → `watertown: budget
  (119/434k 81/237k 99/378k 94/340k)`, `watertown: no highway centre lines in the road band
  (worst 0.00 %)`, `w3-world-polish OK`.
- `node tools/r4/w1-weather.mjs --tracks coast,watertown` → `watertown rain: puddles 4 → 9`,
  `watertown rain: a greyer, darker look (sat 0.9 → 0.774, sky luma 160 → 129)`, `w1-weather OK`.
- `node tools/core-check.mjs` → `core-check OK`.
- Browser: every run ended with `__br.errors` empty (`probe-720.mjs` printed `errors []`).

## Known issues
- The town's rain frame luminance is 114 against 139 in clear = 0.826 of the 0.80 the check needs.
  The margin is thin; a further change to the town's soft-rain look would fix it but I left the
  look as it is.
- The terrain beside the town's lanes (the pale sandy ground beyond the wall) is still the warm
  `stone` terrain material — it is in `src/world/terrain/`, which this job does not own.
- The drain line of smaller stones down the middle of the lane runs under the rider, so it is only
  visible in the wide shots.

## Requests
- None for the core. If the lead wants the town's ground (the wide tan strip beyond the street
  wall) to be cool grey instead of sand, that is `src/world/terrain/` — not owned by this job.
