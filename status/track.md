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
- Banked rail / seawall runs (plumb in world space) sit ≤ 7 cm inside the banked track-space bound at 0.66 m height
  (hairpin bank −6°, chicane); harmless (track.audit.mjs intrusion 0.069 m, limit 0.08).
- Craggy rock faces: band vertices are pushed back (terrain/crag.ts, recesses up to 3.6 m), so ribbonHeight() is
  approximate on the face itself (u < stepW); nothing is placed there (crest props sit on the unshifted lip, u ≥ stepW + 1).
- Sign atlas: a late-font repaint (fonts > 4 s late) re-runs the face closures, so ransom-note styling differs from a
  normal build (still correct glyphs); late billboard art is skipped for that build (next build has it).
- Sandbox only: view() advances 1/60 s per call, so views just after the tunnel show the light still recovering.
- sim: tools/feel-tour.mjs `cliffwall` stop (s 1200, x 3, steer .45) now sits in the calanque's R90 entry turn
  and no longer reaches the wall (x 2.9→3.8). Rock-wall stretches for that test: s 1160–1205 R (x 8.4) or the
  tunnel walls 1945–2095 (x ±8). Other stops still land on their features (sbend → chicane, crest, ramp).
- Hill village site s 330 finds no flat dry spot (4 of 5 villages, as before).

## Notes for other units (fix round 1)
- fx / combat (art critic, cross-unit): near-miss octagon rings and the CHILL ZONE aura read as flat CG rectangles over
  the toon road; suggest toon ground rings clipped to the drivable width with a soft additive edge.
- fx: seen during the in-game sheet run: `ReferenceError: ring is not defined` at src/fx/presets/speed.ts:142
  (rider:boost handler); not track code.
- core / ui: the track now emits `flow:loading` {progress 0.12 → 0.9, label} after each build stage (the loading
  bar follows real progress); game.ts may keep emitting its own as well (target = max).

## Notes for other units (fix round 2)
- race / ui-screens (art critic r2): during the intro flyover the 'PELICAN BAY 鹈鹕湾海滨公路' title card sits on the START
  gantry header (reads 'PELICAN BAYRT'): offset the card or frame that shot so the header stays clear (gantry at s 46).
- env-city: features/bridge.ts now exports APEX / PYLON_AT / RIB_W / RIB_D, and loadBillboardArt lives in
  scenery/signs/art.ts (decode cache, per-image waits); coast/signage still re-exports it.
