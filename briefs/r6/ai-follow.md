# r6 job ai-follow — rivals brake in time for a rider who brakes ahead of them (race unit; SPEC §9 / §25 fairness)

A racer who brakes hard must not be rear-ended by the pack: the brakecheck scenario (`tools/race-scenarios/contact.mjs`
`brakecheck`: the player brakes fully for 2.4 s with rivals 1.5–12 m behind in its lane; a bump stronger than 5 is a
ram) passes today on seeds 1–6 and fails on seed 11 (`shiba:9.1`), and seeds 1–6 pass only because of where the pack happens to sit (the polish job measured it: with
the skills that shifted the pack disabled, seed 3 rams again). The cause (status/r6/r6-polish.md → Requests):
`src/gameplay/race/ai/brain.ts followLimit()` plans its stop with `FOLLOW_DECEL = 4` m/s² against the rider ahead's
CURRENT speed — but a braking rider decelerates at ~12.6 m/s² (sim tuning), so the follower's plan is too late by
the time it reacts; and `huntLimit()` lets a hunter ride up to 5 m/s faster than its prey. Read SPEC.md §6 (sim),
§9 (AI), `src/gameplay/race/ai/{brain,plan,control,sense,pace,fight}.ts`, `src/sim/forces.ts` (the brake),
`src/sim/tuning.ts`, `tools/race-scenarios/contact.mjs` (brakecheck, stopped) and `tools/race-lib.mjs`.

## Build it
1. `followLimit()`: plan with the follower's real braking (the bike's brake deceleration from `BIKES[r.bike].brake`
   and the sim's tuning — not a constant 4) and with the rider ahead's deceleration: estimate it from its speed
   change over the last plan steps (the sense blips carry `vs`; keep a short per-blip history in the brain) and
   assume it keeps decelerating; the safe speed is the one that stops behind it with the room you keep today
   (1.2 m to a rider). React within one plan step (PLAN_EVERY) to a rider that starts braking.
2. `huntLimit()`: closing on its prey from behind, a hunter may not exceed the speed it can still stop from (the same
   stopping rule); alongside nothing changes.
3. Keep the pack's racing: drafting distances, overtakes and the rubber band must not change in the open (the soaks
   and the scenario timings guard that). The online lockstep rules hold (no wall-clock, camera or local-player reads).

## Files you own
`src/gameplay/race/ai/brain.ts`, `src/gameplay/race/ai/plan.ts`, `src/gameplay/race/ai/control.ts`,
`src/gameplay/race/ai/sense.ts`.

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/race/ai/` → TSC-OWN OK
- `node tools/race-scenarios.mjs --only brakecheck --seeds 1,2,3,4,5,6,7,8,9,10,11,12` → 12/12 checks passed
- `node tools/race-scenarios.mjs` → every check passed (no FAIL)
- `node tools/race-soak.mjs --track coast` → SOAK OK; `node tools/race-soak.mjs --track city` → SOAK OK
- `node tools/r6/net-det.mjs` → r6-net-det OK
- `node tools/core-check.mjs` → core-check OK
