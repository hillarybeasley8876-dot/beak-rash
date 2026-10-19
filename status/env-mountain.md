# env-mountain — status (落日山道 SUNSET PASS)

## Plan (milestones)
1. [x] Layout `src/world/layouts/mountain.ts` (~3.6 km): village start → pine climb → 3 hairpins
       (R 24–32, banked, chevrons) → cliff road (rock wall / rail + drop) → curved lit tunnel → gorge
       suspension bridge (river = water plane at lake level 0, waterfall) → summit crest jump + pagoda
       → descent with S-chicane (R 40–55) + ramp → lakeside straight → finish gantry with lanterns.
       Registry lines in layouts/index.ts + dressing/index.ts. 2D plan bench `sandbox/mountain.html?map=1`.
2. [x] Terrain between switchback legs: ribbons clipped at the mid-line between legs + heights
       blended there (generic optional hook in field.ts/near.ts, logic in env/mountain-legs.ts).
3. [x] Look: mountain entry in looks.ts (low warm sun, gold→pink→violet sky, warm fog); env:
       layered ridge silhouettes (env/mountain-ridges.ts), big sun disc + god-ray hint
       (env/mountain-sun.ts), sky-tinted lake (recolour sea uniforms), waterfall + mist.
4. [x] Dressing `src/world/dressing/mountain/*`: forests (pines/firs/birches, far LOD clusters),
       rocks/strata, village (houses, stands, lanterns, start gantry), signage (mountain faces,
       chevrons, road signs, billboards w/ BILLBOARDS.mountain art, distance markers), pagoda
       viewpoint, tea terraces, hot spring w/ capybaras + sign, cows behind fences, cable car,
       wind turbines, hot-air balloons, prayer flags / lantern strings, finish gantry w/ lanterns.
5. [x] Verify: track.test --track mountain, perf ≤250 calls/≤800k tris, build ≤4 s, autopilot race
       finishes, chase-cam contact sheet + aerial; critic pass on screenshots; fix.

## Done
- M1 layout v1 (3588 m, y 3..119, max grade 15 %), registry lines, 2D bench (sandbox/mountain.*).
- M2 switchback terrain: env/mountain-legs.ts (LegBlend) via new optional hook; legs hug the slope.
- M3 look: env/mountain-relief.ts (ridged relief + lake peaks), mountain-grade.ts (alpine
  vertex palette, farmland off), mountain-sky.ts (golden-hour dome, sun disc, god-ray hint),
  mountain-ridges.ts (4 layered silhouettes), mountain-lake.ts (sky-mirroring lake shader).
- M4: props/mountain-trees.ts (pine/fir/birch/farPine/teaBush), dressing/mountain/forest.ts
  (roadside trees, boulders, far forest), dressing/mountain/index.ts, util.ts.
- sandbox/mountain.race.mjs (autopilot soak): run + recorded in the final pass below.

## Final pass (10-18 evening, wrap-up mode) — all milestones done
Zone s (approx): start 0-160 · village 160-300 · pines 300-630 · hairpins 630/855/1089 (legs between) ·
cliff 1171-1651 · cutting 1651-1691 · tunnel 1691-1931 · portal -1957 · bridge 1957-2087 · summit 2123-2283 ·
crest top 2343 · descent 2403-2663 · chicane 2663-2768 · descent -3008 · lake 3008-3188 · lakeside -3428 · finish -3588
- [x] marks.ts dispatcher · signage.ts + faces.ts · village.ts + mountain-house/deco · bridge + gorge + waterfall.
- [x] props/mountain-pagoda.ts + dressing/mountain/landmarks.ts: 3-tier pagoda by the crest (s≈2339, goose on the deck),
      capybara hot spring (s≈3258 L: stone basin, yuzu, 4 capybaras, steam, 「卡皮巴拉温泉 情绪稳定 包月价」 board), prayer flags.
- [x] dressing/mountain/farm.ts + props/mountain-animals.ts: tea terraces 320-490 (437 hedges), pasture 3028-3178 (8 cows
      behind a ranch fence, never on the road).
