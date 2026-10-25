# sim unit status (sim/ + camera/)

## Plan (files)
src/sim/
- tuning.ts      every constant + per-bike/per-character derived params (bikeTune)
- state.ts       private per-rider extra state (SimRider) + helpers (status lookup, road sampling)
- forces.ts      longitudinal: pedal taper, brake, coast drag, slope, overspeed decay, boost, draft
- steering.ts    lateral: target vx (speed-sensitive), grip lag, curve push, wobble/stun, yaw + lean
- drift.ts       drift state machine, 3 mini-turbo levels, release boost, events
- carve.ts       exit carve: after an L1+ release the rest of the bend keeps the drift's bite (acceptance r1)
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
- Curve push is applied as a lateral-velocity bias (kappa*min(v, bike top)^2*0.8 m/s) through the grip lag, so fast
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

## Notes for other units (fix round 2)
- actors/fx: end-on traffic crashes now launch rider.crash differently: obstacles <= 1.9 m tall (cars, props) vault the
  body over the roof (higher/faster launch); taller ones (van/truck/bus) throw it BACK off the vehicle (negative
  forward velocity, backward tumble spin); the sim body slides back with it. The tumble gravity must stay 15 (T.crashVaultGravity).
- fx/ui: the respawn now usually hard-cuts (counted in __br.sim.cam.cuts) under the respawn blink; the 0.45 s glide only
  runs when the crash view already shows the rider from behind. Pause (clock layer 'pause' = 0) freezes shake/kicks/buzz.
- track: the new coast corners (L60/R60 chicane, L46, R90s) are fine for sim: no crashes in grip/drift/brake runs; R46 is
  the tightest radius grip can hold flat out (needs ~93 % steer at 20 m/s; R < 43 would force braking or a drift).
- everyone: CameraRig.chasePose(outPos, outQuat) returns the live chase pose + FOV (also during an override).

## Notes for other units (fix round 3)
- everyone: rider:bump now fires once per approach: a pair that touched stays latched (side re-contacts are silent inelastic
  shoves, no damage) until it is > 0.4 m apart with nobody pressing in, > 1 m apart, or apart 0.6 s.
- race/ui: respawn now ends the blink at 0 m/s and pushes off to 6 m/s in ~0.3 s (was 6 m/s in one frame).
- race (your request): no slipstream / slingshot below 8 m/s or while brake > 0.5; braking resets rider.draft to 0.
- race AI: the curve push uses min(speed, bike top x rubber): boosts and descents no longer shrink the radius full lock holds
  (your speed planner assumes v^2, which is now conservative while boosted). Drift ends (forced too) lock drifting 0.3 s.
- actors: physics.pose() pitch now has weight cues (braking nose dive ~-3 deg, boost squat, landing compression dip) and a
  wall-scrape pose (nose ~5 deg into the wall + 1.2 deg 13 Hz shimmy, lean ~8 deg onto it).
- fx/race (camera): blends whose peak turn rate would exceed 300 deg/s now cut on the release (was > 90 deg), so most KO
  hand-backs between ~56 and 90 deg cut under the whoosh; the crash cam may hover up to 10 m over the sea past a water edge;
  the chase eye slides (<= 1.4 m) / lifts (<= 0.8 m) when a rider blocks the view of the player (__br.sim.cam.occSide /
  occLift); chase distance is world metres on bends. chasePose() unchanged (it includes these offsets).

## Notes for other units (events/data sim emits)
- rider:obstacleHit kind 'wall' (impact, speed = lateral impact m/s) and 'wallScrape' (~6/s while
  leaning on a wall, speed = v·pressure); obstacleId −1 for walls. Traffic: speed = closing speed.
- sim-owned statuses (source null, time mirrors sim timers): 'oiled' (strength .75), 'wet' (.4),
  'wobble' (bumps/obstacles). Physics applies their grip itself via min(), so combat mapping oiled →
  gripMul too is harmless (never multiplied twice).
- rider:land fires for hops and airs ≥ 0.12 s; PERFECT needs ≥ 0.35 s air (plain hops need ≥ 0.55 s
  so hop-spam cannot farm boosts). Respawn: mode 'respawning' 0.6 s, speed 0, then 'racing' from 0 m/s with a ~0.3 s
  push-off to 6 m/s.
- Camera listens to cam:shake/cam:kick/hitstop + rider:crash/land/boost/bump/obstacleHit + combat:hit
  (player involved). Duplicate shakes from fx are harmless (max-combined).

## Core requests
- (fix round 3) SPEC section 6 wording to match deliberate, tested choices (critics keep measuring against the old text):
  L1 mini-turbo boost 0.3 s (not 0.45; anti snake-farming); PERFECT after a plain flat hop needs >= 0.55 s air (ramps,
  crests, drops >= 0.35 s); a wall crash needs > 24 deg impact angle above 18 m/s; the curve push is
  curvature x min(v, bike top)^2 x 0.8 (boosts never shrink the holdable radius); drift charge on a bend into the drift
  rewards a line-holding drift too (L3 ~2.3 s on R <= 250); side contacts bump once per approach (pair latch).
