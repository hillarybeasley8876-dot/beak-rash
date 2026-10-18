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
- post/{pipeline,bloom,composite,composite-glsl,glsl-common,timer}.ts (timer = GPU timer for `__br.fx.gpu`)
- particles/{atlas,atlas-shapes,atlas-shapes2,shaders,pool,system}.ts
- presets/{kit,impacts,ground,bodies,rewards,speed,skills,index}.ts
- react/{tracker,bus,bus-combat,bus-ride,emitters,skills,species}.ts
- ko/{director,cine,look,camera,rise,tester}.ts
- sandbox/fx.{html,ts,stage.ts,replay.ts,check.mjs,sheet.py,play.mjs,isolate.mjs}
- particle modes: 0 billboard · 1 screen-stretched · 2 flat on the road · 3 flutter · 4 orbit anchor · 5 world line

## Event protocol (for ui/audio)
- `cine:ko start` once per KO the cinematic handles (chain = running count, so fallbacks can skip);
  `peak` once per window (+ an immediate re-peak for KOs landing after the peak); one `end` per window.
- `cine:ult start` (player SHOWTIME), `impact` (dive lands), `end` (impact window over / timeout).
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
