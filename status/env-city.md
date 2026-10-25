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
--- resume 10-18 (session 2 planned at 11:25, interrupted before any code; session 3 resumed 14:20) ---
A. [x] Wire paint.ts (sidewalks, zebra, scramble, lamp pools) + street props placement
       (dressing/city/street.ts): lamps+pools, traffic lights at crossings, bus stops, vending, planters, scooters.
B. [x] Shops & people (props/city-shops.ts, city-people.ts; dressing/city/life.ts): food stalls 烧烤/奶茶,
       convenience store, subway entrance, calling-card mural, umbrella animal pedestrians (crowd bob), cables.
C. [x] Landmarks (dressing/city/landmarks.ts …): start/finish neon gantries + giant finish screen, viaduct
       piers + deck fascia, underpass retaining-wall skin, tunnel interior (tiles, jet fans, lamp strips),
       roundabout monument (claims the hairpin island first), bridge arch neon.
D. [x] Signs: distance markers, crest warning, corner chevrons, city road signs, start/finish banners.
E. [x] Light rain (env/city-rain.ts, 1 draw call). Stars / extra moon halo skipped: it rains, and sky.ts
       already draws the moon disc + glow.
F. [x] Far city fill for the aerial (cheap blocks to the harbour, cross streets).
G. [x] Verify: chase + aerial shots, perf <= 250 calls / 800k tris, build <= 4 s, autopilot race, errors.

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

- (session 3) A: `dressing/city/street.ts` (lamps + additive pools, traffic lights at 'crossing' marks, bus
  stops, planter trees with fairy lights, vending, scooters), `util.ts` (zoneRuns, mount on deck/ground,
  catenary/segment), sidewalks / zebras / scramble paint wired. B: `props/city-people.ts` (8 species,
  umbrellas, bob), `props/city-shops.ts` (food stalls, subway hood, convenience store), `landmarks.ts`
  (store / subway / mural / roundabout claim lots first), `props/city-statue.ts` (gilded pelican on a
  bike), `faces.ts` (metro, store, gate, calling-card mural), `life.ts` (crowds, stalls, market gates,
  lantern strings, cables). Bench: `sandbox/city.html` + `node sandbox/city.views.mjs --views "s,x,h,ls,lx,ly;…"`.

- (session 3) C: `gantries.ts` (neon START/FINISH gantries, giant FINISH screen on pylons), `viaduct.ts`
  (deck slab + cyan fascia line, underside, T-piers, embankment at the ramp foot), `underpass.ts`
  (concrete-panel retaining walls with hazard kerb, coping, railing, lights, P5 posters; tunnel tiles,
  LED strips, jet fans, exit signs, road pools), `bridge.ts` (neon tubes on both arch faces, bulbs,
  pink fascia line), `geo.ts`/`wall-tex.ts` helpers. Layout: expressway rise 1 → 0 so the road rejoins
  STREET after the jump (it sat 1 m above the street ground from the riverside on).
  D: `signs.ts` (TRACK_SIGNS.city road signs, chevrons outside every corner, crest warning,
  distance markers, start/finish banners).

- (session 4, wrap-up) E: `env/city-rain.ts` — 2600 additive streak quads (1700 medium / 900 low) in a
  44×24×44 m box ahead of the camera, world-anchored + wrapped in the vertex shader, leaning with the
  camera's speed; fades out within ~24 m of tunnel roofs, hidden in fogless aerial/debug views; huge
  bounding sphere so world/lod.ts' fog cull never hides it. F: `farfill.ts` blocks now also stand on the
  gentle shore slope (base at the lowest corner): 234 → 446 fill blocks, the south shore band is filled.
  G: tsc clean · track.test city 0 fails, no leak · chase perf max 193 calls / 633k tris
  (sandbox/city.perf.mjs) · build 2.4 s · autopilot race finishes (163 s, P1, sandbox/city.race.mjs) ·
  in-game sheet shots/env-city/s4/sheet1.png + aerial2.png, no errors.

