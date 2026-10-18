# species — status (wave 2 character appeal pass; owns src/actors/** except bikes, sandbox/actors*, tools/actors-*)

## Plan
1. ✅ Baseline: sheets vs portraits → shots/species/base-sheet-{a,b}.png, portraits-main.png. Verdict: lanky
   (thin sleeve arms, tall torsos, small heads ≈ 1/5 of seated height, visible necks).
2. Proportions pass, species by species (pelican first): head ≈ 1/3 seated height (bigger head, bigger eyes),
   torso shorter/rounder and hunched forward so shoulders sit closer to the grips (shorter arms), thick limbs,
   chunky paws/wing-fists on the grips, big feet; body bottom hides the upper thigh. IK check after each.
3. Faces: brows/lids/mouths per species (goose angry, capy zen, cat smug :3, doge side-eye, pigeon blank,
   penguin cool, seagull shifty, sloth smile, corgi stern), blush/markings.
4. Idle micro-motions: tail swish (cat) / wag (doge), corgi ear flop, capybara yuzu wobble, sloth slow blinks,
   pigeon head-bob (exists) — new rig/idle.ts.
5. Skill poses at 0.5× (sheet per species).
6. Sandbox `bike=default` (roster default bike per species); turntable sheets (front/34/side/back), chase on
   coast; tris ≤ 9k each; perf unchanged.

Bike fit (character space, saddle origin): grips roadbike (±0.16, 0.04, −0.535) · erba (±0.23, 0.12, −0.41) ·
shared (±0.23, 0.14, −0.40) · fixie (±0.17, 0.035, −0.57) · mtb (±0.255, 0.08, −0.46) · kidbike (±0.16, 0.12,
−0.22) · tandem (±0.21, 0.08, −0.50). Crank centre ≈ (y −0.49…−0.55, z −0.06…−0.11); kidbike (−0.34, 0).

## Done
- Baseline sheets + bikefit numbers (tools/actors-sheet.mjs, tools/actors-bikefit.mjs, tools/actors-tris.mjs).
- New kit: `kit/paws.ts` (SDF mitten hands/feet: toes, curled feather fingers, claws, pads), `kit/wing-fold.ts`
  (feathered wing arm + secondaries + feather fist), `kit/wing-flank.ts` (folded wing shrink-wrapped onto the
  body SDF; crisp colour rows via `kit/panel.ts` grid), `kit/paint.ts` (Painter: colour/weights of a field),
  `kit/crisp.ts` (exact colour-border splitting of SDF meshes — no smeared paint), domed helmets with vents,
  round option and chin strap (`kit/gear.ts`), `extrudeSmooth(maxEdge)`, `flipWinding`. Old `kit/wing.ts` removed.
- Templates rewritten for chibi proportions: `kit/bird.ts` (fold wings / penguin flippers, flank wings),
  `kit/mammal.ts` (hunched layout, big heads, thick limbs, mittens, blush, lid colour).
- All 10 species re-authored (big heads/eyes, thick short limbs, round bodies, portrait colours/accessories).
  Face: `meta.lidTilt` slanted lids (rig/face.ts; brow cue adds to it). Fit clamps raised (arms ×1.55, legs ×1.45).
- Tris (high): pelican 8.8k, others 5.7–8.3k. Pelican IK 0.0 cm on all bikes.
- Sandbox: `bike=default` (roster default bike per species), `__actors.chunks(id)`.

- Wrap-up pass (2026-10-18):
  - [x] Lineup sheets (shots/species/line-{a,b}.png, gallery-sheet.jpg) + IK on all 10 × 7 bikes: 0.0 cm everywhere
    (corgi feet short by design). Penguin flippers now reach the roadbike/fixie hoods (arm stretch cap 1.55 → 1.85).
  - [x] Bar ends through paws fixed: `rig/bar-fit.ts` slides the hand target toward each bar style's end (flat
    +3.2 cm out, swept +1.6 out/+2.6 back, bullhorn fwd/up; drops unchanged) in steer space, so mittens swallow the
    end caps (shots/species/paws-{b,c,d}.png). Penguin fist thickened (a grey blade, likely the kid bike's brake
    lever, still shows beside the flipper in the front view: not confirmed).
  - [x] Faces: goose angry V brows clear of a re-seated bandana; capybara zen half-lid eyes visible from the front;
    sloth eternal smile on the snout surface; pelican brows below the helmet rim, "monocle" eye-ring paint removed.
  - [x] Idle micro-motions `rig/idle.ts`: cat tail swish, shiba wag, corgi stub wiggle + ear flop (ears sweep back
    with speed), capybara hat/yuzu wobble spring, sloth slow blinks (`meta.blinkTime`); pigeon head-bob kept.
  - [x] combat request: 'gulped' riders fully hidden (view.visibleFor), verified in the sandbox.
  - [x] Coast race chase view, 8-rider field (shots/species/chase-coast-{a,b}.png; 4–6 riders in frame at a time,
    all 10 in gallery-sheet.jpg back + 3/4): no errors.
  - Tris (high): pelican 8.7k, others 5.8–8.3k (≤ 9k).

