# r6 job runup — a jump's run-up stays clear of the track events (events planner; SPEC §12 / §16)

The track events (`src/gameplay/race/events/`: roadworks, fish spill, geese, stalls) are planned away from tunnels,
bridges and jumps (`plan.ts covered()`: `featureClear` = 20 m before a feature, `JUMP_FLIGHT` = 45 m after a jump).
Since r6 the roadworks zone is a long, solid wall of barriers (r6-roadworks), and 20 m is not a run-up: on mountain
seed 3 the work zone (spot s=1362) puts barriers from s=1304 to s=1433, in the lane of the ramp at s=1453 (x 0..6).
A rider lining up for the ramp rides into them — `tools/r5/air.mjs` (the player set 60 m before every jump, in the
middle of its width, at 22 m/s) crashes there (`r@1453:0!`). Read SPEC.md §12 (track events) and §16 (jumps),
`src/gameplay/race/events/{plan,roadworks,spot,tuning,index}.ts`, `tools/r6/runup.mjs`, `tools/r5/air.mjs`.

## Build it
1. A jump's run-up is protected like its flight: no event may put a prop in the 60 m before a ramp or a jump crest
   (`JUMP_RUNUP = 60`), nor in the 45 m after it. Check the event's REAL extent — for the roadworks that is the
   whole zone `roadworksPieces()` builds (taper, wall and the deferred pieces), not only its spot — and every other
   event's props (fish crates spill forward, geese walk across, stalls stand on the side) the same way.
2. When a planned spot breaks the rule, move it (the next spot that keeps every rule) — do not drop events: every
   track still gets as many events per race as today (`node tools/r4/w2-events.mjs` checks the counts).
3. Nothing else changes: the work zone's look, the traffic and AI lane rules, the warning distances.

## Files you own
`src/gameplay/race/events/plan.ts`, `src/gameplay/race/events/roadworks.ts`, `src/gameplay/race/events/spot.ts`,
`src/gameplay/race/events/tuning.ts`.

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/race/events/` → TSC-OWN OK
- `node tools/r6/runup.mjs` → r6-runup OK (5 tracks × seeds 1–4: no event prop in a jump's lane from 60 m before to 45 m after it)
- `node tools/r5/air.mjs` → r5-air OK
- `node tools/r4/w2-events.mjs` → w2-events OK
- `node tools/r6/roadworks.mjs` → r6-roadworks OK
- `node tools/race-soak.mjs --track mountain` → SOAK OK
- `node tools/core-check.mjs` → core-check OK
