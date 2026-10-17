# bikes — status

## Done (all milestones)
- Build kit `src/actors/bikes/build/`: geo.ts (bike-space prims + `smooth` weld), strip.ts (chains/ribbons),
  partset.ts (merges a whole bike into ONE rigidly skinned geometry: vertex colours, per-part outline width,
  crack-free hull normals, paint mask, bone index), atlas.ts + decals.ts (one 512² canvas decal atlas:
  plate "01", cartoon QR, 扫码骑行, faded 鹈鹕 badge, 28·载重, NO BRAKES, 越野王, 车上有咸鱼, grid, fish face…),
  material.ts (toon body = vertex colours × atlas on render/toon.ts ramp; own skinned hull material,
  distance-widened like the riders' outlines).
- Parts `parts/`: layout (geometry chart → points + head-tube axis), wheel, drive, cockpit (drop / bullhorn /
  flat / swept bars, stem, levers, bell), frame (lugged tubes, head tube, rigid & suspension forks, saddles),
  brakes (caliper, disc, rod), accessories (fenders, rack, decals), fittings (basket, lamp, kickstand,
  reflectors, chain case, number plate), diamond (diamond frame, drivetrain, rider markers).
- `template.ts` (BikeBuilder: bones/pivots/markers), `cache.ts` (template per id+quality, tint variants share
  every buffer but colour, ref-counted GPU release), `animate.ts`, `model.ts`, `index.ts` → real `createBike`.
- Seven bikes in `defs/` (+ `fish.ts` passenger). Tris at high: roadbike 2982, erba 2992, shared 2986,
  fixie 2810, mtb 2744, tandem 2962 (fish incl.), kidbike 2456. Medium ≈ 75 %, low ≈ 65 %.
- Perf: 2 draw calls per bike (skinned body + hull). In game (8 riders): 16 bike calls, 0 errors, 60 fps.
  All 7 templates build in ~47 ms (high) on first use; instances are ~0.2 ms.
- Verified: sandbox turntable/side/rear/close-ups, lineup, 6 m chase grid, tints (all rival colours),
  low/medium/high, in-game chase screenshots (shots/bikes/), automated animation checks (all pass).

## Contract notes for consumers (actors / ui garage)
- Bike faces −Z, origin = road contact midway between the wheels (per types.ts), +X right.
- `update(dt, speed, steerAngle)`: steerAngle > 0 turns the bars RIGHT, pivoting about the tilted head-tube
  axis (clamped ±0.8 rad). Wheels roll at speed/R. Cranks: crank rev = wheel rev / gear (roadbike 5, erba 3,
  shared 3.2, fixie 3.4, mtb 4.2, tandem 4.4); freewheel bikes stop pedalling under hard braking
  (accel < −1.2 m/s²), the fixie never stops.
- `crankAngle`: 0 = right pedal at top dead centre, increasing = forward pedalling. Pedal markers are
  children of level pedal bones (world orientation = bike orientation).
- kidbike: no cranks. `crankAngle` = paddle phase; pedalL/pedalR markers (root children) paddle along the road
  while accelerating (> 0.6 m/s²), glide on the foot pegs at steady speed, stand on the ground when stopped.
- Rider fit (bike space, metres; saddle→pedal reach = TDC..BDC):
  | bike | R | wb | saddle (y,z) | gripR (x,y,z) | saddle→pedal | saddle→grip |
  |---|---|---|---|---|---|---|
  | roadbike | .27 | .84 | .67, .175 | .16, .71, −.36 | .37–.60 | .56 |
  | erba | .33 | 1.06 | .76, .271 | .231, .88, −.138 | .38–.65 | .485 |
  | shared | .29 | 1.00 | .72, .231 | .227, .858, −.171 | .39–.64 | .48 |
  | fixie | .28 | .84 | .68, .162 | .172, .715, −.408 | .37–.60 | .60 |
  | mtb | .30 | .94 | .70, .198 | .255, .778, −.265 | .36–.61 | .53 |
  | tandem | .28 | 1.60 | .68, −.134 | .206, .76, −.632 | .36–.60 | .545 |
  | kidbike | .16 | .60 | .42, .051 | .157, .542, −.167 | pegs/ground | .30 |
- Extra markers: basket (shared, steer child), rack (erba), stoker (tandem; the fish sits there and sways),
  bell (all, steer child; exported as `BikeMarkersEx.bell`).
- Meshes are `SkinnedMesh` named `bike:body` / `bike:hull`; body has `userData.noOutline`, hull
  `userData.isOutline` (generic outline passes skip them). Materials/atlas are shared singletons (never
  dispose them); `dispose()` releases the instance's lease (GPU buffers freed when the last user goes).
- Garage turntable can call `createBike` in its own renderer; `root.userData.tris/drawCalls` for stats.

## Known issues / possible polish
- Chains are static loops (no link scrolling); erba & shared hide chainring/chain inside their chain cases.
- Very dark rival tints (#222) give black frames (still readable via rims/saddles/outlines).

## Core requests
- types.ts: add optional `bell?: Object3D` to BikeMarkers (bell-ring wing target; exported meanwhile as
  `BikeMarkersEx` from actors/bikes).
- render/toon.ts outline(): same bug actors reported (objectNormal undeclared on plain meshes); bikes use
  their own skinned hull material, so no change needed for bikes.

## How to test
- `tools/devserver.sh`, then `/sandbox/bikes.html` (views: turntable, close, side, front, back, top, lineup,
  chase, grid; markers toggle; tint/quality; speed/steer sliders; LAUNCH 0→v for the balance-bike paddle).
  URL: `?bike=tandem&view=close&markers=1&speed=8&steer=0.3&focus=0,0.95,0.52&dist=0.9`.
- Shots: `node sandbox/bikes.shots.mjs --bikes roadbike,erba --views side,close,chase --markers 1 [--clean]`.
- Animation checks: `node sandbox/bikes.anim.mjs` (all fields true).
- In game: `node sandbox/bikes.game.mjs --bike tandem --frames 640 --stub combat,ui`.
