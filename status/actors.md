# actors — status

## Milestones
- M1 kit ✅ `kit/sdf.ts` (primitives, smooth CSG), `kit/mesher.ts` (surface nets + Newton projection, gradient
  normals), `kit/decimate.ts` (QEM half-edge collapse, colour-border penalty), `kit/tube.ts`, `kit/shapes.ts`,
  `kit/builder.ts` (ONE skinned geometry per species: colour, skin weights, aOutline), `kit/outline.ts`
  (skinned inverted hull, per-vertex width, distance-compensated), `kit/face.ts`, `kit/gear.ts`, `kit/wing.ts`,
  `kit/limbs.ts`, `kit/mammal.ts`, `kit/bird.ts`, `kit/ears-tails.ts`, `kit/props.ts`.
- M2 rig ✅ `rig/skeleton.ts` (34 shared bones), `rig/pose-state.ts`, `rig/ik.ts`, `rig/limb-ik.ts`, `rig/ride.ts`
  (saddle, bob/rock, standing, tuck, counter-lean, head look, wings→grips, legs→pedals + ankling, limb auto-fit,
  pelvis pulled toward pedals so legs never overstretch; corgi feet paddle the air), `rig/face.ts`.
- M3 ✅ `view.ts` (RiderViewImpl), `registry.ts` (glance targets), `preload.ts`, `fallback-bike.ts` (used only if
  createBike throws). M4 ✅ `rig/cues.ts` + `rig/cue-types.ts`, `weapons/*` (8 weapons), `local-fx.ts`, `extras.ts`.
- M5 ✅ `rig/tumble-body.ts`, `crash.ts` (body/bike/helmet rigid bodies on the live-pose ground plane).
- M6 ✅ species: pelican (hero), goose, capybara, cat, shiba, pigeon, penguin, seagull, sloth, corgi.
- M7 ✅ polish/perf: body budgets raised for close-ups, goggles/eyes/paws trimmed, turntable, checks.

## Done (verified)
- Tris (high): pelican 8.2k, rivals 5.7–6.8k; low quality ≈ 0.64× body budgets. 2 draw calls per rider
  (+ weapon 2, smear/stars when active). 10-rider gallery incl. bikes = 62 draw calls. View update ≈ 0.013 ms.
- `node tools/actors-check.mjs`: 10 species × 7 bikes, ankle/grip IK error 0.0 cm (corgi short by design).
- Pelican cues/skills sheet + rival skill sheet + crash strips under `shots/actors/` (cue-sheet-pelican.png,
  skill-sheet.png, crashf-strip.png, turn-pelican.png, species-sheet.png, gal-0.png).
- Full game `/?race=coast&seed=7&traffic=1&police=1` and `&stub=world,combat,race,fx`: no errors; combat cues,
  weapons, KO tumble, WRECKED (player) tumble with fx slow-mo all run.

## Known issues / ideas for wave 2
- Mammals ride fairly upright with long arms (cartoon-animal look); could lean further over the bars.
- Capybara/sloth sleepy lids hide most of the pupil; wing vanes read thin edge-on in front views.
- Helmet pops off and lies where it lands; it reattaches on respawn (no pickup animation).
- Vite dev server serves a stale module after `rm`+recreate of the same path; `touch` the file fixes it.

## Core requests
- None open (toon.ts outline and the bikes stub were fixed by core). fx: dizzy stars for stunned riders are drawn
  by actors (3D stars on the head), fx can skip its own.

## How to test
- `/sandbox/actors.html` — panel: rider/bike/speed/weave/boost/time 1×/0.25×/0.1×, cues, swings, stun, ghost,
  CRASH, weapons, GALLERY, turntable. URL: `?c=pelican&bike=roadbike&speed=8&view=34|front|side|back|chase
  &dist=3.2&ty=1.1&follow=1&panel=0&ts=0.25&turntable=1&mode=gallery&quality=low`.
- `node tools/actors-check.mjs` (IK regression), `node tools/actors-poses.mjs <name> "<query>" "<js>" <frames…>`
  (js e.g. `window.__actors.action('heavy',1,0.52)`, `__actors.crash()`, `__actors.weapon('pan')`,
  `__actors.cue('skill',{skillId:'pelican.gulp'})`), `node tools/actors-probe.mjs "<url>"` (console errors).
- Game: `/?race=coast&seed=2&stub=world,combat,race,fx&traffic=0`; KO: `__br.ko(id, 0)`.