- (fix round 3, cross-unit, feel critic r3) rider meshes overlap at the SPEC contact distance |dx| < 0.75 m: either SPEC
  raises it to ~0.9 m (then combat's wing.ts CONTACT.dx 0.85 -> ~1.0 and sim's T.contactDx / nearPassGap follow), or
  actors keep each rider's shoulders / wings within 0.37 m of its centre line. sim waits for the decision.
- (applied by core, implemented) CameraRig.chasePose; rider.rubber; Track.runoff (sim reads frames to length + runoff).
- combat's RiderMods.pushImmune (status/combat.md core request): once core adds the field, sim's rider contacts will
  skip the speed loss for a pushImmune rider (contacts.ts sideBySide/rearEnd); nothing to do until then.

## How to test
- node tools/feel-telemetry.mjs [--only steer,drift] [--strips]  → prints PASS/FAIL vs SPEC §6
  (fix round 1 added: driftWall knock snake wallEvents slope handoff; round 2: wallPin driftTiming trafficCam
  respawnCam ultHandback pauseCam + PERFECT/knock cases; 106 checks)
- fix round 1 probes (real coast, all units): node shots/sim/fix1/scripts/{driftreal3,exploit2,knock,
  wallcarry,oil,landdip,crashcam,kotrace,soak,framing2,keys}.mjs
- fix round 2 probes: node shots/sim/fix2/cam/{t7-traffic,t17b-grab,t4-crash,t5u-ult,t8-pause,t9n-swerve,t1-fps}.mjs
  (camera critic's scripts, real game), shots/sim/fix2/scripts/{framing,framing-k,wallpin,walldead,hairpin,driftexit,
  knockreal,rubber,runoff,profile,tightcorners,soak}.mjs
- fix round 3: feel-telemetry scenarios driftRelease pressYaw lineHold draftBrake poses tightCam occlusion (tools/
  feel-scenarios-r3.mjs); probes shots/sim/fix3/scripts/{minors,yawsnap,bounds}.mjs, shots/sim/fix3/feel/{soak,dtcompare,
  knockreal}.mjs (critic copies), shots/sim/fix3/cam/{release-size,t30-lap,t34-tight,t32-corners,t4-crash,t3-blend}.mjs
  (critic copies; t30-lap adds occlusion details + maxFullRun; run from that folder, TRACK=city|mountain|coast).