- [x] sky life: env/mountain-anim.ts (shared GPU vertex-anim toon mesh + hull, sim-time uniform) + mountain-ropeway.ts
      (227 m cable car over the descent, moving gondolas) / mountain-turbines.ts (7 spinning, far ridge) /
      mountain-balloons.ts (7) + dressing/mountain/life.ts (site picking).
- [x] content request 11: BANNERS now carry TRACK_BILLBOARDS.mountain picks 「弯道多 漂移券免费领」 + 「海拔越高 鱼越贵」
      (excluded from the poster pool, so each joke shows once); retired 秋名山 / 山路十八弯 lines and the 弯弯有鹅 fallback gone.
- [x] M5 verify: tsc clean · track.test --track mountain 0 fails, no leaks · new sandbox/mountain.perf.mjs (144 chase views,
      both lanes): max 181 calls / 666k tris (avg 106 / 384k) · build 2.47 s · autopilot race seed 3 (mountain.race.mjs):
      player 1st in 2:53.75, results screen, 0 errors · chase + aerial + close-up shots in shots/env-mountain/final/.

## Shared-file edits (track unit files; additive only)
- layouts/index.ts: `if (id === 'mountain') return MOUNTAIN;` (+ import).
- dressing/index.ts: `mountain: dressMountain` (+ import).
- looks.ts: MOUNTAIN_LOOK values (golden hour, mauve fog).
- layout/types.ts: optional `LayoutDef.terrainMod?: (field) => TerrainMod` (+ type import).
- terrain/field.ts: `TerrainMod` interface, `readonly mod` (built from the layout), applied in
  heightAt() and sampleWorld(). No-op when a layout has no terrainMod (coast/city unchanged).
- terrain/near.ts: foldScale room = min(curve room, mod.room); ribbon vertex height via mod (c > 0).

## Known issues
- In-game headroom ~15 % tris / 17 % calls (684k / 207 at the stacked legs); next big dressing addition should add tree cone
  twins (trees in their own near/far batches) first.
- Hairpin kerbs and 4-lane paint are the track's automatic racing kerbs (core request below); START decal orientation is track's.

