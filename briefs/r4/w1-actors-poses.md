# r4 job w1-actors-poses — trick rotations, superman, throw aim, umbrella glide (actors unit)

Read SPEC.md §5 (art bible), §15 (throwing, umbrella glide), §16 (air tricks) and §22. Contracts already in core (do
not edit core): `RiderState.trick` (`{ kind, t, dur, dir }`, progress = t / dur; superman has `dur = Infinity`),
`RiderState.gliding`, `RiderAction.kind 'throw'` (aiming: the weapon is cocked back until release). Other jobs make
the sim and combat SET these fields; you make the rider view SHOW them. You do not change gameplay.

## Read first
`src/actors/view.ts` (RiderViewImpl.update: root pose from physics, body/bike children, the manual matrixWorld
updates, `anchor()`), `src/actors/rig/ride.ts` + `rig/cues.ts` + `rig/pose-state.ts` + `rig/cue-math.ts` (how riding,
attack/heavy and skill poses are blended), `src/actors/weapons/index.ts` (WeaponHolder: weapon in the hand) and
`weapons/models-b.ts` (umbrella model), `src/actors/kit/*` (builders). Test: `tools/r4/w1-poses.mjs` (read it: it
measures `anchor()` world positions in the bike's track frame — fwd / right / up).

## 1. Trick rotation (spin / backflip / frontflip)
- Rotate the WHOLE rider + bike (root) by the trick, around a pivot at the bike's centre (≈ 0.6 m above the road,
  between the wheels), composed on top of the physics pose: `root.quaternion = quat × R(trick)` and
  `root.position = pos + quat·(c − R·c)` with c the pivot in root-local space. Angle = 2π × progress (clamp progress to
  [0, 1]); `spin`: about local +Y, `dir = +1` turns clockwise seen from above (the nose swings RIGHT first);
  `backflip`: about local X, nose UP first; `frontflip`: nose DOWN first. No trick = no change (identity).
- Put the math in a NEW small module (e.g. `src/actors/trick-pivot.ts`) and call it from `view.update` right after the
  root pose is set — keep `view.ts` under 400 lines. Anchors must follow (they do if the root matrix includes it).
- Optional polish (only if the checks stay green): a slight tuck of the rider during flips.

## 2. Superman (`trick.kind === 'superman'`)
The rider lets go and stretches out flying: hips rise ≥ 0.2 m off the saddle, body nearly horizontal, both wings/
arms forward-out off the grips (≥ 0.15 m from their riding place), legs trailing back; blend in/out over ~0.12 s.

## 3. Throw aim (`action.kind === 'throw'`)
The weapon hand cocks the weapon back over the shoulder: hand up ≥ 0.15 m and back ≥ 0.1 m (relative to the chest,
compared with riding); the other wing keeps the bars. When the action ends (the weapon left the hand), play a short
follow-through (~0.2 s forward sweep) before returning to riding.

## 4. Umbrella glide (`state.gliding && weapon === 'umbrella'`)
The rider holds the umbrella straight up over its head (hand ≥ 0.1 m above the head anchor) and the canopy is OPEN: add
an open-umbrella model (a shallow striped red/white dome, same colours as the furled one, ~0.9 m wide) shown instead
of the furled one while gliding. Not gliding → furled umbrella, hands back on the bars.

## Rules
- Everything blends smoothly (no pops) and runs for every species (pelican, goose, capybara, cat, shiba, pigeon,
  penguin, seagull, sloth, corgi) on every bike; keep `node tools/actors-check.mjs` green (feet on pedals, hands on
  grips in normal riding — your new poses only apply while their state is active).
- Look at your work: save a contact sheet under `shots/r4-w1-actors-poses/` (e.g. the sandbox
  `/sandbox/actors.html` or a race with `&stub=sim,combat`, forcing the fields from `__br`) and check it.

## Files you own
`src/actors/` except `src/actors/bikes/`, `src/actors/stub.ts` and `src/actors/rig/bar-fit.ts`;
`sandbox/actors.*`, `tools/actors-*.mjs` (add checks, never weaken existing ones).

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/actors/` → TSC-OWN OK
- `node tools/r4/w1-poses.mjs` → w1-poses OK
- `node tools/actors-check.mjs` → OK
- `node tools/core-check.mjs` → core-check OK
