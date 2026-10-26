# r5 job wt-look — 江南水乡: flagstones across the whole lane, a stone shoulder, a soft drizzle (world: road + env)

Read SPEC.md §5 (art: toon + ink, readable) and §20 (the water town: 古镇, canals, 拱桥, 白墙黛瓦, drizzle by default).
Read `src/world/road/` (road.ts builds the lane per track; flagstone.ts draws the 青石板 texture; edges.ts the kerbs and
walls), `src/world/env/watertown-look.ts`, `src/world/weather/` (look.ts, wet.ts: the rain look and the wet road).
Look at the current state first: `node tools/r5/wt-look.mjs` saves 1920×1080 chase stills under `shots/r5-wt-look/`.

## Today's problem
Only a ~2 m strip of light slabs runs down the middle of the lane; the rest of the lane is plain dark grey (it reads
as asphalt: mean luminance 52–57 of 255 and no visible joints left of the rider). The shoulder beyond the lane is a
brown, spotted band that reads as mud. In the drizzle the slabs lose their joints entirely.

## Build it
1. The whole lane is 青石板: blue-grey stone slabs (a light, slightly cool grey — not asphalt), laid in courses across
   the full width, with clearly visible darker joints, gentle per-slab tint variation, a few worn / darker slabs, and
   the line of drain stones down the middle if you like. Readable at the chase camera at 1280×720 and 1920×1080, toon
   (flat-ish shading, no photo noise), tiled without visible repetition seams. Other tracks are unchanged.
2. The shoulders of the water town: stone (granite setts or a stone gutter), not brown dirt.
3. The drizzle: the slabs get wet (darker, a soft sheen picking up the sky and the lanterns) but keep their joints;
   the scene stays soft and bright enough (misty cool greens and greys, not a dark grey wash).
4. Budgets as before; no new per-frame work; the texture is generated once (or cached) like the other road textures.

## Files you own
`src/world/road/` (folder), `src/world/env/watertown-look.ts`, `src/world/weather/` (folder),
`src/world/dressing/watertown/props.ts`, `src/world/dressing/watertown/places.ts`, `src/world/dressing/watertown/quay.ts`,
`src/world/dressing/watertown/index.ts`. (Another job is changing the layouts and the jump features at the same time:
do not edit `src/world/layouts/` or `src/world/features/`.)

## Acceptance (the runner runs these; read `tools/r5/wt-look.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/road/ src/world/env/watertown-look.ts src/world/weather/ src/world/dressing/watertown/` → TSC-OWN OK
- `node tools/r5/wt-look.mjs` → r5-wt-look OK
- `node tools/r4/w3-world-polish.mjs --shots shots/r5-wt-look/polish` → w3-world-polish OK
- `node tools/r4/w1-weather.mjs --tracks coast,watertown` → w1-weather OK
- `node tools/core-check.mjs` → core-check OK
Look at your work: watertown clear and drizzle at six spots (1920×1080) as a contact sheet under `shots/r5-wt-look/`.
