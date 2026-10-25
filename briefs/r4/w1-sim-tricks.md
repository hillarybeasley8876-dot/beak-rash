# r4 job w1-sim-tricks — air tricks, umbrella glide, weather grip (sim unit)

Read SPEC.md §6 (handling today), §16 (air tricks — your main spec, note the input mapping), §15 (umbrella glide),
§20 (Track.grip) and §22. Contracts already in core (do not edit core): `TrickKind`, `TrickState`,
`RiderState.trick` / `RiderState.trickChain`, `CrashCause 'trick'`, event `rider:trick`, `Track.grip?`.

## Read first
`src/sim/air.ts` (air episodes: startAir, vertical, land — PERFECT, hard landings, crash on bad landings),
`src/sim/state.ts` (SimRider fields), `src/sim/physics.ts` (step order, crash()), `src/sim/crash.ts` (crashRider),
`src/sim/drift.ts` (giveBoost), `src/sim/steering.ts` (air steering factor, grip), `src/sim/tuning.ts`,
`src/sim/surfaces.ts`. Tests and probes: `tools/feel-telemetry.mjs` (must stay green), `tools/r4/w1-tricks.mjs`.

## 1. Tricks (new file `src/sim/tricks.ts`, called from air.ts)
- Track the previous `controls.drift` per SimRider so you can see a FRESH press (false → true) while airborne. A drift
  held since before take-off never starts a trick. Tricks need `r.airTime ≥ 0.25`, `r.mode === 'racing'`, the rider not
  stunned (`r.mods.steerMul > 0`), no trick already running, and the rider not gliding (§3).
- On a fresh press pick the trick from the same step's controls:
  `|steer| > 0.6` → `spin` (dir = sign of steer, dur 0.55 s); else `brake > 0.5` → `backflip` (dir −1, 0.65 s); else
  `hop` (edge) → `frontflip` (dir +1, 0.65 s); else → `superman` candidate: it starts only if drift stays held
  0.2 s (no steer/brake/hop meanwhile), then `dur = Infinity` while drift is held; releasing drift ends it — it counts
  as done if it lasted ≥ 0.3 s, else it is cancelled silently (no points, no crash). Throttle never picks a trick.
- `r.trick = { kind, t, dur, dir }` while running; advance `t` by dt each air step; when `t ≥ dur` the trick is done:
  `r.trick = null`, `r.trickChain += 1`. A new fresh drift press can then start another trick in the same air.
- Emit `rider:trick { riderId, phase: 'start', kind, count: trickChain + 1, points: 0 }` when a trick starts.
- Landing (in `land()`): if a trick is running with `t / dur < 0.85`, or a superman is still held → crash the rider
  with cause 'trick' (crashRider) and emit `rider:trick { phase: 'fail', kind, count, points: 0 }`. A running trick
  with progress ≥ 0.85 counts as done (snap). If `trickChain ≥ 1` after that: emit `rider:trick { phase: 'land', kind:
  (the last trick), count: trickChain, points: 120 × count + 50 × (count − 1) }` and give a boost with
  `giveBoost(..., 'land', 0.2, 0.6 × (1 + 0.2 × (count − 1)))` (keep PERFECT's own boost logic; take the larger).
  Then `trickChain = 0`, `trick = null`.
- Tricks are visual only for physics: do NOT change `r.yaw`, `x`, speed or the landing yaw checks because of a trick
  (the actors unit rotates the view from `r.trick`). Reset `trick`/`trickChain` on crash, respawn and new air episodes.
- AI riders: nothing to do here (race AI will press the inputs later), but every rule must work for any rider.

## 2. Numbers → `tuning.ts` (a TRICKS table: min air 0.25, durations, snap 0.85, superman hold 0.2 / min 0.3,
   points 120/50, boost 0.2 / 0.6 / +20 % per extra trick).

## 3. Umbrella glide (SPEC §15)
While airborne, `r.weapon === 'umbrella'`, drift held (a fresh press in the air, same rule as tricks) and no trick
running → gliding: gravity × 0.45 and air steering 60 % (instead of today's 35 %) until landing or drift release.
Gliding never starts a trick; a glide is not a trick (no rider:trick events). Set `r.gliding = true` while
gliding (core field, views open the umbrella from it) and false otherwise (landing, release, crash).

## 4. Weather grip (SPEC §20)
Multiply the lateral grip by `session.track.grip ?? 1` wherever the surface grip is applied (read it every step: tests
change it at runtime).

## Files you own
`src/sim/` (whole folder except `src/sim/stub.ts`), `tools/feel-scenarios-abuse.mjs`, `tools/feel-telemetry.mjs`
(you may ADD a 'trick' case to the telemetry, never weaken existing checks).

## Acceptance (the runner runs these; read `tools/r4/w1-tricks.mjs` first)
- `node tools/r4/tsc-own.mjs src/sim/` → TSC-OWN OK
- `node tools/r4/w1-tricks.mjs` → w1-tricks OK
- `node tools/feel-telemetry.mjs` → every check passes (exit 0)
- `node tools/core-check.mjs` → core-check OK
