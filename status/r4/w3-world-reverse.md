# w3-world-reverse — every track drivable in reverse (world unit)

## Plan
1. `src/world/layout/types.ts`: `LayoutDef.origin?: {x,z}` (world position of s=0) + `LayoutDef.reversed?: boolean`.
2. `src/world/layout/build.ts`: integrate from `def.origin`; expose the heading array (`BuiltLayout.hdg`).
3. `src/world/layout/reverse.ts`: `reverseLayout(def)` — segments reversed, radius/rise/bank negated,
   left/right profiles swapped (patch-diff per segment), ease/vEase/sideEase moved one segment along,
   features/marks re-anchored (at' = len−at[−flen], x' = −x), jumpCrest peak → L−peak, bumps mirrored,
   pre/post swapped, heading/elevation/origin from the forward finish, start/finish set pieces swapped.
4. `src/world/track.ts`: `opts.reverse` → build from `reverseLayout(layoutFor(id))`; `Track.reverse = true`.
5. Dressing: `ctx.mirror` (±1) in `src/world/ctx.ts`; `Dress.side()` / `GobiCtx.side()`; every hard-coded
   side in `src/world/dressing/**` flipped (coast sea side, city river + far bank, mountain cliff side,
   gobi signs), the mountain's lake peaks re-anchored on the mirrored road.
6. `sandbox/track.ts` + `sandbox/track.audit.mjs`: `?reverse=1` / `--reverse`.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/world/`
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city`
- `node tools/r4/w3-reverse.mjs --tracks watertown,gobi`
- `node sandbox/track.audit.mjs --track coast --reverse --skip stall`
- `node sandbox/track.audit.mjs --track coast --skip stall`
- `node tools/r4/w1-weather.mjs --tracks coast,mountain`
- `node tools/core-check.mjs`
- probes: `node shots/r4-w3-world-reverse/probe-reverse.mjs --tracks coast,mountain,city,watertown,gobi`

## Done
- `reverseLayout()` (src/world/layout/reverse.ts): the same road driven the other way. The mirrored road
  starts at the forward finish (same world position, heading + 180°) so it lies **exactly** on the forward
  one (probe: offset 0.000 m, tangents −dot 1.000, curvature error 0.00000, features kept 1:1).
  - segments reversed; radius / rise / bank negated; roof kept; the left and right side profiles swapped
    (each mirrored segment gets the patch that turns the previous mirrored profile into its own);
  - ease / vEase / sideEase move one segment along (the transition belongs to the boundary that is now the
    segment's end) — the ramp keeps its width, centred on the same boundary;
  - features re-anchored (at' = len − at − flen, x0' = −x1, x1' = −x0), jumpCrest `peak` → L − peak
    (the crest still launches: peak y 0.88–2.65 m in the acceptance runs);
  - marks re-anchored (at' = len − at, x' = −x); bumps mirrored (s → L − s, x → −x);
  - pre/post aprons swapped; heading / elevation / origin taken from the forward finish;
  - the start and finish swap ends: the zone names 'start' ↔ 'finish' and the set pieces
    (startGantry ↔ finishGantry, finishArch ↔ startGantry) change kind and stand where their own kind
    stands on the forward road (the start gantry ahead of the grid, the finish arch on the line).
- `createTrack(..., { reverse: true })` builds the mirrored layout and reports `Track.reverse = true`;
  weather and reverse combine (the w1-weather checks still pass).
- `WorldCtx.mirror` (1 = authored, −1 = mirrored) + `Dress.side()` / `GobiCtx.side()`; the dressings that
  hard-code a side now follow the road: the coast's sea side (palms, hedges, rocks, olive terraces, quay
  lamps, boats, market, pier, sea boats, distance markers, lane signs), the city's river + far bank +
  pylons + signs + the hairpin's roundabout island, the mountain's cliff-side forest + lake peaks, the
  gobi's signs + salt pan. The forward builds are unchanged (the audits and the weather checks match).
- `sandbox/track.html?reverse=1` and `sandbox/track.audit.mjs --reverse` build and audit the mirrored road.

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/world/` → `TSC-OWN OK`
- `node shots/r4-w3-world-reverse/probe-reverse.mjs --tracks coast,mountain,city,watertown,gobi` →
  `PASS coast: L 3300/3300 offset 0.000 m y 0.000 -dot 1.000 k 0.00000 feats 26/26` (same for the others,
  mountain 0.248 m because its hairpin lengths are not whole metres)
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city` → `w3-reverse OK`
  (`PASS coast: the reversed ramp at s 1481 still launches (peak y 1.50 m)`,
  `PASS coast: a reversed autopilot race reaches race:end with ≥ 6 finishers (8)`)
- `node sandbox/track.audit.mjs --track coast --reverse --skip stall` → `AUDIT OK` (intrude 0.069 m)
- `node sandbox/track.audit.mjs --track coast --skip stall` → `AUDIT OK` (intrude 0.069 m, unchanged)
- `node tools/r4/w1-weather.mjs --tracks coast,mountain` → `w1-weather OK`
- `node tools/core-check.mjs` → `core-check OK`
- stills: `shots/r4-accept-reverse/*.png` (the lead's acceptance sheet) and
  `shots/r4-w3-world-reverse/sheet-*.jpg` — the mirrored coast shows the sea on the rider's right, the
  START gantry over the start line and the FINISH arch on the line.

## Known issues
- Twice, `node tools/r4/w3-reverse.mjs` failed only on a console error from another unit in progress
  (`[modules] unit "audio" failed to load … SHAKER is not defined` / `Failed to fetch …/src/audio/index.ts`,
  src/audio/**) — not a world file; every world check of those runs passed and both groups pass on a re-run
  (`w3-reverse OK` twice).
- The mirrored road is the forward road with the scenery mirrored about it (the sea swaps sides), so the
  two builds show the same corners from opposite sides — that is what "driven in reverse" means here.

## Requests
- none
