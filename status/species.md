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

## Next
- Full lineup sheet + IK check on all bikes; fix interpenetration (bar ends through paws), polish faces.
- Idle micro-motions (rig/idle.ts), skill poses, chase view on coast, gallery.

## Known issues

## Core requests
- none

## How to test
- `/sandbox/actors.html` (see status/actors.md); sheets: `node tools/actors-sheet.mjs <out.png> [ids] [views] [query]`;
  IK: `node tools/actors-check.mjs`; bike fit: `node tools/actors-bikefit.mjs`.