- node tools/feel-tour.mjs [--main] [--only drift,crest,tunnelwall]  → shots/sim/tour/*.png (real coast track)
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

## Fix round 2
Plan (issue -> fix; [x] = done + verified). Critic scripts: shots/review/sim/r2-feel/scripts, r2-camera. Probes: shots/sim/fix2/.
- [x] W major wall pinball -> surfaces.ts contact hysteresis: an impact latches sr.wallSide; re-contacts on that side
      take the scrape path (vx 0, friction by pressure from the rider's own intent vxWant, wallScrape events; no bounce,
      no 'wall' event, no shake) until the rider steers > 0.4 m away, is > 1 m away or stays off it 0.8 s. Carry windows
      are direction-aware (steering.ts startCarry(dir) + carried(): only steering toward the wall / vehicle / hitter is
      muted, and the slow carry grip only holds back motion toward it). Yaw is rate-limited to 300 deg/s for 0.15 s
      after a bounce or latched re-contact (attitude.ts, split out of steering.ts). Vehicle side swipes latch the same
      way (obstacles.ts swipeLatch). Real cliff (critic wallpin.mjs): steer 0.15/0.3/0.45/1 -> exactly 1 'wall' event
      at dt 1/30, 1/60, 1/144, 0 yaw reversals after 1.5 s (was 9 impacts, 4.4-4.8/s); walldead.mjs: |vx| >= 2 in
      0 frames after the impact (was 18), yaw -5 deg in 2. Trauma: one 0.32 spike, then 0 (fix2/wall-steer10.png).
- [x] D major drift charge on real curves -> driftChargeKappa 80 -> 250, driftChargeHigh 1.3 -> 1.15 (full commitment
      on R <= 250 = 0.48/1.05/1.75 s, R300 0.55/1.20/1.98). New tools/feel-scenarios-r2.mjs driftTiming checks R300 and
      R150 against L1 0.45-0.7 / L2 1.0-1.45 / L3 1.7-2.4: all pass. Straight factor 0.25 unchanged.
- [x] C major crash cam inside vehicles -> done, see "C major ... (verified + finished)" below.
- [x] minors: all done, each listed below (hero framing, PERFECT, drift curve push, knock, telemetry, respawn cut,
      SHOWTIME settle, pause freeze, water-crash zoom, camera telemetry, rider.rubber).
- resumed 11:15 (new fixer after API outage): found UNVERIFIED code from the previous fixer for C (camera/avoid.ts
  + crash.ts vault over the roof), PERFECT calm/timed (air.ts), drift curve-cancel x1.35 + driftLatIn 4.5 + release
  ramp (steering.ts/drift.ts), knock carry direction-aware (knockSteer 0.1), rider.rubber (forces.ts). Verifying each
  now; then the camera minors (respawn cut, SHOWTIME settle, pause freeze, water FOV, framing per new SPEC numbers,
  chasePose) and the telemetry additions.
- resumed 14:20 (third fixer, previous one stopped at 11:25 mid-verification). Baseline: tsc clean; feel-telemetry
  79/84 (shots/sim/fix2/tele3): wallPin/driftTiming/knock pass; FAIL driftWall k0/k150 hold clear 2.0 s (driftLatIn
  4.5 = critic's ask: check needs updating), press.sideJitterX 0.011 (> 0.01), trafficCam van/bus hiddenRun 10/19.
- [x] C major crash cam inside vehicles (verified + finished): eye never enters a box (camera/avoid.ts lifts it over roofs
      and sight-line blockers, hard floor). crash.ts launchFor(): end-on into an obstacle <= 1.9 m tall the body vaults,
      high enough for the roof and fast enough (relative to it) to pass its far end before dropping to roof height;
      taller ones (van/truck/bus) bounce the body back off the tail/nose (fwd = min(v_obs, 0) - 1.5 - 0.05*closing,
      backward tumble; the sim body slides back with it: sr.crashBack), so it never tunnels and stays on the camera's
      side. feel-telemetry trafficCam: car/van/bus eyeInBox 0/0/0, body hidden run 5/0/0 frames (was 4/10/19).
      Real traffic (fix2/cam/t7-traffic.mjs s3/s5): 0 eye-in-box frames; strips t7-traffic-2-van.png (stopped van:
      pops up and back, van stays a backdrop), 3-van (oncoming), 0-car (vault over the roof). t17b autopilot lap s7: 0 events.
- [x] minor hero framing (core: SPEC §6 now 4.3->5.1 m, FOV 60->70): CHASE dist [4.3, 5.1], fov [60, 70].
      framing-k.mjs on straights (s 300 / 2000): cruise 20 m/s 178-179 px = 24.7 % of 720 (was 149 px = 20.7 %);
      the critic's framing.mjs spot s 1420 is now inside the new L46 hairpin (170 px there, angled view); L3 boost
      keeps the size (counter-dolly), 6 m/s 215 px. Telemetry camera.fovAtTop window -> 69..72.
- [x] minor pause -> rig.ts: while clock layer 'pause' is 0, fx.update() is skipped and the buzz holds its value.
      fix2/cam/t8-pause.mjs: buzz / crash shake / boost kick over 1 s of pause = 0 deg, 0 m, FOV constant (was 0.86 deg/frame).
- [x] minor SHOWTIME settle -> rig.ts: behind a cinematic the chase springs run on dtReal (nothing shows them), so the
      hand-back lands settled. fix2/cam/t5u-ult.mjs: first frame after the 125 deg cut = eye 2.17 m (rest 2.2; was 4.58),
      feet at 537/720 px (was 673) and steady after it (t5u-ult-handback.png).
- [x] minor respawn glide -> listeners.ts glideKeepsRider(): the 0.45 s glide only runs when the last crash-cam view
      already shows the respawned rider from behind (eye >= 0.5 m behind it along the road, rider mid inside 85 % of
      the start frame); otherwise it cuts under the respawn blink. fix2/cam/t4-crash.mjs: traffic + water respawns cut
      (31 / 71 deg in one frame, 0 glide frames, so 0 off-screen frames; was 14 / 8 of 27).
- [x] minor water crash speck -> chase.ts crashZoom(): crash cam farther than crashDist + 1 m from the body narrows the
      FOV to keep its size (floor 30 deg) and rises 0.15 m per m the edge clamp holds it back (<= 1.5 m).
      t4-water-strip.png: the pelican stays readable in the sea for the whole crashed window (was a 20-30 px blob).
- [x] minor PERFECT unconditional (air.ts, verified): PERFECT = air >= min && (calm: |steer| < 0.3 for the last 0.15 s and
      |yaw| < 6 deg, or timed: Space <= 0.2 s before touchdown and |yaw| < 12 deg). Telemetry air: straight ramp PERFECT,
      full steer through the flight NOT perfect, same + Space just before touchdown PERFECT (new checks).
- [x] minor drift on rails (steering.ts/drift.ts, verified): curve push cancelled only up to 1.35 x grip authority,
      driftLatIn 4.5, 0.2 s release ramp. Critic hairpin.mjs: R150/R60/R30 drift neutral holds (x 4.1-4.3), R15 drift
      runs wide to the wall (bounce, no crash) while ride-full crashes; driftexit.mjs: 0 wall hits / crashes after a
      release with 0-0.3 s steer lag (x 3.79 -> 5.62 max, was -> 7.41 at the wall). driftWall hold checks now 1.8 s +
      "never crashes" (a full-into drift crosses ~4.5 m/s like grip steering, as the critic asked).
- [x] minor light knock vs pressing AI: knockSteer 0.1 -> 0.05 (direction-aware: only steering back toward the hitter);
      rider-rider side bounces keep their own bumpSteer 0.3 (press.sideJitterX back to 0.010, the round-1 value).
      New telemetry knock.lightSteerDisp (victim steering full lock back): 0.476 m (>= 0.45); light 0.60, heavy 1.69.
- note: the live coast track now has tight corners (profile.mjs: S-chicane L60/R60 at 995-1115, R90, near-hairpin L46
  at 1325-1425, R90); drift charge is full-rate there (R <= 250), the curve push needs ~93 % steer at 20 m/s on L46.
- [x] core request rider.rubber (forces.ts baseTop, verified): fix2/scripts/rubber.mjs settled speed 1 -> 19.99,
      1.1 -> 21.98, 0.9 -> 18.0, NaN -> 19.99 (neutral), 5 -> capped at rubberMax 1.5.
- [x] core request chasePose: rig.chasePose(outPos, outQuat) returns the live chase pose (before blend / shake) and
      its FOV; during an override it is this frame's chase target. Telemetry pauseCam.chasePoseErr 0.
- [x] core request run-off: state.ts trackEnd() = length + runoff; sim frames / bounds / surface / pose / crash and the
      chase bounds read the real run-off road instead of extrapolating (runoff.mjs: finished rider stops 21 m past
      the line on the road, pose dy 0, no errors).
- [x] regression pass after the fixes: feel-telemetry 106/106 (shots/sim/fix2/tele3, new checks: trafficCam, respawnCam,
      ultHandback, pauseCam, knock.lightSteerDisp, air ramp steer/stick PERFECT, driftWall crash flags); critic wallpin.mjs
      steer 1 -> exactly 1 'wall' + 19 scrapes, yaw 0 at dt 1/30, 1/60, 1/144 (steer 0.45 now sits on the new R90's curb:
      +-0.5 deg curb wobble, 0 walls); walldead.mjs |vx| >= 2 and yaw -5 deg in 1 frame; t9n-swerve s5: 0 eye-in-box on
      0.53-0.70 m passes; soak s3 90 s all units: 0 NaN / out-of-bounds / tunnelling, no errors (the 25 m 'ds' jump of
      rider 2 is pre-existing: also in the critic's soak-3-60.json, not sim). t1-fps: slalom/sbend residuals as before
      (x1.14 from the bigger framing); the drift case now meets the curb/wall at the end (drift crosses at 4.5 m/s), from
      x 6 instead of 2 its residuals match the critic's (sy 0.39 px, pitch 0.038 deg).
- [x] lap check (critic t17-lap.mjs, all units, traffic + police, autopilot): seed 7: inObs [], losFrames [], spikes [],
      blendOff 0 (respawn cut counted), minClear 1.6 m; seed 3: same, 0 frames in / behind vehicles. t17b-grab s7: 0 events.
- [x] tight corners (new coast layout) re-validated: tightcorners.mjs grip / drift / brake runs through L46, L60, R60, R90
      from the outside edge: 0 crashes; drift levels L1 0.67-0.87 / L2 1.22-1.43 / L3 1.92-2.12 s (started on the
      approach straight); full-commitment drifts reach the inside wall and scrape (bounce, no crash).
- Fix round 2 complete: the camera major + both feel majors (wall pinball, drift charge) fixed and verified, all minors done;
  feel-telemetry 106/106; tsc clean for src/sim + src/camera (remaining tsc errors are in src/world, track/env units).

## Fix round 3
Plan (issue -> fix; [x] = done + verified). Critic evidence: shots/review/sim/r3-feel, r3-camera. Probes: shots/sim/fix3/.
- [x] F1 major L3 release flings outward -> steering.ts curvePush() uses min(v, bikeTop) (forces.ts bikeTop = bike top x
      rubber), so boosts / skills / descents never shrink the radius full lock holds (R43); release ramp 0.2 -> 0.35 s
      (driftExitTime) and |vx| <= v tan 20 deg for 0.5 s after a release (driftExitGuard). Critic driftexit.mjs (real coast):
      L46 full/half/neutral yaw 37 -> 1 / -7 / -15 deg (was -10/-18/-25), run-wide 0 / 3.2 / 8.0 m (was 3.9/9.0/12.2), no
      crash (was a wall crash); L60 0 / 0.2 / 3.7 m; R90 0 / 0 / 3.6 m; <= 2.9 deg/frame. driftexit2.mjs bothKeys L46 at
      1/30, 1/60, 1/144: 1 wall bounce, no crash (was a crash at +1.39 s). (shiftOnly L60 still crashes at +1.6 s: full LEFT
      held into the chicane's R60 at 26 m/s = 26 deg into the wall, a player error, also before.)
- [x] F2 major rider bump yaw snap + press loop -> contacts.ts: side contacts latch the pair (like walls): after the first
      bounce, re-contacts are inelastic shoves with no rider:bump and no damage until the pair is > 0.4 m apart with neither
      pressing in (pairLatchGap), > 1 m apart (pairLatchFar), apart 0.6 s (pairLatchTime), or moved farther than it could
      ride (respawn / teleport = new approach). Any side contact closing > 1.5 m/s sets yawEase on both riders (300 deg/s).
      Critic bump.mjs (combat stubbed) at 1/30, 1/60, 1/144 x steer 0.3/0.6/1: 1 bump per 3 s press (was 7-8), HP lost
      P 0/3/5 G 0/2/2 (was up to 43/22), yaw reversals 0.7-1.3/s (was 2.0-5.0); shoulder fight 1 bump (was 7, -36 HP);
      rear-ends unchanged (1 bump). bumpyaw.mjs: player/rival yaw step 5.0 / 4.7-5.0 deg/frame at 60 fps (was 25 / 16).
- [x] F3 minor wall-scrape pose dead straight -> surfaces.ts stores the signed scrape pressure (sr.scrape), attitude.ts
      smooths it (lambda 12) into nose-into-wall yaw 5 deg x pressure + a 1.2 deg grinding shimmy (4.1 rad/m = 13 Hz at
      20 m/s) and lean 8 deg into the wall; vx stays 0 (physics unchanged). fix3/scripts/minors.mjs tunnel wall, full
      lock 3 s at 1/30, 1/60, 1/144: late yaw 3.8..6.2 deg, lean 9.3..9.5 deg (was 0 / 0), 1 wall event.
- [x] F4 minor respawn 0 -> 6 m/s pop -> respawningUpdate starts 'racing' at 0 m/s with a push-off (forces.ts: >= 20 m/s^2
      while below 6 m/s, at most 0.4 s): 6 m/s after 0.30 s, max 0.33 m/s per frame at 60 fps (was 6.2 in one frame).
- [x] F5 minor no brake/landing pitch -> attitude.ts pitchTarget(): -0.25 deg per m/s^2 braking / +0.1 deg per m/s^2
      squat (cap 4 deg) + landing compression (air.ts landCompression: target offset -(5 + 8 x air) deg, cap 12, decays
      lambda 9: peak ~0.37x after ~0.1 s). Full brake 20 -> 0: pitch -3.2 deg (was 0); pedalling +0.5; hop / ramp
      landings dip -4.6 / -8.8 deg (incl. the descending air pitch) and settle within 0.5 s.
- [x] F6 minor drift restarts on a wall -> drift.ts: every end (forced too) locks drifting out 0.3 s, and no drift starts
      toward a latched wall (sr.wallSide). minors.mjs Shift + full lock into the tunnel wall 2.5 s: start@0.00, end + wall
      @0.53, no restart (was a restart 10 ms after the wall killed it).
- [x] F7 minor telemetry blind spots + SPEC deviations -> new tools/feel-scenarios-r3.mjs (REVIEW3): driftRelease (L3 release
      in R46/R60/R90 x full/half/neutral: no crash, full <= 2 m wide, full/half <= 10 deg out), pressYaw (1 bump per 3 s
      press, yaw steps <= 300 deg/s at 60 & 144 fps, HP), lineHold (report: line-holding drift charge), draftBrake, poses
      (brake pitch, scrape pose, respawn push-off), tightCam (real coast: world-distance chase, release-boost size),
      occlusion (rival closing in the camera gap); press.sideBumps is now checked (1). SPEC deviations filed under core
      requests below.
- [x] F8 cross-unit fx load -> fx loads again; ultHandback re-run (see C5): SHOWTIME hand-back settled, 0.69 deg/frame.
- [ ] F9 cross-unit meshes overlap at the 0.75 m contact distance -> not changed in sim: SPEC section 6 fixes |dx| < 0.75 and
      combat's wing.ts mirrors it (CONTACT.dx 0.85), so widening it alone would desync combat's ram test. Filed as a core
      request below (SPEC 0.9 m + combat mirror 1.0, or actors keep shoulders <= 0.37 m); sim only needs T.contactDx.
- [x] C1 minor rival hides hero in camera gap -> new camera/occlude.ts RiderOcclude (chase.ts applies it): riders are boxes
      (|ds| < 0.85, |dx| < 0.35, 1.9 m + 0.12 m clearance); judged from the natural eye, a blocked sight line to the hero's
      chest / head slides the eye toward the open side (<= 1.4 m, within the edge clamp) and lifts it when sliding cannot
      clear (<= 0.8 m), omega-8 springs, held 0.5 s, side sticks until the blocker is > 0.3 m on it (no swinging while a
      drafter weaves); eases out on the crash cam. Critic t30-lap.mjs (copied + fullRun counter): city s4 >= 5/9 blocked
      72 frames (0.7 %), never 9/9 (was 134 frames, 3 full hides up to 0.83 s); mountain s4 175 frames (1.6 %), longest
      full hide 4 frames (rivals tailgating 1.7 m behind in line); coast s3 0 frames (was 14). inObs 0, blendOff 0, no
      rotation spikes, size p5 179-184 px on all three. Telemetry occlusion (rival closing to 1.8 / 2.5 / 3.5 m in line):
      min visible 2 / 7 / 9 of 9, no full-hidden run.
- [x] C2 minor chase dist along centre line -> chase.ts alongS(): the eye sits dist world metres back (and the look point
      `ahead` metres forward) on the line at its lateral offset, delta-s = d / clamp(1 - kappa x, 0.7, 1.3) (the physics'
      metric) with kappa sampled mid-span + one refinement. Plus the boost shrink: while the FOV is kicked beyond the speed
      FOV, the counter-dolly also takes out the acceleration surge (finish(): ramps in over 2 deg of kick). Critic
      t34-tight.mjs (copied, mountain): R27 inside dRider 4.92-5.04 m / 212-220 px (was 4.01 m / 269 px), outside
      4.95-4.97 m / 214-216 px (was 5.92 / 181), straight 5.0 m / 212 px; R26 drift 188-216 px (was 188-278). Coast
      fix3/cam/release-size.mjs (clean L3 release on L46/L60/R90, stick full/half): boost min -2.3..-2.5 % (was -7.2..-8.7 %
      before the surge dolly; critic saw 254 -> 170 px), >= 178 px = 24.7 %. t32-corners: chicane/hairpin 185-187 px.
      Telemetry tightCam (real coast, world live): L46 inside/outside distance ratio 0.996 / 0.998, releaseShrink 0.2 %.
- [x] C3 minor KO exits whip just under 90 deg -> blend.ts: BLEND.cutAngle 90 deg replaced by cutRate 300 deg/s: after
      the duration stretch, a blend whose peak turn rate (1.875 x angle / duration) would exceed 300 deg/s (~56 deg in
      0.35 s = 5 deg/frame at 60 fps, 10 at 30 fps) cuts on the release instead (distance rule 12 m unchanged).
      Critic t3-blend.mjs (copied to fix3/cam): az30 still blends (2.76 deg/frame); az60 / az85 / az60 at 30 & 144 fps /
      orbit60 / az60_steer now cut in one frame (were 5.4-7.6 deg/frame, 10.7 at 30 fps). Telemetry handoff: side
      override at az 45 blends 20 frames at <= 4.1 deg/frame, new side70 case cuts, ko_maxRotDeg check 8 -> 5.2: 16/16.
- [x] C4 minor water crash horizon-less -> chase.ts: the crash cam may hover up to 10 m past a WATER edge (crashOverWater,
      weighted by crashBlend; walls/other edges keep the 1 m inside margin), the crash orbit swings out over the sea when
      the nearer edge is water (body seen against the beach), zoom floor 30 -> 40 deg, and keepHorizon() limits the crash
      cam pitch to -(fov/2 - 6 deg) by raising the look point. Critic t4-crash.mjs (copied): water body distance 4.4-5.2 m
      (was 5.2-14.5), FOV >= 52 (was 30.8), horizon inside the frame in 157/157 crashed frames, >= 6 deg below the top;
      fix3/cam/t4-water-strip3.jpg: beach, road and villas behind the floating pelican until ~2.4 s, horizon + shore after.
      Traffic crash unchanged (4.4-5.5 m).
- [x] C5 minor ultHandback check measures the blend start -> feel-scenarios-cam2.mjs ultHandback now checks what the player
      sees: rig.chasePose() eye height on the first frame after the override vs rest (chaseDy <= 0.3), rendered eye at the
      end of the blend vs rest (blendEndDy <= 0.1) and the blend's rotation (<= 2 deg/frame). Real fx SHOWTIME (fx loads
      again): chaseDy 0.007 m, blendEndDy 0.029 m, 0.69 deg/frame, no cut: 4/4 (was FAIL handbackDy 0.396 on correct
      behaviour). This also re-verifies the r2 SHOWTIME settle fix (cross-unit item F8 below).
- [x] X1 race request: no slingshot/draft while braking or < 8 m/s -> contacts.ts slipstream(): no leader search and no
      slingshot while brake > 0.5 (draftBrakeMax) or v < 8 m/s (draftMinSpeed); braking resets r.draft to 0. Telemetry
      draftBrake: draft 1.0 before braking, 0 while braking, 0 'draft' boosts while braking, 0 at 7 m/s.
- [x] extra: line-holding drift charge (critic context for F1: a drift holding its line on a bend charged at ~45 %, so L3
      only came from cutting inside): drift.ts chargeRate() raises the counter-steer floor on a bend into the drift
      (driftChargeLowBend 0.8, straights unchanged 0.35 x 0.25): lineHold R150 L1/L2/L3 0.63 / 1.38 / 2.32 s (was 1.1 / 2.43
      / none in 3.5 s); full commitment unchanged (driftTiming), snake/driftWall checks unchanged.
- [x] X2 track note: feel-tour cliffwall stop moved -> tools/feel-tour.mjs stop renamed 'tunnelwall' at s 1960, x 5 (tunnel
      rock walls 1945-2095): node tools/feel-tour.mjs --main --only tunnelwall -> 1 'wall' impact at 0.97 s then scrapes
      every 0.16 s, x 4.9..7.7, v 20 -> 16.2; strip fix3/tour/tunnelwall.jpg shows the bike leaning on the wall.
- [x] regression pass: feel-telemetry 152/152 (shots/sim/fix3/tele/metrics.json; wallPin's reversal detector now ignores
      swings < 3 deg so the deliberate scrape shimmy is not counted as pinball); critic soak s3 90 s all units: 0 NaN /
      out-of-bounds / tunnelling, player bump loops 0 (was 3), bumps 18 (player 2, was 8); dtcompare 30/60/144/jitter
      events within 1-3 frames; knockreal light shove 1.12 m; laps coast s3 / mountain s4 / city s4: inObs 0, blendOff 0,
      no rotation spikes, no page errors; npx tsc --noEmit: 0 errors (whole project).
- Fix round 3 complete: both feel majors (L3 release fling, bump snap/loop) and every camera minor fixed and verified, feel
  minors done (scrape pose, respawn push-off, weight pitch, drift lock), race's draft request done, feel-tour retargeted;
  F9 (contact width vs meshes) and the SPEC wording are filed as core requests. Note: critic wall.mjs counts every yaw
  wiggle as a reversal, so it will report the 13 Hz scrape shimmy (~26/s) that its own F3 fix asked for.

## Acceptance round 1
Issues owned by sim in reviews/game-r1-*.json (feel + perf):
- [x] A1 major (feel) L3 release mid-hairpin runs wide / neutral crashes (mountain R27/R26, city R28) -> new sim/carve.ts
      "exit carve": a release with L1+ arms it for the drift's direction; while the bend keeps turning that way the curve
      push beyond 0.7 x grip authority is cancelled (never more than the drift's own 1.35 x cancel), fading over 0.3 s once
      the bend relaxes below 1/150 m^-1 or reverses, or 4 s after the release (never carries into the next corner; a new
      drift / respawn clears it). |vx| <= v tan 20 deg now holds 1.0 s after a release (driftExitGuard 0.5 -> 1.0) and while
      the carve lasts, so walls only scrape. Critic probe-drift.mjs (copy in shots/sim/acc1/scripts, logs drift-before.log /
      drift-after1.log): mountain R27 / R26 + city R28 full lock and line-holder out 0 m, 0 outer-wall hits (was 7.3-8.3 m,
      1-5 hits); half 3.5 m (was 7.3-8.3, 10-11 hits); neutral no crash (was crash on both mountain hairpins), yaw out 12 deg,
      runs wide and scrapes; coast R46 unchanged (0 m). Strip shots/sim/acc1/sheet-hairpin.jpg (line holds the centre,
      neutral rides the outer curb). feel-scenarios-r3 driftRelease adds R26/R28/R30 x full/half/neutral (2.5 s after the
      release): 42/42 pass (full 0 m wide, half 2.4-2.8 m / 3.9 deg, neutral 12-13 deg, no crash).
- [x] A2 minor (feel) hero hides a rival straight ahead for the whole slipstream window (camera) -> chase.ts framing: eye
      2.3 -> 2.8 m up (was 1.9 -> 2.2), 4.2 -> 4.7 m back (was 4.3 -> 5.1), look point 1.2 -> 1.5 m high (was 1.0 m), ranges via
      span(); the horizon stays ~43 % from the top. Critic probe-occlude.mjs (copy in shots/sim/acc1/scripts, 1080p, v 19):
      hero head y 541 -> 636 (58.9 %, critic's target 630-670), hero 253 -> 266 px (24.6 %); cat ahead visible px at
      3/5/7/9/12/16 m: 19/49/69/84/99/113 of 103/82/69/59/49/40 (was 0/0/9/17/26/34) = whole from 7 m, 60 % at 5 m.
      Looked at: sheet-occlude.jpg (before/after), sheet-views.jpg (grid, coast cruise among rivals, city): rivals ahead read
      above the hero, composition fine. Regression: feel-telemetry 176/176 (then camera subset 57/57 after 4.8 -> 4.7 m);
      critic cam scripts (copies in shots/sim/acc1/cam): t34 R27/R28 in/out 218-231 px (fix3 212-220), R26 drift 198-230;
      release-size boost min -2.6 %, >= 187 px = 26 % (fix3 178); t32 chicane/hairpin 195-198 px; t30 laps city s7 / city s4 /
      mountain s4: inObs 0, blendOff 0, size p5 184-192 px (fix3 179-184), maxFullRun 0 / 12 / 0 (the 12 frames = a gulped
      rival popping out of the pouch at ds 0 then the spit arc; t30 now skips gulped / invisible riders, which it counted
      as 48-frame full hides), rotation 'spikes' only inside KO hand-back blends (<= 4.5 deg/frame, under the 5 deg cut rule).
- [x] A3 minor (perf) __br.sim.riders debug closure keeps the previous RaceSession alive at the menu -> debug.ts: the rows
      hook is built by module-level riderRows(riders) (captures only the SimRider list) and dispose() resets it to the
      module-level noRows (the old `() => []` made inside createPhysics kept that scope, and so the session, alive).
      Critic retainer.mjs (copied to shots/sim/acc1/scripts): quit to menu -> "no live RaceSession" (was the sim path).
Plan: A1 = post-release "exit carve" (drift's curve cancel kept while the mini-turbo burns + fade, only while the
bend keeps turning the drift's way, |vx| <= v tan 20 deg for that window); add hairpin release cases to feel-scenarios-r3.
A2 = chase framing (hero lower in frame at speed) and/or eye lift when a rider is ahead in line. A3 = debug holder.
- Regression (after A1-A3): feel-telemetry 176/176 (shots/sim/acc1/tele/metrics.json; +24 hairpin release checks), camera
  subset 57/57 after the last framing tweak; critic soak (copy shots/sim/acc1/feel/soak.mjs, TRACK env added) mountain s4 /
  city s4 90 s all units: nan 0, oob 0, tunnel 0, bump loops 0, no wall crashes (only KOs), page errors 0 (ds/dx jumps =
  pigeon ghost teleports); views.mjs: __br.errors [] on coast / city; npx tsc --noEmit: 0 errors in sim / camera.
Notes for other units (acceptance round 1):
- race AI: a drift released with L1+ now arms an exit carve for the rest of that bend (curve push capped at 0.7 x grip
  authority while the bend keeps turning the drift's way, |vx| <= v tan 20 deg; fades when the bend relaxes / reverses or
  after 4 s). AI riders that release mid-hairpin hold the line with ~70 % steer instead of running wide.
- fx / race / ui / species: the chase eye is higher and a little closer (2.3 -> 2.8 m up, 4.2 -> 4.7 m back, look point
  1.2 -> 1.5 m): the hero's head sits at ~59 % of the screen height (was dead centre), rivals ahead read above it, more of
  the top of the hero's head and beak shows. CameraRig.chasePose() API unchanged (returns the new pose).
Requests (core, SPEC wording; acceptance round 1):
- SPEC section 6 camera: "distance 4.2->4.7 m, height 2.3->2.8 m, look 5->9 m ahead at 1.2->1.5 m" (hero head ~59 % of the
  height so a rider ahead in the slipstream window is visible; hero still >= 24 %), replacing 4.3->5.1 / 1.9->2.2 / 1 m.
- SPEC section 6 drift: "a release keeps |vx| <= v tan 20 deg for 1 s; a release with L1+ keeps the drift's bite for the
  rest of that bend (exit carve: curve push capped at 0.7 x grip authority)".
- Acceptance round 1 complete: A1 (major) and both minors fixed and verified.

## r3 polish (2026-10-25)
Slice r3-perf (integrator's polish round; probes + logs in shots/r3-perf/).
- [x] game-r2-feel#0 combat knocks snapped the hero's heading (16.8-25 deg in one frame; bumps and walls were eased) ->
      physics.ts applyImpulse(): a lateral impulse >= knockMin also arms sr.yawEase for knockEaseTime 0.3 s (tuning.ts), so
      the nose swings with the shove at yawEaseRate (300 deg/s) and still reads as a hit (peak ~20 deg in 4 frames, after the
      hit-stop). Real combat (shots/r3-perf/knock.mjs: coast s2, goose pinned 1.5 m left with a pan, heavy swing, no body
      contact): max yaw step 24.4 -> 5.0 deg/frame at 60 fps, 24.8 -> 2.08 at 144 fps; direct 9 m/s impulse 25.9 -> 5.0.
      feel-telemetry 'knock' case extended (feel-scenarios-abuse.mjs): heavy/light/heavy@144 yaw step + peak yaw, 5 new
      checks (heavyYawStepDeg 5, lightYawStepDeg 5, heavy144YawStepDeg 2.08, heavyPeakYawDeg 19.8, lightPeakYawDeg 8.1);
      knock displacements unchanged (0.599 / 1.685 / 0.476).
- [x] core request (acceptance r1) physics.dispose() reset __br.sim.riders unconditionally -> it only resets the hook it
      published (identity guard). Verified: after an in-page restart __br.sim.riders() lists 8 rows (police-events.mjs).
- Checks: node tools/feel-telemetry.mjs 181/181 (shots/r3-perf/tele/metrics.json); race-soak coast/city/mountain SOAK OK;
  tsc 0 errors in src/sim, src/camera.