- env-mountain: LayoutDef.curbs = false turns the automatic red / white curbs off (requested art#5).
- env-mountain: SignAtlas cells that tile the width (512 / 1024) now share shelves (no gutter) — mountain's atlas packs
  tighter too; coast flags(…, every, finish) gained an optional 6th parameter (your 5-arg call is unchanged) and
  flagPole optional style / swallow / emblem parameters; shared lights.ts now fades sun shadows inside tunnels and uses
  texel-scaled normal bias; terrain material fades received sun shadow on grazing faces (all tracks).

## Core requests
- (fix round 2, tech critic T9) precompile at race start: `await app.renderer.compileAsync(app.scene, app.camera)` with
  every session object visible before show('race') (or warm the bike / rider materials in their preloads): one 383 ms
  hitch mid-race when bikes:depth / bikes:body / actors:rider compile on first sight. No track material compiles in-race.
- (resolved by core: outline() now uses `normal`.) Note: outline() adds a plain Mesh hull, which is
  wrong for InstancedMesh; track builds its own hull geometry (geom.makeHull) for batched props.
- (resolved: core added Track.runoff; track implements it = 250 m.) sim may now read frames past `length`
  instead of extrapolating (sim/pose.ts, crash.ts clamp to length today).

## How to test
- `node sandbox/track.test.mjs` — API self-test (exit 1 on failure).
- `node sandbox/track.audit.mjs [--track coast] [--step 4] [--skip intrude,stall]` — regression audit (exit 1 on failure):
  NaN/∞ API, road height raycasts, edges vs bounds(), curbs vs surfaceAt, prop intrusion, rebuild long tasks.
- `node sandbox/track.plan.mjs [--file … --export …]` — layout plan check without a browser (exit 1 on failure)
  + top-down plan PNG (shots/track/plan.png).
- `node sandbox/track.shots.mjs --q "s=1300&x=2" --out shots/track/x.png` (also `view=aerial|high`,
  `sheet=0,400,…` contact sheet). Sandbox page: /sandbox/track.html.
- `node sandbox/track.race.mjs` — autopilot race, restart, quit (1 track group, fog restored, no errors).
- `node sandbox/track.perf.mjs` — calls / tris per chase view along the track.
- `node sandbox/track.game.mjs --out shots/track/game-sheet.png [--s 1915,1990 --cols 2]` — in-game contact sheet.
- `?debug` (game or sandbox URL) prints the [track] build log: stage timings, billboards, beach counts, atlas use.
- `node tools/shot.mjs --url "/?race=coast&seed=1&stub=actors,combat,race,fx&traffic=0" --out shots/track/a.png --step 600 --controls '{"throttle":1}'`

## Fix round 1 (reviews/track-r1-art.json score 6, track-r1-tech.json score 7) — DONE
Plan ([x] = done; checkpoint after each):
- [x] T1 (tech major) build stall: shared layout/sample-index.ts (exact kd-tree with node boxes + warm start, chord
      refine) replaces both ring searches (TrackQuery.project fallback, TerrainField.sampleWorld); track.ts yields
      (world/breathe.ts) between stages and inside the coast dressing and emits `flow:loading` {progress, label}.
      Coast build 2.2–2.7 s → 0.5–0.6 s; loadstall.mjs worst rAF gap 2000 ms → 100 ms (stubs) / 167 ms (all units).
      Minors done with it: build failure → teardown (fog/background restored, owned resources disposed) + rethrow;
      project() returns {s: clamp(hint), x 0, y 0} + one warning on non-finite input; [track] info logs only with
      ?debug (ctx.log); dead sampleIndex() and stale wave-1 comments removed, layoutFor = exhaustive Record; far
      chunks culled by world/lod.ts (userData.cullMargin 60) instead of their own loop.
- [x] A1 (art major) rock walls: pale limestone GROUND.rock/rockDark; new terrain/rock-texture.ts (angular blocks in
      1.4–3.4 m strata, sunlit ledges, shaded undersides, fractures; 18 m tile) projected biplanar in world space
      (x-y / z-y planes) — no seam at chunk borders, no smear on curved or sloped faces; LayoutDef.crags (coast) →
      terrain/crag.ts pushes each face band back 0.35–1.7 m (noise per band, drifting along s; 0 below 1.5 m, so the
      foot stays at bounds + WALL_TOE) and lifts the lip into crenellations; dressing/coast/crags.ts puts faceted
      limestone rocks (scenery/props/rocks.ts, flat-shaded jittered icosahedra), scrub and pines along every lip;
      coast shore/cliff boulders use the same limestone rocks.
- [x] A3 (art major) tunnel: shared shell (features/tunnel.ts) now unlit with baked lamp light (dim, brighter rows
      under each strip, 4 m panels) in its own batch: same look at every quality, no vault shadow acne (tech minor);
      env/lights.ts dims sun (×0.4) and hemi while the camera is under a roof (τ 0.1 s; night looks ×0.7) for all
      tracks; coast fit-out (dressing/coast/tunnel.ts + tunnel-signs.ts): multiply overlay darkening road+shoulders
      ×0.48 with pools under every lamp, lamp housings, wall lamps, jet-fan pairs every 40 m, black P5 sawtooth over
      the red dado, 4 meme exit signs, portal facades (pilasters + black lintel + 鹈鹕岬隧道 plate) on both ends,
      limestone outcrops / scrub / umbrella pines on the cap. City keeps its own fit-out (same shell geometry).
- [x] A2 (art major) inland + beach: new `cover` batch (double-sided, no outline/shadow, 160 m cells) with ~19k grass
      tufts / flower clumps / pebbles beyond the edge out to ~45 m (dressing/coast/cover.ts, scenery/props/cover.ts);
      olive terraces (rows of olive trees behind dry-stone wall runs) on the gentle land side of 9 zones; flowering
      hedge bushes behind the kerb; hillside trees every 5 m (was 7); large-scale grass tint (tintNoise, ~110 m:
      lush green ↔ sun-bleached ochre) on near + far terrain; beach (dressing/coast/beach.ts, scenery/props/beach.ts):
      umbrella clusters of 2–4 every ~4.5 m with loungers / towels / sunbathing animals, a run of striped beach huts
      at the wall foot, lifeguard towers near the water, sandcastles at the waterline, a volleyball net.
      Perf (track.perf.mjs): max 150 calls / 567k tris per chase view (budget 250 / 800k).
- [x] tech minor: cutting invisible wall — layout/sides.ts switches the edge kind into / out of 'rock' only where the
      blended step is ≤ 2.5 m wide (the face exists), else at the midpoint; edges.mjs: wallMissing 4 → 0.
- [x] tech minor: quay bollards + quay lamps + market pennant poles stand on timber mooring piles 0.7–0.75 m off the
      coping (scenery/props/marine.ts pile); road signs / chevrons / markers keep their plate ≥ 0.3 m outside the
      bound (signage.ts clearU), hedges keep every leaf ≥ 0.2 m out; edges.mjs: wallInside 0, waterBlocked 0;
      intrude2.mjs: only the banked rail lean (≤ 7 cm at 0.66 m, known issue) remains.
- [x] tech minor: crowd + boats batches castShadow false (sway lives in the colour shader only).
- [x] tech minor: quality=low: fog (and with it lod.ts culling) ×0.8, no hulls on thin cards / boats, no ground
      cover, no far groves / hill villages (plus no shadows, as before).
- [x] tech minor: tunnel acne / low-quality sunlit tunnel (A3) · duplicated search + fog cull, NaN, logs (T1).
- [x] art minor: billboards 10 × 5.6 m (was 8 × 4.5), lift 3 m, turned 0.75 rad toward riders (was 0.42), every
      ~150 m (was 230), always clear of the bound.
- [x] art minor: asphalt — per-row tone drift (vertex colours) so the 12 m texture never repeats visibly, darker
      wheel paths, sealed patch seams and cracks; painted 慢 / 慢 / 飞 words from layout 'paint' marks (decals.ts).
- [x] art minor: coast fog #a9d4f5 (bluer than the horizon band), near 300 m (was 200), far 1000 m.
- [x] art minor: FINISH arch (scenery/props/finish.ts): chunky red/black striped pillars with yellow star plates,
      inflatable pelican heads + balloons, deep header with a chequered band, ransom-note 「FINISH 终点」 face
      (faces.ts finishFace), walkway of flag-waving fans, pennants spilling to the ground.
- [x] art minor: sea foam — env/sea.ts derives metres-to-waterline from the height-map slope: one 0.6–1.8 m lapping
      edge + thin surf lines within ~16 m, all fading out beyond 0.6 m depth (no white blotches on flat shallows).
- [x] art minor: stands — red/black striped awnings, meme banners on the awning edge (STAND_BANNERS), crowd heads
      by species (pelican with pouch, goose neck, cat ears, dog ears, boxy capybara, pigeon).
- [x] art minor: villas — pastel walls (pink / ochre / pale yellow among the whites), side wings with roof-terrace
      railings and pergolas, upper balconies, bougainvillea cascades (VillaOpts.plain for the lighthouse cottage).
- [x] art minor: bridge-cove ends — limestone rock skirts along the land/water seam at both bridge ends.
- [x] tech minor: long lines wrapped (≤ 165 chars in coast files; was up to 214).
- [x] cross-unit (content request 6): coast keeps its own BILLBOARD_LINES / ROAD_SIGNS use (positional signs);
      TRACK_BILLBOARDS / TRACK_SIGNS not wired for coast (out of scope this round).

Verified (fix round 1): tsc 0 errors · track.test coast/city/mountain 0 fails · track.plan 0 fails ·
track.race (race, restart, quit: 1 track group, fog restored, 0 errors, 0 warnings) · edges.mjs: road 0 mm /
0 misses, wallOk 3188, wallMissing 0, wallInside 0, waterBlocked 0 · intrude2.mjs: only the ≤ 7 cm banked rail
lean · perf high max 160 calls / 633k tris, low max 98 / 484k · loadstall (stubs): worst rAF gap 2000 → 142 ms
(all units 200 ms, longest track task 149 ms) · in-game sheet shots/track/fix1/game-sheet.png; close-ups
shots/track/fix1/{rock2,inland2,sheet3,high1,final}.jpg.

Shared files touched this round (env-city / env-mountain please note): features/tunnel.ts (shell unlit with baked
light in a new 'tunnel' batch; geometry, LAMP_EVERY 9 m and lamp x ±2.2 unchanged, so city's fit-out still lines
up; new exports tunnelHalfW / vaultY / capHeight / capHalfW / WALL_H / CROWN), env/lights.ts (sun ×0.4 / hemi
×0.61 while the camera is under a roof; night looks keep ×0.7; quality=low fog ×0.8), terrain/material.ts + new
rock-texture.ts (blocky limestone strata, biplanar world projection: also on mountain cliffs), terrain/profile.ts
(groundColor optional n2 tint; GROUND.rock limestone — mountain repaints, city has no rock), layout/sides.ts (edge
kind into/out of 'rock' switches where the face exists), layout/types.ts (optional LayoutDef.crags), layout/query.ts
+ terrain/field.ts (kd-tree search, same results), features/decals.ts ('paint' marks), road/road.ts (asphalt vertex
tone), dressing/dress.ts (new `cover` batch, finishDressYielding, crowd/boats castShadow false), lod.ts (far chunks
via userData.cullMargin).

## Fix round 2 (reviews/track-r2-art.json score 7 fail, track-r2-tech.json score 8 pass) — DONE
Plan ([x] = done + verified; checkpoint after each). Probes/scripts: shots/track/fix2/.
- [x] A1 (art major) shadow acne on limestone faces: env/lights.ts normalBias = 1.5 shadow texels (high 0.067, medium
      0.105; was 0.03), depth bias kept at −0.0004 (−0.001 = 0.4 m over the 400 m ortho depth range: wheel contact
      shadows would detach; it measured the same, see below); terrain material (new terrain/shadow-fade.ts, patched
      lights_fragment_begin, warns once if three's chunk changes) fades the received sun shadow by smoothstep(0, .25, N·L)
      on near ribbons + far grid (grazing faces sit in the toon mid band anyway). Critic's acne sweep (copied to
      shots/track/fix2/acne.mjs + acne.py): s 1260-1320 / 1890-1930 / 2090-2120 flagged 1.0-10.2 % → ≤ 1.4 % (residue =
      real prop shadows on the lip), 2090-2120 none; crawl.mjs high vs low: s 1300 3.3 vs 3.1 (was 9.5 vs 3.1), s 1920
      4.2 vs 4.3 (was 12.3 vs 4.2). shots/track/fix2/acne-cmp.jpg (before / after / low). Final sweep 1150-2200 every
      10 m after A3 (shots/track/fix2/final, acneviz.py): ≤ 2.0 % flagged and every flagged block is a tree / prop on
      the skyline (quality=low drops the cover, groves and mid-ground, so they only exist at high), none on rock;
      with bias −0.0004: s 1290-1310 ≤ 0.9 %, 1900-1930 ≤ 0.8 %, 2100-2120 0 %; rock-region HF high ≈ low (hf.py).
- [x] A2 tunnel: env/lights.ts drives sun.shadow.intensity with the roof factor (1 outside → 0 under the roof: no sunlit
      rider shadows on the tunnel road; the cap's sun-facing skin never reached the shadow map, so the sun lit the tube);
      new dressing/coast/tunnel-light.ts (roadShade moved out of tunnel.ts): 0.5 m grid, crisp elliptical pools (soft
      outer quarter) under every vault strip pair + wall lamp, multiply DIM 0.48 → 0.40 between them, an additive warm
      layer on the pool cores and an additive wash round each wall lamp (3 meshes, was 1); portal lintel 1.75 → 3.3 m
      deep with a 14.5 × 2.95 m ransom-note plate (black, red jagged band, halftone, yellow stars; was 6.8 × 1.36 m
      plain label): readable from ~90 m (shots/track/fix2/tun-b.jpg).
- [x] A3 rock faces planar: terrain/crag.ts adds a shared buttress/recess pattern along s (~6-12 m features, up to
      min(3.6, 0.3·wallH) m deep, scooped mid-face while the lip stays → overhangs with dark undersides; foot still
      fixed below 1.5 m) and tall lip spurs (up to min(5, 0.38·wallH) m, every ~15-25 m) on top of the crenellations;
      new terrain/crag-glsl.ts (CRAG_FACES define, coast only): wavy horizontal ochre + chalk bands across steep faces
      (fwidth-AA) and a cool tint on their ambient (shadowed rock / undersides blue-grey); rock-texture.ts: occlusion
      gradient under every block, darker 2.8 px joints. shots/track/fix2/rock1.jpg (calanque, hairpin, cutting, high).
- [x] A4 empty start/finish beaches: coast layout 'umbrellas' marks on the sea side of start (0-150), sprint (whole
      segment) and finish (3140-3430, into the run-off): umbrella clusters, loungers, towels, sunbathers, huts, lifeguard
      towers, volleyball nets, sandcastles (beachLife, existing batches; place.claim keeps them off the stands).
      shots/track/fix2/beach1.jpg (high 60 / 3280). Found on the way: the sign atlas overflowed (2908/3072, one face
      skipped) because 1024- and 512-wide cells never shared a shelf (4 px gutter): SignAtlas.alloc now drops the
      gutter for cells that tile the width exactly (returns the granted w; cell() draws with it) → 2696/3072, no skip.
- [x] A5 mid-ground + farmland: terrain/farmland.ts crop palette toned 28 % toward grey-green, furrows and hedges
      fade by fwidth once under a few pixels (no far moire); new nature.midGround (coast, not at low): every ~9 m per
      side at 45-150 m bush clumps (2-4, scale 1.3-2.1), cypress lines (2-5) and limestone outcrops on steep ground, in
      the far batch (no new draw calls; +24k tris at the worst view); olive-terrace walls (scenery/props/cover.ts
      stoneWall) in two dry-stone courses (upper set back, lighter, per-segment tone) under the capstone row.
      Not done: footpaths up to the hill villages.
- [x] A6 flags: scenery/props/event.ts flagPole(…, style 'plain' | 'star' | 'chequer', swallow, emblem) — signature
      extended (mountain's calls unchanged): a five-point star on both faces of the cloth (2 cm off, same sway uv so
      it waves with it), black/white chequer cloth (3 × 6 quads), swallowtail fly end; the white trailing edge is gone.
      Coast start flags: red / black / yellow star flags, every other one swallowtailed; finish: chequered flags
      alternating with red star flags (flags(d, side, s0, s1, every, finish) — `finish` added after `every`).
- [x] A7 cross-unit (not track): intro title card covers the START gantry header ('PELICAN BAYRT') → note for race /
      ui-screens below (offset the card or frame that intro shot with the header clear).
- [x] T1 fonts / art: world/index.ts exports preload() (core awaits it at boot; returns at once) that warms the coast
      sign fonts (fonts.warmFonts) and decodes every track's billboard art; new scenery/signs/art.ts (moved from
      coast/signage.ts, re-exported there for city / mountain): per-page decode cache, each image its own 2.5 s wait,
      ready images kept, late ones warned + skipped for that build (next build has them), missing ones warned.
      Coast signs: SignAtlas(…, deferred) records every face and the dressing paints them once (flush) after
      ensureFonts(…, 4000) — the download overlaps the dressing CPU work; if the fonts are later still, the atlas is
      painted with fallbacks and repainted on document.fonts.ready (dress.repaintWhenFontsLoad, skipped once
      disposed). The road-word decals repaint themselves when their font loads (features/textures.ts wordTexture);
      track.ts no longer blocks 2.5 s on them. ensureFonts returns readiness. Banner faces draw with their own rng
      fork (deferred paint does not shift the dressing rng). shots/track/fix2/atlas-check.mjs: two fresh pages →
      identical atlas hash (critic: different); fonts delayed 6 s / 9 s → warn, fallback, then "sign atlas repainted";
      art delayed 6 s → 6 warnings, text billboards, no silent drop. Late art is not repainted in-build (art posters
      use a different quad height).
- [x] T2 load stall: geom.makeHull welds on the 2 mm grid through an Int32 open-addressing hash (no string keys /
      Map); PropBatch.finishYielding() yields every 30 ms inside a batch (finish() kept for city / mountain);
      WorldCtx.progress(f) reports progress inside the current stage (track.ts stage spans) and the coast dressing
      steps 0.62 → 0.9 (8 steps + per batch). Sandbox rebuild (track.audit.mjs): worst long task 173 → 90 ms, build
      814 → 680 ms.
- [x] T3 sea: env/heightmap.ts sizes the target to the terrain's aspect (square texels; long side 4096 at high,
      2048 else) as single-channel R16F when EXT_color_buffer_float exists (RGBA 2048 fallback): coast 4096 × 1463 =
      1.31 m texels (was 1.88 × 5.25 m), 12 MB (was 8 MB RGBA); HeightMap.texel → sea uTexel (no HM_SIZE constant);
      env/sea.ts: aastep() (fwidth smoothstep) for the depth bands, surf, shore lap, ripples and sparkles. mountain-lake
      reads .r only (unchanged). shots/track/fix2/sea1.jpg.
