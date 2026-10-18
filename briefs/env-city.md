# Unit: env-city — wave 2 — 霓虹夜城 NEON NIGHT
Read SPEC.md (§0, §2, §4, §5 environments, §9) and status/track.md (how the track system works: LayoutDef
segments/sides/edges/features/marks/bumps, dressing modules, looks, LOD, perf tools). Study
`src/world/layouts/coast.ts` and `src/world/dressing/coast/*` as the reference implementation.
You own NEW files: `src/world/layouts/city.ts`, `src/world/dressing/city/**`, `src/world/env/city-*.ts`,
`src/world/scenery/props/city-*.ts`, `sandbox/city.*`. Shared track files (layouts/index.ts,
dressing/index.ts, looks.ts, env/sky.ts, env/lights.ts, terrain/*, road/edges.ts, mats.ts …) belong to the
track unit, which may be fixing coast issues at the same time: change them only with small ADDITIVE edits
(registry lines, a new case in a switch, an optional field), re-read a file right before editing it, keep
everything compiling, never change coast behaviour. env-mountain is built concurrently by another agent:
same rule. Note shared-file edits in status/env-city.md.

## Goal
A night-city race that looks like a P5 Tokyo/Shibuya-at-night postcard with Chinese meme neon: dark
navy/purple sky, wet reflective asphalt catching neon, towers with lit windows, huge red/black P5 accents.

## Layout (≈3.4 km, `id: 'city'`, flat-ish with an overpass and an underpass)
Start under a giant neon gantry in a plaza → 4-lane boulevard → **two 90° city corners (R 25–40 m)** →
scramble crossing plaza (wide, zebra stripes everywhere, animal pedestrians waiting at the kerbs — static
or bobbing crowds, never on the drivable road) → neon arcade street (narrower, signs overhead) →
**S-chicane (R 30–45 m)** → elevated expressway ramp up + a **crest jump** off the overpass end → riverside
road with a bridge → underpass tunnel (lit, tiled walls, fans) → **hairpin around a roundabout (R ≈ 28 m)**
→ final sprint down a canyon of billboards to a FINISH gantry with a giant screen. Corners must make the
player brake or drift (sim: curve push `κv²·0.8`; R 30 m at 20 m/s needs > 100 % steer → drift/brake).
Edges: kerbs + sidewalks (drivable shoulder 2–3 m) then building fronts/railings (wall); bridge parapets;
river = water on one side of the bridge.

## Dressing (instanced/merged; seeded)
Tower blocks with emissive window patterns (canvas atlases, some windows animate), shopfronts with
glowing signs, neon signs with meme text (data/memes.ts BILLBOARD_LINES + your own city lines in the same
style, Chinese text drawn on canvas, P5 frames), giant LED billboards using `BILLBOARDS.city` art from
data/assets.ts, traffic lights (cycling), street lamps with fake light pools (decals, no real point
lights except ≤ 4), zebra crossings, bus stops, vending machines, food stalls (烧烤/奶茶), convenience store,
subway entrance, overhead cables, cherry/ginkgo trees in planters, scooters parked, a P5-style red
"calling card" mural, crowds of tiny animal pedestrians, rain puddles (feature 'puddle'), oil (feature),
pickup rows (several, on the asphalt), boost pads (2). Optional light rain (drawn by your module; fx may
add splashes later).

## Look
`looks.ts` city entry: night grade (`grade.night = true`, bloom on), sky gradient navy→purple with a
city glow at the horizon + a moon, fog dark blue, sun → cool moonlight, hemisphere low. Wet road: a
cheap reflection (screen-space or a mirrored emissive-sign layer / planar trick on the asphalt material
with roughness variation) so neon colours streak on the road.

## Quality bar (art + tech critics)
From the chase cam at 70 km/h: unmistakably "neon night city", rich but readable road, strong colour
contrast, no empty black voids, no flat-lit boxes. Aerial: coherent city blocks. Perf: ≤ 250 draw calls,
≤ 800k tris per chase view incl. shadows, build ≤ 4 s. `node sandbox/track.test.mjs`-style checks pass
for 'city' (bounds/surface/edges consistent, round trip, NaN scan). Races finish with autopilot.
