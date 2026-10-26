# r5 — job `air`: enough air on every track (world + sim)

## Plan
1. `src/world/layouts/jumps.ts` (new): the jump catalogue — `KICK.small/mid/big` presets
   (len/height), a `kicker(preset, {at, side, hw})` helper (FeatureDef) and the sign mark.
   Verify: `node tools/r4/tsc-own.mjs src/world/layouts/` → TSC-OWN OK.
2. `src/world/features/ramp.ts`: the kicker reads as a jump from 100 m — a big board on the
   structure (`data.big`), side trusses, hazard lip (already), the same wedge the sim rides.
   Verify: `node tools/r4/tsc-own.mjs src/world/features/` + a browser shot of a big kicker.
3. `src/world/features/decals.ts`: a road arrow + word before every big ramp (from the feature
   data, no new mark kinds → no dressing warnings).
   Verify: the browser shot shows the arrow 20 m before the kicker.
4. The 5 layouts: ≥ 6 jumps each (≥ 0.7 s at 22 m/s), ≥ 2 of them ≥ 1.3 s, ≥ 180 m apart, on
   straights / R ≥ 200 bends, clear landing 80 m after, no overlap with other features, no
   ramp inside a tunnel/bridge. The signature crests are sharpened (u+d ≈ 0.5, sharp vEase).
   Verify: `node tools/r5/air.mjs` → r5-air OK (and `shots/r5-air/model.mjs` offline first).
5. `src/world/features/bridge.ts`: the arch style is a per-track choice ('steel' | 'stone');
   watertown gets the stone humpback. `dressing/watertown/bridges.ts`: the town's crossing
   keeps only the piers the shared bridge does not draw.
   Verify: `node tools/r4/w1-newtrack.mjs --track watertown --min bridge:3,jumpCrest:2,pickupRow:3 --shots shots/r5-air/watertown`.
6. Reverse + routes still work: `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city,watertown,gobi`,
   `node tools/r4/w3-routes.mjs --race mountain`, soaks coast + mountain, `node tools/core-check.mjs`.
7. Look: a chase shot 40 m before every big jump + one mid-air per track, under `shots/r5-air/`.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/world/layouts/ src/world/features/ src/sim/features.ts src/world/dressing/watertown/bridges.ts src/world/layout/route-hints.ts`
- `node tools/r5/air.mjs`
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city,watertown,gobi`
- `node tools/r4/w3-routes.mjs --race mountain`
- `node tools/r4/w1-newtrack.mjs --track watertown --min bridge:3,jumpCrest:2,pickupRow:3 --shots shots/r5-air/watertown`
- `node tools/race-soak.mjs --track coast` · `node tools/race-soak.mjs --track mountain`
- `node tools/core-check.mjs`
- offline: `node shots/r5-air/model.mjs <track>` · `node shots/r5-air/dump.mjs --tracks coast,city,mountain,watertown,gobi`

## Done
- Read SPEC §4/§16/§17/§20, the layouts, sim/features.ts, world/features/*, layout/route*.ts.
- Offline model of the sim's vertical + lateral dynamics (`shots/r5-air/model.mjs`): reproduces the
  browser's air times within ~0.07 s; used to design the jumps.
- Measured the baseline: coast 0.82/0, city 0.76, mountain 0.83/0, watertown 1.10/1.08, gobi 0.80/0.74/0.57/0.86/0.62.

## In progress / next
- (lead, after review) The worker ran out of turns after the acceptance passed; this checkpoint was not updated.
  What landed: `layouts/jumps.ts` (a shared kicker / jump-hill catalogue: low / mid / big kickers, a 12 + 12 m
  jump hill with a crest on top), every layout re-cut with 6+ jumps (2+ big hills), `features/jump.ts` +
  `textures.ts` (the JUMP sign before the big ones, painted kickers / crest lip), `features/ramp.ts` (taller wedge).
  All eight acceptance commands passed (r5-air, reverse ×5 tracks, routes, watertown full track, two soaks, core).
- Not done: the per-track bridge arch (the water town still hides the shared red arch at runtime).

## Known issues
- The sim's ramps only launch when the rider is still on the wedge's x-range: a side ramp on a
  bend is missed (the rider drifts wide) → the ramps go on straights or are wide.

## Requests
- `dressing/watertown/index.ts` (not mine) still calls `hideSteelBridges()`: it removes the
  `structures:` meshes, so the town's own stone arches must not be in that batch. Please delete
  that workaround once the shared bridge draws the stone humpback.