## Next
- Skill-pose sheets at 0.5× skipped (wrap-up mode, integrator note).

## Known issues

## Core requests
- (fix round 2) RiderView needs the track (e.g. `attach?(session)` like the systems, or `track` in ViewOpts) so the crash
  tumble can ground each rigid body exactly (track.project + frameAt per body); today it uses the roll-free sim pose.

## How to test
- `/sandbox/actors.html` (see status/actors.md; `tx=` shifts the camera target, views `r34`/`r34b` = right side); sheets: `node tools/actors-sheet.mjs <out.png> [ids] [views] [query]`;
  IK: `node tools/actors-check.mjs`; bike fit: `node tools/actors-bikefit.mjs`.

## Fix round 1 (critics r1: art 5/10, anim 5/10) — checkpoints
Plan (majors first; [x] = done, verified):
- [x] A1 squash after IK → RidePose.squashTo(): grip/pedal targets (incl. ankle/grip offsets) divided by the mesh squash
  scale; stretchy arm IK (≤ +15 %) when a stretch pulls the grip out of reach. sandbox check() + tools/actors-check.mjs now
  measure WORLD bones and fire land/boost/respawn/ko (hands+feet) and hit/heavy/ult (feet) — 0.0/0.0 cm all 9 × 7, tol 1 cm.
- [x] A2 rig/state-cues.ts: land (air > 0.12 s, intensity by air time), boost (boostTime jump), respawn (mode), victory
  (finished, place ≤ 3) / defeat, taunt (bus 'taunt' for this rider → gesture toward the nearest rival); unsubscribed
  in dispose(). Sandbox app now has a real EventBus. Verified in the sandbox (all six fire, no errors).
- [x] A3 cues.ts: a cut-short action keeps playing as a ghost that fades out over 0.15 s (its stale clip is dropped);
  arm requests merge by w² (cue-types mergeArm/mixCue) instead of keep-strongest; hit arm flail rises over 0.11 s.
  probe-interrupt: attack→hit 53.6 → 18.9 cm, heavy→hit 31 → 2.7, gulp→hit 45 → 3.9, ult→hit 69 → 9.7, taunt→heavy
  38 → 0.8 (victory→defeat swap not fixed: a rider finishes once, StateCues never swaps them).
- [x] A4 WeaponHolder.aim(): weapon oriented in character space each frame — shouldered out-up-back while riding
  (visible from the chase cam), along the swinging hand biased outward-forward and kept low while striking (smoothed
  strike blend). Tip ↔ head ≥ 62 cm in all swings (was inside the beak); actors-check now asserts ≥ 25 cm.
  shots/species/fix1/weapons.jpg; tools/actors-tiles.mjs (weapons/skills/cues/crash sheets).
- [x] A5 crash: rig/tumble-body.ts is now a point-contact rigid body (restitution + Coulomb friction at each contact,
  inertia, settle axis); rig/support-points.ts gives mesh support points — body: per bone (re-posed every frame from the
  flailing skeleton + a depenetrate pass), bike: per bike bone (frame/wheels/bars/cranks/streamers), helmet: its own.
  Bike settles on its side (settleAxis = right; bars stop flopping once down). Ride pose unfolds into the flail over
  0.15 s, flail/settle gains damped (λ 8). probe-crash: body −0.68 → −0.003 m, bike −0.30 → +0.005 (all 10 species
  −0.018…+0.012 in the gallery); 0 limb pops > 6°/frame at 0.1× (was several 12–13°). shots/species/fix1/crash.jpg
