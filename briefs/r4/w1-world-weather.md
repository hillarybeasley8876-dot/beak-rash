# r4 job w1-world-weather — weather variants on every track (track unit, world core)

Read SPEC.md §5 (art bible), §6 (grip), §20 (maps: weather — your spec) and §22. Contracts already in core (do not
edit core): `Weather` ('clear' | 'rain' | 'snow' | 'fog' | 'dusk'), `RaceConfig.weather`, `TrackOptions`,
`Modules.createTrack(app, id, rng, opts?)` — core already passes `{ weather, reverse, route }` from the race config
(URL `?weather=rain`), and `Track.weather? / reverse? / route? / grip?` (optional fields you now fill).

## Read first
`src/world/index.ts` + `src/world/track.ts` (createTrack: layout → build → road/terrain/features/dressing → Track),
`src/world/looks.ts` (lookFor / roadLookFor; the per-track looks incl. the r4 scaffold entries for watertown/gobi
that come from `src/world/env/<id>-look.ts`), `src/world/env/sky.ts`, `src/world/env/lights.ts`, `src/world/road/*`
(asphalt material/texture), `src/world/terrain/*` (ground materials), `src/world/features/*` (puddles), the city's wet
road (`src/world/dressing/city/` — read-only, for ideas), `src/render/toon.ts` (toon material; read-only).

## Build it
1. `createTrack(app, id, rng, opts)`: read `opts.weather` (absent → 'clear'). Allowed per track (SPEC §20):
   coast {clear, rain, dusk, fog}, city {clear, rain, fog}, mountain {clear, snow, fog, rain},
   watertown {clear, rain, fog}, gobi {clear, dusk, fog}. A weather not allowed for the track → `console.warn` once
   and build 'clear'. Expose `weather` (the one built), `reverse: false`, `route: 0` (the reverse/route jobs come later)
   and `grip` (rain 0.85, snow 0.75, else 1) on the Track. New file(s): `src/world/weather.ts` or `src/world/weather/`.
2. Looks: weather = a modifier on the track's base look (so it works for every track, including the two new tracks
   being built right now from their own look files), plus optional per-track tweaks in your own table:
   - fog: fog near and far × ~0.35 (the test wants far ≤ 40 % of clear), fog colour toward a light grey of the sky.
   - rain: greyer and darker (lower grade saturation, darker sky top and horizon, dimmer/cooler sun, softer contrast),
     wet asphalt (darker, slightly glossier road — a cheap specular/sheen on the road material is enough), puddle
     features at least ×2 (≥ 3 total): add seeded `puddle` features on the drivable road (not on bridges/tunnels/
     ramps, not within 120 m of start/finish).
   - snow (mountain): cold grade tint (blue ≥ red), pale blue-grey sky, whiter fog, and SNOW on up-facing world
     surfaces: patch the track group's materials (terrain, rocks, roofs, props, foliage — NOT the road surface and never
     riders/bikes) via onBeforeCompile with a world-normal-up mix toward snow white; visibly white ground in a chase
     frame (the test compares the share of near-white pixels against clear: +5 points at least).
   - dusk: a low warm sun (dir.y > −0.45, warm orange colour with red − blue ≥ 40), warm horizon, longer shadows.
   - clear: exactly today's look (no change).
   Keep every track's clear look byte-identical to today (the r3 art review approved them).
3. Particles (rain streaks, snow flakes, dust) are the fx unit's job later and ambience is audio's — do not add them.
   Do not touch layouts or dressings of any track.

## Files you own
`src/world/weather.ts`, `src/world/weather/`, `src/world/index.ts`, `src/world/track.ts`, `src/world/looks.ts`,
`src/world/env/sky.ts`, `src/world/env/lights.ts`, `src/world/road/`, `src/world/terrain/`, `src/world/features/`.

## Acceptance (the runner runs these; read `tools/r4/w1-weather.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/weather.ts src/world/weather/ src/world/index.ts src/world/track.ts src/world/looks.ts src/world/env/sky.ts src/world/env/lights.ts src/world/road/ src/world/terrain/ src/world/features/` → TSC-OWN OK
- `node tools/r4/w1-weather.mjs --tracks coast,city,mountain` → w1-weather OK
- `node sandbox/track.audit.mjs --track coast --skip stall` → AUDIT OK
- `node sandbox/track.test.mjs --track mountain` → exit 0
- `node tools/core-check.mjs` → core-check OK
Then look at `shots/r4-accept-weather/sheet.jpg` yourself: every variant must read as that weather and stay readable.