- [x] T4 perf: lod.ts hides a batch cell's outline hull once the whole cell is > 130 m away (< 0.4 px outline);
      quality=medium drops the thin-card hulls and plants half the ground cover. track.perf (step 100, high): max
      135 calls / 559k tris incl. the mid-ground ring (r2 critic: 166 / 739k). Atlas: kept 2048 × 3072 — after the
      packing fix it is 2696 px full, so it cannot shrink to 2560.
- [x] T5 renderHeightMap: render inside try/finally (render target, clear colour/alpha, visibility, parent, override
      material restored even if render throws).
- [x] T6 new sandbox/track.audit.mjs (sandbox page, exit 1 on failure; sandbox/track.ts exposes __trk.three):
      project/frameAt/bounds with NaN/±∞, rendered road height (raycasts, ≤ 4 cm), visual edges vs bounds() (wall
      within 2 m and not inside, water edges open), drawn curb blocks vs surfaceAt, prop-vertex intrusion (≤ 8 cm
      below 2.6 m), rebuild long tasks (≤ 150 ms). Coast: road 4435 rays 0 misses (max 2.9 cm), wallOk 1619 / missing 0
      / inside 0, water 155 open / 0 blocked, curbs 1774 / 0 mismatch, intrusion 0.069 m (known banked rail lean),
      rebuild worst task 90 ms → AUDIT OK.
