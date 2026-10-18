# env-mountain — status (落日山道 SUNSET PASS)

## Plan (milestones)
1. [ ] Layout `src/world/layouts/mountain.ts` (~3.6 km): village start → pine climb → 3 hairpins
       (R 24–32, banked, chevrons) → cliff road (rock wall / rail + drop) → curved lit tunnel → gorge
       suspension bridge (river = water plane at lake level 0, waterfall) → summit crest jump + pagoda
       → descent with S-chicane (R 40–55) + ramp → lakeside straight → finish gantry with lanterns.
       Registry lines in layouts/index.ts + dressing/index.ts. 2D plan bench `sandbox/mountain.html?map=1`.
2. [ ] Terrain between switchback legs: ribbons clipped at the mid-line between legs + heights
       blended there (generic optional hook in field.ts/near.ts, logic in env/mountain-legs.ts).
3. [ ] Look: mountain entry in looks.ts (low warm sun, gold→pink→violet sky, warm fog); env:
       layered ridge silhouettes (env/mountain-ridges.ts), big sun disc + god-ray hint
       (env/mountain-sun.ts), sky-tinted lake (recolour sea uniforms), waterfall + mist.
4. [ ] Dressing `src/world/dressing/mountain/*`: forests (pines/firs/birches, far LOD clusters),
       rocks/strata, village (houses, stands, lanterns, start gantry), signage (mountain faces,
       chevrons, road signs, billboards w/ BILLBOARDS.mountain art, distance markers), pagoda
       viewpoint, tea terraces, hot spring w/ capybaras + sign, cows behind fences, cable car,
       wind turbines, hot-air balloons, prayer flags / lantern strings, finish gantry w/ lanterns.
5. [ ] Verify: track.test --track mountain, perf ≤250 calls/≤800k tris, build ≤4 s, autopilot race
       finishes, chase-cam contact sheet + aerial; critic pass on screenshots; fix.

## Done
- M1 layout v1 (3588 m, y 3..119, max grade 15 %), registry lines, 2D bench (sandbox/mountain.*).
- M2 switchback terrain: env/mountain-legs.ts (LegBlend) via new optional hook; legs hug the slope.
- M3 look (mostly): env/mountain-relief.ts (ridged relief + lake peaks), mountain-grade.ts (alpine
  vertex palette, farmland off), mountain-sky.ts (golden-hour dome, sun disc, god-ray hint),
  mountain-ridges.ts (4 layered silhouettes), mountain-lake.ts (sky-mirroring lake shader).
- M4 started: props/mountain-trees.ts (pine/fir/birch/farPine/teaBush), dressing/mountain/forest.ts
  (roadside trees, boulders, far forest), dressing/mountain/index.ts, util.ts.
- sandbox/mountain.race.mjs (autopilot soak) written 03:53 (not yet run/recorded).

## In progress (resumed again 10-18 ~14:30; props/mountain-house.ts + mountain-deco.ts are complete) — M4 module plan
Zone s (approx): start 0-160 · village 160-300 · pines 300-630 · hairpins 630/855/1089 (legs between) ·
cliff 1171-1651 · cutting 1651-1691 · tunnel 1691-1931 · portal -1957 · bridge 1957-2087 · summit 2123-2283 ·
crest top 2343 · descent 2403-2663 · chicane 2663-2768 · descent -3008 · lake 3008-3188 · lakeside -3428 · finish -3588
- [x] dressing/mountain/marks.ts: mark dispatcher (sorted: landmarks first).
- [x] dressing/mountain/signage.ts + faces.ts: chevron rows, SUNSET PASS road signs, scenic signs, billboards
      (TRACK_BILLBOARDS.mountain first, BILLBOARDS.mountain art); km markers/banners/flags/stands via coast helpers.
- [x] dressing/mountain/village.ts + props/mountain-house.ts + props/mountain-deco.ts: houses, lantern strings/posts,
      lantern gantries.
- [x] props/mountain-bridge.ts + dressing/mountain/gorge.ts + env/mountain-waterfall.ts: vermilion suspension
      bridge (pagoda-capped towers, prayer flags on the cables, truss girder), waterfall + mist + river rocks.
- [ ] props/mountain-pagoda.ts: pagoda viewpoint at the crest.
- [ ] dressing/mountain/farm.ts + props/mountain-animals.ts: tea terraces, cows + fences, hot spring
      + capybaras + sign.
- [ ] env/mountain-life.ts: cable car (moving gondolas), wind turbines (spinning), balloons, prayer flags.

## Shared-file edits (track unit files; additive only)
- layouts/index.ts: `if (id === 'mountain') return MOUNTAIN;` (+ import).
- dressing/index.ts: `mountain: dressMountain` (+ import).
- looks.ts: MOUNTAIN_LOOK values (golden hour, mauve fog).
- layout/types.ts: optional `LayoutDef.terrainMod?: (field) => TerrainMod` (+ type import).
- terrain/field.ts: `TerrainMod` interface, `readonly mod` (built from the layout), applied in
  heightAt() and sampleWorld(). No-op when a layout has no terrainMod (coast/city unchanged).
- terrain/near.ts: foldScale room = min(curve room, mod.room); ribbon vertex height via mod (c > 0).

## Known issues
-

## Core requests
-

## How to test
- 2D plan: /sandbox/mountain.html?map=1
- 3D: `node sandbox/track.shots.mjs --q "track=mountain&s=600&x=2" --out shots/env-mountain/x.png`
