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
