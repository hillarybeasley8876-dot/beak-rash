# r5 job hitch — no shader compiles in the middle of a race (race events, police, secrets)

Read SPEC.md §12 (performance: no hitches; core's warm-up) and `src/core/warmup.ts` + where `game.ts` calls it: after
the race session is built and the per-session modules are attached, core renders every material in the scene graph
— hidden objects included — behind the loading screen, so their shader programs are compiled before GO. A material
that first appears later (a new mesh added mid-race) compiles its program on the frame it is first drawn: a
30–250 ms freeze on a mid GPU, at exactly the moment something exciting appears.

`node tools/r5/hitch.mjs` forces every r4 set piece in a race and counts the programs compiled after GO. Today:
the fish-spill truck / fish, the roadworks, the police (★3: backup, roadblock) and the cloud pelican god each compile
their own programs late (3 per track).

## Build it
1. Every r4 set piece builds what it will draw — its materials and one hidden instance of each mesh kind (the same
   object types: a Mesh vs an InstancedMesh vs a SkinnedMesh compile different programs; the same material options:
   vertex colours, transparency, fog, outlines) — while the race is being created, BEFORE core's warm-up, and parks
   it hidden in the scene (`visible = false`; core's warm-up compiles hidden objects too). When the set piece appears,
   it reuses those materials / meshes (or clones that share the materials) instead of creating new ones.
   - race events (`src/gameplay/race/events/`): fish truck, fish, oil slicks, geese, roadworks barriers / cones /
     sign / workers, market stalls and their debris;
   - police (`src/gameplay/race/police/` + `police.ts`): the backup corgi's view, the roadblock sawhorses / cones /
     sign, the baton;
   - secrets (`src/gameplay/secrets/`): the cloud pelican god, the easel, the duck.
2. Nothing visible changes and nothing is drawn twice: the warm proxies stay hidden and cost no draw calls.
3. Free everything on dispose, as today.

## Files you own
`src/gameplay/race/events/` (folder), `src/gameplay/race/police/` (folder), `src/gameplay/race/police.ts`,
`src/gameplay/secrets/` (folder).

## Acceptance (the runner runs these; read `tools/r5/hitch.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/race/events/ src/gameplay/race/police/ src/gameplay/race/police.ts src/gameplay/secrets/` → TSC-OWN OK
- `node tools/r5/hitch.mjs` → r5-hitch OK
- `node tools/r4/w2-events.mjs` → w2-events OK · `node tools/r4/w2-police.mjs` → w2-police OK · `node tools/r4/w2-secrets.mjs` → w2-secrets OK
- `node tools/race-soak.mjs --track coast` → SOAK OK
- `node tools/core-check.mjs` → core-check OK
