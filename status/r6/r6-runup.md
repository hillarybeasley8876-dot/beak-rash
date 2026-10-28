# r6-runup — a jump's run-up stays clear of the track events

## Plan
1. Real prop extents: `spot.ts` exports `FREE_SPAN` (how far `freeSpot` pushes a prop whose spot is taken);
   `roadworks.ts` exports `roadworksSpan()` off a new `wallGrid()` helper (the whole wall grid, first row
   to last row, both half-lengths); `plan.ts` builds `SPAN` from them for all four kinds.
   Proof: `npx tsc --noEmit -p tsconfig.json` → no error in the events folder.
2. `tuning.ts`: `jumpRunup: 60`, `jumpFlight: 45`. Proof: same tsc run.
3. `plan.ts`: `covered()` protects a jump with `jumpRunup` before and `featureClear + jumpFlight` after;
   `findSpot` draws ONCE per kind and then walks the spot on (forward first, then back) in 10 m steps inside
   the 25–80 % window until every rule holds — no event is dropped.
   Proof: `node tools/r6/runup.mjs` → r6-runup OK.
4. Counts unchanged. Proof: `node tools/r4/w2-events.mjs` → w2-events OK + `shots/r6-runup/plan-probe.mjs`
   (want == got over 5 tracks × 12 seeds).
5. Acceptance, all seven commands.

## Done
- Step 1–4, and the whole acceptance list (all green, see Evidence).
- The schedule now draws from its own child stream (`rng.fork(0x5c4ed)` inside `planEvents`): the props of
  an event are forked from the director's `rng` AFTER the plan (`events/index.ts:65`), so a planner that
  drew from it directly shifted every prop of the race. See Known issues — that coupling flipped
  w2-events red before the fork went in.

## In progress / next
Nothing; the job is finished.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/race/events/` · `node tools/r6/runup.mjs` · `node tools/r5/air.mjs`
- `node tools/r4/w2-events.mjs` · `node tools/r6/roadworks.mjs` · `node tools/race-soak.mjs --track mountain`
- `node tools/core-check.mjs`
- probes (mine): `node shots/r6-runup/plan-probe.mjs` (no dropped events), `stalls-probe.mjs` (the
  w2-events forced sequence, step by step), `rolls-probe.mjs` (planner roll counts vs the pre-r6 planner).

## Evidence (key output lines)
- `r6-runup OK` (5 tracks × seeds 1–4; mountain seed 3 — the case in the brief — now plans its work zone at
  s=1230 instead of 1362, so the last barrier row (s+73) is 150 m before the ramp at 1453).
- `r5-air OK` · `w2-events OK` · `r6-roadworks OK` · `SOAK OK` (mountain) · `core-check OK` · `TSC-OWN OK`.
- `shots/r6-runup/plan-probe.mjs --seeds 1..12` × 5 tracks: 60/60 lines `want=n got=n`, no `DROPPED`.
- Roll counts before the fork (`rolls-probe.mjs`, coast): old=3 new=3, old=6 new=5, old=8 new=5, old=7 new=3
  — i.e. the pre-r6 retry loop consumed a data-dependent number of rolls, which is what shifted the props.

## Known issues
- The w2-events forced sequence is knife-edge and has nothing to do with the run-up rule: it forces the
  roadworks 220 m ahead (zone = spot ±70) and then, 600 frames later, the market 120 m ahead — the stalls
  can land INSIDE the still-standing wall, and they do whenever the props' stream moves the player a metre
  or two sideways at the goose step (with `plan.ts` at HEAD and a direct draw from `rng`, the player ends
  pinned at the wall head at x=8.5 and the stalls land at s=708 inside the zone 591–732 → the stalls step
  fails; with the child stream it rides through). The game behaves correctly in both cases; only the
  placement of the forced events differs.

## Requests
- `src/gameplay/race/events/index.ts` (not mine): `rng.fork(0x9e37 + made)` for the props comes from the
  director's `rng` AFTER `planEvents`. Forking a `propRng` BEFORE the plan (`const propRng = rng.fork(0x9e37)`
  … `propRng.fork(made)`) would make the props independent of the planner for good. I did the same thing
  from my side (the schedule draws from `rng.fork(0x5c4ed)`), which is enough to decouple them today.
- `tools/r4/w2-events.mjs` (lead-owned): the stalls step should either wait for the forced work zone to be
  gone (`b.events.list()` / no active `barrier`) or force the market further ahead, so the step cannot
  depend on where the player happens to stand after the roadworks section.