- [x] S1 skill poses moved to rig/cue-skills.ts (+ rig/cue-math.ts): doge paw up palm-out + chin up + smug lean + shades
  glint sprite (local-fx Glint); sloth flash sprinter crouch (paw thrust forward, other swept back, eye glint); chill paws
  behind the head, eyes shut, lean back; corgi whistle + stop paw; gulp head-up + jiggle; wing dash: wings swept back 25°,
  slow flap, body tucked, and NEW spread-only primary fans (B.primL/R bones, skeleton 34 → 36; kit/wing-fold `fan`;
  pelican/goose/seagull/pigeon) that grow out of the fist and swing out swept back. Bell: right paw to the bike's bell
  marker (RideInput.bell), flick + open beak per ding, head turned back over the shoulder. Ghost: fade.ts RiderFade —
  rider + bike + weapon swap to transparent clones: pigeon ghost = cyan wisp (α 0.2), respawn = materialise from a white
  flash, invuln = soft α pulse (no hard blinking). shots/species/fix1/{skills,pel,cues}.jpg
- [x] V1 shading: kit/smooth-normals.ts (2 Laplacian passes over the 1-ring after decimation, colour-split vertices
  welded) + kit/material.ts riderMaterial (riders + weapons): same 3 band levels with soft anti-aliased edges
  (smoothstep, fwidth-aware) and a stepped cool fresnel rim (covers the minor 'no rim light' too).
  shots/species/fix1/cu-before.jpg vs cu-after.jpg
- [x] V2 pelican: spoon beak 0.17 m wide, resting pouch 0.24 m wide, gulp balloons sideways (pouch scale x 1+1.8p) with
  head up 0.32 + jiggle → pink lobes both sides of the neck in the back/chase views (shots/species/fix1/pel.jpg)
- [x] V3 kit/helmet.ts: parametric smooth shell (aero tail or round) outside the SDF budget, dark rolled rim band,
  visor lip, dark inner liner, vent slots + centre stripe as crisp decal ribbons (~600 tris rivals / ~760 hero);
  gear.ts keeps goggles + chin straps (shots/species/fix1/helmets*.jpg)
- [x] V4 pelican body 0.84 → ~0.62 m long, more upright, tail pulled in, head ×1.12 (meta.headScale, rig-level),
  tapered shins, grey wings with black primaries only; penguin legs tucked under the egg + shortLegs; NEW
  extenders.ts toy pedal-extender rods (corgi + penguin) so the stubby legs visibly drive the crank; cat/shiba
  shoulders forward/down on a hunched chest, arms thicker toward the paw → bent elbows (shots/species/fix1/
  {pel-shape,short,arms}.jpg). Tris: fan blades 5 × seg 2, beak budgets 300, mouth seg 1.
- [x] minors: pelican face (dark iris ring, highlight ×1.7, 2.2 cm angry brows lowered in front of the rim, helmet
  +1 cm, smirk gape line seated on the beak edge); corgi/penguin pedal extenders; seagull fry cream + golden tip,
  20 cm sideways; capybara raised brown nose pad + two nostril dots; goose bandana knot/tails bigger (chase cam);
  pelican wing paint; sloth greyer olive with lighter, sharper shag locks; shiba brighter orange; held weapons
  visible; crash start/rest snaps; ghost strobe → fade; respawn/invuln soft fades (outline at concave joints: only
  helped by the normal smoothing). Lineup: shots/species/fix1/line-{a,b}.jpg
- [x] also: OIIA spin tucks the feet off the pedals under the spinning body (knee poles turn with the pelvis):
  probe-spin thigh gap 1.3 → 20 cm; KO/crash body or bike the chase camera overtakes fades to α 0.12 within 1.9 m
  (cross-unit 'victim flies through the camera'); pelican 8998 tris (all ≤ 9k), rider update cost unchanged.
- Verified (fix round 1): tools/actors-check.mjs OK (world-space feet/hands 0.0/0.0 cm on all 7 bikes incl. cues,
  corgi/penguin on extenders; weapon tip ≥ 66 cm from the head); critic probes (contact, interrupt, crash 1×/0.1×,
  spin) re-run; coast race autopilot with 8 riders (shots/species/fix1/chase-sheet.jpg, chase-crops.jpg) and a KO
  cinematic (ko.jpg): 0 console errors. tsc clean for src/actors (only bikes/parts/tyre.ts errors, bikes unit).
- Known / not done: pigeon neck still two crisp bands (no gradient); swing smear still a 2-row ribbon (now follows the
  outward weapon); skill-pose sheets at 0.5× not re-shot per species (shots/species/fix1/skills.jpg covers all 12).
- How to test (new): `node tools/actors-tiles.mjs <weapons|skills|cues|crash|pelican> <out.png> [cols tw th query]`;
  `__actors.check(frames, true)` (world space + cues), `__actors.weaponClearance()`.

