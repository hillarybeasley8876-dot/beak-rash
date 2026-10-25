# r4 job w1-track-watertown — new track 江南水乡 WATER TOWN

Read SPEC.md §0 (pillars), §5 (art bible: designer-vinyl toy look, cel shading, ink outlines, readable at speed),
§6 (handling limits), §9 (race), §20 (maps — your spec) and §22. The track is already registered as a SCAFFOLD that
borrows the coast (layout, dressing) — you replace the scaffold files with the real track. It stays hidden from the
menus (`TRACK_ORDER`) until the lead adds it; test it with `?race=watertown`.

## The track (creative direction)
A 3.0–3.6 km point-to-point ride through a 江南 canal town in a soft drizzle (the look file already has an overcast
palette; tune it). Narrow lanes between 粉墙黛瓦 houses (white walls, black tiled roofs with upturned eaves), canals
running beside and under the road, humpback stone bridges that LAUNCH riders (jump crests), willows, strings of red
lanterns, 乌篷船 boats on the water, a tea house, a 牌坊 memorial archway as a landmark, a riverside promenade with
market stalls, a finish on a town square. Rhythm: tight old-town corners (R 25–45 m: drift-heavy, but never below
R 22), a few short straights between bridges, one longer canal-side sweeper to breathe. Quay edges (falling in = crash
'water') make some corners risky. Meme signs and billboards in the game's kind voice (the scaffold lines in
`src/data/track-content/watertown.ts` are a start: write 8 billboards, 4 signs, 10 calendar 宜/忌 pairs, a name,
blurb and a weather line).

## Read first (copy the patterns, reuse the kits)
`src/world/layout/types.ts` (LayoutDef: segments, side profiles, ground, features, marks) and the three existing
layouts (`src/world/layouts/{coast,city,mountain}.ts`), `src/world/layout/build.ts`, `src/world/track.ts`, the dressing
modules (`src/world/dressing/{coast,city,mountain}/` — how they place landmarks from marks, batch/merge/instance
meshes, yield between stages so loading never blocks > 100 ms), `src/world/kit/*`, `src/world/scenery/**` (props,
signs, billboards), `src/world/looks.ts` (EnvLook + RoadLook), `src/world/features/*` (bridges, ramps, tunnels),
`src/render/toon.ts` (toon materials + outlines). Look at the existing tracks in the game before you start.

## Deliverables
1. `src/world/layouts/watertown.ts`: the real `WATERTOWN: LayoutDef` (replace the re-export). Features: at least 3
   `bridge` and 2 `jumpCrest` (the humpback bridges), 3+ `pickupRow`, puddles, 1–2 boost pads; marks for your landmarks.
2. `src/world/dressing/watertown/`: `dressWatertown(ctx, field)` building EVERYTHING under one Group named
   `dress:watertown` added to the track group (houses, bridges' stone railings, canals' water + boats, willows, lanterns,
   archway, tea house, stalls, far roofline). Merge/instance repeated geometry; yield between stages. Put every new
   helper/prop file for this track inside this folder.
3. `src/world/env/watertown-look.ts`: tune LOOK (sky, fog, sun, ambient, grade), ROAD (asphalt tint: stone-grey, wet),
   TUNNEL (null unless you add a tunnel).
4. `src/data/track-content/watertown.ts`: the content lines (see above).
5. `src/ui/tracks/watertown.ts`: a proper vector card `scene()` (gradient ids prefixed `wt-`), a drizzle WEATHER_ICON,
   and the in-engine still: run `node tools/ui-track-stills.mjs --tracks watertown` (writes
   `src/ui/assets/track-watertown.webp`) and import THAT file as STILL_URL.

## Budgets and rules
≤ 400 draw calls and ≤ 1.3 M triangles anywhere on the track (the acceptance test measures six spots); no loading task
> 100 ms; everything disposes on track.dispose(); no Math.random (use the track rng); toon materials + ink outlines on
props (0.04 m), like the other tracks. Do not edit shared world files (track.ts, build.ts, kits, signs, features,
looks.ts, other tracks): if you need a shared change, write it under `## Requests` in your status file and work around it.
Look at your track: save contact sheets of chase frames under `shots/r4-w1-track-watertown/` (python tools/thumb.py).

## Files you own
`src/world/layouts/watertown.ts`, `src/world/dressing/watertown/` (folder), `src/world/env/watertown-look.ts`,
`src/data/track-content/watertown.ts`, `src/ui/tracks/watertown.ts`, `src/ui/assets/track-watertown.webp`.

## Acceptance (the runner runs these; read `tools/r4/w1-newtrack.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/layouts/watertown.ts src/world/dressing/watertown/ src/world/env/watertown-look.ts src/data/track-content/watertown.ts src/ui/tracks/watertown.ts` → TSC-OWN OK
- `node tools/r4/w1-newtrack.mjs --track watertown --min bridge:3,jumpCrest:2,pickupRow:3` → w1-newtrack watertown OK
- `node sandbox/track.audit.mjs --track watertown --skip stall` → AUDIT OK
- `node tools/core-check.mjs` → core-check OK
