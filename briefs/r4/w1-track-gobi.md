# r4 job w1-track-gobi — new track 戈壁公路 GOBI HIGHWAY

Read SPEC.md §0 (pillars), §5 (art bible: designer-vinyl toy look, cel shading, ink outlines, readable at speed),
§6 (handling limits), §9 (race), §20 (maps — your spec) and §22. The track is already registered as a SCAFFOLD that
borrows the coast (layout, dressing) — you replace the scaffold files with the real track. It stays hidden from the
menus (`TRACK_ORDER`) until the lead adds it; test it with `?race=gobi`.

## The track (creative direction)
A 3.4–4.2 km desert highway across the Gobi: FAST and WIDE — the speed track of the game, the opposite of the twisty
water town. Long straights (400–600 m) broken by wide sweepers (R 120–300 m) and one or two sharper bends (R 40–70 m)
so drifting still matters, 3–4 dune jumps (ramps / jump crests) where the road crosses sand ridges, sand shoulders
(surface 'sand' slows riders who drift wide), giant wind turbines with turning blades along a ridge, nodding oil
pumpjacks, a camel caravan beside the road, telegraph poles, rock mesas/buttes and distant snow peaks on the horizon,
a dry salt lake, a desert truck stop / gas station as the mid-track landmark (with a meme sign), dust devils, and a
finish under a caravanserai-style arch at an oasis. Hard noon light (the look file has a start: tune it). Meme
billboards/signs in the game's kind voice (the scaffold lines in `src/data/track-content/gobi.ts` are a start: write
8 billboards, 4 signs, 10 calendar 宜/忌 pairs, a name, blurb and a weather line).

## Read first (copy the patterns, reuse the kits)
`src/world/layout/types.ts` (LayoutDef: segments, side profiles, ground, features, marks) and the three existing
layouts (`src/world/layouts/{coast,city,mountain}.ts`), `src/world/layout/build.ts`, `src/world/track.ts`, the dressing
modules (`src/world/dressing/{coast,city,mountain}/` — how they place landmarks from marks, batch/merge/instance
meshes, animate cheaply, yield between stages so loading never blocks > 100 ms), `src/world/kit/*`,
`src/world/scenery/**` (props, signs, billboards), `src/world/looks.ts` (EnvLook + RoadLook), `src/world/features/*`,
`src/render/toon.ts` (toon materials + outlines). Look at the existing tracks in the game before you start.

## Deliverables
1. `src/world/layouts/gobi.ts`: the real `GOBI: LayoutDef` (replace the re-export). Features: at least 2 `ramp` and 2
   `jumpCrest` (dune jumps), 3+ `pickupRow`, 2+ boost pads on the long straights, a few oil patches; marks for landmarks.
2. `src/world/dressing/gobi/`: `dressGobi(ctx, field)` building EVERYTHING under one Group named `dress:gobi` added to
   the track group (dunes, mesas, turbines, pumpjacks, camels, truck stop, poles, salt lake, arch). Merge/instance
   repeated geometry; animate turbine blades / pumpjacks cheaply (a few matrix updates per frame, no per-frame
   allocation); yield between stages. Put every new helper/prop file for this track inside this folder.
3. `src/world/env/gobi-look.ts`: tune LOOK (sky, fog, sun, ambient, grade), ROAD (sun-bleached warm asphalt), TUNNEL
   (null unless you add a tunnel).
4. `src/data/track-content/gobi.ts`: the content lines (see above).
5. `src/ui/tracks/gobi.ts`: a proper vector card `scene()` (gradient ids prefixed `gb-`), a sun-and-wind WEATHER_ICON,
   and the in-engine still: run `node tools/ui-track-stills.mjs --tracks gobi` (writes `src/ui/assets/track-gobi.webp`)
   and import THAT file as STILL_URL.

## Budgets and rules
≤ 400 draw calls and ≤ 1.3 M triangles anywhere on the track (the acceptance test measures six spots); no loading task
> 100 ms; everything disposes on track.dispose(); no Math.random (use the track rng); toon materials + ink outlines on
props (0.04 m), like the other tracks. Do not edit shared world files (track.ts, build.ts, kits, signs, features,
looks.ts, other tracks): if you need a shared change, write it under `## Requests` in your status file and work around it.
Look at your track: save contact sheets of chase frames under `shots/r4-w1-track-gobi/` (python tools/thumb.py).

## Files you own
`src/world/layouts/gobi.ts`, `src/world/dressing/gobi/` (folder), `src/world/env/gobi-look.ts`,
`src/data/track-content/gobi.ts`, `src/ui/tracks/gobi.ts`, `src/ui/assets/track-gobi.webp`.

## Acceptance (the runner runs these; read `tools/r4/w1-newtrack.mjs` first)
- `node tools/r4/tsc-own.mjs src/world/layouts/gobi.ts src/world/dressing/gobi/ src/world/env/gobi-look.ts src/data/track-content/gobi.ts src/ui/tracks/gobi.ts` → TSC-OWN OK
- `node tools/r4/w1-newtrack.mjs --track gobi --min ramp:2,jumpCrest:2,pickupRow:3` → w1-newtrack gobi OK
- `node sandbox/track.audit.mjs --track gobi --skip stall` → AUDIT OK
- `node tools/core-check.mjs` → core-check OK
