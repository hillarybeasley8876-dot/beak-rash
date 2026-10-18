# species — status (wave 2 character appeal pass; owns src/actors/** except bikes, sandbox/actors*, tools/actors-*)

## Plan
1. Baseline: per-species sheets (front/34/side/back + chase) vs portraits → shots/species/base-*.png.
2. Proportions pass (shared): bigger heads/eyes, shorter thicker limbs, rounder torsos, chunky grips;
   rig IK keeps feet on pedals (tools/actors-check.mjs) — species by species.
3. Faces & personality: brows/lids, markings, idle micro-motions (cues/face/ride).
4. Signature skill poses at 0.5x.
5. Gallery on default bikes + turntable sheets + chase view on coast; tris <= 9k each.

## Done
- (starting)

## Next
- baseline sheets

## Known issues

## Core requests
- none

## How to test
- `/sandbox/actors.html` (see status/actors.md); sheets: `node tools/actors-sheet.mjs` (to be written).
