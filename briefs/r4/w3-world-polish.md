# r4 job w3-world-polish — 江南水乡 must read as a water town, the gobi as a desert, the sea follows the weather

Read SPEC.md §4 (world), §5 (art: toon + ink, readable silhouettes, P5 energy), §20 (maps: weather, the two new
tracks) and the world unit's code (`src/world/`: road/, env/, weather/, terrain/, dressing/watertown, dressing/gobi,
layouts/watertown.ts, layouts/gobi.ts). Look at the current state first: `node tools/r4/w3-world-polish.mjs` saves
chase stills under `shots/r4-w3-world-polish/` (and see `shots/r4-accept-watertown/`, `shots/r4-accept-gobi/`).
Another job (seeded routes) works on `src/world/layout/`, `track.ts`, the coast / city / mountain dressing at the
same time: do not edit those; keep YOUR dressing rule-based (marks and layout queries, never fixed `s` values) because
a seeded route reorders whole blocks of segments with their marks.

## Today's problems
- 江南水乡 looks like a highway: grey asphalt with yellow centre lines and white lane dashes, concrete jersey barriers,
  a big red steel arch bridge, the canal a thin cyan line far away, houses with grey roofs set back from the road; in
  its default drizzle the whole scene is dark and dull, with white cartoon clouds in a rainy sky.
- 戈壁公路: `layouts/gobi.ts` lifts the far plain (`terrainMod.height`, "keep the far plain high and dry") to stop the
  shared far grid from painting farmland — where the road runs lower this shows as a huge grey slab hanging in the
  sky (s ≈ 3375). The desert is a flat beige plane with few landmarks in view.
- The sea (`env/sea.ts`) keeps its sunny turquoise under rain, fog and dusk.

## Build it
1. **Watertown road**: 青石板 paving — blue-grey flagstone slabs with darker joints and gentle colour variation (toon,
   not photo), long granite kerb blocks; NO highway paint (no yellow centre lines, no white lane dashes; a faint line of
   darker drain stones down the middle is fine). Per track: the road / marks builders switch on the track id
   (`ctx.id`); the other tracks keep their paint.
2. **Watertown edges and canals**: no concrete barriers — low white-plaster walls with dark tile caps in town, stone
   quay edges along the canals (water right beyond: canal 8–16 m wide, dark green-teal water, stone steps down, moored
   乌篷船 boats), stone parapets on bridges.
3. **Watertown bridges and town**: the jump ramps are humped single-arch stone bridges (拱桥); replace the red steel
   arch. 白墙黛瓦 houses — white walls, charcoal-black tile roofs with stepped 马头墙 gables — close to the road
   (3–8 m beyond the edge in town), wooden shopfronts, strings of red lanterns across the lanes, willows over the water.
4. **Watertown drizzle**: soft and pretty — misty cool green-greys, soft light, overcast grey clouds instead of white
   puffs when it rains (any track: the cloud ring follows the weather), lanterns glowing a little.
5. **Gobi**: remove the far-plain lift; make the far grid's farmland painting a per-track switch (off for the gobi,
   `terrain/far.ts` + `terrain/farmland.ts`). More desert in view: rippled dunes, distant mesas / buttes, turning wind
   turbines, nodding oil pumpjacks, camels, telephone poles; the sandstorm finale (last ~500 m: a dusty orange haze).
6. **Sea**: under rain and fog the sea turns greyer and paler (`uMid` saturation ≤ 0.75 × the clear one), at dusk it
   takes warm evening colours; the night city is unchanged.
7. Budgets as before (≤ 420 draw calls, ≤ 1.4 M triangles at the chase camera), no new per-frame allocation.

## Files you own
`src/world/road/`, `src/world/env/`, `src/world/weather/`, `src/world/weather.ts`, `src/world/terrain/`,
`src/world/looks.ts`, `src/world/dressing/watertown/`, `src/world/dressing/gobi/`, `src/world/layouts/watertown.ts`,
`src/world/layouts/gobi.ts`, `src/data/track-content/watertown.ts`, `src/data/track-content/gobi.ts`.

## Acceptance (the runner runs these; read `tools/r4/w3-world-polish.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/road/ src/world/env/ src/world/weather/ src/world/weather.ts src/world/terrain/ src/world/looks.ts src/world/dressing/watertown/ src/world/dressing/gobi/ src/world/layouts/watertown.ts src/world/layouts/gobi.ts` → TSC-OWN OK
- `node tools/r4/w3-world-polish.mjs` → w3-world-polish OK
- `node tools/r4/w1-newtrack.mjs --track watertown --min bridge:3,jumpCrest:2,pickupRow:3 --shots shots/r4-w3-world-polish/accept-watertown` → w1-newtrack watertown OK
- `node tools/r4/w1-newtrack.mjs --track gobi --min ramp:2,jumpCrest:2,pickupRow:3 --shots shots/r4-w3-world-polish/accept-gobi` → w1-newtrack gobi OK
- `node tools/r4/w1-weather.mjs --tracks coast,watertown,gobi` → w1-weather OK
- `node tools/r4/w3-reverse.mjs --tracks watertown,gobi` → w3-reverse OK
- `node tools/core-check.mjs` → core-check OK
Look at your work: a contact sheet of watertown (clear and drizzle) and gobi at six spots, 1920×1080, under
`shots/r4-w3-world-polish/`.
