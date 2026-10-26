# r5 — hitch: no shader compiles in the middle of a race

## Plan

1. **Read** SPEC §12, `src/core/warmup.ts`, the events / police / secrets modules and
   `tools/r5/hitch.mjs`; get the baseline with `node tools/r5/hitch.mjs`.
   → baseline: 2–5 late programs per track (fishSpill, police, god, stalls, +2 on city).
2. **Warm kit (events)** — new `src/gameplay/race/events/warm.ts`: a hidden group with one stand-in per
   mesh kind the four events draw (toon prop mesh, outlines 0.05/0.03, instanced toon + outlines
   0.03/0.02, painted sign face). Built in `createEventDirector` (race creation) and added to
   `session.world`, so core's warm-up compiles them behind the loading screen.
   Verify: `node tools/r5/hitch.mjs --tracks coast` → the `fishSpill` tag disappears.
3. **Warm kit (police)** — new `src/gameplay/race/police/warm.ts`: stand-ins for the roadblock
   (sawhorse toon mesh + outline 0.04, sign poles toon + outline 0.03, plate with a map, DoubleSide).
   Built in `createPolice` and added to `session.world`.
   Verify: `node tools/r5/hitch.mjs --tracks coast` → the `police` tag disappears.
4. **God (secrets)** — build the cloud pelican with the race, hidden in the world, and show it instead
   of creating it mid-race (`src/gameplay/secrets/props.ts`).
   Verify: `node tools/r5/hitch.mjs --tracks coast` → the `god` tag disappears.
5. **Reflect layer (city)** — the wet road's mirror draws the track's REFLECT_LAYER with a camera that
   sees no lights, so those meshes need a second program; warm them with the race
   (`warmReflectLayer`, `src/gameplay/race/events/warm.ts`).
   Verify: `node tools/r5/hitch.mjs --tracks city` → `r5-hitch OK`.
6. **Regressions** — `node tools/r4/tsc-own.mjs …` → TSC-OWN OK; `w2-events`, `w2-police`, `w2-secrets`,
   `race-soak --track coast`, `core-check` → all OK.

## Done

- **`src/gameplay/race/events/warm.ts` (new)** — the shared stand-in helper (`warmProxy`, `warmTexture`,
  `WarmKit`), the events' kit and the reflect layer's warm-up. A stand-in is a hidden mesh / instanced
  mesh with the *same material* as the real prop (toon vertex-colours, the ink outline of that width, a
  painted sign face) — three.js shares one shader program between materials with the same settings, so
  the program the prop needs is already compiled when the prop appears.
- **`src/gameplay/race/events/index.ts`** — the director builds the kit with the race and parks it hidden
  in `session.world` (`visible = false`, so it costs no draw call in the race); `dispose()` frees it.
- **`src/gameplay/race/police/warm.ts` (new)** + **`src/gameplay/race/police.ts`** — the same for the
  roadblock (the sawhorse barrier + outline 0.04, the sign poles + outline 0.03, the double-sided
  painted plate). The corgi officers were already built with the race (both of them, hidden).
- **`src/gameplay/secrets/mesh.ts` / `props.ts`** — the cloud pelican god is built with the race and
  parked hidden in the world (`placeGod()`), so core's warm-up compiles its fog-less toon materials;
  `showGod()` only shows it, `hideGod()` only hides it, `removeGod()` frees the geometries and the three
  toon clones the god owns. The duck and the easel were already placed (and drawn) with the race.
- **The city's wet road** — `warmReflectLayer()` compiles the reflect layer's materials through a camera
  that sees no lights (the mirror's own camera does the same), with a render target bound so the
  programs are the ones the mirror's render needs (its colour space, no tone mapping). The stand-ins
  share the track's geometry and materials, so nothing is drawn and nothing looks different.
- Result: **all five tracks compile 0 programs after GO** (coast 91, city 102, mountain 97,
  watertown 86, gobi 82 programs). Before: 2–5 per track.

## In progress / next

Nothing left in this job.

## How to test (exact commands)

```
node tools/r4/tsc-own.mjs src/gameplay/race/events/ src/gameplay/race/police/ src/gameplay/race/police.ts src/gameplay/secrets/
node tools/r5/hitch.mjs
node tools/r4/w2-events.mjs
node tools/r4/w2-police.mjs
node tools/r4/w2-secrets.mjs
node tools/race-soak.mjs --track coast
node tools/core-check.mjs
```

## Evidence (key output lines)

- `node tools/r5/hitch.mjs`: `PASS coast: … (0: none; 91 programs)`, `PASS city: … (0: none; 102
  programs)`, `PASS mountain: … (0: none; 97 programs)`, `PASS watertown: … (0: none; 86 programs)`,
  `PASS gobi: … (0: none; 82 programs)` → **`r5-hitch OK`**.
- Before: `FAIL coast: … (3: fishSpill@7.4, police@56.3, god@76.4)`, `FAIL city: … (5: fishSpill@7.2,
  police@55.9, god@75.9, throw:leek@87.7, throw:keyboard@93.2)`, `FAIL mountain: … (2: fishSpill@7.3,
  god@75.7)`, `FAIL watertown: … (3: fishSpill@7.6, police@56.1, god@76.3)`, `FAIL gobi: … (3: fishSpill@7.2,
  stalls@40.9, god@73.0)`.
- `node tools/r4/tsc-own.mjs …` → **TSC-OWN OK**; `w2-events` → **w2-events OK**; `w2-police` →
  **w2-police OK**; `w2-secrets` → **w2-secrets OK**; `node tools/race-soak.mjs --track coast` →
  **SOAK OK** (3 seeds, 0 errors); `node tools/core-check.mjs` → **core-check OK** (8/8 PASS).
- The city still renders the wet road and its neon reflections after the change:
  `shots/r5-hitch/city-wet.jpg` (probe `shots/r5-hitch/shot-city.mjs`, 0 console errors).
- Probes: `shots/r5-hitch/probe5.mjs` (which material owns a late program), `probe7.mjs` (the warm and
  the late program key of one material, field by field), `probe8.mjs` (the programs at GO).

## Known issues

- The shared warm-up helper and the reflect layer's warm-up sit in
  `src/gameplay/race/events/warm.ts` because that folder is what this job owns; the reflect layer
  belongs to the world (`src/world/env/city-mirror.ts` draws it) and would fit there better.
- `warmReflectLayer()` walks the track group once per race to find the reflect layer's meshes (a few
  thousand objects, ~1 ms, behind the loading screen).

## Requests

- **world / core (optional)**: the reflect layer's warm-up could live next to the mirror itself
  (`src/world/env/city-wet.ts`): the same `renderer.compile` call with a layer-5 camera would do it, and
  the race would not have to know about the city's reflection layer. It also needs the world's
  `REFLECT_LAYER` constant (imported here from `src/world/dressing/city/batch.ts`).
- **core (info)**: `src/core/warmup.ts`'s `compileScene` walks the scene with `traverseVisible`, so the
  hidden stand-ins are only compiled by `drawEverything()`'s forced-visible frame. That works, but a
  stand-in that is *not* in the scene graph yet (or on a layer no camera sees) is never compiled — which
  is why the reflect layer needs its own compile call.
