# r6 job species — six meme racers get real procedural models (actors unit; SPEC §23)

The roster now has six new racers (`src/data/roster.ts`, `racer: false` until their models land). Today each one
borrows another species' body (`src/actors/species/index.ts` DEFS: bananacat/cryingcat/xinxian → cat, moodeng →
capybara, pedro → shiba, hamster → capybara). Build each its own species file in the house style.

## Lead review after round 1 (read this first when you resume)
The six pass the mechanical checks and xinxian, pedro and cryingcat look right. Three models have defects you can
see on `shots/r6-species/sheet.png` and your own close-ups (`i1.png`, `h1.png`). Fix them; keep every check green.
1. **bananacat**: the fourth peel flap (`[0, 0.60, -0.44] → [0, 0.43, -0.485]`) hangs down the MIDDLE OF THE FACE:
   from the front a yellow bar splits the face over the nose and the wailing mouth. The face must be fully visible
   from the front and the 3/4 view (both eyes, the tear streaks, the open mouth). Move that flap below the chin onto
   the chest, or drop it. The darker inner-peel capsules poke out of the side and back flaps as ragged dark slits and
   torn yellow fringes (the back view): keep the inner colour inside each flap (a smaller inset prim, or a paint prim
   on the flap's inner face) so each flap reads as one smooth peel strip.
2. **moodeng**: the helmet hovers above the skull. In the 3/4 view there is sky between the helmet rim and the head,
   and the strap ends stick out. Seat it on the skull like the capybara's helmet (no gap from any view). Give it a
   colour that is not grey: today it disappears against the grey head. The model reads as a grey bear or gorilla with
   blush. Make it read as a pygmy hippo calf: the muzzle is the widest, boxiest part of the head (rounded boxes like
   capybara.ts), the two nostrils are bumps on top of the muzzle front, the ears are tiny, the eyes small and high,
   and the body is a glossy barrel.
3. **hamster**: the ENORMOUS glossy eyes are half hidden behind the lids (`sleepy: 0.34`), so the face reads as a
   tired sloth. Open them (`sleepy` ≤ 0.12) and keep the sad look through the lid tilt, the brows and the tear. Make
   the body rounder (a hamster is a ball: a wider, shorter barrel and a short neck). Hands stay on the grips and feet
   on the pedals.
Re-shoot the front and 3/4 close-ups of these three and look at them before you report.

**Round 2 changed nothing** (it re-ran the old checks and reported). The lead review is now part of
`tools/r6/species.mjs` as numbers — six checks fail on today's models and must pass:
- bananacat: ≤ 3 banana-yellow vertices on the face between the eyes and the chin (today 33: the fourth flap).
- moodeng: helmet rim gap ≤ 4.5 cm on every side (today 6.8 cm at the sides) · helmet colour ΔRGB ≥ 100 from the
  grey skin (today 63) · muzzle as wide as the skull: front-30 % width / head width ≥ 0.95 (today 0.88).
- hamster: `meta.sleepy` ≤ 0.12 (today 0.34) · torso width / height ≥ 1.2 (today 1.08).
Change the models (not the numbers), then look at the new front and 3/4 close-ups before you report.

**Lead review after round 3** (`shots/r6-species/faces8.jpg`, the sheet): bananacat, cryingcat, xinxian and pedro
are done — do not touch them. Four new checks in `tools/r6/species.mjs` fail and must pass (every old check stays
green). They cast rays through the finished mesh and record which bone each ray meets first, so they measure what the
camera shows:
- **moodeng, skull through the helmet** (front 86 · 3/4 21 · side 12 head cells between helmet cells; ≤ 4): from the
  front, two grey patches of skull break through the white shell above the eyes. The skull box
  (`box c [0, 0.585, -0.315] h [0.125, 0.13, 0.175] round 0.045`) is bigger than the helmet ellipsoid
  (`c [0, 0.625, -0.295] r [0.161, 0.185, 0.204]`) at the front corners. Make the helmet enclose the top of the skull
  (bigger or further forward), or keep the skull's top inside it.
- **moodeng, eyes from the front** (8.3 cm² of eyeball visible; ≥ 15): the eyes at y 0.552 (r 0.04) sit between the
  muzzle box's top (≈ 0.52) and the helmet rim (0.546), so only a sliver shows. A hippo's eyes sit HIGH on the head and
  bulge out: put them on top of the front corners of the skull, above the muzzle, with the helmet rim above them
  (tilt the helmet back or raise it at the front). They may stay small; they must not be covered.
- **hamster, sad mouth** (curve −0.32 cm; ≥ 0.3): the mouth line is a smile. Its centre (y 0.475) is lower than its
  corners (0.485). For the sad hamster, the corners go DOWN and the centre stays up: an upside-down U (∩).
- **hamster, no neck** (narrowest slice between the chest and the head / head width 0.6; ≥ 0.8): from the front
  and the back the head sits on a thin neck, so the body reads as a peanut, not a ball. Fill the neck: fat cheek
  pouches that flow into the shoulders, a wider chest top, the head lower into the body. Hands stay on the grips.
Look at the front, 3/4 and back close-ups of these two after the fix.

## Read first
SPEC.md §5 (art bible: designer-vinyl toys, cel shading + ink outline, chunky cartoon, readable from the chase cam),
§23; the species kit `src/actors/kit/*` (mammal.ts `buildMammal` / `MammalSpec`, ears-tails.ts, gear.ts helmets,
face.ts eyes, paws.ts, props.ts, sdf.ts primitives) and the existing species as patterns: `species/cat.ts` (tabby
stripes, ears, tail), `species/capybara.ts` (boxy head built from rounded boxes, yuzu helmet), `species/shiba.ts`,
`species/sloth.ts` (shaggy locks), `species/types.ts` (SpeciesMeta), `actors/rig/cues.ts` (POSES) +
`rig/cue-skills.ts` (skill poses), the sandbox `/sandbox/actors.html` (`__actors.set`, `check`, `report`),
`tools/actors-sheet.mjs` (turntables), `tools/actors-check.mjs`.

## The six (kind, recognisable, no real people)
1. **香蕉猫 bananacat** — a small white-grey cat wearing a peeled-banana costume: a yellow banana-skin hood around the
   face (the peel's flaps hang down over the shoulders like a bonnet, brown tip on top), big glossy wet eyes with tear
   streaks, mouth open in a wail. The hood replaces the helmet. Signature pose: tosses a peel behind (`bananacat.peel`).
2. **泪眼猫猫 cryingcat** — a grey-beige cat with HUGE glossy eyes brimming with tears (blue tear drops on the cheeks),
   wobbly mouth, one paw giving a thumbs-up (keep it on the grip while riding; the thumb shows in the skill pose).
   Small helmet. Pose: crying upward, tears raining (`cryingcat.tears`).
3. **新鲜哥 xinxian** — a lean orange stray tabby (sharp, scrappy, NOT the chubby 哈基米): orange coat with faint
   stripes, cream muzzle, alert ears (one with a notch), keen green eyes, a green collar with a little round tag.
   Pose: lunges forward mouth open to grab (`xinxian.fresh`).
4. **弹跳猪 moodeng** — the pygmy hippo calf: glossy dark grey body with a pink belly, cheeks and mouth, small round
   ears, nostrils on top of a wide muzzle, tiny eyes, chubby short legs; shiny (a glossy highlight stripe painted on
   the back). Pose: crouch and bounce (`moodeng.bounce`).
5. **佩德罗 pedro** — a raccoon: grey fur, the black eye mask, white brows and muzzle, black nose, ringed bushy tail
   (alternating grey / black rings), dark hands. Pose: a happy spin (`pedro.trash`).
6. **悲伤仓鼠 hamster** — a golden-tan hamster with a cream belly and cheeks, tiny round ears, ENORMOUS glossy black
   eyes (two white highlights each, slightly teary), tiny pink nose, chubby cheek pouches. Pose: holds an imaginary
   violin (`hamster.violin`).

## Build it
- One file per species `src/actors/species/<id>.ts` (≤ 200 lines, like cat.ts), exported `SpeciesDef`, registered in
  `species/index.ts` DEFS replacing the stand-in. 5 500 – 9 500 triangles at high quality (`budget` / `cell`).
- Hands on the grips and feet on the pedals on all 7 bikes (the actors-check rules; a short-legged species may set
  `shortLegs`).
- Skill poses: map each new skill id to a pose in `rig/cues.ts` POSES (reuse the existing SkillPose kinds: spit / gulp
  / wingspread / honk / chill / spin / doge / ghost / slide / grab / flash / whistle — pick the closest, e.g. peel =
  grab, tears = chill, fresh = grab, bounce = flash, trash = spin, violin = chill) and give each species
  `meta.skillPose`. Also map the 17 pool skills and 3 shared ults to a pose (attack → spit/grab, control → honk,
  move → flash, defense → doge, summon/trap → grab, gag → spin, ults → wingspread).
- Signature colours must show on the model (tools/r6/species.mjs checks the vertex colours).
- Look at every species from the chase camera and on a turntable before you call it done.

## Files you own
`src/actors/species/bananacat.ts`, `cryingcat.ts`, `xinxian.ts`, `moodeng.ts`, `pedro.ts`, `hamster.ts`,
`src/actors/species/index.ts`, `src/actors/rig/cues.ts`, `sandbox/actors-scene.ts` (add the six to ROSTER_IDS),
`sandbox/actors-skills.ts`.

## Acceptance (the runner runs these; read `tools/r6/species.mjs` first)
- `node tools/r4/tsc-own.mjs src/actors/` → TSC-OWN OK
- `node tools/r6/species.mjs --sheet` → r6-species OK (and look at `shots/r6-species/sheet.png` via thumb.py)
- `node tools/actors-check.mjs` → OK (the old cast still fits every bike)
- `node tools/core-check.mjs` → core-check OK
