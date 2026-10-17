# sim unit status (sim/ + camera/)

## Plan (files)
src/sim/
- tuning.ts      every constant + per-bike/per-character derived params (bikeTune)
- state.ts       private per-rider extra state (SimRider) + helpers (status lookup, road sampling)
- forces.ts      longitudinal: pedal taper, brake, coast drag, slope, overspeed decay, boost, draft
- steering.ts    lateral: target vx (speed-sensitive), grip lag, curve push, wobble/stun, yaw + lean
- drift.ts       drift state machine, 3 mini-turbo levels, release boost, events
- air.ts         hop, crest launch (road-relative y'' = -g - v^2*k_v), ramps, air control, landings
- surfaces.ts    surfaceAt effects, oil/puddle features, walls/drops via bounds()
- contacts.ts    rider-rider contacts, slipstream/slingshot
- obstacles.ts   session.obstacles collisions, near misses
- crash.ts       crash launch, crashed slide, respawn (safe x), respawning blink, invuln
- pose.ts        world pose (slope pitch, bank, yaw, lean, air pitch, beyond-finish extrapolation)
- physics.ts     createPhysics orchestration + __br.sim debug
src/camera/
- chase.ts (track-space chase cam), shake.ts (trauma + kicks), blend.ts (override blend-out),
  orbit.ts (menu orbit), rig.ts (createCameraRig: modes, bus listeners)
tools/feel-telemetry.mjs  scripted scenarios → JSON/CSV + PNG strips + metrics

## Design notes
- Curve push is applied as a lateral-velocity bias (kappa*v^2*0.8 m/s) through the grip lag, so fast
  corners need ~60-80 % steer (a pure acceleration would be cancelled by the 0.07 s grip lag).
- Drift is road-relative (no curve push; steering sets the speed across the road) and charges by commitment;
  knocks / hard bumps / wall bounces / side swipes open a short carry window (weak steering, slow grip).
- Chase camera lives in track space (s - dist exact, x/y springs) → no spring lag at 20 m/s, no jitter.
- Shake combines with max(), so duplicate cam:shake from other units never stacks.

