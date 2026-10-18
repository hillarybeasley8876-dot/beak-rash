# env-city unit — status (霓虹夜城 NEON NIGHT)

## Plan (milestones; [x] = done)
1. [x] Layout `src/world/layouts/city.ts` (≈3.38 km, flat street level STREET = 3 m abs, harbour around):
       start plaza → boulevard → corner R35 (R) → street → corner R30 (L) → scramble plaza → arcade
       → S-chicane R34 → expressway ramp (+9 m, parapets, detached) → crest jump drop → riverside (river
       LEFT) → red-arch bridge → riverside → underpass (−8 m, retaining walls) → tunnel (roof 8) → exit
       → avenue → hairpin R28 round a roundabout → sprint canyon of billboards → finish (giant screen).
       Registry line in layouts/index.ts; dressing stub + registry; CITY_LOOK in looks.ts;
       ground mat 'paved' (types.ts + profile.ts, additive). Check: track.test.mjs --track city.
2. [x] City batches + materials (dressing/city/batch.ts, mats.ts): aux attribute; building window
       shader (procedural lit windows, animated TVs/toggles, distance AA), HDR neon (flicker), LED
       screens, traffic-light cycle, additive light pools.
3. [x] Buildings (scenery/props/city-building.ts) + street walls/towers/skyline (dressing/city/blocks.ts).
4. [x] Neon signs atlas + meme lines (neon.ts, neon-faces.ts, lines.ts), LED screens with BILLBOARDS.city art.
5. [x] Wet road (env/city-mirror.ts + env/city-wet.ts).
--- resume 10-18 (session 2) plan ---
A. [ ] Wire paint.ts (sidewalks, zebra, scramble, lamp pools) + street props placement
       (dressing/city/street.ts): lamps+pools, traffic lights at crossings, bus stops, vending, planters, scooters.
B. [ ] Shops & people (props/city-shops.ts, city-people.ts; dressing/city/life.ts): food stalls 烧烤/奶茶,
       convenience store, subway entrance, calling-card mural, umbrella animal pedestrians (crowd bob), cables.
C. [ ] Landmarks (dressing/city/landmarks.ts …): start/finish neon gantries + giant finish screen, viaduct
       piers + deck fascia, underpass retaining-wall skin, tunnel interior (tiles, jet fans, lamp strips),
       roundabout monument (claims the hairpin island first), bridge arch neon.
D. [ ] Signs: distance markers, crest warning, corner chevrons, city road signs, start/finish banners.
E. [ ] Sky extras (moon halo, stars; env/city-sky.ts) + light rain (env/city-rain.ts, 1 draw call).
F. [ ] Far city fill for the aerial (cheap blocks to the harbour, cross streets).
G. [ ] Verify: chase + aerial shots, perf <= 250 calls / 800k tris, build <= 4 s, autopilot race, errors.

## Done
- M1 layout `layouts/city.ts` (3378 m, STREET 9 m abs, flat paved ground, harbour beyond ~200 m, river
  LEFT of the riverside, red-arch bridge, underpass+tunnel roof 8, hairpin R28, crest jump at 1566).
  track.test.mjs --track city passes (round trip, bounds/surface, NaN, leak).
- M2 city batches (`dressing/city/batch.ts` AuxBuf/AuxBatch + REFLECT_LAYER), materials (`mats.ts`,
  `glsl.ts`): procedural night windows (styles, TV flicker, toggles, LED lines, distance AA), HDR neon
  with flicker, light cycles.
- M3 buildings (`scenery/props/city-kit.ts`, `city-building.ts`), lots (`dressing/city/lots.ts`), street
  walls / towers / skyline per zone (`blocks.ts`); neon fascias, blades, rooftop + P5 boards, LED screens
  with BILLBOARDS.city art (`neon.ts`, `neon-faces.ts`, `lines.ts`).
- M5a wet road: planar mirror of the emissive layer (`env/city-mirror.ts`) + additive overlay with
  streaks / puddles / ripples / Fresnel (`env/city-wet.ts`). Looks great in game.

## Shared-file edits (additive only)
- layouts/index.ts: `if (id === 'city') return CITY;` · dressing/index.ts: `city: dressCity`.
- looks.ts: CITY_LOOK values (the city entry).
- layout/types.ts: GroundDef.mat += 'paved'; LayoutDef.farMargin?: number (optional).
- terrain/profile.ts: GROUND.paved/pavedDark/concrete + 'paved' branch in groundColor.
- terrain/far.ts: `const margin = L.def.farMargin ?? MARGIN` (city 460: build 4.1 s → 1.35 s).
- env/sky.ts: night-only cloud tint 0.62 → 0.84 (only the city is night). env/sea.ts: night foam tint.
- scenery/signs/faces.ts: `cell` exported.

## Known issues
-

## Core requests
-

## How to test
- `node sandbox/track.test.mjs --track city`
- `node sandbox/track.shots.mjs --q "track=city&s=600&x=2" --out shots/env-city/x.png` (view=aerial|high)
- `node tools/shot.mjs --url "/?race=city&seed=3&traffic=0" --out shots/env-city/g.png --step 300 --controls '{"throttle":1}'`
