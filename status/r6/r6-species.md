# r6-species — six meme racers get real procedural models (SPEC §23)

## Plan
1. Six species files under `src/actors/species/`: bananacat, cryingcat, xinxian, moodeng, pedro, hamster
   (each ≤ 200 lines, `SpeciesDef`, own `MammalSpec` + kit extras).
   Verify: `node tools/r4/tsc-own.mjs src/actors/` → TSC-OWN OK.
2. Register them in `src/actors/species/index.ts` (replacing the cat/capybara/shiba stand-ins).
   Verify: `node shots/r6-species/probe.mjs` → each id maps to itself, tris 5 500–9 500.
3. `src/actors/rig/cues.ts`: POSES gains the 6 new signature ids + the 17 pool skills + the 3 shared ults.
   Verify: `node tools/r6/species.mjs` → "each new racer strikes a readable pose".
4. `sandbox/actors-scene.ts` ROSTER_IDS += the six; `sandbox/actors-skills.ts` SKILL_SPECS += the six sig skills.
   Verify: `node tools/actors-check.mjs` → OK (poses read, hands ≤ 15 cm/frame).
5. Look at every species from the chase cam + turntable sheet.
   Verify: `node tools/r6/species.mjs --sheet` then `python tools/thumb.py shots/r6-species/sheet.png` and read the .jpg.
6. Final gates: `node tools/r4/tsc-own.mjs src/actors/`, `node tools/r6/species.mjs --sheet`,
   `node tools/actors-check.mjs`, `node tools/core-check.mjs`.

## Done
- Six new species files, each its own model (no stand-in): bananacat (peel hood + flaps + stalk, tear streaks,
  wailing gape), cryingcat (huge glossy eyes, blue tear drops/streaks, wobbly mouth, thumbs-up paw, small
  round helmet), xinxian (lean orange tabby, faint stripes, notched left ear, green eyes, green collar + gold
  tag), moodeng (pygmy hippo: wide muzzle with nostrils on top, pink cheeks/mouth/belly, tiny eyes, shine
  stripe on the back), pedro (raccoon: black bandit mask, white brows/muzzle, ringed bushy tail, dark paws),
  hamster (golden tan, cream cheek pouches, enormous black eyes with two highlights each, tear at the lid).
- `src/actors/species/index.ts`: DEFS now maps every id to its own species.
- `src/actors/rig/cues.ts`: POSES += 6 signature ids, the 17 pool skills and the 3 shared ults
  (attack → spit, control → honk, move → flash, defense → doge, summon/trap → grab, gag → spin, ults → wingspread).
  Each new species has `meta.skillPose` (peel/fresh = grab, tears/violin = chill, bounce = flash, trash = spin).
