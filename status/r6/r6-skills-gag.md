# r6 — Skills 2.0: the gag / utility pool (job r6-skills-gag)

Files owned: `src/gameplay/combat/skills/gag/**` (boomerang, pie, brainfight, blink, thermos, ducks, popup, warsong).

## Plan
1. `gag/props.ts` — the folder's geometries (`gag:fish` (a salted fish), `gag:pie`, `gag:duck`, `gag:ad`,
   `gag:note`), built once at session start by the PropLibrary (the catalog already spreads `GAG_PROPS`).
2. `gag/flyer.ts` — one shared visual: a toon prop that flies in track space (s, x, y), spins, disposes.
3. `gag/boomerang.ts` — a salted fish flies out 14 m and comes back; it hits riders (10 dmg) and the officers
   in its reach on both passes.
4. `gag/pie.ts` — a pie flies at the rider ahead (ready(): a target ahead); it roots them 1.8 s.
5. `gag/brainfight.ts` — 'confused' (mirrored steering) on every rider within 5 m for 3 s.
6. `gag/blink.ts` — a flash: the rider appears 15 m further up the road (clear lane, short of the line).
7. `gag/thermos.ts` — a gulp of goji tea: +30 HP and every negative status off.
8. `gag/ducks.ts` — five yellow ducks charge ahead and wobble whoever they meet (officers too).
9. `gag/popup.ts` — a pop-up ad blocks the view of the rider ahead (blind 3.5 s; ready(): a target ahead).
10. `gag/warsong.ts` — +25 % top speed for 3 s; the riders within 6 m lose 30 % speed for 2.5 s.
11. `gag/index.ts` lists the eight; then the whole acceptance.

## Done
- All eight pool skills are in `src/gameplay/combat/skills/gag/` (one file per skill + `flyer.ts`, `props.ts`,
  `index.ts`); the folder is listed in `skills/registry.ts` through `GAG_SKILLS` (the registry already reads it).
- The `gag` line of the r6 acceptance PASSES: `PASS gag / utility pool skills do what their descriptions say
  {"boomerang":2,"pie":true,"brain":2,"blink":15,"thermos":{"hp":0.78,"clean":true},"ducks":true,"popup":true,
  "warsong":{"boost":true,"slow":true},"police":[]}` — `police: []` means both damaging skills (boomerang, ducks)
  reach a police officer. With the other r6 jobs landed, the whole run ends `r6-skills OK`.
- `node tools/combat-check.mjs` → 72/72 passed; `node tools/core-check.mjs` → core-check OK;
  `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/gag/` → TSC-OWN OK.
- One screenshot per skill mid-effect + two contact sheets: `shots/r6-skills-gag/sheet1.jpg` (boomerang, pie,
  brainfight, blink), `sheet2.jpg` (thermos, ducks, popup, warsong), `sheet3.jpg` (popup + boomerang after the
  ad panel was raised so it reads over the victim's head).
- No element on any of the eight (the catalogue gives them none), so no `applyElement` call is needed; the two
  damaging skills hit the police with `obstaclesIn()` + `skillObstacleHit()`.

## In progress / next
- Nothing in this job. At the last run the other r6 skill jobs had landed too, so the whole
  `node tools/r6/skills.mjs` run is green (`r6-skills OK`, 39/39 skills implemented).

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/gag/`
- `node tools/r6/skills.mjs --only gag`
- `node tools/combat-check.mjs`
- `node tools/core-check.mjs`
- The probes and the shots: `node shots/r6-skills-gag/probe-pie.mjs` (why the pie landed late),
  `node shots/r6-skills-gag/shots.mjs` (the screenshots).

## Evidence (key output lines)
- `node tools/r6/skills.mjs --only gag` → `r6-skills OK`, with
  `PASS gag / utility pool skills do what their descriptions say {"boomerang":2,"pie":true,"brain":2,
  "blink":15,"thermos":{"hp":0.78,"clean":true},"ducks":true,"popup":true,"warsong":{"boost":true,"slow":true},
  "police":[]}` and `PASS skills: no console errors ()`.
- `node tools/combat-check.mjs` → `72/72 passed`.
- `node tools/core-check.mjs` → `core-check OK`.
- `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/gag/` → `TSC-OWN OK`.
- The pie probe (before the fix the pie flew at 24 m/s and never caught a rider at full speed; now 45 m/s):
  `skill:hit skillId=pool.pie victim=2`, `statuses [{"id":"rooted","time":1.25,"strength":1}]`.

## Known issues
- `pool.pie` and `pool.popup` deny the cast with their own line (饼画给谁？ / 弹给谁看？) when nobody is ahead —
  by design (the brief's `ready()` rule), the same way SHOWTIME says 无目标！.
- The `pool.popup` ad panel is 1 m in front of the victim's head, so from the chase camera it peeks over the
  rider's shoulder rather than covering them; it reads as a yellow card above the rider (shots/r6-skills-gag/
  sheet3.jpg).

## Requests
- **AI rules for `src/gameplay/race/ai/skills.ts`** (the skills-ai job owns it) — one rule per skill, all of them
  for the slot-2 pool skill:
  - `pool.boomerang`: a rival 6–25 m ahead (it hits on the way out and again coming back).
  - `pool.pie`: a rival 4–20 m ahead (it roots them for 1.8 s).
  - `pool.brainfight`: two or more rivals within 5 m (it mirrors everyone's steering).
  - `pool.blink`: the rider needs a gap — blocked, two rivals within 5 m, or the player 5–30 m ahead (like ghost).
  - `pool.thermos`: hurt (HP below half) — it heals 30 and washes the debuffs off.
  - `pool.ducks`: a rival 6–20 m ahead (the flock wobbles them).
  - `pool.popup`: a rival 4–24 m ahead (it blinds them for 3.5 s).
  - `pool.warsong`: two or more rivals within 6 m (self boost, the rivals go weak in the knees).
