# r5 job mega — one landmark mega jump per track, big enough for a three-trick chain (world layouts + features)

Read SPEC.md §16 (air tricks: 0.25 s of air before the first trick, a spin takes 0.55 s, a flip 0.65 s, the next
trick needs a fresh drift press, and a trick only starts when the predicted air covers 85 % of it), the achievement
`trick_combo` 花活三连 (three tricks landed in one air) and the r5 air job's work in `src/world/layouts/*.ts` +
`src/world/features/` (every track now has 6+ jumps, the biggest give ~1.7 s of air: room for two tricks, not three).
A three-trick chain needs ≈ 1.9 s of air.

## Build it
1. Each track gets ONE mega jump (keep the existing jumps): ≥ 1.9 s of air at 22 m/s (and sane at the top speed:
   no flight over the scenery, a long straight landing — a downhill landing slope is the easy way to get airtime
   without launching 10 m high). Place it as a set piece with its own look and a big 「起飞！」/ MEGA sign 120 m
   before: the coast — a seaside boardwalk launch; the city — a flyover gap; the mountain — a cliff-edge kicker over
   a gully; the water town — the tallest humpback bridge over the widest canal; the gobi — a giant dune ramp.
2. The landing never crashes a straight rider; the AI riders survive it (race soaks green); reverse and seeded
   routes keep working (the reversed mega jump may be smaller but must still launch).
3. Budgets as before.

## Files you own
`src/world/layouts/` (folder), `src/world/features/` (folder), `src/sim/features.ts`, `src/world/layout/route-hints.ts`,
`src/world/dressing/` (only to add the mega jump's set dressing / sign; do not change other dressing).

## Acceptance (the runner runs these; read `tools/r5/mega.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/layouts/ src/world/features/ src/sim/features.ts` → TSC-OWN OK
- `node tools/r5/mega.mjs` → r5-mega OK
- `node tools/r5/air.mjs` → r5-air OK
- `node tools/r4/w3-reverse.mjs --tracks coast,mountain,city,watertown,gobi` → w3-reverse OK
- `node tools/r4/w3-routes.mjs --race mountain` → w3-routes OK
- `node tools/race-soak.mjs --track gobi` → SOAK OK · `node tools/race-soak.mjs --track city` → SOAK OK
- `node tools/core-check.mjs` → core-check OK
Look at your work: a chase shot 80 m before each mega jump and one at the top of the flight, under `shots/r5-mega/`.
