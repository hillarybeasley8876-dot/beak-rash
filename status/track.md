# track unit — status

## Plan (milestones)
1. [x] Layout system: segment format → smoothed curvature/slope/bank → 1 m samples (typed arrays);
       frameAt / toWorld / project (hintS + spatial hash); zones → bounds/surfaceAt. Coast layout.
       Replace stub re-export in world/index.ts with a basic road so others run on the real track.
2. [x] Road visuals: canvas asphalt+markings texture, shoulders, curbs, start/finish lines; rails/walls
       exactly at bounds(); skirt.
3. [x] Terrain: near ribbons (exact road match) + far chunked grid; cliff rock walls; sea shader with
       heightmap-driven shallow colour + foam; sky dome (gradient, sun, toon clouds); lights + shadow
       following camera; fog from look.
4. [x] Features: ramp, tunnel, bridge, crest jump, oil, puddle, boost pads, pickupRow; meshes.
5. [x] Scenery: palms, rocks, umbrellas/towels, villas, lighthouse, pier, market stalls, boats, buoys,
       lamps, signs + billboards (memes, P5 frames), distance markers, crowd/banners, gantries, gulls, flags.
6. [x] city/mountain placeholder looks; __br.track; sandbox/track.html (fly-through + aerial); perf
       (≤250 calls, ≤800k tris); contact sheet of 8+ positions.

## Design notes
- s = horizontal arc length; sea on the LEFT (x<0) for coast. Drivable shoulders are coplanar with
  the road (physics is planar in track space); every boundary is visible (rail/wall/quay edge/water).
- bounds().leftKind/rightKind = what lies beyond the drivable extent: 'wall' (bounce) | 'water' (drop).

## Done
- M1 layout system + coast layout (3300 m); API verified by `node sandbox/track.test.mjs`
  (round trip < 3 mm, project ≈ 2 µs, bounds/surface consistency, NaN scan, dispose leak test).
- M2 road: canvas asphalt + markings, shoulders by surface, curbs on curves, edges exactly at
  bounds() (rail, barrier, seawall, stone, parapet, market kerb, quay), decals (start/finish chequers,
  START/FINISH paint, grid slots, oil, puddles, animated boost pads).
- M3 environment: near ribbons (exact) + chunked far grid + landmark domes (islands, lighthouse
  islet); world-projected rock strata on steep faces; toon sea (heightmap shallow bands, shoreline
  foam, crest dashes, glints); sky dome + cartoon clouds; sun shadow following the camera; fog.
- M4 features: ramp (matches sim wedge), tunnel (tube, lights, portals, hill cap), bridge (deck,
  piers, red through-arches springing from concrete end pylons), crest jump, oil/puddles/boost pads,
  15 pickup rows. Rock walls + tunnel walls sit WALL_TOE (0.06 m) beyond bounds().
- Far terrain: farmland patchwork (fields, furrows, hedges) on gentle inland far ground
  (terrain/farmland.ts, far-grid `farm` attribute) + 4 hill villages with bell towers (coast/hamlets.ts).