- `sandbox/actors-scene.ts`: ROSTER_IDS += the six (gallery + report). `sandbox/actors-skills.ts`: SKILL_SPECS +=
  the six signature skills (durations mirror src/gameplay/combat/skills/meme/*.ts).
- Face paint/add prims were re-placed on the real SDF surfaces (a paint prim only colours points inside it),
  so the tears, the raccoon mask, the tabby stripes, the hippo nostrils and the shine stripe actually show.
- Turntable sheet + close-up sheets reviewed: shots/r6-species/sheet.png (front/34/side/back), faces*.jpg,
  poses.jpg (each signature skill cast).

## In progress / next
- Nothing: the job is complete. The lead can flip `racer: false` → true in data/roster.ts for the six.

## Round 2 (resumed after the lead committed 8899efb)
- Re-read the brief and the disk state: my six species files, the registry, the POSES map and the two sandbox
  files are committed and unmodified; the only other work in the tree is the skills-ai job (not mine).
- Re-ran all four acceptance commands on the current tree: TSC-OWN OK / r6-species OK / actors-check OK /
  core-check OK (same numbers as round 1 — nothing else in the tree touched the actors).
- End-to-end check in the real game (not just the sandbox): a race with the six as rivals
  (`/?race=coast&seed=3&manual=1&rivals=bananacat,cryingcat,xinxian,moodeng,pedro,hamster&traffic=0&police=0`)
  runs clean — `errors: []`, phase `racing`, all six on the grid with their name tags, and the chase-cam
  screenshots (shots/r6-species/race_1.png, race_4.png) show the yellow hood, the grey hippo, the tan hamster
  and the cream cryingcat reading correctly from behind, in the game HUD.
- The six are still `racer: false`, so `?character=<id>` falls back to the pelican (isRacer in
  src/core/race-config.ts); they can already be fielded as rivals. Flipping the flag is the lead's call.

## Round 3 (lead review f108fa4: the review turned into checks — six of them failed)
The lead's review notes are now numbers in `tools/r6/species.mjs`. I changed the MODELS, not the checks:
- **bananacat** — the fourth peel flap hung down the middle of the face (a yellow bar over the nose and the
  wailing mouth; 33 yellow vertices between the eyes and the chin) and the darker inner-peel capsules poked out
  of the side/back flaps as ragged dark slits. Fix: the front flap is gone (three smooth strips now, one
  inner-peel shape per flap removed) and the peel cap sits 7 mm higher. → 0 yellow vertices on the face.
- **moodeng** — the helmet hovered (6.8 cm of sky at the rim), it was grey on a grey head and the muzzle was
  narrower than the skull (0.88). Fix: the head is rebuilt (a narrow boxy skull + a LOW, WIDE, boxy muzzle from
  rounded boxes, so the muzzle is the widest part), the eyes moved onto the sides of the skull under the
  helmet's rim (they were hidden between the helmet and the muzzle), the nostrils are bumps on the muzzle's
  front-top, the ears are tiny, and the helmet is now WHITE (shell 0xffffff, pink stripe, soft pink rim, no
  chin strap) seated right down on the skull (its rim is buried in the head). → gap 2.9 cm, ΔRGB 194, ratio 0.98.
- **hamster** — the ENORMOUS eyes were half hidden behind the lids (sleepy 0.34) and the body was a barrel, not
  a ball (1.08). Fix: sleepy 0.1 (the sad look now comes from the lid tilt, the down-turned mouth and the
  tear) and a wide, short body with a short neck (r [0.205, 0.155, 0.19], the head dropped onto the shoulders).
  → torso width/height 1.54.
- The other three pass the helmet-gap check untouched (cryingcat 1.5 cm, pedro 2.5 cm, hamster 1.6 cm).

## Round 4 (lead review 96b5cab: the review became ray-cast checks — four failed)
The lead's new checks cast rays through the finished mesh and record which bone each ray meets first, so they
measure what the camera sees. I changed the MODELS again (bananacat, cryingcat, xinxian and pedro are done —
not touched):
- **moodeng, skull through the helmet** (front 86 · 3/4 21 · side 12; ≤ 4): the skull box was bigger than the
  white shell at the front corners, so two grey patches of skull broke through the helmet above the eyes.
  Fix: the skull box is much smaller (h [0.1, 0.105, 0.14], round 0.035) and the skull ellipsoid shrank to
  r [0.145, 0.145, 0.165], so the whole skull now sits inside the shell; the helmet moved 1.5 cm forward
  (c_z −0.31) to close the gap at the back of the rim. → front 0 · 3/4 0 · side 0.
- **moodeng, eyes from the front** (8.3 cm²; ≥ 15): the eyes sat between the muzzle's top and the helmet's rim
  and the pink cheek blobs were in front of them. Fix: the cheeks moved down and back (they no longer cover the
  eyes), the muzzle dropped 1 cm, and the eyes now bulge out of the skull (centre 2 cm in front of the surface,
  high on the head, under the helmet's rim). → 20.5 cm².
- **hamster, sad mouth** (−0.32 cm; ≥ 0.3): the mouth was a smile. Fix: the corners go DOWN and the centre
  stays up (an upside-down U). → +1.31 cm.
- **hamster, no neck** (0.6; ≥ 0.8): the head sat on a thin neck, so the body read as a peanut. Fix: a fat
  roll of cream chest fur on a NECK bone (so it fills the neck without widening the head or the torso), a
  slightly smaller head, a denser mesh (cell 0.014, budget 3200) and a shorter chin strap (a long strap was
  itself letting the head show between the helmet's cells). → 0.83.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/actors/` → TSC-OWN OK
- `node tools/r6/species.mjs --sheet` → r6-species OK (sheet: shots/r6-species/sheet.png)
- `node tools/actors-check.mjs` → OK
- `node tools/core-check.mjs` → core-check OK
- `node shots/r6-species/probe.mjs` (tris per species), `node shots/r6-species/pose.mjs` (skill pose shots)
- `python tools/thumb.py shots/r6-species/sheet.png` → read the .jpg

## Evidence (key output lines)
- tris at high: bananacat 6770 · cryingcat 6674 · xinxian 6428 · moodeng 6740 · pedro 6784 · hamster 6234
  (old cast: penguin 5866 … pelican 8984).
- signature colours: closest vertex ΔRGB 2–5 (limit 40).
- feet/hands on all 7 bikes: 0.0/0.0 cm for all six (limit 1.0 cm).
- signature poses: bananacat 0.45 s · cryingcat 0.93 s · xinxian 0.45 s · moodeng 0.95 s · pedro 0.75 s ·
  hamster 0.93 s (need ≥ 0.3 s); actors-check skill line: `bananacat.peel 0.45(0.4)/13 cryingcat.tears
  3.85(2.6)/5.9 xinxian.fresh 0.45(0.4)/12.7 moodeng.bounce 0.95(0.8)/10.9 pedro.trash 0.78(0.6)/13.1
  hamster.violin 3.85(2.8)/5.8` → hand move ≤ 15 cm/frame.
- `node tools/actors-check.mjs` → OK; `node tools/core-check.mjs` → core-check OK; `node tools/r6/species.mjs
  --sheet` → r6-species OK (no console errors).
- Round 3 (the lead's review checks, all PASS): `bananacat: the face is clear of the peel … (0 banana-yellow
  vertices there; ≤ 3)` · `moodeng: the helmet sits on the skull (widest rim gap 2.9 cm; ≤ 4.5)` · `moodeng: the
  helmet colour stands out from the grey skin (ΔRGB 194; ≥ 100)` · `moodeng: the hippo muzzle is as wide as the
  skull (front-30 % width / head width 0.98; ≥ 0.95)` · `hamster: the enormous eyes are open (meta.sleepy 0.1;
  ≤ 0.12)` · `hamster: a round ball of a body (torso width / height 1.54; ≥ 1.2)`.
- Round 3 triangles at high: bananacat 6498 · cryingcat 6674 · xinxian 6428 · moodeng 7496 · pedro 6784 ·
  hamster 6220 (all inside 5 500–9 500).
- Round 4 (all the lead's ray-cast checks PASS): `moodeng: no skull showing through the helmet shell (head cells
  between helmet cells: front 0, 3/4 0, side 0; ≤ 4 each)` · `moodeng: the tiny eyes read from the front (visible
  eyeball 20.5 cm², lids left out; ≥ 15)` · `hamster: the sad mouth turns down (centre 1.31 cm above the
  corners; ≥ 0.3)` · `hamster: no neck (narrowest slice between chest and head / head width 0.83; ≥ 0.8)`.
- Round 4 triangles at high: bananacat 6498 · cryingcat 6674 · xinxian 6428 · moodeng 7580 · pedro 6784 ·
  hamster 7582 (all inside 5 500–9 500).

## Known issues
- The six are still `racer: false` in src/data/roster.ts (the lead's call, per SPEC §23). Until then they can
  only be fielded as rivals (`?rivals=bananacat,...`), not as the player (`?character=` needs `racer: true`).
- No portraits exist for the six yet: public/assets/portraits/ still has only the old cast's hand-drawn art,
  and tools/r6/portraits.mjs (lead-owned) does not exist yet. The 3/4 views in shots/r6-species/faces*.jpg
  show the models read at portrait size.
- The cryingcat's thumbs-up is a small SDF bump on the left paw: it reads in the chill pose (the paw turns
  palm-out) but is small on the bar.
- xinxian's "notched ear" is on the rider's left ear; the notch is ~3 cm and mostly reads from 3/4-behind.

## Requests
- none
