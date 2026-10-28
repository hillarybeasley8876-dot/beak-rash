# r6 job unstick — a rival pinned against a barrier finds the gap (race AI; SPEC §9)

`tools/race-soak.mjs --track watertown` fails on seed 3: `rider 7 (capybara) stuck at s=646` for 5.5 s. What happened
(traced): the police roadblock (`src/gameplay/race/police/roadblock.ts`: barriers with ids 8000+, one 3.2 m gap at a
seeded lane) stands at s=647 with barriers at x 0.3 / 2.0 / 3.7; the capybara arrived wet (grip ×0.68, steer ×0.7)
at x≈3.1 and stopped against them. `src/gameplay/race/ai/brain.ts unstick()` then pedals and steers back toward the
CENTRE LINE (`steer = -x·0.3`) — but the centre is behind a barrier too, so it pushed into the wall until a hit
knocked it loose. The same dead end exists at a work zone's closed side and behind a stopped car.
Read SPEC.md §9 (AI), `src/gameplay/race/ai/{brain,plan,sense,control}.ts`, `police/roadblock.ts` (gapX, gapWidth),
`events/roadworks.ts` (the open lane: `roadworksLane`), `tools/race-soak.mjs` (the stuck rule: racing, < 2 m/s, > 5 s).

## Build it
1. `unstick()`: steer toward the nearest lateral position whose next ~4 m ahead is free of solid obstacles (scan
   `session.obstacles` the senses already see: barriers, props, stopped cars) with room for the bike (≥ 1.2 m),
   instead of the centre line; back off first (brake / reverse is not a thing: steer away while rolling) if the bike
   is pressed against the obstacle. Keep the hop after 3 s as the last resort.
2. Before it gets there: when the plan sees a roadblock ahead (an obstacle row with one gap), aim the lane at the gap
   (the work zone already sets the AI's lane with `ai.setZone`; the roadblock does not) — a rival rides through the
   gap like the player is taught to.
3. Keep the pack's racing as it is: drafting, overtakes, the rubber band, the brakecheck/stopped scenarios. The online
   lockstep rules hold (no wall clock, camera or local-player reads; use `session.humans` helpers).

## Files you own
`src/gameplay/race/ai/brain.ts`, `src/gameplay/race/ai/plan.ts`, `src/gameplay/race/ai/sense.ts`,
`src/gameplay/race/ai/control.ts`.

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/race/ai/` → TSC-OWN OK
- `node tools/race-soak.mjs --track watertown` → SOAK OK
- `node tools/race-soak.mjs --track city` → SOAK OK
- `node tools/race-soak.mjs --track coast` → SOAK OK
- `node tools/race-scenarios.mjs` → every check passed (no FAIL)
- `node tools/r4/w2-police.mjs` → w2-police OK
- `node tools/r6/net-det.mjs` → r6-net-det OK
- `node tools/core-check.mjs` → core-check OK
