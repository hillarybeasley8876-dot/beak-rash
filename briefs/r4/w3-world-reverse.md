# r4 job w3-world-reverse — every track drivable in reverse (track unit, world)

Read SPEC.md §20 (maps: reverse — your spec) and §22. Contracts already in core (do not edit core): `RaceConfig.reverse`
(URL `?reverse=1`), `TrackOptions.reverse` (core passes it to `createTrack(app, id, rng, opts)`), `Track.reverse?`.
The weather job already threads `opts` through `src/world/track.ts` / `src/world/weather*` — read it and extend it.

## Read first
`src/world/layout/types.ts` (LayoutDef: segments with len / radius / rise / bank / ease / vEase / side profiles /
features / marks; pre/post aprons; bumps; zones), `src/world/layout/build.ts`, `src/world/track.ts`,
`src/world/index.ts`, every layout in `src/world/layouts/`, the dressing modules in `src/world/dressing/` (look for
side assumptions such as "the sea is on the LEFT" in coast — after a mirror the sea is on the right), the feature
builders in `src/world/features/` (ramps, jump crests, tunnels, bridges), `sandbox/track.*` (the track sandbox and
`track.audit.mjs`). Test: `tools/r4/w3-reverse.mjs` (read it first).

## Build it
1. `src/world/layout/reverse.ts`: `reverseLayout(def: LayoutDef): LayoutDef` — the same road driven the other way:
   segments in reverse order; radius → −radius (a right-hander driven backwards is a left-hander), rise → −rise,
   bank → −bank, left/right side profiles swapped; transitions that sit at a segment's START (ease / vEase / sideEase)
   move one segment along (they belonged to the boundary that is now that segment's end); features re-anchored inside
   their segment (at' = len − at − flen; x0' = −x1, x1' = −x0); marks re-anchored (at' = len − at, x' = −x);
   bumps / terrain mods mirrored in s and x; pre/post aprons swapped; heading and start elevation taken from the
   original finish. Start and finish set pieces (the segments/zones named 'start' / 'finish', start gantry, finish arch,
   grid, stands) must still be at the new start / finish: keep those bookend segments in place (not mirrored to the
   other end) and reverse what lies between them. Directional features (ramps must rise in the new direction of
   travel; jump crests keep launching) must still work.
2. `createTrack(…, opts)`: `opts.reverse` → build from `reverseLayout(layout)`; set `Track.reverse = true`. Weather and
   reverse combine.
3. Dressings: fix any place that assumes a side or a direction (e.g. coast's sea side, signs that face a fixed way,
   landmark placement by absolute s) so the reversed tracks are dressed correctly — prefer reading the side profiles
   of the (mirrored) layout over hard-coded sides. All five tracks (coast, city, mountain, watertown, gobi) must build
   in reverse with 0 errors.
4. `sandbox/track.html` / `track.audit.mjs`: accept `reverse=1` / `--reverse` so the audit can check reversed builds.

## Files you own
`src/world/` (whole folder except `src/world/stub.ts`), `sandbox/track.ts`, `sandbox/track.html`, `sandbox/track.*.mjs`.

## Acceptance (the runner runs these; read `tools/r4/w3-reverse.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/` → TSC-OWN OK
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city` → w3-reverse OK
- `node tools/r4/w3-reverse.mjs --tracks watertown,gobi` → w3-reverse OK
- `node sandbox/track.audit.mjs --track coast --reverse --skip stall` → AUDIT OK
- `node sandbox/track.audit.mjs --track coast --skip stall` → AUDIT OK (forward builds unchanged)
- `node tools/r4/w1-weather.mjs --tracks coast,mountain` → w1-weather OK
- `node tools/core-check.mjs` → core-check OK
Look at `shots/r4-accept-reverse/*.png` yourself: the reversed tracks must look as finished as the forward ones.
