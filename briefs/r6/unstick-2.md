# r6 job unstick-2 — a rider steering past a stopped car keeps pedalling (race AI; SPEC §9)

r6-unstick (status/r6/r6-unstick.md) taught `unstick()` to steer for the nearest free lane. The final regression found
one more stuck case, deterministic: `node tools/race-soak.mjs --track gobi` → `FAIL [seed 1] rider 7 (penguin) stuck at
s=1984` (< 2 m/s for 5.5 s; the soak allows 5). Traced (every 0.5 s, rider 7):
```
t=107.0 s1979.7 x1.05 v1.32   near: car#1001@s1984,x2.0 (stopped)  barrier@s1977,x-1.7  barrier@s1981,x-1.9
t=107.5 s1980.1 x1.39 v0.75
t=108.0 s1980.7 x1.78 v0.81
t=108.5 s1981.2 x2.37 v0.16   wobble (bumped)
t=109.5 s1981.8 x3.50 v1.51
t=110.0 s1982.5 x3.96 v1.53   barrier@s1981,x6.9 — the bike is now clear of the car's right side (car x2.0 ± 0.9)
t=110.3 s1983.0 x4.08 v1.52   still ~1.5 m/s
t=110.9 s1983.8 x3.87 v1.09   stun (a police officer's baton, police#900@s1978,x4.2)
t=111.7 s1985.0 x4.24 v1.69
t=114.2 s1999.7 x1.05 v2.00
```
It is inside a work zone (walls at x≈-1.8 and x≈6.7) behind a car stopped in the open lane. The speed sits at 1.5 m/s
for seconds: `unstick()` cuts the throttle whenever `plan.followKind !== null && plan.followGap < PRESSED_GAP` and the
speed is above `ROLL` (1.5) — so the rider holds the steering minimum while it steers past the car, and still after it
is laterally clear of it (t=110: x 3.96, the car's right edge is 2.9). Read `src/gameplay/race/ai/brain.ts unstick()`,
`plan.ts planLateral()/blockage()` (what `followKind`/`followGap` follow), `sense.ts freeLaneNear()`, the soak's stuck
rule in `tools/race-soak.mjs` (racing, < 2 m/s, > 5 s) and status/r6/r6-unstick.md.

## Build it
1. Cut the throttle only while the bike is really pressed against the obstacle IN ITS OWN LANE (the followed blip
   overlaps the rider's current x with the bike's half width), never while it steers past it; once the lane ahead of
   the rider is clear (its x is in the escape lane, or the followed blip no longer overlaps it) it pedals fully.
2. Check why the planner keeps "following" a stopped car the rider is already beside: the follow should end when the
   car is no longer in the rider's lane.
3. Keep r6-unstick's behaviour everywhere else (roadblock gap, escape lane, the hop after 3 s) and the pack's racing
   (drafting, overtakes, rubber band, scenarios). Online lockstep rules hold.

## Files you own
`src/gameplay/race/ai/brain.ts`, `src/gameplay/race/ai/plan.ts`, `src/gameplay/race/ai/sense.ts`,
`src/gameplay/race/ai/control.ts`.

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/race/ai/` → TSC-OWN OK
- `node tools/race-soak.mjs --track gobi` → SOAK OK
- `node tools/race-soak.mjs --track watertown` → SOAK OK
- `node tools/race-soak.mjs --track city` → SOAK OK
- `node tools/race-soak.mjs --track coast` → SOAK OK
- `node tools/race-soak.mjs --track mountain` → SOAK OK
- `node tools/race-scenarios.mjs` → every check passed (no FAIL)
- `node tools/r4/w2-police.mjs` → w2-police OK
- `node tools/r6/net-det.mjs` → r6-net-det OK
- `node tools/core-check.mjs` → core-check OK
