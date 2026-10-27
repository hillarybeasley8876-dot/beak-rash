# r6 job skills-ai — rivals use their whole kit, the player's autopilot uses any loadout (race unit; SPEC §24)

Rivals now carry a loadout (`RiderState.loadout`: slot 1 = their signature skill, slot 2 = a pool skill, the
nemesis also an ult; `src/data/loadouts.ts` rivalLoadout). `src/gameplay/race/ai/skills.ts` only knows slot 1 and
the old 13 signature skills, and its pelican branch hard-codes the pelican's kit for the autopilot player. Measured
(`node tools/r6/skills.mjs --only ai`): 0 slot-2 casts in a 60 s race.

## Build it
1. `useSkill` decides per slot: slot 1, slot 2 and the ult (`me.loadout`), each through the rule table keyed by
   skill id (`RULES[id]`), with the existing gates (grudge, nemesis `prefer`, holstered speed skills, eagerness).
   A rider presses `skill1` / `skill2` / `ult` for the slot it picked (one press per decision).
2. Rules for every skill in `src/data/skills.ts` (39). Keep the 9 existing signature rules as they are. The workers
   who built the new skills wrote the rule they want for each one — use them (below); for skills without one use a
   generic rule by `category` (attack: a rival in a 25 m cone ahead; control: two rivals within 8 m, or one within
   4 m; move: the existing `purpose()` comeback/overtake gate; defense: `threatened()` or hurt; trap: a rival within
   15 m behind; summon: a rival 6–25 m ahead; gag: a rival within 10 m).
   Requested rules (from status/r6/r6-skills-elem.md and r6-skills-gag.md):
   - pool.firebreath 4–10 m ahead, never point-blank · pool.icelance nearest rival 8–40 m ahead · pool.thunder 5–40 m
     ahead (more eager in the rain) · pool.watergun 3–9 m ahead · pool.tornado 10–35 m ahead · pool.snowball two or more
     rivals 8–30 m ahead · pool.rocket a chaser within 12 m behind · pool.firecracker a chaser within 15 m behind ·
     pool.bubble a rival within 3 m swinging (threatened)
   - pool.boomerang 6–25 m ahead · pool.pie 4–20 m ahead · pool.brainfight two or more rivals within 5 m ·
     pool.blink blocked / two rivals within 5 m / the player 5–30 m ahead (like pigeon.ghost) · pool.thermos HP below
     half · pool.ducks 6–20 m ahead · pool.popup 4–24 m ahead · pool.warsong two or more rivals within 6 m
   - the meme signatures and the shared ults: read their files in `src/gameplay/combat/skills/meme/` and `ults/`
     (the job r6-skills-meme writes its requests into `status/r6/r6-skills-meme.md` → `## Requests`; if it is not
     there yet use the category rule). Ults (any SP-100 skill): SP full and ≥ 2 rivals within 40 m ahead, like the
     pelican's SHOWTIME rule; never the time stop by an AI (rivalLoadout already avoids it).
3. The autopilot player (`me.isPlayer`) uses the same table on its own loadout — delete the pelican-only branch.
4. A rule never fires a skill the runner would refuse: check `me.cooldowns[slot - 1] <= 0` (slot 1–2), `me.sp >=
   100` for the ult, `!me.mods.silenced`.

## Files you own
`src/gameplay/race/ai/skills.ts` (and a new `src/gameplay/race/ai/skill-rules.ts` if the table gets long; keep each
file ≤ 400 lines).

## Acceptance (the runner runs these; read `tools/r6/skills.mjs` first, group `ai`)
- `node tools/r4/tsc-own.mjs src/gameplay/race/ai/` → TSC-OWN OK
- `node tools/r6/skills.mjs --only ai` → `PASS rivals fire their slot-2 pool skills in a race`
- `node tools/race-scenarios.mjs` → 62/62 checks passed
- `node tools/race-soak.mjs --track coast` → SOAK OK
- `node tools/combat-check.mjs --soak` → SOAK OK (the SP economy: ≤ 2 SHOWTIMEs a race)
- `node tools/core-check.mjs` → core-check OK
