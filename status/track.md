# track unit — status

## Plan (milestones)
1. [x] Layout system: segment format → smoothed curvature/slope/bank → 1 m samples (typed arrays);
       frameAt / toWorld / project (hintS + spatial hash); zones → bounds/surfaceAt. Coast layout.
       Replace stub re-export in world/index.ts with a basic road so others run on the real track.
2. [ ] Road visuals: canvas asphalt+markings texture, shoulders, curbs, start/finish lines; rails/walls
       exactly at bounds(); skirt.
3. [ ] Terrain: near ribbons (exact road match) + far chunked grid; cliff rock walls; sea shader with
       heightmap-driven shallow colour + foam; sky dome (gradient, sun, toon clouds); lights + shadow
       following camera; fog from look.
4. [ ] Features: ramp, tunnel, bridge, crest jump, oil, puddle, boost pads, pickupRow; meshes.
5. [ ] Scenery: palms, rocks, umbrellas/towels, villas, lighthouse, pier, market stalls, boats, buoys,
       lamps, signs + billboards (memes, P5 frames), distance markers, crowd/banners, gantries, gulls, flags.
6. [ ] city/mountain placeholder looks; __br.track; sandbox/track.html (fly-through + aerial); perf
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
  piers, red through-arches), crest jump, oil/puddles/boost pads, 9 pickup rows.
- M5 scenery (dressing/coast/*): palms, umbrella pines, cypresses, bushes, boulders, far groves,
  terraced villas, beach umbrellas/loungers/towels, promenade lamps/benches, fish market (stalls,
  pennants, moored boats), pier, lighthouse + cottage, sailboats/buoys (bobbing), grandstands with a
  bobbing animal crowd, start/finish gantries, flags, banners, meme billboards (P5 frames, generated
  art when BILLBOARDS lists any), road/warning signs, chevrons, distance markers, gull flocks.
- Perf: ≤ 145 draw calls and ≤ 435k tris per chase view incl. the shadow pass (sandbox/track.perf.mjs);
  fog-distance culling (world/lod.ts); build ≈ 2.6 s.
- `window.__br.track = { id, length, layout, features }`.

## Next
Polish: far terrain variety (farmland, hill villages), tunnel/bridge junction checks, city/mountain
placeholder check, full-race restart check, final contact sheets.

## Feature data (for sim / race / combat)
- ramp: wedge 0 → data.height (1.2) from s0 to s1 across x0..x1 · jumpCrest: data.peak = crest s
- boostPad: data.power/time (0.3 / 1.0) · oil, puddle: boxes · tunnel / bridge: s range, full width
- pickupRow: diagonal row (s0,x0)→(s1,x1), data.kind = coin|fish|can|… (else mixed)
- Start line (visual) at s = 46, grid slots painted at s = 40 / 33.5 / 27, x = −3.4 / 0 / 3.4.

## Known issues
-

## Core requests
- (resolved by core: outline() now uses `normal`.) Note: outline() adds a plain Mesh hull, which is
  wrong for InstancedMesh; track builds its own hull geometry (geom.makeHull) for batched props.
- Optional: frameAt clamps to [0, length]; the track samples 280 m of visual run-off past the finish,
  so letting physics read frames past `length` would let finished riders roll on instead of stacking.

## How to test
- `node sandbox/track.test.mjs` — API self-test (exit 1 on failure).
- `node sandbox/track.shots.mjs --q "s=1300&x=2" --out shots/track/x.png` (also `view=aerial|high`,
  `sheet=0,400,…` contact sheet). Sandbox page: /sandbox/track.html.
`node tools/shot.mjs --url "/?race=coast&seed=1&stub=actors,combat,race,fx&traffic=0" --out shots/track/a.png --step 600 --controls '{"throttle":1}'`
