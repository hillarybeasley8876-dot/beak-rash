# r6-hitch — no shader program compiles after GO

## Plan
1. Probe: copy `tools/r5/hitch.mjs` into `shots/r6-hitch/probe.mjs`, log each late program's
   `cacheKey` + the closest warmed one + the scene material that holds it.
   Proof: `node shots/r6-hitch/probe.mjs --tracks coast` prints a `who:` line per late program.
2. Baseline GO time: `shots/r6-hitch/go-time.mjs` (coast, seed 3, 3 loads, `__br.game.lastWarmup`).
   Proof: prints `GO <ms>` three times; this is the "before" number.
3. Fix the combat visuals' warm-up (`visuals/materials.ts`): one stand-in per ink-outline width combat
   draws (meme rain drop 0.01, gag/elem 0.02, 0.03, pickups/projectiles 0.035, ult meteor 0.04,
   ult storm 0.05) — today only 0.03 and 0.035 are warmed, so `outline-0.0100` compiles mid-race.
   Proof: probe shows no `outline-0.0100`; `node tools/r5/hitch.mjs` → `r5-hitch OK`.
4. Fix the police warm-up (`police/warm.ts`): the beacon and the riot shield hang off the police rider's
   view root, so actors' RiderFade clones their materials when an officer fades (downed / invulnerable)
   — `|fade`, `|fade-depth`, `outline-0.0200|fade-hull`. Park stand-ins with those exact cache keys.
   Proof: `node shots/r6-hitch/fade-keys.mjs` prints WARMED for all six clones the officer needs.
5. Acceptance: tsc-own, hitch, w3-fx, police, present --only visual, sandbox/fx.warm.mjs, core-check,
   plus the GO time re-measured (≤ 0.3 s slower than step 2).

## Done
- step 1: `shots/r6-hitch/probe.mjs` (late programs + the material in the scene that compiled them).
  Baseline `node tools/r5/hitch.mjs` failed on all five tracks, one program each, all the same:
  `outline-0.0100`, held by `/session/combat/Mesh/Mesh` — the crying cat's rain drops
  (`skills/meme/visuals.ts`, `toonMesh(geo('meme:drop'), 0.01)`), cast by an AI rival in the first
  event window. The tag (`fishSpill@14.2`, `geese@24.6`, …) is only the ride window it landed in.
- step 2: baseline GO 6223 / 6400 / 6270 ms (61 programs, readyMs ~500, drawMs ~1500).
- step 3: `visuals/materials.ts` — `HULL_WIDTHS` stand-ins, one per ink-hull width combat draws.
- step 4: `police/warm.ts` — `fadeClone` mirrors actors/fade.ts's clone recipe (clone, copy
  `onBeforeCompile`, `<base>|<key>` cache key) and warms the six programs an officer's own meshes need
  when it fades: toon + unlit `|fade` / `|fade-depth`, and `outline-0.0200|fade-hull` /
  `outline-0.0250|fade-hull` (the beacon's pole and bars, the riot shield's plate and stripe).
- step 5: every acceptance command run, all green (below). GO after: 6400 / 6221 / 6374 ms (+~0.1 s,
  inside the noise, well under the 0.3 s budget; 68 programs, readyMs ~350, drawMs ~1150).

## In progress / next
- nothing; the job is finished. Scratch probes stay under `shots/r6-hitch/`.

## How to test (exact commands)
- `node shots/r6-hitch/probe.mjs --tracks coast,mountain` → `0 late of N programs`
- `node shots/r6-hitch/fade-keys.mjs` → every `fade clones the officer needs` line says WARMED
- `node shots/r6-hitch/go-time.mjs --runs 3`
- `node tools/r4/tsc-own.mjs src/gameplay/race/events/ src/gameplay/race/police/ src/gameplay/combat/visuals/`
- `node tools/r5/hitch.mjs` · `node tools/r4/w3-fx.mjs` · `node tools/r6/police.mjs`
- `node tools/r6/present.mjs --only visual` · `node sandbox/fx.warm.mjs` · `node tools/core-check.mjs`

## Evidence (key output lines)
- before: `FAIL coast: no shader program compiles after GO (1: fishSpill@14.2; 94 programs)` (5/5 tracks)
- before: probe `who: /session/combat/Mesh/Mesh Mesh/MeshBasicMaterial key=outline-0.0100`
- after: `PASS coast: … (0: none; 98 programs)` … `r5-hitch OK` (all five tracks, no console errors)
- after: `TSC-OWN OK`, `w3-fx OK`, `r6-police OK`, `r6-present OK`, `core-check OK`,
  `fx.warm exit=0` with `{"track":"coast",…,"late":0,"fxLate":0,"errors":[]}`
- load: before `GO 6270 ms … programs 61`, after `GO 6374 ms … programs 68`

## Known issues
- The late-program list is timing-dependent (which AI rival casts what, and when an officer fades), so a
  single run is not proof on its own; the two causes above were identified from the cache keys, and
  `fade-keys.mjs` checks the police recipe against actors' real RiderFade deterministically.
- Other workers edit the tree at the same time: one run of the city track failed with
  `[modules] unit "race" failed to load … 'BLOCK_LOOK'` (another unit's in-progress file).

## Requests
- `src/core/warmup.ts` needs no change: the stand-ins are compiled by `drawEverything` (three's
  `compileAsync` uses `traverseVisible`, so a hidden stand-in only compiles in that forced frame — which
  is how every existing warm kit already works).