## Fix round 2 (critics r2: art 7/10, anim 6.5/10) — checkpoints
Plan ([x] = done + verified; majors first):
- [x] M1 anim: skill poses crushed to 0.35 s → rig/cues.ts: a non-lockout skill (combat's cast action shorter than the
  clip) lets the clip own the timing (no fromAction, covers() false, no cull/ghost when the cast action ends); sustained
  skills hold the pose at u 0.5 while the effect runs (SKILL_HOLD chill 4 s, doge 3, flash 3, ghost 1.5; ends early when
  shield / boost / invisible is gone) with a `hold` weight for hold variants: doge pushes the shades up (glint), then paw
  akimbo on the hip + glint pulses (the old raised straight arm read like a salute); chill breathing + head sway + NEW
  steam puffs (src/actors/steam.ts, CueOut.steam); ghost flutter; flash glint pulses. Spin: spread arms turn with the
  body (ride.ts), slower arm release; flash/whistle/grab rises slowed. sandbox/actors-skills.ts castSkill() = combat's
  way (cue + min(effect, 0.35 s) action + caster statuses); __actors.skill(id), __actors.skillCheck(); actors-check.mjs
  asserts each pose reads ≥ its need and hands ≤ 15 cm/frame (pelvis space): chill 3.85 s, doge 2.88, flash 2.93,
  ghost 1.47, honk 0.8, whistle 0.78, steal 0.45, torpedo 0.47; max hand 13.4 cm/frame. actors-tiles `holds` set.
- [x] M2 art: hero beak/pouch from the chase cam → NEW species/pelican-beak.ts on NEW kit/loft.ts (regular lofted grids,
  area-weighted welded normals): spoon upper mandible + red hook cap (head bone), lower mandible (jaw), and a big pear-
  shaped pouch sack (widest 0.40 m post head-scale, hanging to ~0.48 m under the face, rear weights blend head→pouch) whose
  pink lobes show on both sides of the neck below the head from the chase cam; gulp inflation retuned (1+1.05p, 1+0.5p,
  1+0.35p). view.ts soloGlance(): riding alone, every 4–7 s a 0.5–0.8 s 30–40° glance (beak + pouch clear the head);
  meta.headSway 0.09 rad once per crank turn (ride.ts). Beak is smooth now (minor 1: no SDF faceting, paint can't spill:
  the pouch is its own surface). Pelican 8984 tris (beak/pouch ~980; tuft 44, helmet liner 3×10 for everyone).
- [x] minor helmets: vents are constant-width rounded-end slots, shorter, in a deep shade of the shell colour (no black-on-
  yellow tiger stripes); capybara helmet IS the yuzu (round dimpled peel, no vents/visor, stem + leaf: props addLeafStem);
  pelican shell domed (+2.2 cm, raised 1 cm), dark centre vent slot with the tuft sprouting out of it.
- [x] minor seagull fry: two chunky golden fries (1.9 cm, bent, darker-gold ends), fanned (kit/props addFry).
- [x] minor shiba: pixel shades on the eye line, tilted 0.07 rad, temple arms to the head; coat tan #D9A35F.
- [x] minor defeat: arms dangle off the bars, slumped spine, sunk body, hanging head with a slow shake, one sigh puff.
- [x] minor hop: StateCues fires an internal 'takeoff' clip (compress → pop, chest back, head up); air flare after 0.25 s
  of air (birds spread wings a little, eyes wide), smoothed in/out (CueSystem.statusPoses).