## Done (all brief deliverables)
- [x] src/sim/* physics (index.ts → physics.ts; 15 files ≤ 165 lines): forces, steering, drift, air (hop/
  crest/ramp/landings; 'external' air for combat ult/gulp), features (ramp, jumpCrest kick even after a
  micro launch, boostPad data.power/time, oil, puddle), surfaces + walls (impact bounce vs scrape
  friction + 'wallScrape' events; crash only at > 24° impact above 18 m/s), rider contacts (axis of least
  overlap, ≤ 4 cm fix per substep: push, never teleport), rider + traffic near misses, slipstream/
  slingshot, obstacles, crash/respawn (safe x), pose (Gram-Schmidt, beyond-finish), NaN guard.
  Cost 0.03 ms/substep for 8 riders + traffic. __br.sim = { tuning, riders(), cam }.
- [x] src/camera/* rig (index.ts → rig.ts): track-space chase (exact s, springs ω 9–11), look-back (C),
  override + 0.35 s smootherstep blend-out (race intro + fx KO director verified, no pop), respawn glide
  0.45 s, crash cam follows the tumbling body anchor, menu orbit, trauma shake (max-combined, settings
  .shake, prefers-reduced-motion ×0.35) + FOV kicks, bus listeners.
- [x] tools/feel-telemetry.mjs (+ feel-lib, feel-steps, feel-scenarios{,-world,-camera}.mjs): 15
  scenarios → metrics.json + CSV + 4×4 strips; 28/28 SPEC checks pass (stub track, clean numbers).
- [x] tools/feel-tour.mjs: strips on the REAL coast track → shots/sim/tour/*.png (all looked at).
- [x] sandbox/sim.html FEEL BENCH: full game + live graphs + tuning sliders + fps 30/60/144 stepping,
  slow-mo, crash/KO buttons, jump-to-feature; &realtrack=1 = track unit builder before world goes live.

## Key metrics (stub track, dt 1/60)
0–60 km/h 4.42 s · top 20.0 m/s · brake 12.5 m/s² · coast 0.6 · steer τ63 0.083 s, visible in 1 frame,
0 overshoot · lean max 28° (straight) / 38° cap · R60 needs 71 % steer, R100 43 % · drift levels at
0.55/1.20/2.00 charge-s (fix round 1: rate by commitment; tight bend held into = 1.3/s, straight 0.33/s),
L3 boost +35 % 1.3 s, slip 30° · hop 0.375 s · ramp 0.68 s PERFECT · slingshot ok ·
screen jitter same at 30/60/144 fps, camera jerk (track space) 22.5/23.3/23.8 m/s³ · slow-mo max 0.6 px/frame.

## Next
- re-run feel-tour when world/index.ts is live (drop &realtrack); nothing else pending.

## Known issues / deliberate choices
- PERFECT after a plain hop needs ≥ 0.55 s air (a flat hop is 0.38 s) so hop-spam cannot farm +20 %/SP;
  ramps/crests/hops off drops still give PERFECT at ≥ 0.35 s as per spec.
- Crash-on-landing (> 45° yaw from > 2.5 m) is implemented but rare: air control (35 %) keeps yaw low.
- Coast curves are gentle (R ≥ 150 m → ≤ 30 % steer at top speed); the spec push makes R60 bite (71 %).

## Notes for other units (fix round 1)
- track: cliff/tunnel wall faces sit ~0.3 m INSIDE bounds() (rider scraping at x 8.05 of 8.40 renders half
  inside the rock; strips/wallhi.png) -> put wall faces at bounds() + 0.05 m. The camera now keeps 1.0 m inside.
- track: tightest coast curve is R150 (needs ~28 % steer, no corner calls for a drift). Please add 2-3 corners
  of R 45-70 m with run-off (after the tunnel, the market chicane); drift charge is fastest at |kappa| >= 1/80.
- fx: the crashed chase pose changed (4.3 m behind the tumbling body, 1.6 m high, FOV 58, 12 deg/s orbit
  toward the road centre); chase FOV widens above top speed (+11 deg per 1.0 over) with a counter-dolly.
  The rig blend-out arcs around the rider and hard-cuts starts > 90 deg / > 12 m (__br.sim.cam.cuts, gapDeg).
- race AI: drifting is road-relative now (steer sets 3.2 m/s inward ... 1.0 m/s outward; no curve push while
  drifting); charge needs commitment (steer into it, bend the same way). The AI's drift P-controller still works.

## Notes for other units (events/data sim emits)
- rider:obstacleHit kind 'wall' (impact, speed = lateral impact m/s) and 'wallScrape' (~6/s while
  leaning on a wall, speed = v·pressure); obstacleId −1 for walls. Traffic: speed = closing speed.
- sim-owned statuses (source null, time mirrors sim timers): 'oiled' (strength .75), 'wet' (.4),
  'wobble' (bumps/obstacles). Physics applies their grip itself via min(), so combat mapping oiled →
  gripMul too is harmless (never multiplied twice).
- rider:land fires for hops and airs ≥ 0.12 s; PERFECT needs ≥ 0.35 s air (plain hops need ≥ 0.55 s
  so hop-spam cannot farm boosts). Respawn: mode 'respawning' 0.6 s, speed 0, then 'racing' at 6 m/s.
- Camera listens to cam:shake/cam:kick/hitstop + rider:crash/land/boost/bump/obstacleHit + combat:hit
  (player involved). Duplicate shakes from fx are harmless (max-combined).

## Core requests
- Hero framing (feel review F9): cruise rider is 149 px tall at 720p (21 %); the critic wants >= 175 px.
  Proposed SPEC §6 camera numbers: distance 4.6->5.6 m => 4.3->5.1 m, FOV 62->74 => 60->70 (then edit
  CHASE.dist/fov in src/camera/chase.ts). Boosts no longer shrink the rider (counter-dolly).
- Optional contract: CameraRig.chasePose(outPos, outQuat): number (fov) so fx/race cinematics can fly home to
  the real chase pose instead of re-deriving it (fx/ko/home.ts copies SPEC numbers; the crash cam changed).

## How to test
- node tools/feel-telemetry.mjs [--only steer,drift] [--strips]  → prints PASS/FAIL vs SPEC §6
  (fix round 1 added: driftWall knock snake wallEvents slope handoff; 60 checks)
- fix round 1 probes (real coast, all units): node shots/sim/fix1/scripts/{driftreal3,exploit2,knock,
  wallcarry,oil,landdip,crashcam,kotrace,soak,framing2,keys}.mjs
- node tools/feel-tour.mjs [--only drift,crest]  → shots/sim/tour/*.png (real coast track)
- /sandbox/sim.html?race=coast&seed=1&traffic=0&realtrack=1  (feel bench: drive with keyboard)
- /?race=coast&seed=1&stub=world,actors,combat,fx&traffic=0 ; live tuning: __br.sim.tuning, __br.sim.riders(), __br.sim.cam

## Fix round 1
Plan (issue -> fix; [x] = done + verified). Critic scripts: shots/review/sim/r1-feel/scripts, r1-camera.
- [x] C1 blocker/F2 blend slerp alias -> camera/blend.ts slerps into scratch quats (tq/mq), never an argument.
- [x] C2 straight-line blend path -> blend.ts stores the start pose relative to the followed rider + road
      frame (chase.anchor()), arcs around the rider (cylindrical lerp radius/azimuth/height) and slerps in that
      frame; residual blends stretch up to 0.35 s to stay <= 15 m/s and 480 deg/s; starts > 90 deg or > 12 m
      hard-cut (counted in __br.sim.cam.cuts). Verified: tools/feel-scenarios-blend.mjs 'handoff' (real fx/race):
      override 175 deg -> 1 cut; 60 deg side -> 20 frames, max 5.4 deg/frame, pop ratio 1.0, >= 4.5 m from rider;
      real KO hand-back 2.5 deg/frame, wrecked 2.0, respawn 2.3, intro->GO 0.05.
- [x] C5 crash cam -> chase.ts: crashed = 4.3 m / 1.6 m / FOV 58 (lambda 4), body follow lambda 20, 12 deg/s
      orbit toward the road centre; measured 4.3-4.9 m from the tumbling body (was 7-8.7). shots/sim/fix1/crashcam.png
- [x] C4 hit-stop slide -> all chase follow springs/damps run on dtSim (frozen in hit-stop, slowed in slow-mo).
- [x] F1 drift dives into wall -> steering.ts driftTarget(): road-relative (no curve push while drifting),
      d*lerp(-1.0, 3.2, u)*v/top m/s across the road, |vx| <= v*tan(20 deg) (a drift bounces, never wrecks).
      Real coast, 3 s from the centre (driftreal3.mjs): straight & R150 hold/neutral/counter: 0 crashes, only
      straight-hold touches the wall at 2.95 s (2.9 m/s bounce); R150 hold reaches L3 at 2.38 s.
      Deviation: neutral/counter no longer reach L3 within 2.5 s -- that is F4's commitment charging (wanted).
- [x] F3 knockback eaten by grip lag -> applyImpulse + hard side bumps open a carry window (steering.ts
      startCarry: 0.22 s, steer x0.3, grip tau >= 0.3 s). knock.mjs: 3.2 -> 0.60 m, 5.5 -> 1.03, 9 -> 1.69,
      9 vs steering back -> 1.27, oiled 9 -> 2.96. bumpai.mjs: a shoulder bump now separates 0.75 -> 1.59 m.
- [x] F4 drift-snaking -> drift.ts chargeRate(): lerp(0.35, 1.3, u) * lerp(0.25, 1, clamp01(kappa*d*80)),
      0.3 s re-drift lockout after a release, L1 boost 0.3 s. exploit2.mjs (20 s flat): into-L1 +2.8 %,
      neutral-L1 +0.05 %, into-L2/L3, neutral-L2, counter-L1 all lose speed (was +17..22 %).
- [x] F5 wall bounce -> surfaces.ts impact(): carry window 0.3 s (no steering, tau 0.4) -> 0.52 m bounce at
      full lock (0.35 m at 0.6 steer); 'wall' events honour wallHitEvery 0.3 s (re-hits merge silently).
      Camera eye now keeps 1.0 m inside bounds (was 0.4) so it never sits in the cliff face.
- [x] C3 skill boosts -> rig.ts watchBoost(): kicks from the player's boost state (boostPower/boostTime/
      mods.speedMul rising) unless a rider:boost already kicked this frame; chase FOV keeps widening above the
      bike's top (+11 deg per 1.0 over, capped +40 %). t21-skills.mjs: pelican.wing -> kick 12 for 2.2 s, FOV
      74 -> 87.8 at 26 m/s (combat now emits rider:boost 'skill' too, so C8 is covered on both sides).
- [x] F9 hero size -> counter-dolly in chase.finish(): FOV above the speed FOV (kicks, over-top) moves the eye
      in, so an L3 boost keeps the rider 141 px tall (was 113; cruise 149). Bigger cruise framing = SPEC
      numbers -> core request below.
- [x] F8/C6 landings + continuous buzz -> chase.dip(): spring dip 0.04 + 0.25*air m (0.21 m peak 70 ms after
      a 0.68 s ramp), -2 deg FOV punch on non-perfect landings >= 0.5 s; shake.ts buzz channel (15-19 Hz,
      0.0036 rad = ~2 px at buzz 1): curb 0.6*vn, rough ground 0.45*vn, wall scrape 0.9, speed 0.2*vn^2.
      wallScrape events now feed the buzz instead of a 0.35 trauma shake 6x/s.
- [x] F6 slopes -> forces.ts overspeed(): quadratic drag k 0.005 above top + linear pull only beyond the
      slope's settle speed. Real coast (slopes.mjs): -5.5 % settles 21.4 m/s (was 20.4), 50 m of -13 % 19.3 -> 21.0.
- [x] F7 oil/puddle -> features.ts enterSlick(): -6 % / -2 % speed on entry; steering.ts fishtail (2.6 m/s
      target sway at 6 rad/s, +-12 deg yaw, lean wobble) decaying with the oil timer; puddle = 0.35x for 0.3 s.
      oil.mjs: v 20 -> 18.8, yaw -5.8..13.5 deg, 0.6 m sway; puddle 19.6, yaw 5 deg. shots/sim/fix1/oil.png
- [x] F10/C7 telemetry -> tools/feel-scenarios-abuse.mjs (driftWall k0/k150 x hold/neutral/counter, knock
      3.2/9, snake into/counter vs straight, wallEvents at 30/60/144 fps + carry, slope -13/-5.5/+10 %) and
      tools/feel-scenarios-blend.mjs 'handoff' (per-frame rotation/translation/FOV, cuts, rider clearance for a
      175 deg override, a 60 deg override, real KO, wrecked, respawn and intro->GO; runs with no stubs via
      sc.stub = ''). feel-telemetry: 60/60 checks pass (shots/sim/fix1/tele/metrics.json).
- [x] extra (found in the 90 s pack soak): side swipes on vehicles glued like walls (player hit one truck
      14x in 12 m, -10 % speed each) -> obstacles.ts: carry window + one event/scrub per 0.3 s. Soak seed 3
      90 s all units: 2 separate truck hits, 0 NaN, 0 out-of-bounds, 0 tunnelling, no page errors.
- [x] C8 cross-unit -> combat's skillBoost now emits rider:boost 'skill' (seen in t21); the rig's boost-state
      watcher covers any writer that does not.
- [ ] not done: blend path vs obstacle boxes (only rider clearance is guaranteed: the arc never gets closer
      to the rider than the nearer end pose; far starts cut). F11/F12 are track-unit items (notes below).
