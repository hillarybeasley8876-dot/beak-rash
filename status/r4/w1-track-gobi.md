# w1-track-gobi — 戈壁公路 GOBI HIGHWAY (r4 §20)

## Plan
1. `src/world/layouts/gobi.ts` — real layout (3750 m): long straights, wide sweepers R200–260, two
   sharp bends R65/R75, 3 jump crests (650 / 2410 / 3490) + 2 ramps (545 / 3160), 10 pickupRows,
   3 boostPads, 3 oil patches, marks for every landmark. Side profiles: sand shoulders + rail edge,
   barrier at start/finish, a rock face at the butte pass, a stone dyke at the salt lake.
2. `src/world/dressing/gobi/` — one Group `dress:gobi` under the track group, all props merged per
   batch cell: dunes, mesas/buttes, turbines (GPU-animated rotors), pumpjacks (nodding beams),
   camels, truck stop, telegraph poles, salt pan, caravanserai finish arch, gantry, billboards/signs.
3. `src/world/env/gobi-look.ts` — hard desert noon look, sun-bleached warm asphalt.
4. `src/data/track-content/gobi.ts` — 8 billboards, 4 signs, 10 calendar 宜/忌, name/blurb/weather.
5. `src/ui/tracks/gobi.ts` + `node tools/ui-track-stills.mjs --tracks gobi` → src/ui/assets/track-gobi.webp.

## Done
- Layout: 3750 m, 18 segments, own feature mix (ramp 2, jumpCrest 3, pickupRow 10, boostPad 3, oil 3),
  tightest curve R 65 m. The track sits on a high desert plateau (elevation 130 m): the shared far
  terrain paints farmland on flat ground between 4 and 115 m, so `terrainMod` keeps the Gobi plain
  at ≥ 122 m (no wheat fields in the desert).
- Dressing: `src/world/dressing/gobi/{index,gctx,batch,atlas,kit,land,town,industry,critters,roadside}.ts`
  — one `dress:gobi` group, 43 merged meshes, ~300 k triangles; dunes, buttes, 8 wind turbines
  (rotors spin in the vertex shader), 4 nodding pumpjacks, camel caravans, the truck stop with its
  meme price sign, the salt pan, telegraph poles with sagging wires, the GOBI start gantry and the
  caravanserai finish arch at the oasis. Stage-by-stage yields (4 mark groups + 4 scatter slices +
  per-cell batch build) so no loading task is long.
- Look: hard noon (sun 2.6, dusty ochre fog 360–1450 m), warm bleached asphalt `#6e6559`.
- Content: 8 billboards, 4 signs, 10 calendar pairs, INFO (name / blurb / weather / 3.8 km / diff 2).
- UI: vector card (`gb-` ids: sun, road, turbine, camel, mesas, a red slash), sun-and-wind weather
  icon, in-engine still `src/ui/assets/track-gobi.webp` (rendered by tools/ui-track-stills.mjs).

## In progress / next
- Nothing left: all four acceptance commands pass (see Evidence).

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/world/layouts/gobi.ts src/world/dressing/gobi/ src/world/env/gobi-look.ts src/data/track-content/gobi.ts src/ui/tracks/gobi.ts`
- `node tools/r4/w1-newtrack.mjs --track gobi --min ramp:2,jumpCrest:2,pickupRow:3 --shots shots/r4-accept-gobi`
- `node sandbox/track.audit.mjs --track gobi --skip stall`
- `node tools/core-check.mjs`
- Look at it: `node shots/r4-w1-track-gobi/probe.mjs 0.05 0.39 0.65 0.94` (chase stills + draw calls).

## Evidence (key output lines)
- `TSC-OWN OK`
- `w1-newtrack gobi OK` — length 3750 m; tightest curve R 65.0 m; ramp 2 / jumpCrest 3 / pickupRow 10;
  dressing 93 meshes, 300 070 tris; budget at six spots: worst 186 calls, 634 768 tris;
  autopilot race: 8 finishers in 179 s, 0 wall/water crashes; no console errors.
- `AUDIT OK` — road 5000 samples, 0 misses; edges 2000 ok / 0 missing / 0 inside; curbs 0 mismatch;
  intrusion worst 0.069 m (the shared edge mesh) < 0.08.
- `core-check OK` (all 8 checks PASS).
- Stall (audit without --skip stall): worst long task 137 ms (the shared mountain track measures 168 ms
  on the same machine); the gobi dressing itself: 4 mark groups + 4 scatter slices ≈ 10–15 ms each,
  atlas faces painted as they are created (no end-of-build flush), batch build 43 ms.

## Known issues
- The Gobi's plain is high (elevation 130 m) because the shared far-terrain system paints farmland
  between 4 and 115 m; `terrainMod` in the layout keeps the plain at ≥ 122 m. The far sea plane
  (y = 0) stays 120 m below the road and is hidden by the fog.
- The shared `world/env/mountain-anim.ts` helper (used for the turbine rotors) lives under the
  mountain env name; the gobi dressing imports it — see Requests.

## Requests
- `src/world/env/mountain-anim.ts` is a generic vertex-animation helper (animatedMesh + lifeTime)
  that now serves two tracks; moving it to `src/world/kit/anim.ts` would be cleaner.
- (Optional, shared) the far-terrain farmland (`world/terrain/farmland.ts`) has no "dry desert"
  switch: a per-layout flag (e.g. `LayoutDef.farmland?: boolean`) would let a desert track opt out
  instead of keeping its plain above the farmland height band.
