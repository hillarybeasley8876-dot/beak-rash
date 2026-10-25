# w3-llm-polish — make the 大模型限定款 look wrong at a glance

## Plan
1. Baseline: read the llm def + the acceptance script; record the tri counts and the diff numbers.
   `node sandbox/bikes.tris.mjs --bikes roadbike,llm --top 6` → roadbike 6864, llm 5930 tris.
   `node tools/r4/w3-llm-polish.mjs` → race 2.1 %, garage 18.6 % (both FAIL).
2. llm.ts: loud palette (pink frame / mint+orange rear / yellow+cyan front), the drawn front wheel 1.3×
   (its hub raised so the tyre still touches the ground; the physics radius stays 0.27), the frame a
   tube too many + a down tube that stops short, the bar backwards and much too wide, a third wheel on
   the top tube, two loose pedals on their own orbits.
   Verify: `node tools/r4/tsc-own.mjs src/actors/` → TSC-OWN OK.
3. llm/ folder: `bar.ts` (the backwards wide bar), `frame.ts` (the wrong frame), `wheel3.ts` (the third
   wheel), `pedals.ts` (the loose pedals).  Verify: same tsc command.
4. animate.ts: the llm branch — the third wheel spins about its axle, the loose pedals drift around
   their orbits, the chain sways.  Verify: tsc + a browser run with 0 console errors.
5. llm-chain.ts: a thick bright chain with a big slack loop, the collar still around the neck.
   Verify: `node tools/r4/w1-llm.mjs` → w1-llm OK.
6. bar-fit.ts: the llm grip offset so the mitten covers the new sleeve.  Verify: w1-llm OK.
7. Measure: `node tools/r4/w3-llm-polish.mjs` → race ≥ 10 %, garage ≥ 28 %.
   The garage number depends on the turntable's swing phase: `node shots/r4-w3-llm-polish/garage-sweep.mjs`
   sweeps the phase (the worst phase is 29.2 %, the acceptance itself measures 31–33 %).
8. Shots under `shots/r4-w3-llm-polish/` (side / back / turntable / garage / race crop).
9. Full acceptance: tsc-own, w3-llm-polish, w1-llm, bikes.tris, core-check.

## Done
- The llm bike is now loud and impossible: 1.3× front wheel (drawn only, still on the ground), two neon
  rims, seven plank spokes with every third one shooting past the rim, a backwards 1.3 m wide bar with
  long grip sleeves that poke out past the paws, a fat pink frame with a second top tube crossing the
  triangle and a down tube that stops in mid-air, a third wheel on a stub out to the side (spinning on
  its axle, facing the rider), two huge loose pedals drifting around beside the frame, and a chunky
  yellow chain that sags out beside the frame, sways, and closes into a collar around the rider's neck.
- The rider still fits: the saddle, the cranks and the pedals are the standard rig's; only the bar is
  drawn wider, and the paws hold its sleeves (bar-fit.ts slides the wrist onto the sleeve's end).
- Animated parts ride the existing hooks: the third wheel is the 'crank2' bone (spun in animate.ts),
  the loose pedals are 'pedal2L/R' bones (orbited in animate.ts), the chain sways about the chainring
  (llm-chain.ts, called from animate.ts). No per-frame allocation.

## In progress / next
- nothing outstanding; the acceptance suite is green.

## How to test (exact commands)
- node tools/r4/tsc-own.mjs src/actors/
- node tools/r4/w3-llm-polish.mjs
- node tools/r4/w1-llm.mjs
- node sandbox/bikes.tris.mjs
- node tools/core-check.mjs
- node sandbox/bikes.shots.mjs --bikes llm,roadbike --views side,turntable,back --clean --out shots/r4-w3-llm-polish
- node shots/r4-w3-llm-polish/garage-sweep.mjs 1500,2000,2500,3000,3500,4000   (the garage's phase sweep)

## Evidence (key output lines)
- node tools/r4/tsc-own.mjs src/actors/ → TSC-OWN OK
- node tools/r4/w3-llm-polish.mjs → PASS race camera: the llm bike differs from the roadbike in 17.7 %
  of its region (≥ 10 %) / PASS garage: … 30.7 % of the turntable (≥ 28 %) / w3-llm-polish OK
  (three more runs: 17.8 % and 31.0 / 31.1 / 31.6 %)
- node tools/r4/w1-llm.mjs → PASS the 'llm-chain' part reaches the rider's neck (closest vertex 0.08 m) / w1-llm OK
- node sandbox/bikes.tris.mjs → llm 7094 tris (roadbike 6864); far LOD llm 1002 (roadbike 884); exit 0
- node tools/core-check.mjs → core-check OK (exit 0)
- node shots/r4-w3-llm-polish/race-probe.mjs (llm at 17.6 m/s) → the chain's rotation changes
  ([0.004, 0, 0.041] → [-0.072, 0, -0.027]), the 'crank2' bone spins, the 'pedal2L/R' bones orbit,
  __br.errors = 0.
- garage phase sweep → 32.3 / 30.5 / 29.2 / 29.3 / 30.1 % (the turntable's swing phase moves the
  number by ~3 points; the acceptance itself measures 30.5–33.6 %)

## Known issues
- The garage diff in the lead's check swings with the turntable's swing phase (the two shots land at
  different angles): 29.2 % at the worst phase I could find, 28 % is the threshold. The race number is
  deterministic (17.8 % every run).
- The drawn front wheel is 1.3× the rear, so the front hub is drawn 8 cm higher than the physics hub
  (the tyre still touches the ground). The physics is untouched: `wheelRadius` 0.27, wheelbase 0.84.

## Requests
- `src/actors/bikes/template.ts` has no group names for the LLM's extra moving parts. I reuse the
  tandem's spare groups — `crank2` (the third wheel) and `pedal2L/R` (the loose pedals) — and
  special-case them in animate.ts for the llm bike only. If the lead prefers proper names
  (`wheel3`, `orbitL`, `orbitR`) in template.ts, that file is not mine to edit.
- The chain's sway: the first `anim.update` runs while the bike root has no parent yet, so the sway list
  is keyed on the chain geometry's `dispose` event (fired when the model disposes it) instead of on the
  parent chain — otherwise the chain was dropped from the list before it ever swayed.
