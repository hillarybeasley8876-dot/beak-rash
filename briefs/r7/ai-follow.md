# r7 job ai-follow — the pack never rams a stopped or braking rider (race AI; SPEC §9 / §25 fairness)

`tools/race-scenarios.mjs` checks that riders behind a parked or braking player do not ram it (a bump stronger than 5
is a ram): `stopped` (the player parked mid-lane 70 m ahead of the pack, two lanes) and `brakecheck` (the player
brakes fully for 2.4 s with rivals 1.5–12 m behind). On the current tree, across seeds 1–12:
```
FAIL stopped seed 4 x=0       sloth:7.4
FAIL stopped seed 11 x=-2.5   penguin:6.3
FAIL brakecheck seed 6        capybara:5.4
FAIL brakecheck seed 11       shiba:9.1
```
and the default seeds pass or fail depending on where the pack happens to sit — every change to anybody's speed
(r7 gave the speed skills an instant kick, `skillBoost` BOOST_KICK) moves a different seed over the line. The causes
(read them in the code before you change anything):
- `src/gameplay/race/ai/brain.ts followLimit()` plans its stop with `FOLLOW_DECEL = 4` m/s² against the rider ahead's
  CURRENT speed, while a braking rider decelerates at ~12.6 m/s² (sim tuning) — the plan is too late by the time it
  reacts; a rider stopped beyond the planner's horizon (`plan.ts blockage()`, `inp.horizon`) is not followed at all
  until it is too close at speed;
- `huntLimit()`: a hunter closing on its prey from behind used to only ease off (`g.soft`) — the lead made it brake
  when closing fast (`closing < SOFT_CLOSING`), keep that;
- a speed skill cast with a slower rider ahead in the lane (`skill-rules.ts rammingAhead`: 15 m, closing > 4 m/s)
  — with the kick a cast 20 m behind a stopped rider can still ram it.
An earlier attempt on the r6 tree reached brakecheck 12/12 and every scenario check, then stalled on the city soak:
`F:/dev/beak-rash-out/r6/parked/ai-follow-wip.patch` (its report: `F:/dev/beak-rash-out/r6/parked/r6-ai-follow.md`).
It does not apply any more (r6-unstick / r6-unstick-2 rewrote parts of brain.ts, plan.ts and sense.ts since): use it
as a reference, re-do it on today's files, and keep the unstick work (blockGap, gapLane, freeLaneNear, unstick's
escape lane, the pass-beside rule for stopped things).

Read SPEC.md §6 (sim), §9 (AI), `src/gameplay/race/ai/{brain,plan,control,sense,pace,fight,skill-rules,skills}.ts`,
`src/sim/forces.ts` (the brake), `src/sim/tuning.ts`, `tools/race-scenarios/contact.mjs` (stopped, brakecheck) and
`tools/race-lib.mjs`.

## Build it
1. `followLimit()`: plan with the follower's real braking (the bike's brake deceleration from `BIKES[r.bike].brake`
   and the sim's tuning — not a constant 4) and with the rider ahead's deceleration (estimate it from its speed over
   the last plan steps — the sense blips carry `vs`; keep a short per-blip history in the brain — and assume it keeps
   decelerating); the safe speed is the one that stops behind it with the room kept today (1.2 m to a rider). React
   within one plan step (PLAN_EVERY) to a rider that starts braking.
2. A much slower rider in the chosen lane is followed from the moment the follower could no longer stop behind it,
   even beyond the planning horizon.
3. `rammingAhead` holds a speed skill for any rider in the lane ahead it could not stop behind after the kick (the
   skill's boost and BOOST_KICK), not only 15 m.
4. The pack's racing does not change in the open: drafting distances, overtakes, the rubber band (the soaks and the
   scenario timings guard that). The online lockstep rules hold (no wall clock, camera or local-player reads).

## Files you own
`src/gameplay/race/ai/brain.ts`, `src/gameplay/race/ai/plan.ts`, `src/gameplay/race/ai/control.ts`,
`src/gameplay/race/ai/sense.ts`, `src/gameplay/race/ai/skill-rules.ts`.

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/race/ai/` → TSC-OWN OK
- `node tools/race-scenarios.mjs --only stopped,brakecheck --seeds 1,2,3,4,5,6,7,8,9,10,11,12` → 36/36 checks passed
- `node tools/race-scenarios.mjs` → every check passed (no FAIL)
- `node tools/race-soak.mjs --track coast` / `--track city` / `--track watertown` / `--track gobi` / `--track mountain` → SOAK OK
- `node tools/r4/w2-police.mjs` → w2-police OK
- `node tools/combat-check.mjs --soak` → SOAK OK
- `node tools/r6/net-det.mjs` → r6-net-det OK
- `node tools/core-check.mjs` → core-check OK
