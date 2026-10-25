# fx unit status

## Plan (milestones)
1. [x] post pipeline: scene → HalfFloat MSAA RT (+depth tex) → dual-filter bloom → composite uber-pass to screen
       (grade, bloom, edge radial blur + chroma by speed, white speed lines, vignette, KO comic look
       [ink/red/paper 3-tone + halftone + depth-masked red ray burst behind the subject + black KO lines
       + zoom blur + grain], damage edge pulse, impact frames, flash, slanted letterbox). low = no bloom/blur.
2. [x] particles: 2 pooled instanced pools (solid inked sprites + additive), ≤3k, analytic motion in VS,
       5x5 runtime canvas atlas (25 comic sprites), modes billboard/stretch/flat/flutter/orbit, follow anchors,
       frame velocity (inherit rider motion), erode rings, sim-time vs real-time animation domains.
3. [x] presets (impacts/ground/bodies/rewards/speed/skills, 40+ names) + bus reactions + continuous emitters.
4. [x] KO director (ko/): KO, chain (extend once, re-peak), short variant (repeat <10 s / settings), off (lite),
       WRECKED (side cam, red tint), SHOWTIME rise (hero cam, 'ult' slow-mo) + impact (wide cam, shockwave).
5. [x] debug `__br.fx` (burst, testKo/testWrecked/testUlt, bench, gpu, stats, post, toggles);
       sandbox/fx.html gallery + post sliders; real KoCine replay in the sandbox (session 3).
6. [x] perf: post 0.38 ms (normal) / 0.65 ms (worst: KO look + speed + bloom) at 1080p M1 Max
       (readPixels-synced wall clock, best of 3); 1500 live particles cost < 0.2 ms (noise).
7. [x] verified: KO strip, chain (DOUBLE), wrecked, SHOWTIME via real combat (TRIPLE), slowmo short/off,
       restore on quitRace / race:end mid-cinematic; drift/boost/landing strip (session 4); final cleanup.

## Resume 21:58 (session 3)
- [x] (a) health check: KO/chain/wrecked/SHOWTIME (debug + real combat) all run in the current build.
- [x] camera hand-back: found the old rig blend froze orientation (slerpQuaternions aliasing; sim fixed it 22:20
      and now hard-cuts > 90° / 12 m). KO orbit now drifts OUT to the side (30°→58°) instead of in front of the
      victim; release = cut back to chase + whoosh (pulse.whoosh speed lines/edge blur, chroma punch,
      cam:kick +7° FOV); subject-masked burst off on the first handed-back frame, comic look gone in 0.14 s.
      (Tried an fx-side fly-home arc first: a 130° whip in 0.27 s read worse than the cut; removed.)
- [x] (b) sandbox KO replay: KoCine now depends on a narrow CineHost, so sandbox/fx.replay.ts drives the REAL
      cinematic (real Clock + EventBus, mini rig, tumbling stand-ins): kinds ko/chain/short/wrecked/ult/lite.
- [x] (c) drift/boost/landing frame strip in game, (d) final cleanup (dead code, sizes, tsc) — see session 4.

## Session 4 (resume 00:30) — ride strip + cleanup: DONE
- [x] Strip `node sandbox/fx.check.mjs ride` (shots/fx/ride-NN-*.png, sheet-ride.png, sheet-ride-zoom.png) showed
      weak riding FX; fixed and re-verified in game (real sim events, 0 errors):
  - drift sparks were invisible: the emitter passed `count: 1`, overriding the preset → now 3 hot streak sparks
    + an inked comic spark (reads in daylight) + a contact flare per tick in the level colour (L1 blue / L2 orange /
    L3 pink); level pop = ring + 12 sparks + 3 inked sparks + flare.
  - drift smoke read as grey rocks → white tyre-smoke puffs (`driftSmoke`) that hang by the wheel.
  - boost: the body glow washed the rider out (removed); rear flare in the boost colour + ring + wind-line gust;
    L3 boost came out orange (0.35 / 0.1 rounds to 3) → colour from the level of the drift that just ended.
  - wind lines were dots (stretch is screen-space, lines ran along the view axis) → new particle mode 5 = world
    line along the velocity (perspective-correct), placed 1.2–3 m off the rider, 3–5 m long.
  - landing dust inherited the fall speed (sank into the road, gone in 0.1 s) → horizontal speed only, puffs/ring
    keep most of the rider's speed; size scales with air time (0.4 + air).
