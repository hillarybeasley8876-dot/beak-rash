# r4 job w3-routes — seeded routes (track unit)

Read SPEC.md §20 (maps: weather, reverse, seeded routes), §4 (world), §22. A race asks for a route with
`RaceConfig.route` (`?route=4821`; 0 = the authored layout); core already hands it to `createTrack(app, id, rng,
opts)` as `opts.route`, and `Track.route` must report it. Read `src/world/track.ts`, `src/world/layout/` (types.ts =
the LayoutDef format: segments with radius / rise / bank / ease, side profiles, features and marks positioned per
segment; build.ts; reverse.ts = how the reversed layout is derived BEFORE the build — do the same for routes),
`src/world/layouts/*.ts` (the five authored layouts) and how dressing reads marks / features.

## Build it
1. A route generator `src/world/layout/route.ts` (+ helpers): `routeLayout(def: LayoutDef, seed: number): LayoutDef`.
   Keep the authored opening and closing set pieces (the start grid and the finish with their features / marks, a
   few segments each — decide per track, e.g. a `keep: { head, tail }` hint in the layout file) and draw the middle
   from a per-track segment pool: the track's own middle cut into blocks (a few consecutive segments, with their side
   profiles, features and marks), plus generic pieces (curves of several radii, S-chicanes, hairpins on the mountain,
   straights that carry features). The seeded rng (`new Rng(seed)`) shuffles / reorders blocks, mirrors some (radius,
   bank and the x of features / marks / side profiles swapped, like reverse.ts does), varies radii (never under 25 m)
   and fills to length.
2. Constraints (check the BUILT centre line and retry with the next draw; up to ~40 attempts; if every attempt fails,
   warn once and build the authored layout): total length within ±10 % of the authored one; every curve R ≥ 25 m;
   no self-intersection — centre-line points more than 150 m apart along the track stay ≥ 40 m apart in plan, unless
   one passes ≥ 8 m above the other; elevation stays within the authored layout's min / max band (coast stays above
   the sea, tunnels stay under their hills); features keep their spacing rules (no ramp in a tight curve, no two
   features overlapping).
3. `createTrack` builds `routeLayout(def, route)` when `opts.route > 0`, then reverses it when `opts.reverse` (route
   first, then reverse — the same seed reversed is the same road backwards). Same seed → identical layout, every
   time, on every machine (no Math.random, no Date, no iteration over unordered keys).
4. Dressing must work on any layout: marks travel with their blocks; anything that is placed at fixed `s` positions
   or assumes the authored geometry (landmarks, the city's districts, the watertown canals, tunnels, the gobi's
   sandstorm finale) must follow the route (by rules on the built layout, not hard-coded distances).
5. Keep the authored layouts bit-for-bit identical when `route` is 0.

## Files you own
`src/world/layout/` (folder), `src/world/layouts/` (folder), `src/world/track.ts`, `src/world/ctx.ts`,
`src/world/index.ts`, `src/world/dressing/` (folder), `sandbox/track.ts`, `sandbox/track.html`, `sandbox/track.*.mjs`
(the existing track sandbox tools — list them in your plan).

## Acceptance (the runner runs these; read `tools/r4/w3-routes.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/` → TSC-OWN OK
- `node tools/r4/w3-routes.mjs` → w3-routes OK
- `node tools/r4/w3-reverse.mjs` → w3-reverse OK (reverse still works)
- `node tools/core-check.mjs` → core-check OK
Look at your work: a chase shot at the start, the middle and the finish of route #4821 on every track, plus a plan
view (sandbox/track.plan-png.mjs) of the authored layout vs #4821 vs #77, under `shots/r4-w3-routes/`.
