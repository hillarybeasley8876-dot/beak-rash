# w1-sim-tricks — air tricks, umbrella glide, weather grip (sim unit)

## Plan
1. `src/sim/tuning.ts`: the TRICKS table (minAir 0.25, spinDur 0.55, flipDur 0.65, snap 0.85,
   supermanHold 0.2 / supermanMin 0.3, points 120/50, boost 0.2 / 0.6 / +20 % per extra trick)
   + glideGravity 0.45 / glideControl 0.6.
2. `src/sim/state.ts`: the SimRider fields `driftPrev`, `driftPressed`, `supermanHold`, `lastTrick`.
3. `src/sim/tricks.ts` (new): the trick state machine + the umbrella glide (`updateAirTricks`, `resetTrick`).
4. `src/sim/physics.ts`: a fresh drift press per step (`driftPressed = c.drift && !driftPrev`).
5. `src/sim/air.ts`: `updateAirTricks` in vertical() (before the gravity → the glide's gravity),
   the trick judgement in land() (fail → crash 'trick', snap ≥ 85 %, the chain payout + boost),
   the trick reset on a new air episode.
6. `src/sim/crash.ts`: the trick reset on crash and respawn.
7. `src/sim/steering.ts`: the track grip (session.track.grip) in `gripOf`; the glide steering 60 %.
8. `tools/feel-scenarios-abuse.mjs` + `tools/feel-telemetry.mjs`: a new 'trick' scenario (spin, wreck,
   glide, grip) with 7 new checks (the existing checks are untouched).
9. Full acceptance: `node tools/r4/tsc-own.mjs src/sim/`, `node tools/r4/w1-tricks.mjs`,
   `node tools/feel-telemetry.mjs`, `node tools/core-check.mjs`.

## Done
- Tricks (SPEC §16): a trick starts on a FRESH drift press in the air (a drift held since the ground
  never tricks), only with airTime ≥ tricks.minAir, mode 'racing', not stunned, no trick running and
  not gliding. The same step's controls pick it: |steer| > 0.6 → spin (dir = sign, 0.55 s),
  brake > 0.5 → backflip (−1, 0.65 s), hop → frontflip (+1, 0.65 s), drift alone → superman
  (a candidate: it starts after 0.2 s of holding, dur = Infinity while the drift is held; the release
  ends it — ≥ 0.3 s counts, shorter is cancelled silently). Throttle never picks a trick.
  `rider:trick` 'start' on every trick, 'land' on a clean landing (points 120·count + 50·(count−1),
  the boost 0.2 / 0.6·(1 + 0.2·(count−1)), the larger of it and PERFECT's wins), 'fail' + a crash with
  cause 'trick' when the trick is below 85 % done (or a superman is still held) at touchdown.
  The trick is visual only: the yaw, x, speed and the landing yaw checks never see it.
  The chain resets on a new air episode, a crash and a respawn.
- Umbrella glide (SPEC §15): a fresh drift press in the air with the umbrella open (and no trick
  running) → `r.gliding = true`: gravity × 0.45, air steering 60 % (instead of 35 %), no trick and no
  events; it ends on the drift release, without the umbrella, on a landing or a crash.
- Weather grip (SPEC §20): `session.track.grip ?? 1` multiplies the combined lateral grip in
  `gripOf` (read every step, the race may change it at runtime).
- Tuning numbers live in the TUNING table (`T.tricks`, `T.glideGravity`, `T.glideControl`).

## In progress / next
Nothing — the brief is implemented and every acceptance command passes.

## How to test (exact commands)
node tools/r4/tsc-own.mjs src/sim/          → TSC-OWN OK
node tools/r4/w1-tricks.mjs                 → w1-tricks OK (17 PASS lines)
node tools/feel-telemetry.mjs               → 188/188 checks pass (exit 0)
node tools/core-check.mjs                   → core-check OK
node tools/feel-telemetry.mjs --only trick  → the 7 new checks (spin 120 pts, wreck cause 'trick',
                                                glide ×1.73 air, grip ratio 0.62)

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/sim/` → "TSC-OWN OK"; `npx tsc --noEmit -p tsconfig.json` → clean.
- `node tools/r4/w1-tricks.mjs` → all PASS, e.g.
  "PASS spin: rider:trick land {count 1, points 120}",
  "PASS chain: two spins land {count 2, points 290}",
  "PASS superman held into the ground: fail + crash 'trick' ([\"trick\"])",
  "PASS short air: an unfinished spin crashes with cause 'trick' ([\"trick\"])",
  "PASS umbrella glide: air 0.95 s → 1.72 s, no trick (0)",
  "PASS Track.grip 0.5 slows the lateral response (vx after 4 frames 5.39 → 3.68)",
  "PASS tricks: no console errors ()" → "w1-tricks OK".
- `node tools/feel-telemetry.mjs` → "[feel] 188/188 checks pass" (the 7 new 'trick' checks included:
  spinPoints 120, spinCount 1, spinCrashed false, shortCrash true, glideRatio 1.728, glideTricks 0,
  gripRatio 0.617), exit 0.
- `node tools/core-check.mjs` → "core-check OK".

## Known issues
- None in the sim. The actors unit still has to read `RiderState.trick` for the visual rotation and
  `RiderState.gliding` for the umbrella pose (not this unit's files).

## Requests
- None. (`window.__br.combat.give(0,'umbrella')` already exists — gameplay/combat/debug.ts.)

## Decisions the lead should know
- The superman's "did it last long enough" is measured from the fresh press (the 0.2 s candidate
  included): the SPEC/acceptance need a superman that is held ~0.4 s to count, so the 0.3 s test
  cannot start at the arming. The 'start' event is emitted when the trick is armed (after 0.2 s).
- A superman still held at touchdown wrecks the rider — that includes the candidate phase
  (the drift pressed < 0.2 s before the landing), following the brief's "or a superman is still held".
- The trick's landing boost replaces the hard-landing speed scrub (like PERFECT does); the larger of
  PERFECT's boost and the trick's is given as one `rider:boost` event.
- The glide starts on any fresh drift press in the air (no tricks.minAir requirement — the brief's
  §3 lists only the umbrella, the drift press and "no trick running").