- [x] minor weapon teleport: extras.ts hands the weapon across instead of reparenting in one frame: off-side swing →
  toss inside the wind-up (0.1 s light / 0.16 s heavy; grip slides over the bars, weapon dips forward-down through
  Q_PASS then into the new hand's pose; never through the face), riding → 0.4 s move to the side a rival rides on
  (`prefer`, view.ts). WeaponHolder.orient/gripOffset/carry/tipWorld. weaponClearance(): tip↔head ≥ 52 cm, grip ≤ 30 cm
  per non-strike frame (asserted ≤ 32 in actors-check: the penguin's long flippers move ~30 cm/frame in a heavy wind-up;
  one-frame swaps were 85–132 cm). A long weapon's TIP still sweeps up to ~0.9 m/frame through a heavy wind-up (reported).
- [x] minor swing curves: cue-math spline() (non-uniform Catmull-Rom, velocity-continuous); swing/heavy targets start
  at the wind-up and the blend weight pulls the paw there (first frame 16 cm, was 42), short anticipation hold, the
  strike is the fastest frame and carries through contact (pelican fish light: 16,16,6,5,23,8,6,9,4…; heavy:
  8,12,15,17,17,15,3,1,0,15,35,24,11…).
- [x] minor fade x-ray / outline blink: fade.ts draws a depth-only copy of every faded mesh first (renderOrder 40,
  skinned copies share the skeleton), then the transparent colour clone (41), so only the outer surface blends (no
  limbs / far wing / bike tubes through the body; pigeon ghost = clean cyan wisp); hulls fade with the same alpha (42)
  instead of toggling. Invuln pulse 0.7–0.95 (never crosses the 0.995 swap), eases to opaque over the last 0.25 s.
- [x] minor crash ground: crash.ts grounds the tumble on the road under the sim body: pose up WITHOUT roll (lean/bank
  tilted the plane: bodies sank/floated at lateral offsets), dropped by state.y while the sim body flies. Exact per-body
  road height needs the track in the view → core request below.
- [x] cross-unit KO victim near the chase cam: outside a KO cinematic (bus cine:ko start→end) a tumbling body/bike fades
  once it would cover > ~1/4 of the screen height within 3.5 m (plus the old 1.9 m rule always).
- [x] minor swing smear: NEW smear.ts (moved out of local-fx.ts): 5-column ribbon = fading inner edge, white core, thin
  red→black ink edge on the tip side; Catmull-Rom subdivided (3 rows per frame sample) so the arc curves; tail tapers
  toward the tip as it ages; life 0.1 s.
- [x] minor pelican S-neck: neck[1] 6.5 cm back, neck[2] 5 cm forward/3.5 up, whole head (face, beak, eyes, gear, tuft,
  beak anchor) +4.5 cm up / 5 cm forward via HO in species/pelican.ts; pelvis ellipsoid 9° more upright, rear body/tail
  pulled in 4 cm, flank wing tip in. IK still 0.0/0.0 cm on all 7 bikes.
- [x] minor pigeon neck: six thin stepped sheen bands grey-green → green → teal → blue-violet → purple → grey (no two-
  stripe scarf). Not done: the fresnel hue shift in riderMaterial (would need a per-vertex weight attribute).
- [x] minor sloth shag: bumps painted in the fur colour (no camo spots); 15 long thin locks (2 capsules each, lighter
  tips) spread over back, flanks and nape, hanging down-back, off the shoulder line; finer SDF cell 0.016, budget 2900.
- [~] minor extended wings: spread target raised (dihedral) and the hand droops ~20° (ride.ts); seagull steal curls the
  grabbing wing-hand forward. Still no secondaries splaying along the trailing edge (needs wing-fold geometry).
- [x] minor chill steam: steam.ts puffs while chilling (and one sigh puff on defeat).
- Not mine / not done: kid bike crank ellipse (bikes unit: penguin extenders follow the markers exactly); sim's
  "shoulders within 0.37 m" option awaits core's contact-distance decision (status/sim.md core requests).
- Verified (fix round 2): tools/actors-check.mjs (IK 0.0/0.0 cm all species × 7 bikes, corgi/penguin on extenders;
  weapon tip↔head ≥ 52 cm, grip ≤ 30 cm/non-strike frame; 12 skills cast combat-style read ≥ need, hands ≤ 14.3 cm/frame);
  in game (real combat casts via __br.combat.cast, coast): chill 4.02 s, flash 3.27, doge 3.05, ghost 1.97, honk/steal/
  whistle ≥ 1.3 (incl. taunts); KO'd bodies/bikes rest within −0.9…+0.6 cm of the road (track.project) on coast and
  mountain starts; chase-cam crops (shots/species/fix2/gc-strip.jpg): pouch lobes beside the neck at rest, beak + pouch
  clear the head in solo glances, gulp balloons. Sheets: fix2/final-a.jpg, holds.jpg, doge.jpg, gulp.jpg, props.jpg.
  Tris (high): pelican 8984, pigeon 8874, seagull 8270, goose 7802, sloth 7570, cat 7398, corgi 7284, shiba 7278, capybara
  7050, penguin 5866; view.update 0.019 ms; 0 console errors (sandbox + races). tsc clean for src/actors + sandbox/actors.
- How to test (new): `__actors.skill(id)` / `__actors.skillCheck()`; `node tools/actors-tiles.mjs holds <out.png>`;
  `__actors.weaponClearance()` → {head, grip, pop}.