## Shared-file edits (additive only)
- layouts/index.ts: `if (id === 'city') return CITY;` · dressing/index.ts: `city: dressCity`.
- looks.ts: CITY_LOOK values (the city entry).
- layout/types.ts: GroundDef.mat += 'paved'; LayoutDef.farMargin?: number (optional).
- terrain/profile.ts: GROUND.paved/pavedDark/concrete + 'paved' branch in groundColor.
- terrain/far.ts: `const margin = L.def.farMargin ?? MARGIN` (city 460: build 4.1 s → 1.35 s).
- env/sky.ts: night-only cloud tint 0.62 → 0.84 (only the city is night). env/sea.ts: night foam tint.
- scenery/signs/faces.ts: `cell` exported.

## Known issues
- (race unit, not env-city) in city.race.mjs some rivals pass the line after the player finished and
  keep mode 'racing' up to s≈5400 (past length + runoff).

## Core requests
- (track unit, from fix round 1 / T5) export APEX / PYLON_AT / RIB_W / RIB_D from features/bridge.ts and move
  coast/signage's shared helpers (chevrons, banners, distanceMarkers, warning, loadBillboardArt) to scenery/signs,
  so dressing/city/bridge.ts + signs.ts stop copying / reaching into coast internals. (still open, fix round 2)
- (track unit, fix round 2, critic r2 art #6/#9/#10) night looks only: hide or dim the sea foam flecks (read as
  snow on the river), give the oil decal an iridescent sheen instead of a near-black ellipse, and raise the
  night clouds above the tallest towers (or hide them: it rains) — they hang among the towers as cut-outs.

## How to test
- `node sandbox/track.test.mjs --track city` · `node sandbox/city.perf.mjs` · `node sandbox/city.race.mjs --seed 3`
- regression checks (exit 1 on failure): `node sandbox/city.occlude.mjs` (nothing covers the wet road) ·
  `node sandbox/city.black.mjs [--s0 0 --s1 3378]` (no black voids beside the outer lanes) · `node sandbox/city.intrude.mjs`
- `node sandbox/track.shots.mjs --q "track=city&s=600&x=2" --out shots/env-city/x.png` (view=aerial|high)
- `node tools/shot.mjs --url "/?race=city&seed=3&traffic=0" --out shots/env-city/g.png --step 300 --controls '{"throttle":1}'`

## Fix round 1 (reviews/env-city-r1-{art,tech}.json; wrap-up mode: skip anything > ~20 min)
Order / checkpoints ([x] = done, verified in browser):
1. [x] T0 blocker: quality=low freeze -> wet overlay shaders moved to env/city-wet-glsl.ts with `USE_MIRROR`
       define (0 at low: no uTexMat/uRefl at all; uTexMat defaults to identity anyway). Verified: race runs at
       quality=low, 0 errors (shots/env-city/f1/low.png). Also: env/city-cam.ts shares the camera's track s
       (wet + rain project once), mirror scratch Vector3, rain roofDistance without arrays (T6).
2. [x] T2 signs: posts now stand `signInset(w, turn)` = 0.3 + w/2·cos(turn) beyond the drivable edge (util.ts),
       bus-stop sign too; deck mounts (parapet) skip with a warning (none skipped). New check
       `node sandbox/city.intrude.mjs --ymax 2.95`: no sign intrusions left (only lamp arms/canopies >= 2.8 m,
       umbrella rims <= 0.2 m). Dead `roadPoint` removed.
3. [x] A0 wet road: ripple amplitude 0.0028/0.0012 faded by fwidth (none in the distance), 10 taps with
       per-pixel jitter + alternating ±0.0015 horizontal offsets (no comb copies), mirror 0.6 high / 0.4 medium
       capped at 720 rows (dpr 2 safe), low-frequency drier patches (~1/3 at 25 %). Smooth streaks (f1/road1r.jpg).
4. [x] T1 occluders: city:walls + city:tiles also render in the mirror; `city:vaultMirror` black tube per tunnel
       (walls + vault, layers.set(REFLECT_LAYER) = mirror only). Tunnel floor now mirrors only its LED strips.
