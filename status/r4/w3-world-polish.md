# r4 · w3-world-polish — 江南水乡 as a water town, 戈壁 as a desert, the sea follows the weather

## Plan
1. Sea palette per track + weather (grey/pale in rain+fog, warm at dusk, night unchanged). **done**
   → `node tools/r4/w3-world-polish.mjs` prints "rain/fog/dusk" PASS.
2. Watertown road: 青石板 flagstone paving texture, no highway paint, no road marks. **done**
   → same script: "no highway centre lines" PASS.
3. Gobi far plain: road-relative desert plain (no slab), farmland painting off per track, dry horizon.
   **done** → same script: "no slab of bare grey geometry" PASS.
4. Watertown edges/town: narrow lane, plaster walls with tile caps, stone quay + wide canal,
   白墙黛瓦 houses close to the road, shopfronts, stone humpback bridges instead of the steel arch.
   **done** → `node tools/r4/w1-newtrack.mjs --track watertown --min bridge:3,jumpCrest:2,pickupRow:3` OK.
5. Gobi desert: rippled dunes, distant mesas, sandstorm finale over the last 500 m. **done**
   → `node tools/r4/w1-newtrack.mjs --track gobi --min ramp:2,jumpCrest:2,pickupRow:3` OK.
6. Weather look: grey overcast clouds in rain/fog, soft drizzle look for the water town, sandy
   sandstorm fog for the gobi. **done**
   → `node tools/r4/w1-weather.mjs --tracks coast,watertown,gobi` OK.
7. Reverse + core checks, screenshots, budget. **done**
   → `node tools/r4/w3-reverse.mjs --tracks watertown,gobi` OK, `node tools/core-check.mjs` OK.

## Done
- The sea follows the weather: `env/sea-look.ts` paints the palette per track (the coast turquoise,
  the water town's canals green-teal, the night city indigo) and per weather (rain/fog/snow grey and
  pale, dusk warm). `weather/look.ts` gained `weatherFor(id, look)`, which the sea and the clouds use.
- Watertown road: `road/flagstone.ts` draws the 青石板 paving (blue-grey slabs, dark joints, gentle
  colour variation, a line of drain stones down the middle); `road/road.ts` switches on the track id,
  `road/marks.ts` paints no marks at all on the flagstone lanes.
- Watertown edges: `road/edges.ts` gives the town a granite kerb + whitewashed wall with a dark tile
  cap, the bridges a stone parapet (no red posts) and the canals a stone quay with mooring posts.
  The lane is 7.2 m wide now (`layouts/watertown.ts`), the canal 9 m wide with a stone landing
  (`dressing/watertown/quay.ts`).
- Watertown town: `dressing/watertown/props.ts` — white walls, charcoal tile roofs, four-step 马头墙
  gables, wooden shopfronts with a counter board and a hanging sign; the houses sit 3–8 m behind the
  kerb. The far roofline houses got stepped gables too.
- Watertown bridges: the shared red steel arch is taken out of the scene and the town draws its own
  stone bridges (`dressing/watertown/bridges.ts`); the jump crests keep their humpback stone arches.
- Clouds follow the weather (`env/sky.ts`): grey overcast in rain, pale in fog and snow, warm at dusk.
- Gobi: the far plain now follows the road's own height (no slab over the horizon), the farmland
  quilt is a per-track switch (`terrain/farmland.ts`, off for the gobi and the water town) and the
  desert horizon falls to a dry basin, not an ocean (`terrain/tracks.ts`). The distant snow peaks are
  gone: distant mesas take their place, the dunes got wind ripples, and the last 500 m run into a
  dust storm (`dressing/gobi/sandstorm.ts`). The gobi's fog weather is a sandy sandstorm look.

## In progress / next
- Nothing left in the brief: every acceptance command passes. Screenshots for the lead:
  `shots/r4-w3-world-polish/sheet-watertown-clear.jpg`, `sheet-watertown-drizzle.jpg`, `sheet-gobi.jpg`
  (six 1920×1080 spots each, the PNGs in `contact-<track>-<weather>/`), plus `coast-sheet.jpg`,
  `coast-rain.jpg` and `gobi-fog.jpg` as references.

## How to test (exact commands)
```
node tools/r4/tsc-own.mjs src/world/road/ src/world/env/ src/world/weather/ src/world/weather.ts src/world/terrain/ src/world/looks.ts src/world/dressing/watertown/ src/world/dressing/gobi/ src/world/layouts/watertown.ts src/world/layouts/gobi.ts
node tools/r4/w3-world-polish.mjs
node tools/r4/w1-newtrack.mjs --track watertown --min bridge:3,jumpCrest:2,pickupRow:3 --shots shots/r4-w3-world-polish/accept-watertown
node tools/r4/w1-newtrack.mjs --track gobi --min ramp:2,jumpCrest:2,pickupRow:3 --shots shots/r4-w3-world-polish/accept-gobi
node tools/r4/w1-weather.mjs --tracks coast,watertown,gobi
node tools/r4/w3-reverse.mjs --tracks watertown,gobi
node tools/core-check.mjs
```

## Evidence (key output lines)
- baseline (before): `FAIL rain: a greyer sea (saturation 0.96 vs clear 0.96)`, `FAIL fog: a paler,
  greyer sea`, `FAIL dusk: the sea takes the evening colours (#1fa6d3 vs #1fa6d3)`,
  `FAIL watertown: no highway centre lines in the road band (worst 3.20 %)`,
  `FAIL gobi: no slab of bare grey geometry over the horizon (worst 10.5 % … s3375 10.5)`.
- after: `w3-world-polish OK` (rain sat 0.53 vs clear 0.96, fog 0.38, dusk #c4693a; watertown paint
  0.00 %; gobi slab 1.9 %), `w1-newtrack watertown OK` (155 calls / 535 k tris, 0 crashes),
  `w1-newtrack gobi OK` (231 calls / 640 k tris, 0 crashes), `w1-weather OK`, `w3-reverse OK`,
  `core-check OK`.

## Known issues
- The shared `features/bridge.ts` draws a red steel through-arch (not my file). The water town takes
  those meshes out of the scene at build time and draws its own stone bridges; the request below asks
  for the arch style to become per track so the workaround can go.
- The orange "fried fish" lying on the road are the game's currency pickups (drawn by the race unit),
  not scenery.

## Requests
- `src/world/features/bridge.ts`: make the arch style per track (a stone humpback for `watertown`) so
  the water town does not have to take the shared structure meshes out of the scene at runtime.
