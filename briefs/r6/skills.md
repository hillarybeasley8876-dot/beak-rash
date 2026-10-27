# r6 jobs skills-elem / skills-gag / skills-meme — Skills 2.0 implementations (combat unit; SPEC §24)

The user: "技能好少啊 应该多一些多元化的技能 要素拉满那种". The catalogue (`src/data/skills.ts`) now lists 39 skills;
26 have no implementation yet. Three jobs build them in parallel, each in its own folder (never edit another job's
folder; shared files are read-only for all three):
- **skills-elem** → `src/gameplay/combat/skills/elem/`: pool.firebreath, pool.icelance, pool.thunder, pool.watergun,
  pool.tornado, pool.snowball, pool.rocket, pool.firecracker, pool.bubble
- **skills-gag** → `src/gameplay/combat/skills/gag/`: pool.boomerang, pool.pie, pool.brainfight, pool.blink,
  pool.thermos, pool.ducks, pool.popup, pool.warsong
- **skills-meme** → `src/gameplay/combat/skills/meme/` + `skills/ults/`: bananacat.peel, cryingcat.tears, xinxian.fresh,
  moodeng.bounce, pedro.trash, hamster.violin, ult.timestop, ult.meteor, ult.storm

## Read first
SPEC.md §7 (combat), §24 (Skills 2.0, elements), §25 (skills hit the police), §27; `src/data/skills.ts` (names,
descriptions, cooldowns, elements — the description IS the spec of what the skill does), `src/data/loadouts.ts`,
`src/gameplay/combat/elements.ts` (applyElement, reactions), `combat/statuses.ts` (the new statuses and their mods),
`combat/tuning.ts` (ELEMENTS, REACT, STATUS_MODS), and the existing skills as patterns:
`skills/torpedo.ts` (a homing projectile), `skills/honk.ts` (a cone wave), `skills/spin.ts` (a radius hit),
`skills/chill.ts` (an aura), `skills/doge.ts` (a self buff + shield), `skills/ghost.ts` (a teleport),
`skills/steal.ts` (a ready() check), `skills/ult.ts` (an ult: `TimedSkill(..., 'ult')`, `ult:start` / `ult:impact`),
helpers in `skills/common.ts` (`skillHit`, `skillAffect`, `inCone`, `inRadius`, `skillBoost`, `clearLane`,
`obstaclesIn`, `skillObstacleHit`), `skills/types.ts` (TimedSkill), `projectiles/projectiles.ts` (ProjectileSpec: use
`onObstacle` to hit the police), `visuals/*` (ConeWave, FlatRing, GroundRing, AuraDisc, SpinSwirl, Trail, Lightning,
Tether, VacuumSpiral, Follower), `meshes/catalog.ts` (props: put your new geometries in YOUR folder's `props.ts`,
keys prefixed with your folder: `elem:`, `gag:`, `meme:`, `ult:`).

## Rules for every skill
1. One file per skill (≤ 200 lines) in your folder, exporting a `SkillImpl`; list it in your folder's `index.ts`.
   Tuning numbers at the top of the file in a `const <NAME> = { … } as const` table (like HONK / SPIN).
2. It does exactly what its description says, with numbers in the range of the existing skills (a hit 8–20 dmg,
   a stun ≤ 1 s, a slow ≤ 40 % for ≤ 3 s, a boost ≤ +40 % for ≤ 3 s, a teleport ≤ 20 m, never through a wall or past
   the finish line, never off the road). Ults: SP 100, about as strong as SHOWTIME (pelican.ult). Use `ready()` when
   a cast without a target would be wasted (the runner denies it with your `noTarget` line, like SHOWTIME's 无目标！).
3. Elements: a skill with `element` in the catalogue calls `applyElement(ctx, caster, victim, element)` on every
   rider it hits (after its own `skillHit`), so reactions happen (tools/r6/skills.mjs checks vaporize, freeze,
   electro, overload between pool skills).
4. Police: every skill that damages riders also damages officers in its reach — `obstaclesIn()` +
   `skillObstacleHit()` for area / cone / instant skills, `onObstacle` for projectiles. Ults with `ko`: the big
   ones (meteor, storm) pass `ko = true` on officers they hit; time stop halts officers too (their obstacles stop:
   you cannot move them from combat — emit `skillObstacleHit(..., damage 0)` is NOT needed; just skip officers).
5. A visual for every skill (reuse the visuals; new small meshes go in your props.ts, built once at session start;
   materials from `ctx.visuals.materials` — never `new Material` per cast), and every visual ends and disposes
   (combat-check's 3-race loop checks GPU memory and listeners return to baseline).
6. `skill:hit` for every rider affected (skillHit / skillAffect emit it), `combat:hit` for damage.
7. No `Math.random()` (use `ctx.rng`), no allocation per substep in hot loops (reuse arrays like `others()` does).
8. AI: every new skill needs a rule in `src/gameplay/race/ai/skills.ts` — that file belongs to the job
   **skills-ai** (not yours). Write the rule you would want for each of your skills under `## Requests` in your
   status file (one line per skill: when should a rival fire it), the lead hands them over.

## Files you own
- skills-elem: `src/gameplay/combat/skills/elem/**`
- skills-gag: `src/gameplay/combat/skills/gag/**`
- skills-meme: `src/gameplay/combat/skills/meme/**`, `src/gameplay/combat/skills/ults/**`

## Acceptance (the runner runs these; read `tools/r6/skills.mjs` first — your group only)
- `node tools/r4/tsc-own.mjs <your folders>` → TSC-OWN OK
- `node tools/r6/skills.mjs --only <elem,react | gag | meme,ults>` → your group's lines PASS (the catalogue line fails
  until all three jobs are done; the runner's `must` only looks at your group's lines). Each group's line includes
  `police: []` — the list of your damaging skills that did NOT reach a police officer (must be empty).
- `node tools/combat-check.mjs` → 72/72 passed (nothing old breaks)
- `node tools/core-check.mjs` → core-check OK
Look at your work: one screenshot per skill mid-effect (`/sandbox/combat.html` or a race with `stub=ui`), contact
sheets under `shots/<job>/`.
