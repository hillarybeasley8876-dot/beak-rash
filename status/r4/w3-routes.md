# r4 / w3-routes — seeded routes (track unit)

## Plan
1. `src/world/layout/route-hints.ts` — the per-track hint table (head/tail kept, the generic radii,
   the tightest curve, the elevation band, the domes the road keeps clear of).
2. `src/world/layout/route-blocks.ts` — the authored middle cut into one block per zone (with its side
   profile, features and marks), the generic pieces (curve / S-chicane / hairpin / straight that
   carries a pickup row) and the mirror.
3. `src/world/layout/route-plan.ts` — the centre-line integrator (the same maths as layout/build.ts) and
   the self-distance rule.
4. `src/world/layout/route.ts` — `routeLayout(def, seed)`: the seeded draw → the order → the road →
   the checks; up to 40 draws, then the authored layout with one warning.
5. `src/world/track.ts` — the route is drawn before the mirrored road; `Track.route` reports the seed.
6. The dressing on a route: the zones, marks and features travel with their block; the coast dressing
   follows the road it stands on (a zone that comes back later gets its own run of scenery).
7. Shots: the chase at the start / middle / finish of #4821 on the three tracks + the plan views
   (authored vs #4821 vs #77) under `shots/r4-w3-routes/`.
8. Acceptance: tsc-own · w3-routes · w3-reverse · track.audit · core-check.

## Done
- **The generator** (`src/world/layout/route.ts`): the authored layout's opening (the grid) and closing
  (the finish) stay where they are; the middle is drawn again from a pool of the track's own blocks
  (one per zone, with their side profiles, features and marks) and generic pieces. The seed decides
  the order, which blocks are mirrored and which are re-shaped; the same seed always builds the same
  road (no `Math.random`, no `Date`, no unordered iteration).
- **The order** is chosen by a greedy that keeps the road inside the track's elevation band and away
  from itself; the middle's net turn is given back to the corners (the straights take most of it), so
  the road keeps its line. The length is exactly the authored one (the blocks keep their length).
- **The checks** (`fault`): the length within ±10 %, every curve at least R 25, the road never within
  40 m of itself (|Δs| > 150 m, unless one passes 8 m above the other) — the visual road before the
  start and after the finish included — the elevation inside the authored band, the features apart
  from each other and out of the tight corners, the road clear of the terrain domes. A draw that
  breaks a rule is thrown away; after 40 draws the authored layout is kept and one warning is printed.
- **The domes follow the route**: the layout's own domes (the coast's islands and the lighthouse
  headland) move with the block they stood on and keep their distance from the road; the mountain's
  lake peaks (the terrain mod pins them to a fixed s) are in the hint table, so a route never runs
  into a mountain.
- **`createTrack`** draws the route first and the mirrored road second (`route` then `reverse`: the
  same seed reversed is the same road backwards) and reports `Track.route`.
- **The authored layouts are untouched**: route 0 never calls the generator, and the generator copies
  the segments it re-anchors (the probe checks that the authored crest jump keeps its peak).
- **The dressing works on a route**: the zones, marks and features travel with their block; the coast
  dressing now gives every run of a zone its own scenery (the cliff road runs twice on a route); the
  scenery on a route is 100–102 % of the authored one.

## In progress / next
Nothing outstanding. The routes of all five tracks build, pass the checks and race.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/world/layout/ src/world/layouts/coast.ts src/world/layouts/city.ts src/world/layouts/mountain.ts src/world/layouts/index.ts src/world/track.ts src/world/ctx.ts src/world/index.ts src/world/dressing/coast/ src/world/dressing/city/ src/world/dressing/mountain/ src/world/dressing/dress.ts src/world/dressing/index.ts`
- `node tools/r4/w3-routes.mjs --tracks coast,city,mountain --race mountain` (and `node tools/r4/w3-routes.mjs` for all five tracks)
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city`
- `node sandbox/track.audit.mjs --track coast --skip stall`
- `node tools/core-check.mjs`
- My own probes: `node shots/r4-w3-routes/probe-route.mjs [--png]` (the routes' numbers + the plan
  views), `node shots/r4-w3-routes/probe-peaks.mjs` (the mountain's lake peaks vs a route),
  `node shots/r4-w3-routes/probe-dress.mjs` (the scenery of a route vs the authored one),
  `node shots/r4-w3-routes/shots-route.mjs` (the chase shots).
- The plan view of any route: `node sandbox/track.plan.mjs --track coast --route 4821 --out shots/r4-w3-routes/plan-coast-4821.png`

## Evidence (key output lines)
- `node tools/r4/w3-routes.mjs` (all five tracks) → `w3-routes OK`
  - coast #4821: 3300 m, R 46.2 m, closest 113.8 m, 27 features; coast #77: R 46.2 m, closest 111.8 m
  - city #4821: 3378 m, R 30.1 m, closest 101.4 m, 24 features; city #77: R 28.0 m, closest 56.9 m
  - mountain #4821: 3588 m, R 25.4 m, closest 148.4 m; mountain #77: R 26.1 m, closest 140.2 m
  - watertown #4821: 3212 m, R 32.7 m, closest 115.1 m; gobi #4821: 3750 m, R 62.9 m, closest 119.0 m
  - the same seed builds the same route, another seed another one; reverse + route builds
  - the mountain and the watertown autopilot races on #4821 end with 8 finishers and 0 crashes
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city` → `w3-reverse OK`
- `node tools/r4/tsc-own.mjs <own files>` → `TSC-OWN OK`
- `node sandbox/track.audit.mjs --track coast --skip stall` → `AUDIT OK` (0 wall misses, 0 curb mismatches)
- `node tools/core-check.mjs` → `core-check OK`
- `node shots/r4-w3-routes/probe-route.mjs` → every track: `same:false`, `dLen:0`, `authoredUntouched:true`,
  no zone missing, every feature and mark kept, 15–84 ms per route (the retry count is in the notes).
- `node shots/r4-w3-routes/probe-peaks.mjs` → 38 of 40 seeds keep the road 60 m clear of the mountain's
  lake peaks (the other two keep the 40 m the generator asks for; the authored layout keeps 203 m).
- `node shots/r4-w3-routes/probe-dress.mjs` → coast 100 %, city 100 %, mountain 102 % of the authored
  scenery on a route.
- `node sandbox/track.plan.mjs --track <t> --route <seed>` → the coast and the city routes pass the plan
  audit (the authored city and mountain do not: their return leg runs beside the outbound one by
  design); the mountain route is no closer to itself than the authored one.

## Known issues
- None of my own. While the polish job was in the middle of the gobi dressing
  (`src/world/dressing/gobi/land.ts` did not export `horizonPeaks`), the whole world unit failed to
  load and `w3-reverse` failed on the city; that is fixed now and the test passes.

## Requests
- `src/world/env/mountain-relief.ts` (the polish job's): the lake peaks are pinned to fixed s, so a
  route moves the road under them. I keep the road 40 m clear of them with the peak list copied into
  `src/world/layout/route-hints.ts`; if the peaks move, that copy has to move with them (or the terrain
  mod could take the peaks from the layout instead of from a fixed s).
- `src/world/layouts/watertown.ts` (the polish job's): the road is now 3.6 m wide, but the pickup rows
  are still at x = ±3.2, so they sit 0.4 m from the edge of the asphalt
  (`node sandbox/track.plan.mjs --track watertown` says "pickupRow@… beyond ±2.6"). Not mine to change —
  the rows just have to come in to about ±2.5.
