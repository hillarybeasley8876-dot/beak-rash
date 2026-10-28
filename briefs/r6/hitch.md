# r6 job hitch — no shader program compiles after GO again (render warm-up; SPEC §12 / §27)

r5 warmed every mid-race set piece behind the loading screen (`tools/r5/hitch.mjs`: a manual race per track, every
track event, ★3 police with the backup and the roadblock, the cloud pelican and thrown weapons are forced near the
player; any shader program that compiles after GO fails — on a mid GPU each one is a 30–250 ms freeze). r6 broke it:
```
coast:     fishSpill@16.4, throw:baguette@87.7 ×3      city:  stalls@40.1
mountain:  geese@18.7, police@61.6 ×3                  watertown / gobi: fishSpill@13.7
```
(`F:`-free copy: run `node tools/r5/hitch.mjs` yourself.) r6 changed the event props (`events/{fish-spill,geese,
stalls,props}.ts`), the police (薄纱警察: downed / fight / shield visuals) and the combat visuals (skills 2.0, element
tints) — some of those meshes now draw with materials, object kinds or defines that no warm-up stand-in has.
Read SPEC.md §12 and the warm-up comments: `src/gameplay/race/events/warm.ts` (the events' stand-ins and the shared
helper), `src/gameplay/race/police/warm.ts`, `src/gameplay/combat/visuals/` (projectiles, auras), `src/core/warmup.ts`
and `src/actors/warmup.ts`, and the acceptance `tools/r5/hitch.mjs`.

## Build it
1. Find exactly which programs compile late: in a probe (copy hitch.mjs into `shots/r6-hitch/`), log each late
   program's `name` and `cacheKey`, and the warmed program it is closest to — the difference (a define, the
   object kind — Mesh / InstancedMesh / SkinnedMesh / Points / Sprite —, vertex colours, a map, transparency,
   `onBeforeCompile` / `customProgramCacheKey`, fog or the light count) names the material and the stand-in missing.
2. Add the missing stand-ins (or make the props reuse a warmed material) in the warm-up of the unit that draws them:
   events → `events/warm.ts`, police → `police/warm.ts`, thrown weapons and skill visuals → the combat visuals' warm-up.
   No prop may be drawn differently than today; no warm-up may stay visible.
3. The loading screen may take at most 0.3 s longer than today (measure a coast race's GO time before and after).

## Files you own
`src/gameplay/race/events/warm.ts`, `src/gameplay/race/events/{fish-spill,geese,stalls,props}.ts` (only to share or
expose materials — no visual change), `src/gameplay/race/police/warm.ts`, `src/gameplay/combat/visuals/` (warm-up only).
`src/core/warmup.ts` is the lead's: if core's scene walk itself must change, say what and why under Requests.

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/race/events/ src/gameplay/race/police/ src/gameplay/combat/visuals/` → TSC-OWN OK
- `node tools/r5/hitch.mjs` → r5-hitch OK
- `node tools/r4/w3-fx.mjs` → w3-fx OK
- `node tools/r6/police.mjs` → r6-police OK
- `node tools/r6/present.mjs --only visual` → r6-present OK
- `node sandbox/fx.warm.mjs` → exits 0
- `node tools/core-check.mjs` → core-check OK
