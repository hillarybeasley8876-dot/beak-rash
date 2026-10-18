# Unit: species — wave 2 — character appeal pass (all 10 riders)
Read SPEC.md (§0, §5 characters, §7 skills), status/actors.md (kit, rig, cues, how to test) and the latest
reviews/actors-*.json. You own `src/actors/species/**`, `src/actors/kit/{bird,mammal,ears-tails,props,face,gear,wing,limbs}.ts`
and `sandbox/actors*` (the actors unit is finished; its core files view.ts / rig/* / crash.ts may get small
fixes from you only when a species needs them — keep the RiderView contract and the shared skeleton).

## Goal
Make every rider look like a collectible designer-vinyl toy you would want on a shelf, consistent with
the 2D portraits in `public/assets/portraits/<id>_main.png` (open them: same colours, accessories,
attitude). Today they read correctly but lanky: long thin arms like sleeves, stretched torsos, small heads.

## Deliverables
1. Proportions: chibi-stylised — head ≈ 1/3 of the seated height (bigger heads, bigger eyes with
   highlights), shorter/thicker limbs, rounder torsos, chunky hands/paws/wing-tips on the grips, feet that
   still reach the pedals (IK must keep working — check full crank cycles). Silhouettes distinct per species
   from behind at 6 m (the chase view): pelican beak + pouch, goose neck, capybara block, cat ears + tail,
   doge curled tail, pigeon round + head-bob, penguin egg shape + flippers, seagull wings + fry, sloth shag,
   corgi ears + short legs (comically short: pedal extenders/blocks are a fine meme).
2. Faces & personality: expressive brows/lids per species (goose angry, capybara zen half-lids, cat smug,
   doge side-eye + pixel shades, pigeon blank stare, penguin cool, seagull shifty, sloth eternal smile,
   corgi stern), mouth/beak shapes, blush/markings, idle micro-motions (pigeon head-bob synced to cadence,
   sloth slow blinks, cat tail swish, doge tail wag, corgi ear flop, capybara yuzu wobble).
3. Signature poses for `skillPose` cues read clearly at 0.5× speed: honk (neck out, beak wide), chill
   (eyes closed, steam), OIIA spin (whole cat spinning on the saddle), doge shield (paw up, shades glint),
   pigeon ghost (fade), penguin belly slide (flat on the bike), seagull steal (wing grab), sloth flash
   (lightning pose), corgi whistle (whistle + stop paw), pelican torpedo/gulp (pouch balloon)/wing dash.
4. Each species on its default bike (data/roster.ts defaultBike) in the gallery; turntable sheets of all
   10 from front, 3/4, side, back + a chase-cam view on the coast track. Keep tris ≤ 9k per rider.

## Quality bar (art + anim critics)
Side by side with the portraits, they are clearly the same characters and look polished and appealing;
no lanky limbs, no interpenetration with bikes, feet on pedals, readable at speed; performance unchanged.