5. [x] A1/T3 pools: r 3.8 m (4.5 on plazas), colour halved, texture alpha (1-d²)³, none where the grade bends
       (crest/drop), tunnel: one faint pool (0.35,0.32,0.28) every 18 m alternating sides. Pelican reads (f1/hi1.jpg).
6. [x] A2 shopfronts (glsl.ts): `shopInterior()` = dim tinted interior, bright ceiling strip, two shelf rows of
       goods, 1-2 shopper silhouettes, 1 in 5 bays a red/white P5 poster; only ~62 % of bays lit, bright 0.62;
       offices/mixed: lit ratio capped at 0.45 on floors 0-3, saturated amber vs cyan windows (f1/hi2.jpg).
7. [x] A6 trees (props/city-street.ts): canopy = 3 smooth 12x8 blobs in the unlit glow batch (pink/gold x0.75,
       underside x0.42), 0.2 m trunk + 2 fork branches; none on the sprint.
8. [x] A4 canyon (new dressing/city/canyon.ts): 15 steel scaffolds along the sprint (both sides, staggered every
       26 m, facade-parallel angled ~15° to the riders): stacked LED screens (BILLBOARDS.city art, neon frames) +
       P5 boards at 4-13 m. neon.ts exports `screenRect` (same 12 atlas designs).
9. [x] A5 P5 accents: 1 in 5 shop fascias + 1 in 6 blades are red/black P5 signs (neon-faces.ts p5FasciaFace /
       p5BladeFace, white slashed lettering, star); 9 eye-level P5 boards on legs every ~170 m (canyon.ts
       streetP5Boards, kept clear of the road with signInset). Viaduct/portal chevrons skipped (time).
10. [x] A3 far bank (new dressing/city/farbank.ts): 26 lit towers on a quay strip 265-420 m across the river
       (far batch, neon crowns on the tall ones) + additive light columns on the water (`city:riverGlow`, fades
       with fog via paint.ts `additiveFade`, now shared with the pools). Night clouds darker indigo (sky.ts
       night-only line, shared-file edit). Sea foam untouched (track unit).
11. [x] minors: gate title 0.38h/0.46h + subtitle 0.15h (faces.ts); lanterns = oval glow body + dark caps +
       tassel (life.ts); road paint self-glows (emissiveMap 0.45, paint.ts) so zebras/scramble read white;
       statue 1.5x in the glow batch (bright gold, bronze frame), hedge ring + 3 flower-bed rings, P5 plaque
       on the drum (landmarks.ts); per-frame allocs (T6, item 1); `ahead()` once in util.ts (5 copies gone),
       `canvasTex()` shared (paint-tex/wall-tex), underpass imports WALL_H/CROWN/LAMP_EVERY (features/tunnel)
       + WALL_TOE (terrain/profile); dead skyline mark removed. track.test city: 0 fails, no leak.
       Not done: font-timeout redraw (T4), CREST from segments + sign s from zones (T5 part), viaduct/portal
       chevrons, ferry pier.
Verify (fix round 1, 10-19): tsc clean for city files · track.test city 0 fails, no leak · chase perf
(sandbox/city.perf.mjs) high max 194 calls / 654k tris, medium 191 / 634k, low 131 / 401k · dressing build
~0.7 s · autopilot races finish with 0 errors at high (seed 3, 179.5 s) and quality=low (seed 7, 172.6 s) ·
city.intrude.mjs: nothing inside the drivable road below 2.75 m except umbrella rims (<= 0.16 m) ·
sheets shots/env-city/f1/{low,hi1,hi2,hi3,hi4}.jpg + road1r.jpg.

