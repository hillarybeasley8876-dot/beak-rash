# Unit: actors (rider views) — wave 1 — the hero pelican + the character kit
Read SPEC.md first (§0–2, §5 characters, §7 skills visuals, §8 victim tumble). You own `src/actors/**`
except `src/actors/bikes/**` (bikes unit; you consume `createBike` + `BikeModel` from `src/actors/bikes`).
Contract: `createRiderView(app, character, bike, opts) → RiderView` (+ optional `preload(app)`).

## Goal
Characters that look like collectible designer toys, never 火柴人. Wave 1 = the kit + the hero
PELICAN at full quality + every other species as a decent kit-built version (wave 2 polishes them).

## Deliverables
1. Kit (`actors/kit/`): smooth organic modelling (recommended: SDF primitives — ellipsoid, capsule,
   rounded cone, torus — with smooth-union, meshed by surface nets / marching cubes at load into
   indexed BufferGeometry with SDF-gradient normals and vertex colours by nearest primitive), plus
   helpers for eyes (sclera/pupil/highlight, blinking), beaks, feathers/wing shapes (extruded curves),
   fur tufts, helmets & goggles, accessories. Toon materials + outlines from `src/render/toon.ts`.
   Mesh caching per species (build once, clone per rider). Rider ≈ 900–6k tris; 8 riders total.
2. Rig + animation (procedural, no external files): hierarchy pelvis → spine → chest → neck chain →
   head (+ jaw/pouch); wings/arms (shoulder, elbow) with IK to bike grips; legs (hip, knee, ankle) with
   two-bone IK to the pedals (feet stay on pedals through the crank cycle!); tail. Pedal cadence from
   `bike.crankAngle`. Body: lean with the bike + counter-lean, bob with pedalling, standing on pedals
   when accelerating hard/uphill, tuck when boosting, look toward nearest rival/attacker.
3. Cues (`view.cue`): attack L/R (wing slap or weapon swing arc with smear trail), heavy (big overhead
   windup), hit L/R (flinch + squash), stun (dizzy stars/birds orbit), skill (per-species pose; pelican:
   torpedo spit, gulp pouch balloon inflation, wing dash spread wings), ult (pelican leaps — sim/combat
   move the rider; you pose), bell (rings bell, smug), taunt, victory, defeat, land (squash), boost.
   Weapons held in the wing (meshes for all WEAPONS in data/weapons.ts: salted fish, baguette, frying pan,
   leek, umbrella, selfie stick, mom's slipper, mechanical keyboard) via `setWeapon`.
4. Crash/KO tumble: when `state.mode === 'crashed'`, detach rider from bike: integrate a ballistic
   tumble from `state.crash` (vel, spin, origin) with ground bounces & skid, limbs flailing; bike
   cartwheels/slides separately; helmet pops off. Must look great at 0.1× time (it's the KO money shot).
   `respawning`: blink back on the bike. `anchor('body')` follows the tumbling body (camera uses it).
5. Pelican hero details per SPEC §5: S-neck, huge beak with hooked red tip, inflatable pouch, goggles,
   red helmet, black wingtips, webbed feet, expressive eyes (blink, squint when attacking, wide when hit).
6. Other species (goose, capybara, cat, shiba, pigeon, penguin, seagull, sloth, corgi): recognisable
   silhouettes + signature features (goose angry brows; capybara yuzu; cat stripes; doge shades; pigeon
   iridescent neck + head bob; penguin belly; seagull fry; sloth eye patches; corgi cap & short legs).
7. `sandbox/actors.html`: turntable gallery of all characters on bikes (orbit), a pose/cue tester and a
   slow-motion crash tester. Portrait render helper `renderPortrait(character, pose)` (optional).

## Quality bar (art + animation critics)
Close-up turntables look like a polished stylised game (smooth forms, clean outlines, appealing faces,
correct proportions), feet never slide off pedals, wings stay on the grips unless attacking, no
interpenetration with the bike, readable from the chase cam at 70 km/h, tumble is dynamic and funny.

## Test
`/sandbox/actors.html` and `/?race=coast&seed=2&stub=world,combat,race,fx&traffic=0` (real sim if it loads).