- [x] actors request: fx no longer emits dizzy stars (actors draw 3D ones; there were two star rings).
  Also removed the fx wing-tip trail (combat's pelican.wing draws ribbons; ours was an invisible duplicate) and the
  now-unused presets `dizzy`, `wingTrail` and `BurstOpts.life`. Deleted the one-off sandbox/fx.probe.mjs.
- [x] tsc: 0 errors in src/fx + sandbox/fx.* (only a track *.wip.ts error elsewhere); largest fx file 263 lines;
  no TODO/console.log/Math.random/empty catch. Autopilot coast sample (fx.play.mjs): 60 fps, 180 calls, 0 errors.

## Files
- src/fx/index.ts (entry) · system.ts (FxSystem core) · state.ts (PostState) · grade.ts · context.ts · debug.ts
- post/{pipeline,bloom,composite,composite-glsl,composite-cast,mask,lights,glsl-common,timer}.ts (timer = GPU timer for
  `__br.fx.gpu`; mask = KO cast mask pass, composite-cast = victim / attacker / bystander look, lights = the scene's
  lights for the mask draw + the lit-white level of the cast exposure)
- particles/{atlas,atlas-shapes,atlas-shapes2,atlas-shapes3,shaders,pool,system}.ts
- presets/{kit,impacts,ground,bodies,rewards,speed,skills,index}.ts
- react/{tracker,bus,bus-combat,bus-ride,emitters,skills,species}.ts
- ko/{director,cine,cine-aim,cast,look,camera,framing,subject,rise,tester}.ts (cast = who is who for the mask + occluders) (framing = shot templates incl. SHOWTIME + picker +
  bounds confine, subject = head/body/bike sphere + SHOWTIME hero pick, cine-aim = SHOWTIME hold aim: hero + pair truck)
- sandbox/fx.{html,ts,stage.ts,replay.ts,check.mjs,cine.mjs,cine-sum.py,flow.mjs,sheet.py,grid.py,play.mjs,isolate.mjs,
  accept.mjs,warm.mjs} (accept = the critics' cinematic probe with sizes/events + contact sheet; warm = shader link check)
- particle modes: 0 billboard · 1 screen-stretched · 2 flat on the road · 3 flutter · 4 orbit anchor · 5 world line

## Event protocol (for ui/audio)
- `cine:ko start` once per KO the cinematic handles (chain = running count, so fallbacks can skip);
  `peak` once per window (+ an immediate re-peak for KOs landing after the peak); one `end` per window.
- `cine:ult start` (player SHOWTIME), `impact` (dive lands), `end` (impact window over / timeout / cancelled by a
  player WRECKED), always in that order. A player KO during the rise: `cine:ko start` at once, its `peak`/`end` come
  with the impact window (one `end` if the rise never lands). Nothing starts after `race:end` until the next race.
- fx emits `hitstop` when it calls clock.hitStop. No `cam:shake` from fx (combat/camera own shake).

## Known issues
- Victim tumble comes from actors (rider.crash); camera follows view.anchor('body').
- UI KNOCK OUT splash covers most of the frame after the peak (by design of ui unit).
- Line web over the screen while inside capybara CHILL ZONE is combat's aura wireframe (not fx).
- Drift charge on straights is slow by sim design (bends charge faster), so the ride strip tops the charge up to
  each threshold; the level/end/boost events are still the sim's own.
- Note for sim: its optional `CameraRig.chasePose` request cites fx/ko/home.ts, which no longer exists (fx cuts
  back to chase on release); fx does not need that contract.

## Core requests
- none.

## How to test
- Sandbox: /sandbox/fx.html (?gallery=1&night=1&panel=0&manual=1&replay=ko); window.fxSandbox.{fire,closeup,gallery,replay,replayInfo,step}.
- Game: /?race=coast&seed=3 then `__br.fx.testKo()`, `testKo({chainAfter:0.3})`, `testWrecked()`, `testUlt()`,
  `__br.fx.burst('hitHeavy')`, `__br.fx.bench(60)`, `__br.fx.stats()`.
- Scripts: `node sandbox/fx.check.mjs ko --variant ko|chain|wrecked`, `ult`, `real --kind swing|ult`, `bursts`, `closeups`,
  `gallery`, `speed`, `replay --variant ko|chain|short|wrecked|ult|lite` (sandbox, no race),
  `ride` (drift L1→L3, boost, hop/landing in game → shots/fx/ride-NN-*.png);
  `node sandbox/fx.play.mjs [--track coast] [--frames 1800]` autopilot sampler (shots + fx stats + errors);
  `node sandbox/fx.isolate.mjs --frames 600` one frame re-rendered with fx layers toggled (artifact attribution);
  contact sheet: `python3 sandbox/fx.sheet.py "shots/fx/ko-ko-*.png" shots/fx/sheet-ko.png 6 320`.
- Cinematic telemetry (fix round 1): `node sandbox/fx.cine.mjs --track coast|city|mountain --variant ko|edge|wrecked|chain|ult
  [--trace 1|pulse]` -> JSON (timeline, simToRelease, victim displacement, minEyeMargin, body/bike/victims in frame,
  framing id) + key frames shots/fx/cine-<track>-<variant>-<ms>.png; `python3 sandbox/fx.grid.py out.jpg cols width files...`.
  Fix round 2: variant `ultko` (KO 0.45 s into the rise), checks headClear/headTopMax (KO), heroFrac/barsMin/protocolOk
  (ult), `--trace size` (per-frame victim sizes/NDC), `--q "&rivals=cat"`; compact view: `| python3 sandbox/fx.cine-sum.py`.
  `node sandbox/fx.flow.mjs`: slowmo full/short/off rise timing + race-ended latch (PASS/FAIL per case).
  `__br.fx.stats().cine.ko.scores` lists every framing score as id+side:total(b=room penalty, o=occluder penalty).

## Fix round 1 (fixer started 2026-10-18; reviews/fx-r1-art.json score 5, fx-r1-timing.json score 6; DONE 2026-10-19: all 7 majors + 12 minors addressed)
Plan (art A#, timing T#; [x] = done + verified):
- [x] T0 KO hold: Timeline.holdAt/holdScale/holdRamp (0.1x until the peak, then 0.35x over 0.4 s): 0.37 s of sim
      to the release (was 0.18), victim moves 3.8 m during the hold; shot frames body+bike midpoint and backs off
      to fit both (createShot `fit`): body/bike in frame 90/87 % of the hold (sandbox/fx.cine.mjs, 3 tracks).
      T6: chain extend 0.3 s at the hold scale, window capped at WINDOW_MAX 1.8 s; tester stages the chained
      victim on the other side, 3.5 m further.
- [x] T2 bounds + T7 variety + A0.4/A1 occluders: ko/framing.ts pickFraming scores every framing x side (eye outside
      bounds - 0.8 m at 3 time samples, riders on the sight line / in a 40 deg cone in front of the subject with their
      drift extrapolated, attacker-side preference, never the same framing twice) over 5 KO framings (front34, worm,
      high, side, rear34) and 2 WRECKED ones (side, sideHigh); makeConfine clamps the eye each frame (swings toward
      the road at the same distance, lifts when squeezed). City edge case (victim 1 m inside the wall): rear34 on
      the free side, eye margin >= 1.87 m, victim fully visible. `__br.fx.stats().cine.ko.scores` lists the scores.
- [x] T1+A3 ult: ko/cluster.ts frames the impact point + victims (centroid, leaning to the nearest after the hit-stop)
      from behind the pelican (az 165/150 deg, long lens, distance from the cluster depth): all 3 TRIPLE-KO victims
      in frame for the whole hold (fx.cine.mjs ult: victimsInFrame 3.0). shockwave preset: 9 varied two-tone puffs
      (0.6-1.6x, vy <= 1, life <= .45) + a flat erode ground ring instead of 28 identical puffs.
- [x] T3 rise: 0.5x under the cut-in, 0.25x apex hang after it (0.95-1.4 s real), dive at 1x; dive follow locked
      (followY 60): the pelican stays in frame down to the impact.
- [x] A1 WRECKED: full comic look (ko 1) on an inverted backdrop (ink rays on deep red, burstInk), red only as an edge
      tint, zoom <= .02, side/sideHigh chosen by the occluder test; no global red multiply.
- [x] T4/A9b flash: the 0.65 white flash at 34 ms is gone (impact frames stay crisp); T5: chroma punch now decays
      proportionally (all punches used to vanish in < 5 ms), start punch lands at 34 ms, release whoosh/punch/kick
      fire on the first handed-back frame and the whoosh share (speed.rush) bypasses the (1 - ko) mask.
- [x] A0 KO look: vertex stage measures the subject's mean graded luma (15 depth-gated taps) -> tone map centred on
      it; subject = B/W manga (ink/halftone/paper), road in front = paper screen-tone floor (depth-normal ground
      mask), everything behind (and the road past +0.4 m) = ink/deep-red band merging into the red rays; paper
      sticker rim at the burst edge; red kept only for vivid bright reds (sat > .7, r > .6). Checked coast/city/mountain.
- [x] A2 grade (fxGrade, shared by both shader stages): tint divided by its luma, half strength, applied as a split
      tone that fades out above luma .55-.9; saturation is vibrance (dull colours gain, near-whites/vivid none).
      Measured post ON vs OFF (same frame): coast pelican (236,231,214)->(246,241,222) (hue kept; was -> cream/orange),
      mountain sky (157,101,146)->(160,94,145) b/r .93->.91 (was crimson b/r .62), mountain pelican (227,160,140)->
      (243,163,137). Night bloom threshold .7 -> .85 (A10).
- [x] A7: edge blur only above 1.02x top speed or in boost, chroma fringe only in boost, sparse lines (.15) at top speed.
- [x] A9: hit glow 0.55 m soft blob -> 0.3 m, 0.05 s.
- [x] A4: atlas 5x5 -> 6x6 with 4 new sprites (atlas-shapes3.ts): `shock` (9 jagged tapering inked segments whose
      alpha cores make erode shorten them), `hex` shield, `plus` heal glyph, `glint` 4-point needle star. ring()/groundRing
      use `shock`; block = hexagon flash; heal = rising '+' glyphs (+ a heart); sparkle = glints; boost = flat shock ring
      at the rear wheel + backward spike cone (no hoop round the torso); driftPop = flat ring + ground star.
- [x] A5 landing: shock ring + crescent of 7 two-tone lead puffs (0.6-1.4x, rear 220 deg of travel) + 6 grit bits.
- [x] A6 wind lines: corridor 2.5-3.6 m either side of the rider, +-2.5 m along it, 0.3-2.4 m high, 1.6-2.4 m long (were
      up to 8 m ahead, 3-5 m long, across rivals and the sky). Not done: per-rider proximity skip (lines never cross the
      rider's own lane any more).
- [x] A8 drift: per tick 3/4/5 hot streaks (L3 fatter), 0-1/2/3 inked sparks at .22/.30/.38 m, flat ground star in the
      level colour instead of the soft glow, zap arcs at L3 (~every 80 ms). Not done: second (front) wheel emitter.
- [x] Request combat: pelican.torpedo hit = hitHeavy x1.5 + scales x1.6 (stun stars are drawn by actors). Pre-warm of the
      USE_FOG+USE_SHADOWMAP material: not an fx material (fx particles/post use neither), left to combat/actors.
- Checks after the round: tsc clean for src/fx + sandbox/fx.*; fx.check.mjs bursts/ride/closeups/replay 0 errors;
  fx.play.mjs mountain 60 fps, 0 errors; post 0.61 ms normal / 1.39 ms during a KO at 1080p (bench, shared machine).

Cross-unit notes (fix round 1, from the critics):
- ui-hud: KNOCK OUT / WRECKED splashes cover ~85 % of the cinematic from the peak to the release and outlive the short
  variant; please make them a band <= 40 % of the frame off the centre (cine focus) and close on `cine:ko end`.
- combat: the SHOWTIME impact's translucent red cylinder + beam reads as a debug volume; an inked ground ring + short
  flash would match fx's new flat shock ring.
- env-city: wet-road reflections are high-frequency stripes (fx now renders the road as a screen-tone floor in KOs).
- track: looks.ts grade tints are now applied luminance-neutral at half strength on shadows/mid-tones only; re-tune
  against the new operator if a track needs more colour.

## Fix round 2 (fixer 2026-10-19; reviews/fx-r2-art.json score 7, fx-r2-timing.json score 7; DONE: all 5 majors + 15 minors)
Plan (art A#, timing T#; [x] = done + verified, [ ] = open):
- [x] T1 KO during the SHOWTIME rise: director.holdForImpact announces it (cine:ko start, 0.05 s hit-stop, flash),
      the rise keeps going and the impact window peaks/ends it (chain = held count); a player WRECKED still cancels
      the rise (one cine:ult end) and a late ult:impact without an open rise only bursts. ultko.mjs: start 17 ->
      KO start 467 -> impact 1883 -> peak 2383 -> end 3350 -> cine:ult end 3683, rise + 'ult' layer kept.
- [x] T8 race-ended latch (director.ended, cleared on attach): no new KO / rise / impact window after race:end.
- [x] T7 slowmo 'short' shortens the rise (rise.ts BEATS: full 0.28x until 1.35 s, short 0.75x, off 1x).
- [x] T0+A3 SHOWTIME impact: KoCine `continued` (cutNow) keeps bars + comic look on from the impact frame (barsMin 1.0
      impact -> release); new post field cine.behindAt = farthest victim depth + 2 m (every victim B/W, none melts into
      the band); framings ult34 / ult34High (raised 3/4 from behind-side, az 125/135, 1.8-3 m high) frame the hero victim
      (nearest the impact) with ko/subject.ts sphere fit + bias 0.22 (hero body NDC y +0.3..+0.42, head top < 0.52, far
      victims y < 0.55), pan toward the cluster across the line of sight. coast: hero 0.24-0.28 of the frame height
      upright (0.19 lying flat mid-tumble; r2: 0.13-0.22), 2nd 0.14-0.15 (r2 0.09-0.11), 3 victims in frame 100 %.
- [x] A2+T4 KO fit: ko/subject.ts subjectSphere = head + 0.3 m, body, bike (faded out 3.5-6 m away); createShot fits it to
      FIT_NDC 0.6 - |bias| of the half-height (inside the bars) and places it at NDC y +bias (framings 0.02-0.1).
      fx.cine.mjs now asserts headClear (head top + 0.25 m < NDC 0.70 in every hold frame): coast cat / mountain shiba
      headClear 1.0, headTopMax 0.63/0.64, body + bike in frame 100 %.
- [x] A1 orange/tan victims: fxRedness (shared by both stages) keeps only TRUE reds (hue offset < ~10 deg) and the vertex
      stage fades accent red when > 20-35 % of the subject taps are red (vKoRed). Cat (coast) and shiba (mountain) now
      read as B/W manga with ink stripes on the red rays; the pelican keeps its red helmet/bike accents.
- [x] T3 look ramps: applyLook snaps the look in at slowAt (or from frame 0 when continued) and drops ko/burst/rim/lines/
      halftone/zoom on the first handed-back frame; only bars, grain, vignette ease out.
- [x] T2 chain re-target: director.reshoot -> KoCine.reshoot cuts to a freshly picked framing (avoid = current) when a
      chain KO moves the window onto another victim; KO shots read live view anchors (director.anchors, one scratch set
      per rider) instead of the 1-frame-late tracker. chain: rear34 -> cut to 'high' at 300 ms with the new victim at NDC
      (0.05, 0.22) on the cut frame (r2: entered at x 2.83, centred by 550 ms). Particles VS: sprites shrink away within
      1.2-2.5 m of the lens, billboards capped at 35 % of the screen height (POWs no longer fill the lens).
- [x] A6b city wall edge: fxRim also rims subject pixels next to a 0.7-3 m depth drop (dark victim on a dark wall keeps
      its paper outline). Framing picker: angular-overlap occluder test with a second sight line to the face (a high eye
      looks over a rider beside the victim) + trace of room/occluder penalties; city edge now picks 'high' over the
      attacker (front34 behind the pelican was chosen with the new fit distance).
- [x] A9 plain top speed: gameplay speed lines map their inner radius by sqrt(amount) from 0.8 (0.15 -> ~0.73, 0.4 ->
      ~0.64): a few thin lines in the outer band at top speed; KO lines keep the old mapping.
- [x] A8 hand-back clutter: Particles.cull(fromReal) (uCull uniform): on the first chase frame KoCine fades (0.1 s) every
      particle born since 0.06 s before the window (final blow burst, KO debris, fur, smoke, WRECKED smoke).
- [x] A4 impact rays: FRAME.rays redrawn as 18 thin flat ink strokes with a white keyline starting at 45 % of the radius
      (clear centre); hit 1.0 m / heavy 1.1 m (cap 1.2) / koPow 1.6 m cap, life 0.08 s; a lethal blow uses `hitKo`
      (heavy burst without lines, koPow brings its own).
- [x] A5 sprites: groundRing = 7 fat inked dashes flying out from r0 >= 0.45 m to <= 1.6 m, shortening to nothing, over
      a faint additive dust haze (landing, splash, boost, driftPop); block = pale cracked hexagon face (0.12 s) that
      shatters into 6 inked shards (new FRAME.shard); glints = thin 4-point needles living 0.1-0.15 s, staggered;
      sparkle drops its ring (its eroding segments were the 'yellow splats'); shock sprite segments thinner.
- [x] A6 wind lines: mode 5 has a constant ~2.5 px screen width with alpha tapering to both ends; streaks spawn 4-5.5 m
      to the side or 2-3 m up, additive grey 0.55-0.7 (no pale-blue planks), boost gust 6 lines.
- [x] T5 release after the apex: Timeline.apexWait (KO 0.18 s, WRECKED 0.12 s, capped by WINDOW_MAX): the release waits
      until the victim's body comes down (coast/city KO release 1.40 s, sim 0.36 s; r2 0.338). WRECKED holdAt 0.2 /
      holdScale 0.65 / holdRamp 0.25: 0.43 s of sim before the release (r2 0.278), the pelican leaves the bike, flies and
      tumbles on camera; the first chase frame is clean (debris cull).
- [x] T6 apex hang + A7 rise look: rise BEATS full = 0.28x until 1.35 s (the end of the climb plays after the 1 s
      cut-in), then 1x for hang + dive (impact 1.87 s, r2 1.72); shot = front 3/4 turning to the side (orbit 34 deg/s),
      delay 0.8 s then pushes in 6.2 -> 4.3 m, FOV 58 -> 50: pelican ~35-40 % of the frame height; follows the LIVE body
      anchor with snap follow (the 1-frame tracker lag + damping put the dive under the bar): centred down to the impact.
      Rise look in full colour (no 0.25 comic blend): bars, vignette, grain .15, white speed lines toward the pelican
      (new cine.heroLines, composite centres the lines on cine.focus).
- [x] track note `ReferenceError: ring is not defined` (presets/speed.ts:142): not reproducible, the boost preset uses
      groundRing; bursts / ride / closeups / replay / autopilot runs: 0 errors.
- Checks after the round (all 0 __br.errors): fx.cine.mjs ko (coast/city/mountain, cat, shiba, edge) headClear 1.0,
  headTopMax <= 0.64, body/bike in frame 100 %; ult (3 tracks) victimsInFrame 3, barsMin 1.0, hero 0.24-0.29 upright
  (min 0.19 mid-tumble), protocolOk; ultko protocolOk with the rise kept; chain clean cut; wrecked sim 0.43 s.
  New sandbox/fx.flow.mjs: full impact 1867 ms, short 1183 ms (0.75x), off 917 ms (no 'ult' layer), race:end mid-rise
  -> no impact window: PASS. fx.check.mjs bursts/ride/closeups/replay(ko,ult,chain) 0 errors; fx.play.mjs coast 60 fps,
  202 calls, 0 errors; post 0.38 ms at 1080p (bench, best of 3). tsc: src/fx + sandbox/fx.* clean.

Cross-unit notes (fix round 2):
- combat: the SHOWTIME ribbon/beam (translucent red) still crosses the impact hold as a large red slab (true red, so the
  KO look keeps it as an accent); please hide it while `cine:ult` runs (start -> end) or replace it with an inked
  ground ring + a 2-frame flash.
- ui-hud: the SHOWTIME hold now frames the hero victim at NDC y +0.3..+0.45 and every victim above y -0.2 (cine.focus is
  published in post.cine.focus); the TRIPLE KNOCK OUT band fits below NDC y -0.15. KO holds keep the head below NDC 0.64.
- ui-hud / audio: a player KO during the SHOWTIME rise now sends `cine:ko start` at once (chain = held count) and its
  peak + end come from the impact window (or one `end` if the rise is cancelled); `cine:ult` is always start -> impact
  -> end, and no cinematic starts after `race:end` until the next race.
- env-city: wet-road reflections still read as vertical stripes in chase view at night (unchanged, not fx).

## Acceptance round 1 (fixer 2026-10-19; reviews/game-r1-*.json, owner fx: 2 majors + 5 minors; DONE: all 7)
- [x] M1 (e2e major + aesthetic minors 'bystanders crowd' / 'WRECKED pink cut-out' + feel minor 'white clump'): the KO
      look now knows WHO is who. post/mask.ts draws the cast (ko/cast.ts: victims, attacker, every other rider + the
      race:traffic / race:police groups as bystanders) with a role id + view depth into an RG16F target (layer 30 +
      override material, layers/culling restored right after; only while the comic look is on). post/composite-cast.ts:
      victim = spot colour (white-balanced against the track's sun + sky light, grade.wb; saturated parts keep their
      colour, near-neutral parts go to clean 3-tone paper/grey/ink so sunset / neon light never tints white plumage;
      lifted up to 1.8x when dark) inside a 4 px paper sticker rim + ink line; attacker muted (50 % colour, x0.78);
      bystanders and vehicles = 30-55 % ink ghosts over the burst; riders between the lens and a victim are skipped for
      the frame (fillOccluders; the SHOWTIME pelican is kept); MSAA fringe pixels adopt their neighbour's role; floor =
      dark ink-red screen tone; WRECKED red edges never touch the victim; the shot keeps 2.15 m from the victim's head /
      body / bike (actors fade a crashed rider within 1.9 m). Without a cast (sandbox) the old depth look stays.
      Checked (sandbox/fx.accept.mjs = the critics' probe + sizes/events): coast capybara/goose/sloth, city cat + seagull,
      mountain shiba, chain, WRECKED: victim in colour with a rim, bystanders dark, traffic dark; city seagull p90 paper
      (246,244,239); WRECKED pelican paper white (247,245,240) at 250/500/750 ms with &stub=ui (the remaining pink in
      game is ui-hud's red overlay, see Requests). Debug: __br.fx.toggles.castView (ghost red / victim green / attacker blue).
- [x] M2 (aesthetic major + feel minor) SHOWTIME: framing.ultOverShoulder = eye 2.4 m behind the impact and 1.3 m to the
      side, ~1.1 m up, FOV fitted so the hero victim's sphere fills 45 % of the half-height (bias 0.15), pan 0 (hero
      centred), hero bike leaves the fit from 1 m; preferred (bonus) over ult34/ult34High, which stay for a hero < 3 m
      from the impact. Victims stand against the rays, the pelican is a muted foreground edge; shockwave clouds burst out
      to both sides of the travel direction. Rise: 0.28x under the cut-in until 1.0 s, then the near-static top rushes at
      1.6x until 0.6 s of skill sim time, dive at 1x: impact 1.48 s (was 1.87), static apex ~0.29 s.
      fx.cine.mjs ult: hero 0.26-0.35 of the frame height for the whole hold (x ~ -0.05), 2nd victim 0.18-0.24 at the
      impact, barsMin 1, protocolOk; critics' scenario: hero 0.26-0.29, 2nd 0.27-0.39. fx.flow.mjs: full 1483 ms (rush
      1.6x), short 1183, off 917, race-ended latch PASS (full criterion now 1350-1700 ms + rush).
- [x] m3 traffic in the framing: director.vehicles() adds active solid session.obstacles within 30 m (centre at half
      height, radius max(halfWidth, min(halfLength, 2.5), height/2), velocity along the tangent) to pickFraming's
      occluders; framing.blocks() takes a per-occluder radius (riders keep 0.7 m).
- [x] m4 FULL timeline: holdAt 0.45 -> 0.75 (0.1x from ~0.2 s through the peak + splash slam), holdScale 0.4 over 0.3 s,
      release 1.3 s (+ apexWait). fx.cine.mjs ko (coast/city/mountain): scale 0.1 at +0.3/+0.5 s, 0.18 at +0.8, 0.4 at
      +1.1; simToRelease 0.357 s, victim displacement 3.5-3.85 m, headClear 1, body/bike in frame 100 %. Not the full
      1.1 s at 0.1x: that leaves ~0.11 s of sim and the victim never leaves the bike on camera (fx timing critic r1).
- [x] m5 peak wash: zoom pulse at the peak 0.06 -> 0.03 (the radial smear) + a 2-frame 0.3 white flash on the first peak;
      the B/W wash itself is gone with M1.
- [x] m6 GO-frame compiles: ParticlePool.warm() draws both (parked) pools for 2 frames after attach; the pipeline renders
      the cast mask once in the intro (5 variants). sandbox/fx.warm.mjs coast + city high: fx.particles / fx.subjectMask
      link in the intro, nothing fx links at GO / first KO / WRECKED (fxLate 0).
- Checks after the round: tsc clean for src/fx + sandbox/fx.*; fx.check.mjs bursts / ride / replay ko|ult|chain|wrecked
  0 errors; fx.play.mjs mountain 60 fps, 216 calls, 0 errors; post at 1080p 0.39 ms plain / 1.46 ms during a KO hold
  (mask pass + cast taps included; budget 3 ms). Files: post/mask.ts 136, post/composite-cast.ts ~110, ko/cast.ts 41,
  ko/cine.ts 393 (split before it grows further), sandbox/fx.accept.mjs + fx.warm.mjs new.

Requests (acceptance round 1):
- ui-hud: the WRECKED splash brings a full-screen red overlay (~28 %; letterbox bars (11,11,15) -> (72,15,19)) that turns
  the white pelican pink for the whole hold (the aesthetic critic's 'pale-pink cut-out'); fx renders it paper white.
  Please keep that tint to the screen edges (or drop it while cine:ko kind=wrecked runs).
- combat: the SHOWTIME translucent red ring / beam crosses the victims for ~0.2 s after the impact and tints them red
  (transparent, so the cast colours show it); please hide it while cine:ult runs or make it an inked ground ring.
- actors: stun stars are small in the SHOWTIME hold (critic: 'scale up the stun stars so the chain reads'); and the
  near-camera fade of a crashed rider uses min(body, bike) distance, so a bike 1.9 m from a cinematic camera fades the
  whole body (fx now keeps 2.15 m from head/body/bike, but a dedicated cinematic exemption would be safer).

## r3 polish (2026-10-25) — reviews game-r2-aesthetic #0 #3, game-r2-e2e #3, game-r2-feel #2 #3, game-r2-perf #0, reduced motion
Probes + frames in shots/r3-fx/ (ult.mjs, tone.mjs, occl.mjs, sparks.mjs, reduced.mjs, warmcost.mjs, bench.mjs).
- [x] perf/feel: first KO compiled 4-9 programs mid-race. The mask warm-up never ran (core's warm-up frames skip rendering, the
      director's one-frame cast was gone by core's draw-everything frame) and the mask draw (camera.layers = 30) dropped the
      lights, so the next shadow pass compiled zero-light depth variants. Now pipeline.warm(cast) draws the whole race cast (every
      view + traffic + police) into the mask in core's draw-everything frame (no core edit needed), and SubjectMask.render puts the
      scene lights (post/lights.ts SceneLights) on layer 30 with shadowMap auto-update off for the draw. actors-programs.mjs high,
      after GO: coast/city/mountain 11 -> 0 fx / depth programs (KO, WRECKED); fx.warm.mjs (+ a real SHOWTIME, exits 1 on any
      late program): late 0 on 3 tracks high + coast low/medium. Cost: hidden warm-up frame +~70 ms (coast 668 -> 738 ms).
      The latest actors-programs run shows 4 late programs, all combat skill visuals (see Requests).
- [x] e2e: SHOWTIME subject = a rider the impact knocked out (combat zeroes their HP before ult:impact), nearest the impact;
      nearest hit rider only if nobody was KO'd (KoCine re-targets with a cut if a KO arrives for a hit-only hero). cine:ko start
      names each KO'd rider, peak / end the shot's KO'd subject. fx.cine.mjs ult / ultko (new subjectKod, namesKod): 1 / true on
      coast, city, mountain. Tester ult zeroes HP before ult:impact like combat.
- [x] e2e: near-neutral victims keep their own lightness: 4 clean tones (ink, dark grey, light grey, paper) instead of the paper-
      biased 3-tone map, and the exposure lift comes from the light level (grade.litWhite: strongest directional + hemisphere
      from the live scene lights, so tunnels count) instead of the victim's own mean luma (that lifted a grey pigeon to white).
      tone.mjs coast pigeon median luma 238 -> 116 (paper share 0.59 -> 0.04), goose / seagull keep paper (p90 245-247);
      city night goose still white (p90 236), pigeon grey (p50 84). The 25-tap victim loop in the vertex stage is gone.
- [x] aesthetic #0: SHOWTIME hold. Framings lower (ult34 1.3-1.5 m, ult34High 2.2-2.4 m), bias 0.22 -> 0.08-0.1 (hero just above the
      middle, clear of the KO splash band below NDC -0.2), heightFollow 0.5-0.6 (the eye climbs with a flung hero), hero fit drops
      its bike from 0.4 m; the centroid pan is replaced by a truck toward the victim nearest the hero (<= 8 m, hero kept within 0.3
      NDC of the centre; ko/cine-aim.ts) and the picker penalises framings that would leave that victim out (pairMiss); other
      victims count as occluders of the hero. Critics' city scenario: hero 0.23-0.26 at NDC y 0.19-0.23 (others 0.45-0.84) ->
      0.28-0.36 at y 0.05 (others 0.23-0.5); KO'd pigeon probe 0.15 at y 0.47-0.66 -> 0.26-0.31 at y 0.09-0.19; fx.cine ult heroFrac
      0.33-0.35 on 3 tracks. Not done literally: "pair on the lower third" (the KO splash band covers the lower 40 % after the peak).
- [x] aesthetic #3: fillOccluders also skips traffic / police in front of a victim (instanced per type: the race:traffic group steps
      aside for the frame; long vehicles by their near end). occl.mjs (car parked on the sight line, city): victim px 0 / 0 / 1759
      -> 44835 / 40069 / 33582. KO framings follow the flung body (followY 11, heightFollow 0.5) and the KO fit drops the bike from
      2 m (was 3.5): fx.cine ko coast/city/mountain + city edge/chain/wrecked body/bike in frame 1, headClear 1, headTop <= 0.59.
- [x] feel #2: drift sparks per level (presets/speed.ts FAN): L1 small blue, L2 bigger orange, L3 large pink + glow pool on the road +
      flame jet; longer, not fatter streaks; driftPop adds a camera-facing burst ring (grows per level), new driftRelease ring on
      the drift boost; rivals' fans at 0.6. sparks.mjs 1080p coloured px L1 715 -> 1679, L2 2949 -> 8492, L3 1369 -> 6726, release
      6258 -> 20421. Particles: player L3 add 43 -> 80 alive; all 8 riders drifting L3: 140 solid / 469 add (caps 2000 / 1000);
      scene-pass GPU with vs without particles within noise.
- [x] reduced motion (state.ts REDUCED): no impact frames (as before), flashes x0.35, chroma punches x0.35 and fringes x0.5, hurt
      pulse x0.6, whoosh x0.5, cam:kick 7 -> 2.5 deg, zoom blur x0.35 and no start / peak pulses, speed lines re-randomise at 4 Hz
      (18), static grain, KO / WRECKED / SHOWTIME look eases in / out over 0.16 s. reduced.mjs (KO + real SHOWTIME, 640x360):
      largest frame-to-frame luma jump KO 155.6 -> 50.1 (the camera cut into the shot), SHOWTIME 146.6 -> 29.9; 0 inverted frames.
      Bug found on the way: the look's fades started at tl.releaseAt while the release still waited for the apex (bars / grain
      dipped, then snapped back); they now start at the actual release.
- Checks: tsc clean for src/fx + sandbox/fx.*; fx.check bursts / ride / replay ko|ult|chain|wrecked|lite / real swing|ult /
  closeups / gallery 0 errors; fx.flow all pass; fx.accept coast ko|wrecked|chain|ult + city ko (cat) | ult 0 errors; fx.play city /
  mountain 60 fps 0 errors; core-check OK; post at 1080p 0.08-0.2 ms riding, 0.43-0.54 ms in a KO hold (old mask 0.97 in the same
  probe). Sandbox scripts take FX_OUT=<dir> for their frames.
- Requests: combat — 4 programs still link after GO at the first pigeon / shiba / penguin skill (combat MeshBasicMaterial +
  ShaderMaterial meshes under the 'combat' group; tools/actors-programs.mjs lists them): please pre-warm them at race build.