## Fix round 2 (reviews/env-city-r2-{art,tech}.json)
Plan / checkpoints ([x] = done + verified in browser; A = art issue #, T = tech issue #):
1. [x] A0 major: root cause found with chase-cam raycasts: the return leg (avenue/sprint/finish) runs ~56 m beside
       the outbound leg, closer than the near ribbons reach (bound + 52 m), so the return leg's street-level
       ribbon (nearR:1728, 9 m) lay over the underpass ramps (road below 9 m) and hid road + overlay until the
       camera dropped under it (backface). Fix: new env/city-terrain.ts = LayoutDef.terrainMod (same hook as the
       mountain): per 2 m row/side the ribbon stops at the mid-line to the other leg (+1.5 m overlap), only where
       both grounds share the street level and not near the road ends (no holes, no steps). layouts/city.ts:
       `terrainMod`. Overlay rows now on the road's own 1 m rows; mirror plane from the road 12 m ahead with the
       normal leaning 2:1 to world up (crest/drop shear). New check `node sandbox/city.occlude.mjs`: chase-cam rays
       over s 1500-1650 / 2150-2240 / 2520-2600: 882 rays, 0 covered (73/75 covered without the mod).
       Verified f2/a0.jpg (reflections at 2176-2205 and 2556-2570), f2/bridge.jpg (no pits from the road).
2. [x] T0 major: shophouse (city-building.ts): glass recessed 0.3 m (was 0.75) between 0.34 x 0.3 m piers in the
       wall colour (was 0.6 x 0.8 m near-black trim) + steady neon edge strips + a warm soffit line (light-cycle
       role 6); arcade facades 1.6-2.2 m behind the bound (was 0.4-0.8); building material gets a street-glow
       wash (emissive 0.42 x wall colour, warm, fading over the lowest 9 m; mats.ts vWorldY + uStreetY); market
       gate pillars self-lit. New check `node sandbox/city.black.mjs` (HUD hidden, after the countdown): arcade
       s 840-1080 at x = ±3.5/±6.5: worst 0.103 (limit 0.25; was 0.95 before). Whole track at ±6.5 (step 60):
       3 frames 0.27-0.37, all thin legit objects at arm's length (P5 board, signal mast) or the expressway's
       upper facades. T4 umbrellas: crowd() keeps umbrella holders >= 1.0 m behind the kerb; city.intrude.mjs
       now exits 1 on anything inside the road below 2.5 m: ok (only canopies/lamps at 3.0-3.45 m).
3. [x] A1 major: new `city:lit` AuxBatch (building material, prop outline 0.04, shadows) + window-shader style 5
       = self-lit toon (cel ramp + aux.y × colour as emissive, glsl.ts). Trees (city-street.ts): canopy = central
       14-seg blob + crown + 5 scalloped lobes, toon pink / gold with 0.55 undersides, emissive 0.42 / 0.36,
       11 small warm specks scattered over random lobes (no eye pairs); 83 trees. Statue (city-statue.ts):
       toon gold + shade + bronze, S-neck as a Bézier sphere chain, 0.95 m flattened beak with red hook, big
       pouch, eyes, tuft; 3 warm uplights on the plinth rim. Flower beds: 39 low green toon mounds with
       self-lit blossom dots (landmarks.ts flowerBeds). Verified f2/a1.jpg + f2/statue.jpg.
4. minors:
   [x] A2 tunnel: new dressing/city/vault.ts = navy panel skin (12-step arc, concrete texture, 3 cm inside the vault,
       under the track's lamp strips), cable trays on both spring lines, red crown stripe + white pinstripes;
       floor pools dropped (tunnelFitOut no longer takes Pools); texMesh moved to geo.ts; underpass.ts uses the
       track's exported vaultY. Verified f2/tunnel.jpg (s 2300-2440).
   [x] A3 lamp pools -> hot spots r 1.7 m (plazas 2.0, was 3.8 / 4.5), colour x1.25 (street.ts). f2/tunnel.jpg row 2.
   [x] T4 umbrellas (see 2).
   [x] A8 shopInterior (glsl.ts): shopper() = 4 animal silhouettes (cat ears, bird beak, round capybara, long-necked
       goose), size 0.65-1.25, heads kept round (bay aspect), 30 % drift slowly, only ~55 % of bays have shoppers.
   [x] T2: layouts/city.ts CREST = TO_CREST.reduce(...) (segments split TO_CREST / FROM_CREST); signs.ts places the
       9 road signs relative to zones / the subway mark (same s as before) and nudges ±6/12 m when a lot takes
       the spot (the chicane warning was skipped once the arcade lots moved back); `C` colour helper exported
       from city-kit.ts (city-people / city-street / city-shops). Still copied: bridge.ts constants and
       coast/signage imports (core request below still open). track.test city: 0 fails.
   [x] A5 canyon.ts: a scaffold every 13 m per side (was 26), staggered; magenta / cyan LED kerb lines along both
       sprint edges (glow, mirrored); two tall double-screen scaffolds per side (top 18.6 m) leading up to the
       FINISH gantry / giant screen. Verified f2/canyon.jpg.
   [x] A4 new p5.ts (street boards moved out of canyon.ts): boards 6.2 x 1.94 m (was 3.4 x 1.06) on the outside of
       every corner / chicane / hairpin first, then every ~170 m (11 boards); 5 giant P5 banner pylons (5 x 15 m
       p5BladeFace 暴力鹈鹕 / 霓虹夜城 from 4.5 m up, steel frame, red neon frame) on the boulevard (2), scramble
       corners (2) and the avenue into the sprint (its sides are full of scaffolds), other side / ±21 m as
       fallback, skip warning like the signs; red/black hazard stripes (new neon-atlas cell) on both parapets over the 60 m before the crest
       jump, a band under the vault + flush wall panels just inside both tunnel portals (portal jambs are hidden
       by the cutting walls). Verified f2/p5.jpg, f2/p5b.jpg; intrude ok.
   [x] A7 skylineBlock (city-building.ts) rooftop kit: 40 % stepped setbacks (1-2 windowed boxes), 18 % pyramid caps,
       AC blocks, 45 % antenna masts and spires on > 110 m blocks with red aviation blinkers (lights batch);
       blocks.ts / farbank.ts pass the lights buffer. Verified f2/sky.jpg.
   [x] A6 farbank.ts: one continuous embankment (26 m boxes every 24 m, 190 m deep from u = 262) with a warm
       railing line + promenade lamps, towers stand 274-420 m out on it (no per-tower quay islands); river light
       columns start at the bank edge, fade with camera distance (420-760 m) instead of fog and shimmer with
       animated ripples (riverGlowMat), x2.2 brighter. Sea foam on night looks = track unit (core request).
       Verified f2/bank.jpg, f2/bank2.jpg.
   [x] T1 deferred atlases (the track's SignAtlas deferred mode, as on the coast): the shared faces atlas and the
       neon + screen atlases record every face while the city builds and paint once the fonts are in
       (ensureFonts 4 s runs in parallel with the build instead of blocking 2.5 s before it); if the fonts were
       late, all three repaint on document.fonts.ready and re-upload (city.ts paintAtlases; disposed-safe).
       Verified f2/fonts.jpg (text OK).
   [x] T3 city-mirror.ts: the nested pass hides every top-level scene branch except the track group and the
       lights (riders, fx, UI are no longer traversed / culled / sorted for 26-35 reflected meshes) and restores
       them right after. Measured (f2/mirrortime.mjs, real-time autopilot, 1080p high): nested mirror render
       avg 0.38 -> 0.31 ms, p50 0.4 -> 0.3 ms. A separate proxy scene was not done: it would need its own lights
       and fog, i.e. a second program per material switched every frame.
Cross-unit (not env-city): A9 oil decal (track), A10 night clouds (track), T5 session leak (integrator),
T6 dpr-2 cost (fx/core).
Other units' notes: assets.md "landmarks.ts p5Face is not defined" no longer reproduces (every city build this
round: 0 errors); fx.md "wet-road reflections are high-frequency stripes" was fixed in round 1 (comb removed).
Also: planter boxes now square to the kerb (a turned box poked 0.13 m over the edge, caught by intrude).
Verify (fix round 2, 10-19): tsc 0 errors · track.test city 0 fails, no leak · city.occlude 882 rays, 0 covered ·
city.black arcade worst 0.111 (limit 0.25) · city.intrude ok (nothing below 2.5 m) · perf (city.perf.mjs) high
max 195 calls / 683k tris, medium 193 / 681k, low 122 / 432k · dressing build ~0.65 s · autopilot races finish
with 0 errors at high (seed 3, P2, 169.9 s) and quality=low (seed 7, P1, 170.2 s) · in-game sheet
shots/env-city/f2/final.jpg (16 tiles, mean luma 60-100, 0 errors) + per-fix shots in shots/env-city/f2/.

## r3 polish (2026-10-25)
Issues: reviews/game-r2-aesthetic.json#4 (trees), reviews/game-r2-perf.json#2 (dressing freeze); re-checked status/core.md's
old wet-road seam + arcade black-front items. Evidence in shots/r3-env/ (gitignored).
- [x] aesthetic#4 trees (props/city-street.ts `TREE`, dressing/city/street.ts): crown = core + 5 rim lobes + crown lobe, every
  lobe <= 1.0 m (TREE.maxLobe), crown reach 1.55 m, canopy emissive share 0.42/0.36 -> 0.15 (TREE.canopyLit), three tones per
  tree + warm dark undersides (no purple / olive shadow side), crown starts ~2.7 m up (camera looks under it); planter,
  trunk (thicker, lighter) and 3 fork branches moved to the city:lit batch with the street-glow wash. Placement: on curves
  tighter than R 60 (tightest radius within +-16 m) trunks stand 2.5-2.6 m back (3 trees, crown clearance >= 0.95 m); no
  trees on the roundabout's side from 90 m before the hairpin to its end (9 spots left open); landmarks.ts reserves a
  36 x 18 m view corridor at the corner before the hairpin (Lots.reserve: no buildings, street props still allowed).
  Verified: statue probe (shots/r3-env/city.sight.mjs, chase-cam rays to wheel/body/head over s 2640-2725): visible 31 % -> 86 %,
  0 views blocked by trees (17 before); the statue now shows from s~2660. Sheet shots/r3-env/sheet_city_trees.jpg (before | after).
- [x] perf#2 dressing freeze: dressCity yields between 13 stages with ctx.progress (copy of dressMountain's stages());
  streetWalls / skyline / farFill / farBank / life slice their loops (breathe.ts `slicer`, 30 ms); city batches build via
  AuxBatch.finishYielding; the three deferred atlases are now SlicedAtlas (new dressing/city/atlas.ts: paints its cells
  in 30 ms slices; the faces atlas alone was a 120 ms flush); shared batches via finishDressYielding. Long tasks in the
  dressing window (shots/r3-env/longtask.mjs, 1080p, loaded machine): restart 910 / 907 ms -> 80 / 78 ms; cold 1135 ms -> the
  city's own slices <= 63-72 ms (LoAF attribution, shots/r3-env/loaf.mjs; the 180-365 ms tasks left in a cold window are
  src/actors/preload.ts). Loading bar: 2 -> 27 updates during the dressing. City info logs now go through ctx.log (?debug).
- finishScreenFace (faces.ts) uses the track's new art contract (artReady + cell(..., [art])): red-burst placeholder while
  the poster decodes, redrawn when it lands.
- Old items: wet-road seams / reflection pop at the underpass NOT reproduced (city.occlude 851 rays, 0 covered; mirror on in
  515/515 samples s 2120-2761, shots/r3-env/city.wetpop.mjs); arcade black fronts NOT reproduced (city.black worst 0.096).
  Note: city.black at s 2640 x -6.5 reads 0.27-0.29 with and without the corridor (dark building base + planter at arm's length).
- Shared-file edit: src/world/breathe.ts + `slicer()` (additive). sandbox/city.intrude.mjs takes --track.
Verify: tsc 0 errors · track.test city 0 fails, rebuild/dispose clean · city.occlude 0/851 · city.intrude ok · city.black ok ·
city.perf max 195 calls / 682k tris (unchanged) · real-time 60 fps capped, p95 16.8 ms at s 2742 / 360 / 2466 · autopilot race
seed 3: 8/8 finished, P1 167.4 s, 0 errors · core-check OK.
