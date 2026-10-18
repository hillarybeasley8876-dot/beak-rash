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