- M5 scenery (dressing/coast/*): palms, umbrella pines, cypresses, bushes, boulders, far groves,
  terraced villas, beach umbrellas/loungers/towels, promenade lamps/benches, fish market (stalls,
  pennants, moored boats), pier, lighthouse + cottage, sailboats/buoys (bobbing), grandstands with a
  bobbing animal crowd, start/finish gantries, flags, banners, meme billboards (P5 frames, generated
  art when BILLBOARDS lists any), road/warning signs, chevrons, distance markers, gull flocks.
- Perf: ≤ 145 draw calls and ≤ 435k tris per chase view incl. the shadow pass (sandbox/track.perf.mjs);
  fog-distance culling (world/lod.ts); build ≈ 2.6 s.
- `window.__br.track = { id, length, layout, features }`.

## Next (resume 10-18 plan; [x] = done)
- [x] leak test: dressing must not depend on the race seed (billboard faces use a forked rng)
- [x] sim F11: cliff/tunnel wall faces at bounds() + 0.05 m (WALL_TOE 0.06; portals narrowed before the plane)
- [x] combat: a crate/can row about every 400 m; all rows inside halfWidth − 1 m
- [x] Track.runoff = 250 m (frameAt/project/bounds/surfaceAt valid on [0, length + 250])
- [x] far terrain variety: farmland patchwork shader on the far grid (terrain/farmland.ts), 4 hill villages (dressing/coast/hamlets.ts)
- [x] tunnel/bridge junction checks (bridge end pylons close the rock/parapet seam, arch ribs spring from them) · full-race restart check (track.race.mjs + full autopilot race: finish, results, no errors) · city/mountain: now owned by env-city / env-mountain (wave 2)
- [x] final contact sheets: shots/track/final-sheet.png (12 chase views), shots/track/game-sheet.png (16 in-game),
  shots/track/aerial.png; perf after all changes ≤ 141 calls / ≤ 456k tris per chase view
- [x] poster billboards: text band 0.30 → 0.38 of the face (2-line memes ≈ 25 % larger glyphs)
- [x] coast tight corners (integrator note) — see below. Wave-2 units env-city / env-mountain own the city /
  mountain layouts + dressings.

## Tight corners (integrator note, resume 10-18 #2) — DONE
- [x] sandbox/track.plan.mjs (+ track.plan-png.mjs): node layout checker on the game's own buildLayout:
      corners (R, turn), self-proximity, sea/land side conflicts, rows |x| ≤ hw − 1, dome clearance, plan PNG.
- [x] coast.ts (3300 m, same s for everything before 980 and after 1580): S-chicane 998–1116 (L R60 −48°,
      R R60 +48°; run-off: grass verge right, 3 m asphalt shoulder left) replaces the R150 sbend; calanque
      1209–1535: R90 +57° into a narrow cove, near-hairpin L R46 −118° round its head (1324–1427; rail +
      drop inside, 3.6 m asphalt run-off before the rock wall outside), R90 +58° out past the lighthouse
      islet (bump s1514 x−86). Crest (peak 1640), ramp 1812, tunnel, bridge unchanged.
- [x] signs / villages / gulls are layout marks now ({kind:'sign', data:{sign}} · 'village' · 'gulls'), so they
      follow the corners: curves sign = ROAD_SIGNS[5] 「连续弯道 弯弯有鹅」 at 930 (content request 6),
      sharp-bend warning 「急弯 别急」 at 1236, lighthouse sign 1452, fish 1135; far groves / hill villages use
      place.free() (never on another road part).
- [x] far grid: vertices covered by the near ribbon (and under the road) sink below the lowest profile
      point within one cell (terrain/far.ts deepHold/roadHold) — removed far-grid spikes poking through
      cliff feet (coast 989 → 100 poke samples, the rest at the bridge abutment; mountain 665 → 408,
      city 146 → 48; 0 new holes on coast / city).
- [x] verified: track.test OK · plan check 0 fails · perf ≤ 142 calls / 455k tris · track.race OK · in-game
      sheet (shots/track/game-sheet.png) · calanque shots (calanque-top/-in/-sea, hairpin-sheet,
      corners-sheet, signs-sheet) · feel-tour: chicane needs 69 % steer at 20 m/s (was 28 %), drift L2 +
      boost in the chicane · race-soak --seeds 1: SOAK OK (all 8 finish, 171 s, maxStuck 2 s, 80 drift events).

## Feature data (for sim / race / combat)
- ramp: wedge 0 → data.height (1.2) from s0 to s1 across x0..x1 · jumpCrest: data.peak = crest s
- boostPad: data.power/time (0.3 / 1.0) · oil, puddle: boxes · tunnel / bridge: s range, full width
- pickupRow: diagonal row (s0,x0)→(s1,x1), data.kind = coin|fish|crate|can (else mixed); 15 rows, all
  |x| ≤ 6; crate/can rows at s ≈ 430 crate, 820 can, 1190 crate, 1494 can, 1825 can, 2240 crate,
  2620 crate, 2990 can (+ mixed rows 1118, 2390 with one random special); coin row 1366 on the hairpin apex.
- Tight corners: chicane L R60 998–1053 / R R60 1059–1116; calanque R R90 1209–1304, hairpin L R46
  1324–1427, R R90 1440–1535 (run `node sandbox/track.plan.mjs` for the live list).
- Track.runoff = 250 m: frameAt / toWorld / project / bounds / surfaceAt valid on [0, length + 250]
  (barrier-lined straight past the FINISH gantry).
- Start line (visual) at s = 46, grid slots painted at s = 40 / 33.5 / 27, x = −3.4 / 0 / 3.4.

## Known issues
- Banked rail / seawall runs lean ≤ 2.6 cm into bounds at 0.5 m height (chicane, 2570–2700 L); harmless.
- sim: tools/feel-tour.mjs `cliffwall` stop (s 1200, x 3, steer .45) now sits in the calanque's R90 entry turn
  and no longer reaches the wall (x 2.9→3.8). Rock-wall stretches for that test: s 1160–1205 R (x 8.4) or the
  tunnel walls 1945–2095 (x ±8). Other stops still land on their features (sbend → chicane, crest, ramp).
- Hill village site s 330 finds no flat dry spot (4 of 5 villages, as before).
- content: sandbox/content.world.ts mirrors the poster billboard layout; its band is still 0.30 (now 0.38).

## Core requests
- (resolved by core: outline() now uses `normal`.) Note: outline() adds a plain Mesh hull, which is
  wrong for InstancedMesh; track builds its own hull geometry (geom.makeHull) for batched props.
- (resolved: core added Track.runoff; track implements it = 250 m.) sim may now read frames past `length`
  instead of extrapolating (sim/pose.ts, crash.ts clamp to length today).

## How to test
- `node sandbox/track.test.mjs` — API self-test (exit 1 on failure).
- `node sandbox/track.plan.mjs [--file … --export …]` — layout plan check without a browser (exit 1 on failure)
  + top-down plan PNG (shots/track/plan.png).
- `node sandbox/track.shots.mjs --q "s=1300&x=2" --out shots/track/x.png` (also `view=aerial|high`,
  `sheet=0,400,…` contact sheet). Sandbox page: /sandbox/track.html.
- `node sandbox/track.race.mjs` — autopilot race, restart, quit (1 track group, fog restored, no errors).
- `node sandbox/track.perf.mjs` — calls / tris per chase view along the track.
- `node sandbox/track.game.mjs --out shots/track/game-sheet.png` — in-game contact sheet (16 positions).
- `node tools/shot.mjs --url "/?race=coast&seed=1&stub=actors,combat,race,fx&traffic=0" --out shots/track/a.png --step 600 --controls '{"throttle":1}'`
