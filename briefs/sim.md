# Unit: sim (sim/ + camera/) — wave 1 — THE FEEL
Read SPEC.md first (§0–2, §6 is your spec, §7 boost/impulse/crash APIs, §8 camera override).
You own `src/sim/**`, `src/camera/**` (not stub.ts), `sandbox/sim.*`, `tools/feel-*.mjs`.
Contracts: `createPhysics(session)`, `createCameraRig(app)` (core/contracts.ts).

## Goal
Arcade bicycle handling that feels fantastic with keyboard (ramped steer) and gamepad, plus the chase
camera that sells speed. This is the #1 pillar: tune by measurement AND by looking at frame strips.

## Deliverables
1. Physics in track space per SPEC §6: pedalling/brake/drag/slopes, steering with speed-sensitive
   authority + grip time constant, centrifugal push on curves, lean/yaw for visuals, drift with three
   mini-turbo levels, hop, crest launches, ramp launches (track features), air control, landings
   (PERFECT / hard / crash), slipstream + slingshot, surfaces (incl. oil/puddle features), walls &
   drops (bounds), rider–rider contacts (mass-weighted, bumps, small damage, wobble), obstacles from
   `session.obstacles` (traffic: crash above 8 m/s relative), crash launch + respawn (SPEC numbers),
   boost API, `applyImpulse`, `pose()` (pitch to slope, yaw, lean; airborne pitch), honours `rider.mods`
   (speedMul/accelMul/steerMul/gripMul/intangible) and statuses (stun → no steer, wobble → sway).
   Emits rider:* events (hop, land, drift, boost, bump, crash, respawn, nearMiss, offroad, obstacleHit).
2. Split into small files (forces, steering, drift, air, contacts, surfaces, crash, tuning.ts with
   every constant + per-bike modifiers from data/bikes.ts).
3. Camera rig per SPEC §6: spring chase, look-ahead, FOV, roll, trauma shake, kicks, look-back (C),
   cinematic override with smooth blend-out, terrain/road clearance, bus listeners (cam:shake, cam:kick).
   Also a simple pre-race orbit when no session (menus) that looks good behind the UI.
4. `tools/feel-telemetry.mjs`: scripted inputs (step steer, slalom, drift hold/release, hop, ramp,
   wall scrape, rider bump) in manual stepping → CSV/JSON + PNG frame strips; prints metrics: 0–60 time,
   top speed, steer response time constant, overshoot, lean max, drift level timings, airtime, camera
   jerk. Keep it for the feel critic.
5. Debug toggles: `__br.sim = { tuning }` so critics can inspect values.

## Quality bar (feel critic checks)
Metrics within SPEC §6 ranges; no jitter (camera or bike) at any frame rate 30–144 fps (test dt 1/30,
1/60, 1/144); smooth slow-mo (clock scale 0.1) without stutter; curves need steering but never feel
unfair; drift is controllable and the boost is satisfying; collisions push, never teleport or tunnel;
no NaN; riders never leave the world.

## Test
`/?race=coast&seed=1&stub=world,actors,combat,fx&traffic=0` isolates you on the stub track (stub
physics/camera are yours to replace). Also test on the real track when it loads.
