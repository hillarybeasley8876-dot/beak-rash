# r6-skills-meme — Skills 2.0: the meme roster signatures + the shared ults

Job: `r6-skills-meme`. Owns `src/gameplay/combat/skills/meme/**` and `src/gameplay/combat/skills/ults/**`.

## Plan

1. `meme/props.ts` + `ults/props.ts`: the folder geometries (peel, violin, bin, can, cloud / meteor, bolt, storm disc).
   Verify: `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/meme/ src/gameplay/combat/skills/ults/` → `TSC-OWN OK`.
2. `meme/visuals.ts` + `ults/visuals.ts`: the custom visuals (peel field, rain cloud, violin / meteor fall, bolt strike, storm veil).
   Verify: same `tsc-own` → `TSC-OWN OK`.
3. `meme/peel.ts`, `tears.ts`, `fresh.ts`, `bounce.ts`, `trash.ts`, `violin.ts`: the six signature skills.
   Verify: `node tools/r6/skills.mjs --only meme` → `PASS the meme roster's signature skills …`.
4. `ults/timestop.ts`, `meteor.ts`, `storm.ts`: the three shared ults (SP 100, `TimedSkill(..., 'ult')`).
   Verify: `node tools/r6/skills.mjs --only ults` → `PASS the shared ults work …`.
5. `meme/index.ts` + `ults/index.ts`: list the implementations (the registry already reads them).
   Verify: `tsc-own` + the r6 catalogue line (only passes when all three jobs are done — not mine alone).
6. Full acceptance: `tsc-own`, `node tools/r6/skills.mjs --only meme,ults`, `node tools/combat-check.mjs`, `node tools/core-check.mjs`.
7. One screenshot per skill mid-effect → `shots/r6-skills-meme/` (thumb.py → .jpg; ≤ 15 images read).

## Done

(nothing yet)

## In progress / next

Step 1.

## How to test (exact commands)

```
node tools/r4/tsc-own.mjs src/gameplay/combat/skills/meme/ src/gameplay/combat/skills/ults/
node tools/r6/skills.mjs --only meme,ults
node tools/combat-check.mjs
node tools/core-check.mjs
```

## Evidence (key output lines)

(nothing yet)

## Known issues

- none yet

## Requests

- (AI rules for `src/gameplay/race/ai/skills.ts` — job skills-ai) — filled in when the skills are written.
