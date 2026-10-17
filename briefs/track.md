# Unit: track (world/) — wave 1
Read SPEC.md first (§0–5, §9 features). You own `src/world/**` (not stub.ts), `src/data/tracks.ts`, `sandbox/track.*`.
Contract: `createTrack(app, id, rng): Promise<Track>` (core/contracts.ts) exported from `src/world/index.ts`.

## Goal
A real track system plus the fully dressed **coast** track "鹈鹕湾海滨公路 Pelican Bay". `city` and
`mountain` are wave 2: for now return the coast layout with a placeholder look for those ids, but build
the system so a new environment = one layout file + one dressing module.

## Deliverables
1. Layout format (`world/layouts/<id>.ts`): sequence of segments {length, curvature or radius, elevation
   delta, bank} + features. Smooth into a centre line (no kinks: curvature changes ramp in), sample
   frames every 1 m (pos, tangent, up incl. bank, right, curvature, slope, halfWidth). `frameAt`
   interpolates; `project` is fast with hintS. Length ~3.0–3.4 km point-to-point.
2. Coast layout with variety: long start straight with the start gantry; sweeping seaside curves; an
   S-bend; a cliffside section (rock wall on one side, guard rail + drop to sea on the other); a
   crest jump; a ramp; a short tunnel through a headland; a bridge over a cove; a fish-market village
   straight; final sprint to a big FINISH gantry. Road 4 lanes (~14 m, halfWidth 7) with shoulders.
3. Road mesh: asphalt with subtle texture (canvas-generated), lane dashes, edge lines, red/white curbs
   on curves, start/finish lines; guard rails/walls where `bounds()` says wall; correct `surfaceAt`
   (road/curb/grass/sand/dirt/water/wall) and `bounds()` matching what is drawn.
4. Terrain both sides (heightfield ribbons following the track: beach + sea on one side, hills/cliffs
   on the other), animated toon sea (shader waves, foam line at the beach), sky dome gradient + sun +
   toon clouds, fog matching `look`, lights (sun shadow following the camera, small frustum).
5. Scenery (instanced/merged, seeded): palms, rocks, beach umbrellas & towels, villas with terracotta
   roofs, red/white lighthouse, pier, fish-market stalls, sailboats, buoys, lamp posts, road signs and
   billboards with Chinese meme text from `data/memes.ts` (canvas-rendered, P5 red/black/white style
   frames; use `BILLBOARDS` art from data/assets.ts when present), distance markers, a crowd/banner
   area near start and finish, animated gull flock, flags. Gameplay features in `track.features`: ramp,
   tunnel, bridge, oil, puddle, pickupRow (several), jumpCrest, boostPad (a couple, optional).
6. Performance: environment ≤ 250 draw calls, ≤ 800k tris; LOD by fog distance; dispose everything.
7. Debug: `window.__br.track = { layout, features }` optional; sandbox/track.html: fly-through camera
   along the track + aerial overview for screenshots.

## Quality bar (critics check)
From the chase camera (~5 m behind, 2 m up) the road reads clearly at 70 km/h, the world feels sunny,
rich and characterful (not empty, not cluttered on the road), toon-styled, coherent palette with P5
red accents. Aerial view shows a believable coastal road. No z-fighting, gaps, popping, floating props,
props on the asphalt (except features), or bounds/visual mismatch.

## Test
`node tools/shot.mjs --url "/?race=coast&seed=1&stub=actors,combat,race,fx&traffic=0" --out shots/track/a.png --step 600 --controls '{"throttle":1}'`
and teleport via `--eval "window.__br.teleport(0, 1200, 0)"`. Make a contact sheet of 8+ positions. LOOK at them.