- [x] T7 curbs: TrackQuery.curbAt(s, side) = the 1.5 m block covering s is drawn (both ends flagged); surfaceAt and
      road.ts buildCurbs share it (CURB_BLOCK) → audit 0 of 1774 mismatches (critic: 14 at run ends).
- [x] T8 hygiene: query.ts builds new frames with real fields (newFrame, no `as unknown as`); far.ts / near.ts hold
      ground materials as GroundDef['mat'][] (the old casts dropped 'paved'); surfaceAt no longer allocates (private
      side() removed); every track source line over 150 chars wrapped (24 lines; bridge 188 → ≤ 140); roadRange,
      SHOULDER_COLORS, tunnelOutline no longer exported. bounds() still returns a fresh object (contract value; callers
      may keep two). Lines of 141-150 chars and the sandbox scripts' long lines left as they are.
- [x] T9 cross-unit (not track): no shader precompile at race start (383 ms hitch when rival bike / rider programs
      compile mid-race; no track material compiles in-race) → core request below.
- [x] X2 env-mountain request (art#5, the cheap half): LayoutDef.curbs?: boolean (default true); false → no automatic
      curbs drawn and surfaceAt never 'curb' (TrackQuery.markCurbs), so mountain can paint its own edge. Not done: a
      curb restyle option and the per-track env hook (tech#7) — bigger, needs a core / track design pass.
- [x] X1 env-city request: features/bridge.ts exports APEX / PYLON_AT / RIB_W / RIB_D (arch uses them); loadBillboardArt
      now lives in scenery/signs/art.ts (coast/signage re-exports it, so city / mountain imports keep working). Not
      moved: chevrons / banners / distanceMarkers / warning (still in coast/signage).

Verified (fix round 2): tsc 0 errors (whole project) · track.test coast / city / mountain 0 fails · track.plan exit 0 ·
track.audit AUDIT OK (road 0 misses / 2.9 cm, walls 0 missing / 0 inside, water 0 blocked, curbs 0 mismatch, intrusion
0.069 m, rebuild worst task 90 ms) · track.race (all units: race, restart 1 group, quit 0 groups, fog restored, 0 errors,
0 warnings) · perf (step 50) high 134 calls / 547k tris, medium 131 / 529k, low 88 / 380k · sun shadow intensity 0 under
the tunnel roof, 1 outside (fix2/sunprobe.mjs) · city / mountain / coast-low / coast-medium sandbox builds: no warnings
or errors · in-game sheet shots/track/fix2/game-sheet.jpg; close-ups fix2/{acne-cmp,acneviz,tun-b,rock1,beach1,sea1,fin}.jpg.


## r3 polish (2026-10-25)
Issues from reviews/game-r2-aesthetic.json #5/#7/#8/#9 + game-r2-perf.json #4. Probes and sheets: shots/r3-track/.
- [x] aesthetic#5 asphalt: per-track RoadLook table in looks.ts (base colour, two tones, racing-line darkness, mark weights).
      New road/detail.ts (patched into the road toon material): lane panels 18-38 m long of worn / fresh asphalt (±7 %,
      straight seams blended over fwidth), ±3 % two-octave mottle, darker streaky racing-line band (x per row in the
      aLine attribute from road/line.ts: taut-string line through the corridor, projected SOR on a 6 m grid + smoothing).
      New road/marks.ts + marks-tex.ts: one merged decal mesh 'roadMarks' (one draw call, 0.6-1.0k tris) with tar / concrete
      patches, manholes (grouped in the city), worn lane arrows (bend arrows before corners tighter than R 120), skid marks
      along the racing line at apexes tighter than R 70, and ≤ 6 meme words per track (content TRACK_SIGNS / ROAD_SIGNS,
      heavy Noto glyphs, read near → far) every 70-150 m, kept clear of features, start / finish and env paint marks.
      Asphalt base: coast warm grey, mountain cool violet-grey, city unchanged (wet overlay on top). road.py (chase frames,
      100×60 patches): large-scale luma std coast 2.5-5.0 → 3.7-6.4, mountain 2.9-3.5 → 4.4-5.3; road colour coast
      (82,85,87) → (82,79,77), mountain (69,58,67) → (68,64,76). Sheets road-before-after.jpg, v4-marks.jpg.
- [x] aesthetic#7 mountain key: MOUNTAIN_LOOK sun #ffb46e → #ffe0b4, ambient sky #b48ad8 → #aaaadc (the requested
      #ffc79a / #a6a2e6 measured still salmon-pink: lit hue 13°, chroma 56). Exact player-mask probe (backmask.mjs/.py):
      lit plumage hue 13° → 29°, chroma 81-83 → 39-43, all-plumage HLS sat ~0.44 → 0.31-0.37 (coast whites read 0.27-0.34
      by the same measure; HLS sat of near-whites is inflated, the ≤ 0.2 target is not reachable even on the coast);
      shaded back at the descent neutral (HLS 0.02). Sheet mountain-key.jpg.
- [x] aesthetic#8 / perf#4 late billboard art: art.ts hands out every image that has not failed after a bounded wait
      (1.5 s), late ones still decoding (artReady / whenArt); faces.ts cell(…, art) draws a placeholder design in the
      same 16:9 cell and SignAtlas.redrawCell repaints it when the image lands (debounced re-upload of every live
      texture made from the atlas; skipped once disposed). Works for SlicedAtlas (city screens) too. lateart.mjs (images
      delayed 15 s): coast / mountain / city: placeholder in race, art in the same race, 0 errors / 0 warnings.
- [x] aesthetic#9 tunnels: new features/tunnel-kit.ts (TUNNEL_STYLES per track; city null): yellow / black chevrons over
      the dado inside both portals, cable trays with brackets and a cable bundle under the spring line, lane-control
      signals (green ↓ over the riders' lanes, red ✕ over the oncoming ones) every 48 / 60 m, low green exit boxes with an
      arrow toward the nearer portal. Unlit with the shell's baked light (SHELL_LIGHT), in the existing tube / lamp batches:
      0 extra calls, +2.0k tris coast / +2.8k mountain. Shell vault darkens to soot at the crown. Coast pools warm and long
      (DIM 0.4 → 0.58, pool half length 3.1 → 4.6 m, daylight spill 16 m into each mouth: no dark bands). t2-tunnels.jpg.
- [x] side fixes: env/lights.ts no longer restores a dead track's fog / background after restart + quit (track.race
      fog check passes again); track.ts splits road / road marks / near / sea / edges / features into separate tasks;
      billboard text faces draw from their own rng fork (a repaint keeps the design).
Requests: env-city — dressing/city/faces.ts finishScreenFace draws `art` itself: use `art && artReady(art)` (from
scenery/signs/art) to choose art vs the red burst and pass `art ? [art] : undefined` as cell()'s 5th argument, so a late
city_1 lands on the finish screen too (now it would stay dark). fx — a large white quad covers the top right of chase frames
when a billboard is in view (coast s≈589, 2620; gone with &stub=fx): repro `node shots/r3-track/chase.mjs --track coast --s 589`.
Shared-file notes (env): TUNNEL_STYLES.mountain can be tuned / nulled when the mountain gets a rock vault; the kit draws
at the dado (0.14-1.06 m), exit boxes 0.62-0.98 m, trays at WALL_H − 0.1, signals 5.0-5.66 m.
Verified: tsc 0 errors · track.test coast / city / mountain 0 fails, no leaks · track.audit coast AUDIT OK (road 0 misses /
2.9 cm, walls 0 missing / 0 inside, water 0 blocked, curbs 0 mismatch, intrusion 0.069; rebuild long task 89-149 ms when
quiet, up to 189 ms with 7 agents loading the machine: flaky gate) · track.perf coast high max 135 calls / 550k tris (r2 134 /
547k) · track.fps coast 60 fps at all 7 points · core-check OK · track.race 1 group, fog restored · autopilot races coast /
city / mountain finished, 0 errors, 0 warnings · late-art test 3 tracks.