## Core requests
- track (art#5): a LayoutDef option to turn off / restyle the automatic red-white kerbs that layout/query.ts adds on every
  curve tighter than R430 (mountain wants a painted rumble edge or stone gutter) and a 2-lane + wide-shoulder paint style.
- track (tech r2 #6): export towardRiders(ctx, s, side, turn) from scenery/signs/boards.ts (three copies: coast/signage.ts,
  city/util.ts, mountain/signage.ts); mountain then imports it and drops its copy.
- track (tech r2 #1): a non-claiming Placer.test(x, z, r), so lantern strings can test both pole discs before claiming either
  (today a failed right claim leaves the left disc claimed).
- track (art r2 #9): START road decals read upside down from the chase camera (features/decals.ts, every track).
- track/core (tech#7): an additive per-track environment hook (e.g. LayoutDef.env { sky, water, groundMaterial }) so
  mountain-sky / mountain-lake / mountain-grade stop swapping the coast meshes' materials by name after the build.

## How to test
- 2D plan: /sandbox/mountain.html?map=1
- 3D: `node sandbox/mountain.shots.mjs --views "2290:2:chase,3020:-2:chase,0:0:aerial" --out shots/env-mountain/v`
- Perf: in game `node sandbox/mountain.perfgame.mjs [--seed 3]` (exit 1 over 250 calls / 800k tris) · sandbox sweep
  `node sandbox/mountain.perf.mjs [--step 50]` (gates at 85 %) · API: `node sandbox/track.test.mjs --track mountain`
- Race: `node sandbox/mountain.race.mjs --seed 3 --frames 20000 [--shot shots/env-mountain/race]`
- In-game views (real chase cam + post, HUD hidden, contact sheet): `node sandbox/mountain.game.mjs --list "1450:0,2030:0"
  [--cams "885:3:5:27:-16:1"] --out shots/env-mountain/g` (cams = s:x:h:ds:lx:ly free camera)

## Fix round 1 (10-18 night, wrap-up: chase-cam order, each item small)
Reviews: reviews/env-mountain-r1-art.json (6 major, 6 minor), r1-tech.json (11 minor). Plan in order:
1. [x] art#0 grade tint floods red (looks.ts) · 2. [x] art#1 sun re-aim/raise + gold band + cliff drop side tree-free (+art#11 roof acne)
3. [x] art#9 start gantry lanterns over banner ("SUNSET ▮ASS") · 4. [x] tech#0/#1 chevron direction + lift above rail
5. [x] art#2 tunnel (portal headwall, lamps + light pools, exit glow) · 6. [x] art#3 waterfall shader/shape
7. [x] art#4 terrain toon steps + broad strata · 8. [x] art#5 road identity (small: hairpin landmarks/scatter; kerb = core req)
9. [x] art#6 hot-spring board · 10. [x] art#7 far forest ≥40 m from road · 11. [x] tech#5/#8/#9/#6 cheap code fixes
12. [x] tech#2/#3 perf (quality scaling, gate FOV) · 13. [x] verify: chase + aerial, perf, autopilot race, errors
- art#0 DONE: looks.ts MOUNTAIN_LOOK grade tint #ffe0c2 → #fff5ec, saturation 1.18 → 1.08, contrast 1.08 → 1.06, ambient ground
  #8a5462 → cool violet #6a5a9a. (fx composite now applies a luma-normalised 50 % split tone, so the tint is mild either way.)
- art#1 DONE: sun re-aimed to az 10° / el 14° (dir -0.1685,-0.2419,-0.9555; sweep in shots/env-mountain/fix1/sunaz.mjs): sun
  12-27° off the cliff, 14° at the crest (pagoda + sun glow dead ahead at take-off), 0-28° on the descent; toward-sun share of the
  lap 21 % → 45 %. Sky gold band widened (smoothstep 0.1-0.9 → 0.05-0.6). forest.ts DENSITY.cliff `only: -1` keeps the drop side
  tree-free; far forest now ≥ 40 m from any road (art#7 part). Ridge saddle follows the sun automatically (mountain-ridges.ts).
- art#9 DONE: layouts/mountain.ts startGantry 46 → 64 (≈32 m ahead of the grid: banner mid-screen during the countdown, clear of
  the HUD strip); start lantern strings now begin at s 80 (the s 42 string hung in front of the banner text). village.ts
  lanternStrings: both poles or no string (tech#8 part). Verified: shots/env-mountain/fix1/start1.jpg (intro → GO, banner clean).
- tech#0/#1 DONE: signage.ts chevronRow takes the arrow direction from the row's own sharpest bend, or (approach rows on a
  straight, |k| < 1/400) from the next 40 m; boards over 'rail'/'stone' edges lift 0.5 → 0.95 m so the face clears the barrier.
  Verified: fix1/chev2.jpg (hairpin-2 approach now '<<', hairpin-3 approach '>>', faces above the rail).
- art#2 DONE (small version): new dressing/mountain/tunnel.ts + pools.ts (LightPools: additive two-ring vertex-colour fans,
  one mesh 'mountain:tunnelPools', no texture): sodium pools on the road under every vault strip, sodium wall lamps every 12 m
  with wall glows, green exit boxes, meme sign 「鹈鹕请 收好喉囊」 at mid-tunnel, daylight spill at both mouths, carved
  「落日隧道 SUNSET TUNNEL · 240 m」 plaque (faces.ts tunnelPlaqueFace) + two lamps over the entrance portal. Interior now reads
  warm mid-grey (fix1/tun1.jpg). Not done: strata rock / pines above the portal (portal cap is the track unit's tunnelCap).
- art#3 DONE (shading/shape; placement kept): env/mountain-waterfall.ts rewritten — sheet curls over a rounded lip (R 1.3 m)
  and widens 0.8 → 1.22× as it falls; three hard toon bands (deep / mid / white streaks at 2.0 / 3.4 / 5.2 m/s), wide noisy
  ragged sides (±0.18 of the width instead of 7 %), white foam lip + churning spray at the foot; toon-banded foam pool.
  Mist moved to env/mountain-mist.ts (tech#6: both now run on mountain-anim lifeTime(); the dead uv attribute / triple corner
  callback are gone). Not done (> 20 min): moving the fall 50-80 m upstream into a rock cleft and smoothing gorge walls.
- art#4 DONE (small version): new env/mountain-terrain-mat.ts — the terrain meshes get a mountain toon material whose steep
  faces show broad procedural strata (2.6 m bands, own flat tone each, dark ledge at each base, world-space wobble, fwidth fade
  so no moiré) instead of the coast's 18 m limestone texture with fine pinstripes; crisper grass/rock boundary (shader
  0.42-0.52, vertex palette ny 0.7-0.76). Swapped in gradeMountainTerrain only on 'track-terrain*' materials. Not done:
  retaining walls on cut banks, rock-outcrop meshes, 2-tone fogged hills.
- art#5 DONE (small version): each hairpin gets its own landmark on its inner island (the outside drops below the rail):
  H1 red wayside shrine with lanterns + yuzu offering and a 「山神庙 保佑不摔车」 scenic sign, H2 race-watching lay-by (two
  benches + coin binocular) with 「观景台 拍照请靠边」, H3 boulder outcrop with a stacked-stone cairn. New marks shrine /
  viewpoint / outcrop (layouts/mountain.ts → marks.ts → dressing/mountain/hairpins.ts; props/mountain-roadside.ts). part()
  moved to props/mountain-kit.ts (tech#6: was duplicated in house + pagoda). landmarks.ts flatSpot now exported, rejects
  spots steeper than maxSlope and warns '[mountain] <what> skipped' (tech#8). Kerbs/lane paint: core request below.
  Not done: roadside scatter (tufts/flowers) — no triangle headroom in the game view (tech#2).
- art#6 DONE: hot-spring board moved from before the pool (s-9, u 1.6) to just beyond it (s+7.5, beside the pool's setback), so
  riders see the stone rim, steam and capybaras first (fix1/spring1.jpg). Pool not raised (kept small).
- art#7 PART: far forest ≥ 40 m from any road (was 8 m). Not done: smooth 12-seg pine tiers / new birch crowns (adds triangles
  we do not have, see tech#2).
- tech#5 DONE: banner lines picked by content (util.ts pickLine('漂移' / '海拔'), warns if content drops them). ROAD_SIGNS
  positions are now documented by content ([2] pelican, [5] curves, [8] sharp bend), so marks.ts keeps them.
- tech#6 DONE: one sagAt (props/mountain-deco) reused by mountain-ropeway.ts and life.ts; part() in props/mountain-kit.ts;
  waterfall + mist share lifeTime(); buildMist lives in env/mountain-mist.ts.
- tech#8 DONE: flatSpot rejects spots above maxSlope and warns; lantern strings need both poles; hot-spring board warns on overlap.
- tech#9 DONE: removed HouseOpts.lantern, AnimSpec.castShadow, houses(u0,u1,rows) params; balloon aDrift is a vec2; mist geometry
  has no uv and a seed callback.
- tech#2 PART: tree density scales with quality (forest.ts QUALITY_DENSITY low 0.6 / medium 0.8 / high 1 on roadside spacing
  and far stands); the in-game peak (s≈786, legs looking over the tea slope) was the tea terraces (~100k tris incl. hulls):
  hedges are now 5.6 m continuous segments every 6 m (was 3.2 m every 3.7 m) with 7×3 / 6×2 spheres → that view 942k → 862k
  whole-scene; pines/descent/leg/hairpin roadside spacing +15-25 %. Not done: per-tile distance LOD (tree tiers → cones).
- tech#3 DONE: new sandbox/mountain.perfgame.mjs measures the track share in the real game camera (stepped autopilot race,
  1920x1080, render with/without the track group, exit 1 over 250 / 800k); sandbox/mountain.perf.mjs now gates at 85 %.
- VERIFY (fix round 1 done): tsc 0 errors · track.test --track mountain 0 fails, no leaks · sandbox build 1.74 s · in-game
  perf (mountain.perfgame.mjs, 1920x1080, track share incl. shadows) max 206 calls / 707k tris (was 205 / 798k before the
  tea/forest trims) · sandbox sweep max 181 calls / 679k (85 % gate) · autopilot race seed 3 (mountain.race.mjs): player
  finished, all 8 finished, 0 errors · chase sheet shots/env-mountain/fix1/final.jpg, aerial fix1/air_0_aerial.png.
  0 errors from env-mountain; seen from other units mid-edit: ui confirm.css missing (fixed since), actors capybara
  'addNostrils is not defined' (actors stub) — not ours.
- Skipped (> 20 min or no headroom): waterfall move into a cleft + smooth gorge walls, cut-bank retaining walls, roadside
  scatter, smooth pine tiers / birch crowns, lake near-shore body + pebble shore (art#10), distance LOD per props tile,
  layout marks for sky life + track-space lake peaks (tech#4), tech#10 AI rail hits in hairpins (race unit; races finish).
- content request 11 (status/content.md) is already done here: BANNERS carry no retired lines (content can close it).

## Fix round 2 (10-19; checkpoint after each item, a resumed fixer skips [x])
Reviews: reviews/env-mountain-r2-art.json (score 6: 3 major, 7 minor incl. 2 cross-unit), r2-tech.json (pass 8: 7 minor).
Plan in order (cheap code fixes first, then headroom, then the art majors):
1. [x] tech#5 logs via ctx.log · tech#6 towardRiders/flatAxes/doc · tech#1 atlas overflow warns + claim fixes · tech#2 swap-count warn
2. [x] tech#4 tunnel-mouth pools stacking
3. [x] tech#0 distance LOD (far props tiles: no hulls, cone trees) → headroom for the art items
4. [x] art#0 rock faces: crags on cliff/cutting walls, rock slabs + crag tops, strata fade by px + distance, top bevel, far fog steps
5. [x] art#1 waterfall: streak noise 10-15:1 + step streaks + wet-rock backing; move upstream into a notch facing the deck
6. [x] art#2 hairpin identity: big landmarks (paifang gate, camper + spectators deck, rock spire), island ground cover, scatter, dry-stone walls
7. [x] art#3 portal headwall + rock/pines over the cap · art#4 hot spring raised + toon steam
8. [x] art#5 birch dashes / pine smoothing · art#7 tea risers · art#6 lake colour/ripples/shore strip
9. [x] tech#3 sky-life marks + lake peaks in track space · art#8/#9 cross-unit (track) check
10. [x] verify: tsc, track.test, perfgame, perf sweep, race, chase sheet
- tech#5 DONE: every [mountain] info line goes through ctx.log / d.ctx.log (prints only with ?debug); LegBlend keeps a
  `summary` that dressMountain logs; console.warn stays for real problems.
- tech#6 DONE: new env/mountain-frame.ts flatAxes(fr) (unit horizontal tangent/right) used by util.worldAt, signage.towardRiders
  and both LegBlend sites; chevronRow doc moved onto chevronRow. towardRiders copy kept until track exports one (core request).
- tech#1 DONE: util.signFace(d, key, draw) warns '[mountain] sign atlas full: <key>' at all 10 face sites; billboards() uses
  `continue`; atlas usage logged per build; hot-spring board tries s+7.5/10.5/13.5 and skips with a warning when all are taken.
  Lantern-string phantom claim needs a non-claiming Placer.test (core request).
- tech#2 DONE: gradeMountainTerrain counts swapped terrain materials and warns when 0 (sky/lake swaps already warned).
- tech#4 DONE: sodium pools start/stop ≥ 14 m from each mouth (no overlap with the 9 m spill at 7 m), SPILL halved.
- tech#0 DONE: new dressing/mountain/lod.ts (per frame, before the fog cull): outline hulls of every batched cell off once the
  cell's nearest point is > 220 m away; crowd cells get a 260 m draw distance through the fog cull's per-mesh cullMargin.
  In-game perf (perfgame seed 3, 1920x1080 high): max 206 calls / 708k → 192 calls / 637k tris (80 % of the budget).
- art#0 DONE: layouts/mountain.ts `crags: true` (track's near-ribbon ledges + jagged lip on the cliff / cutting / portal walls);
  new dressing/mountain/crags.ts: granite columns (3–8 m) at the wall foot every 6–9 m, slabs bedded higher on the face,
  a ragged lip line (rock clusters, tufts, small pines); rocks in their own outlined 'mountain:rocks' batch that casts no
  shadow (self-shadow acne striped them). Strata shader (env/mountain-terrain-mat.ts): 3.2 m strata split into 3–7 m blocks
  (own tone, thin cracks, lighter top bevel instead of the dark ledge), whole pattern fades under ~20 px or beyond 60–95 m,
  grain sampled in world space (projected on the face on slopes: no stretched stripes), fog stepped (3 steps, short ramps).
- art#1 DONE: waterfall moved out of gorge.ts into new dressing/mountain/falls.ts: two tiers in a rock notch at the far
  bridge end (s 2089, x -36): upper sheet from a lip 22 m above the deck into a ledge pool 1.5 m below deck level (lip, drop,
  foam and mist all read over the parapet from the whole bridge, shots/env-mountain/fix2/e2.jpg), lower sheet from the
  ledge to the river; sheets face down the gorge turned 0.55 rad toward the road; dark wet-rock backing, dense granite
  notch walls, a buttress under the ledge, rocks behind the lip. Shader: streak noise stretched ~12:1 (v·0.045/0.09/0.2,
  9/11/13 m/s), deep blue only in narrow gaps, white streaks + thin bright streak lines. buildWaterfall returns the foot
  and takes a `mist` flag; mist smaller (rise 16 m).
- art#3 DONE: new dressing/mountain/portal.ts at both mouths: dressed-stone headwall (block pilasters beside the arch, a
  three-course block band + cornice above it, the plaque in front), stepped stone wing walls along the cutting foot, a broad
  band of granite masses bedded in the upper portal face (hides the striped concrete/rock face), granite + pines + firs on
  the cap 3-46 m behind each mouth. Cap stripes: terrain grain now sampled in world space (see art#0).
- art#2 DONE: new props/mountain-hairpin.ts (paifang gate 6.8 m with hip roof + name board, stone lantern, camper van,
  timber deck, mossy granite spire) and hairpins.ts rewritten around each bend's island (centre from the hairpin zone +
  curvature): H1 paifang at the island tip + shrine behind it + stone lanterns every 8.5 m along the inner curb, gravel;
  H2 9.5 m viewing deck with 8 cheering fans (crowd batch), two 5 m flags + pennants, coin binocular, camper van, flower
  meadow + 48 flower clumps; H3 7.5 m spire with a trickle hugging it (FallSpec.reach 0.3), boulders, cairn, scree.
  Ground cover = env/mountain-grade.ts paintGround (near-terrain vertex repaint within the island radius, ragged edge).
  New dressing/mountain/scatter.ts verges(): ~2600 tufts / flower clumps / pebbles on grass verges (cover batch, density by
  quality). Not done: dry-stone walls on the uphill side (the uphill edge is already the track's stone curb wall).
- art#4 DONE: hot spring rim lowered (basin top = ground + 0.3, 26 small rim stones r 0.3-0.42), soakers raised 0.22 m and
  turned to the road (heads + yuzu clear the rim), a 5th capybara with a pink towel stands at the road side; steam half size.
  env/mountain-mist.ts puffs are now toon: lobed hard-edged silhouette that erodes as it fades, shade tone + lit core
  (waterfall spray too, alpha 0.55).
- art#5 DONE: birch = white two-piece leaning trunk with 3-5 short dark dashes + 3-4 merged golden blobs with a darker
  underside; birches stand 4-7 m back at least (irregular); pine tiers 8 → 10 segments, fir 7 → 9 (smooth normals already).
- art#7 DONE: tea hedges were oriented across the slope (yaw = along put the long local X across the road): now along the
  contour (along + π/2) in the thin-outline batch, each row on an earth/stone riser strip on its downhill side (reads as
  contour steps, fix2/i_sheet.jpg), ~1 in 40 rows gets a picker (bobbing crowd figure + straw cone hat + wicker basket).
- art#6 DONE: lake shader (env/mountain-lake.ts): deeper saturated violet body (fresnel 0.3 + 0.55·(1-elev)^4), a jagged band
  of mirrored ridges under the horizon (by view azimuth, gold-tinted toward the sun), hard toon ripple streaks long across
  the view out to ~500 m, wet-pebble shore band in the terrain's own waterline colour (hides the stair-stepped
  intersection) with the lapping foam line on a smooth height-map contour.
- tech#3 DONE: sky life is placed by layout marks now (layouts/mountain.ts: cableCar in the descent, turbines (len 850) and 7
  'balloon' marks in their segments; marks.ts dispatches cableCar/turbines and builds all balloon marks in one mesh; the
  cable-car stations claim their discs before the forests). Lake peaks are track space (anchor s, along-offset beyond the
  road ends, lateral x, r, h) converted with the anchor frame (env/mountain-relief.ts), warning when a peak's radius
  comes within 60 m of the road.
- art#8 / art#9 (cross-unit, track): not delivered by track yet (no kerb option in LayoutDef; START decal still flipped);
  both stay in core requests.
- perf follow-up (after all fix-2 dressing): tea hedges + risers in their own 'mountain:tea' batch (thin outline, no shadow
  pass, 80 m cells so far rows lose their hulls), crowd draw distance 160 m, the LOD also covers every 'mountain:*' batch,
  hull LOD from 120 m reach, lantern glow spheres 7×5, verges 1.9 m on high. In-game max 684k tris / 207 calls (85.5 % /
  83 % of the unit budget; round-1 state was 708k / 206 with far less dressing).
- VERIFY (fix round 2 done): tsc 0 errors (whole project) · track.test --track mountain 0 fails, rebuild/leak clean · in-game
  perf (perfgame seed 3, 1920x1080 high) max 207 calls / 684k tris · sandbox sweep max 183 calls / 538k · autopilot races
  seed 3 and seed 5: player 1st, all 8 finished, 0 errors · build 0.9 s (sandbox) · chase sheet shots/env-mountain/fix2/
  final_sheet.jpg (start, H1, cliff, portal, bridge + waterfall, crest, lake, hot spring); close-ups fix2/{c,e2,f,h,i,j}.
  Skipped: dry-stone walls (uphill edge is already the track's stone wall), per-tile tree cone twins (budget met without).

## Acceptance round 1 (10-19; checkpoint after each item, a resumed fixer skips [x])
Reviews: reviews/game-r1-*.json. Owner env-mountain: aesthetic#0 (major), aesthetic#6, aesthetic#7 (minor);
perf#7 (owner env-city, mountain part: leg blend 342 ms in one task). Plan in order:
1. [x] aesthetic#0 floating granite slabs over the cliff road (crags.ts faceRocks: seat on sampled ground, skip, log; smoother crags)
2. [x] aesthetic#7 grade: neutral whites / cool shadow side; dress the switchback legs (scree, posts, flags, signposts, boulders)
3. [x] aesthetic#6 waterfall from the bridge (thickness, base foam ring, mist, wet-rock lip)
4. [x] perf#7 leg blend / terrain grading split with yields (if the hook allows it from our files)
5. [x] verify: tsc, track.test, perfgame, race, chase sheet, __br.errors
- aesthetic#0 DONE: crags.ts faceRocks no longer assumes an evenly leaning wall. faceProfile() rebuilds the rendered wall
  cross-section at s (ground() at every near column out to 12 m + the same cragOffset push-back near.ts applies, which
  ground() alone does not see), sizes columns by the real wall height (skips where it is < 4 m: R-150 bank, relief), and
  wedges each slab where the rendered face reaches its height (back third buried); slabs whose face never gets that
  high are skipped. Log: 'rock walls: 44 columns, 20 slabs (1 skipped: face too low)'; warns if any slab base sits > 0.3 m
  above groundWorld (0). Rocks: new props/mountain-granite.ts bevelRock() = the jittered icosahedron subdivided once with
  edge midpoints lifted (80 facets, one tone per plane + bevel facets): wall, lip and portal rocks use it; GRANITE palette
  shared from there (was copied in crags.ts + portal.ts). Verified in game: shots/env-mountain/acc1/crag2_sheet.jpg.
- aesthetic#7 DONE (own files only; looks.ts is track's): new env/mountain-fill.ts adds a shadowless cyan-blue sky fill
  (#8fe0ff × 0.8) from the sky opposite the low sun (29° up). Back-lit / shaded sides, sun shadows and the asphalt now pick
  up the cool sky instead of the orange key's toon floor band: pelican back (descent s 2440) RGB 206,136,115 → 203,170,176
  (HLS sat 0.48 → 0.24), road beside the bike 77,50,48 → 78,59,62 (brown → neutral grey-violet), kerbs crisp; the sky,
  sun and lit sides stay golden. Fades with the cube of the sun's tunnel dimming (sky light does not reach into the bore).
  Sunlit whites stay peachy: needs a less saturated key (request below). Legs: new dressing/mountain/legs.ts, every
  20–30 m per side: half-buried bevelled boulder clusters with tufts, scree fans (outcrop + 16 stones fanning to the curb)
  on the cut slope, a split-rail fence and a trail signpost per leg (「前方还有 两个回头弯」 / 「最后一弯 鹈鹕加油」),
  prayer-flag lines down the fall-away beyond the rail (21 rock items + flags). Verified: acc1/fill_cmp.jpg, g2_sheet.jpg.
- aesthetic#6 DONE: env/mountain-waterfall.ts rebuilt around strands: 1–4 separate curved ribbons per fall (one per ~4.5 m;
  side strands start 0.8–1.8 m lower = stepped lip), each curls over the lip, bulges outward across (rounded column) and
  widens downward; toon stripes across (deep-blue edge, pale blue, white core) with lane streaks racing down, an ink line
  inside the ragged cut sides, lip foam + foot spray; cut (discard) + opaque, so no sorting against the mist. Foam pool
  gets a churning white ring; mist 16 → 20 puffs, bigger. falls.ts: dark wet-rock lip bar the strands pour over (shows
  in the gaps), notch rocks use bevelRock. Same API (FallSpec + optional strands). Verified: acc1/wf2_sheet.jpg (bridge
  view: four white strands over wet rock with mist; close view: stripes, ink, ring).
- perf#7 DONE (mountain part): env/mountain-legs.ts LegBlend no longer marches 61 steps + 5 bisections per ray over every
  candidate: the ray point w m out is exactly w from the own centre point, so each candidate's crossing is the closed form
  w = |q − p0|² / (2 (q − p0)·d) and the mid-line is the minimum (same criterion, exact; same 1013 rows): 182 → 27–43 ms.
  dressMountain now yields between stages like coast (stages(): debug ms per stage, ctx.progress, breathe; batches via
  finishDressYielding + rocks.finishYielding): terrain grade 22–30 · sky 3 · landmarks 91–101 · tunnel 2 · walls/legs/signs
  63–90 · trees 20–24 · verges/far 30–65 ms (loaded machine), i.e. no dressing task over ~100 ms.
- VERIFY (acceptance r1 done): tsc 0 errors (whole project; a transient combat ult.ts error mid-run was combat's) ·
  track.test --track mountain 0 fails, rebuild/dispose clean · in-game perf
  (perfgame seed 3, 1920x1080 high) max 212 calls / 706k tris at the stacked legs (85 % / 88 % of 250 / 800k; was 207 /
  684k before the leg dressing) · sandbox sweep max 188 calls / 563k (85 % gate ok) · autopilot race seed 3: all 8
  finished, 0 errors · __br.errors empty in every run · final chase sheet shots/env-mountain/acc1/final_sheet.jpg
  (start, H1, leg, cliff, bridge + falls, crest pagoda, descent, lake).
- Requests (acceptance r1):
  - track (aesthetic#7 remainder, looks.ts is track's): MOUNTAIN_LOOK sun colour #ffb46e → ~#ffc79a (a less saturated key,
    so sunlit whites read cream instead of salmon) and ambient sky #b48ad8 → ~#a6a2e6 (bluer). env/mountain-fill.ts stays
    either way. The per-track env hook (tech#7) would let mountain own these values.
  - track: LayoutDef.curbs (delivered, thanks) is not adopted yet: mountain needs its own painted rumble edge / gutter
    first (new dressing work, not in this round's issues).
  - perf#4 (track): turbine rotors and gondolas compile when the fog cull first shows them; covered by the core warm-up
    request (perf#0), nothing mountain-side to change.

