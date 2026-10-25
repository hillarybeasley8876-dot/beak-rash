# w3-fx — effects for the r4 mechanics + weather particles (fx unit)

## Plan
1. New atlas sprites (police cap, fish, watermelon, fruit, duck) — `src/fx/particles/atlas-shapes4.ts`,
   FRAME 31..35 in `src/fx/particles/atlas.ts`.
   Verify: `node tools/r4/tsc-own.mjs src/fx/` → TSC-OWN OK.
2. New presets (trickTrail, trickLand, parry, throwTrail, policeDown, fishSplash, truckDust, gooseFeathers,
   fruit, quack) — `src/fx/presets/r4.ts`, registered in `src/fx/presets/index.ts`.
   Verify: `node tools/r4/tsc-own.mjs src/fx/` + `node shots/r4-w3-fx/probe-presets.mjs`.
3. Reactions — `src/fx/react/r4.ts` (trick land/fail, parry, throw, keyboard crit, police down/hurt,
   race:event, traffic:honk, npc:say, secret:found) + `src/fx/react/tricks.ts` (the trick trail).
   Verify: `node tools/r4/w3-fx.mjs` → the 6 burst checks + the trail check PASS.
4. Weather layer — `src/fx/weather.ts`: one instanced layer named `fx:weather` (userData.kind rain|snow),
   camera-relative, quality-scaled, hidden for clear/fog/dusk and outside a race.
   Verify: `node tools/r4/w3-fx.mjs` → the 4 weather checks PASS.
5. Warm-up — the weather program links behind the loading screen; `sandbox/fx.warm.mjs` now samples the
   renderer's program list every animation frame (it used to miss everything the manual stepper drew), fires
   the new presets and runs a rainy race.
   Verify: `node sandbox/fx.warm.mjs` → exit 0, `late: 0`.
6. Contact sheet of every new preset + rain + snow at 1920×1080 → `shots/r4-w3-fx/`.
7. Full acceptance: `node tools/r4/tsc-own.mjs src/fx/`, `node tools/r4/w3-fx.mjs`, `node sandbox/fx.warm.mjs`,
   `node tools/core-check.mjs`.

## Done
- 5 new atlas sprites (cap, fish, melon, fruit, duck) + the 10 new presets, all registered in `PRESETS`.
- `src/fx/react/r4.ts`: every r4 reaction (trick land/fail, parry, throw, keyboard crit, police down/hurt,
  fishSpill, goose flock, the goose honk, the stall owner's shout, the easter eggs).
- `src/fx/react/tricks.ts`: the trick trail. The sim clears `RiderState.trick` in the same frame the rider
  goes airborne (`startAir('external')` → `resetTrick`), so a frame-synced poll of `rider.trick` can never
  see a trick. The emitter watches the `trick` property instead (it restores the plain property on detach)
  and keeps the trail alive for the trick's own duration.
- `src/fx/weather.ts`: the `fx:weather` layer — one instanced draw call, the drops placed and wrapped in the
  shader around the camera, rain = fast slanted streaks, snow = slow drifting flakes, quality-scaled
  (low = ⅓ of high), reduced motion = half the drops at 60 % speed, hidden for clear/fog/dusk and outside
  a race (the GPU resources stay, so the program stays warm for the next race).
- `sandbox/fx.warm.mjs`: the check now samples the program list every animation frame and the phase tag is
  sampled before it changes, so the loading screen's programs are never counted as late. It also fires the
  ten new presets and runs a rainy race (and fails if that race has no visible weather layer).
- `sandbox/fx.ts`: the sandbox now exposes `stage` (so a probe can move the camera).
- Contact sheet: `shots/r4-w3-fx/presets.jpg` (10 presets), `shots/r4-w3-fx/weather.jpg` (rain + snow),
  plus the raw 1920×1080 PNGs next to them.

## In progress / next
- Nothing left in this job; the acceptance is green apart from another unit's broken module (see Requests).

## How to test (exact commands)
```
node tools/r4/tsc-own.mjs src/fx/     # TSC-OWN OK
node tools/r4/w3-fx.mjs               # w3-fx OK
node sandbox/fx.warm.mjs              # exit 0
node tools/core-check.mjs              # core-check OK
node shots/r4-w3-fx/probe-presets.mjs # every new preset spawns particles
node shots/r4-w3-fx/probe-weather-perf.mjs  # the weather layer's cost at 1920×1080
```

## Evidence (key output lines)
```
$ node tools/r4/tsc-own.mjs src/fx/
TSC-OWN OK

$ node tools/r4/w3-fx.mjs
PASS new fx presets exist (missing: none)
PASS rider:trick land → a burst of particles (+16)
PASS combat:parry → a burst of particles (+48)
PASS police:down → a burst of particles (+13)
PASS race:event fishSpill start → a burst of particles (+41)
PASS race:event geese start → a burst of particles (+13)
PASS secret:found → a burst of particles (+13)
PASS a running trick leaves a trail (+16)
PASS coast clear: no falling weather particles ({"visible":false,"kind":""})
PASS coast rain: an fx:weather layer of kind rain ({"visible":true,"kind":"rain"})
PASS mountain snow: an fx:weather layer of kind snow ({"visible":true,"kind":"snow"})
PASS coast fog: no falling weather particles ({"visible":false,"kind":""})
w3-fx OK                                  (run three times, the same numbers every time)

$ node sandbox/fx.warm.mjs
{"track":"coast","quality":"high","layer":{"visible":true,"kind":"rain"},"late":0,"fxLate":0,"errors":[]}
exit=0

$ node tools/core-check.mjs
core-check OK

$ node shots/r4-w3-fx/probe-weather-perf.mjs      # 1920×1080, best of 5×150 frames
rain {"before":{"kind":"rain","count":3000,...},"up":4.795,"down":4.993,"cost":-0.198}
snow {"before":{"kind":"snow","count":2400,...},"up":3.031,"down":2.751,"cost":0.28}
(the rain cost is inside the measurement noise; the snow is 0.28 ms — both under the 0.4 ms budget)

$ node shots/r4-w3-fx/probe-trick.mjs
hand-set trick: {"before":null,"set":{"kind":"spin","t":0.1,"dur":0.55,"dir":1},"after1":null}
(the sim clears RiderState.trick in the frame the rider takes off — the reason the trail watches the property)
```

## Known issues
- The trick trail needs the `RiderState.trick` property to be watched (see Done): a poll from the fx frame
  loop misses every trick, because the sim resets the trick in the frame the rider takes off.
- The weather layer keeps its GPU resources between races (it only stops drawing) so that its program stays
  warm; a race that starts with rain never compiles a shader mid-race.
- A real spin cannot be started on the flat coast start line (a hop gives less air than a spin needs), so the
  real trick path was not exercised end to end; the trail's real path is the same property write the sim
  does in `startTrick`.
- The optional dust layer for the gobi in fog was not built (the brief marks it optional).

## Requests
- (none open.) Two other units' modules broke briefly while I worked (`ui`: a missing `weatherChip` export and
  a wrong `r4.css` path; `audio`: a duplicated `level` in `src/audio/watcher.ts`). Both made every
  `noErrors` check fail until the other worker fixed them — with the audio unit stubbed, a 600-frame race
  runs with no console error at all (`shots/r4-w3-fx/probe-errors.mjs`). Nothing outside this job's paths was
  touched.
