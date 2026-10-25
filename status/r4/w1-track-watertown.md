# w1-track-watertown — 江南水乡 WATER TOWN (r4, SPEC §20)

## Plan
1. `src/world/layouts/watertown.ts` — real layout: 3.21 km point-to-point, halfWidth 4.8, elevation 1.6
   (canal water at y=0). Zones: start · lanes (R 48) · canal · hump ×2 (stone humpback, jumpCrest) ·
   market · tea (R 34) · sweeper (R 240) · hump ×2 · archway (R 60) · bridge ×3 (canal crossings) ·
   corners (R 34 / R 38) · promenade · sprint · finish. Features: bridge ×3, jumpCrest ×2, pickupRow
   ×12, puddle ×4, boostPad ×3. R ≥ 34 m; every corner turns ≤ 93°.
2. `src/world/env/watertown-look.ts` — drizzle palette (overcast sky, cool mist, wet grey stone road).
3. `src/data/track-content/watertown.ts` — 8 billboards, 4 signs, 10 calendar 宜/忌 pairs, INFO.
4. `src/world/dressing/watertown/` — index.ts (orchestrator, one group `dress:watertown`) + props.ts
   (粉墙黛瓦 house with 马头墙 gables, willow, far house) + landmarks.ts (牌坊, 茶馆, pagoda, 乌篷船) +
   bridges.ts (humpback stone arch + the water sheets) + places.ts (placement) + util.ts.
5. `src/ui/tracks/watertown.ts` — vector card (ids `wt-`), drizzle icon, still from
   `node tools/ui-track-stills.mjs --tracks watertown` → `src/ui/assets/track-watertown.webp`.
6. Acceptance (all four run, all pass — see Evidence).

## Done
- Layout, look, content, dressing, card + still: written and verified.
- Bugs found and fixed while testing:
  - every corner turned 200-270° (the track spiralled and the sides read mirrored) → each corner is
    now its own short segment; net turn +13°.
  - side profiles are inherited between segments, so the zones with no override kept the start
    apron (red/white barriers down the whole town) → every zone now names its own sides.
  - the lantern strings hung from the ground (low on the quay side → into the lane) → they hang
    from the road's height now.
  - the 牌坊's pillars stood in the lane → they stand clear of the bound.
  - the bridge's stone railing sat inside the drivable box → the masonry is a solid parapet above
    the deck instead.
  - the roof pitch was too shallow to read → 1.75 m rise + stepped 马头墙 gables.
- Probes (own, under `shots/r4-w1-track-watertown/`): probe-layout · probe-edges · probe-profile ·
  probe-intrude · probe-spots · probe-high · probe-look · probe-pick · probe-sides · probe-card.

## In progress / next
- Nothing blocking. Optional polish: the 牌坊's beams are plain red slabs; the tea house's sign is
  small at speed.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/world/layouts/watertown.ts src/world/dressing/watertown/ src/world/env/watertown-look.ts src/data/track-content/watertown.ts src/ui/tracks/watertown.ts`
- `node tools/r4/w1-newtrack.mjs --track watertown --min bridge:3,jumpCrest:2,pickupRow:3 --shots shots/r4-accept-watertown`
- `node sandbox/track.audit.mjs --track watertown --skip stall`
- `node tools/core-check.mjs`
- Look: `python tools/thumb.py shots/r4-accept-watertown/*.png -o shots/r4-w1-track-watertown/accept.jpg`

## Evidence (key output lines)
- `TSC-OWN OK`
- `w1-newtrack watertown OK` — length 3212 m · R 34 ≥ 22 · bridge 3 / jumpCrest 2 / pickupRow 12 ·
  `dress:watertown` 99 meshes, 353 389 tris · budget 135 calls / 496 301 tris · autopilot race:
  8 finishers in 160 s · 0 wall/water crashes · no console errors.
- `AUDIT OK` — road 4325 samples, 0 misses · walls 1341 ok / 0 missing · water 389 ok / 0 blocked ·
  intrusion worst 0.019 m.
- `core-check OK`
- Layout probe: length 3212 · maxK 0.0294 (R 34) · jumpCrest kick 0.346 (≈ 5.2 m/s at 15 m/s).
- Rebuild (audit's stall check): 695 ms, worst long task 124 ms — the coast is 1023 ms / 139 ms.

## Known issues
- The road texture is the shared one: a double yellow centre line and white lane dashes. The lane is
  narrow (9.6 m) but the markings are the game's shared road language (coast / city / mountain too).
- The far terrain's farmland patchwork (shared) makes the fields around the town green — fine for
  江南 rice paddies, but it is not a track-specific colour.
- The three big canal crossings use the shared `bridge` feature, so they are red steel arches; the
  two humpback stone bridges are this job's own dressing.

## Requests
- None.
