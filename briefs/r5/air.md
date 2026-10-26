# r5 job r5-air — enough air on every track to make the tricks playable (world + sim features)

Read SPEC.md §16 (air tricks: a spin takes 0.55 s, a flip 0.65 s, a trick starts only if the predicted air covers
85 % of it; after one trick a fresh press starts the next — a chain), §17 (STYLE), §4 (world) and §20 (reverse,
seeded routes). Read `src/world/layouts/*.ts` (features per segment: `ramp` = a wedge `data.height` rising along +s
across x0..x1; `jumpCrest` = a full-width kick at `data.peak`), `src/world/features/ramp.ts` + `bridge.ts`,
`src/sim/features.ts` (how a ramp / crest launches a rider) and the route / reverse rules in `src/world/layout/`
(route.ts checks "no ramp in a tight corner"; reverse.ts re-orients directional features).

## The problem (measured by `tools/r5/air.mjs`: player 60 m before each jump, centred, 22 m/s, throttle on)
Coast 2 jumps (0.82 s, one ramp gives no air at all), city 1 (0.76 s), mountain 2 (0.83 s, ramp 0), watertown 2
(1.1 s), gobi 5 (0.57–0.86 s). In a whole race the player gets 1–4 airs: one trick per race at best, a three-trick
chain (achievement `trick_combo`) is impossible, and the reversed coast ramp does not launch at all.

## Build it
1. Every track: **at least 6 jumps** that give ≥ 0.7 s of air at 22 m/s, of which **at least 2 big ones** give
   ≥ 1.3 s (room for a two-to-three trick chain). Spread them over the lap (not two within 150 m), on straights or
   gentle bends (R ≥ 120 m), with a straight, clear landing (no tight corner within 80 m after the landing, no tunnel,
   bridge parapet or event spot under the flight path). Fix the ramps that give no air today.
2. Make them read as jumps from ≥ 100 m: P5-style kickers (red / white / yellow, ink outline) with a "JUMP" or
   「起飞！」 sign or arrow before the big ones; the track's own style (stone humps in the water town, dune kickers in
   the gobi, a wooden kicker on the mountain, a launch ramp on the city flyover, the boardwalk ramp on the coast).
3. Landing a straight jump must never crash (any speed up to the top speed); the sim ramp / crest physics stays
   consistent with the drawn shape (`sim/features.ts` and `world/features/ramp.ts` together).
4. Reverse and routes keep working: a reversed jump still launches (re-oriented), the route generator keeps its rules
   with the new features (they travel with their blocks).
5. The water town's bridges: make the arch style a per-track choice in `features/bridge.ts` (a stone humpback for
   `watertown`) and drop the water town's workaround that removes the shared red steel arch at runtime
   (`dressing/watertown/bridges.ts`).
6. The AI riders take the jumps fine (the race soaks stay green: nobody stuck, nobody flung off the road).

## Files you own
`src/world/layouts/` (folder), `src/world/features/` (folder), `src/sim/features.ts`,
`src/world/dressing/watertown/bridges.ts`, `src/world/layout/route-hints.ts`, `sandbox/track.plan.mjs`.

## Acceptance (the runner runs these; read `tools/r5/air.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/layouts/ src/world/features/ src/sim/features.ts src/world/dressing/watertown/bridges.ts src/world/layout/route-hints.ts` → TSC-OWN OK
- `node tools/r5/air.mjs` → r5-air OK
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city,watertown,gobi` → w3-reverse OK
- `node tools/r4/w3-routes.mjs --race mountain` → w3-routes OK
- `node tools/r4/w1-newtrack.mjs --track watertown --min bridge:3,jumpCrest:2,pickupRow:3 --shots shots/r5-air/watertown` → w1-newtrack watertown OK
- `node tools/race-soak.mjs --track coast` → SOAK OK · `node tools/race-soak.mjs --track mountain` → SOAK OK
- `node tools/core-check.mjs` → core-check OK
Look at your work: a chase shot 40 m before each big jump on every track and one mid-air, under `shots/r5-air/`.
