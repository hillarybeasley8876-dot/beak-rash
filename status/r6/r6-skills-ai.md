# r6-skills-ai — rivals use their whole kit; the autopilot uses any loadout

Job: `r6-skills-ai`. Owns `src/gameplay/race/ai/skills.ts` + `src/gameplay/race/ai/skill-rules.ts` + this file.

## Plan (steps, each with the command that proves it)

1. `skill-rules.ts` — the rule table: one rule per skill id (all 39 of `data/skills.ts`) + a generic rule per
   category for the skills without a special one. The shared predicates (riders / ahead / threatened / holstered /
   purpose) move here from `skills.ts`.
   Verify: `node tools/r4/tsc-own.mjs src/gameplay/race/ai/` → `TSC-OWN OK`.
2. `skills.ts` — `useSkill` decides per slot: the ult, then slots 1–3 of `me.loadout`; every slot goes through
   `RULES[id]`, the readiness gates (cooldown / SP 100 / not silenced) and the old gates (grudge, 宿敌 prefer,
   eagerness). The pelican-only branch is gone (the autopilot uses the same table on its own loadout).
   Verify: same `tsc-own` → `TSC-OWN OK`.
3. The rivals fire their slot-2 pool skills in a race (the old code only knew slot 1).
   Verify: `node tools/r6/skills.mjs --only ai` → `PASS rivals fire their slot-2 pool skills in a race`.
4. The SP economy holds (the autopilot's first SHOWTIME is not before 35 s) and the race still ends, the balance
   checks hold, the core checks out.
   Verify: `node tools/race-scenarios.mjs` → `62/62 checks passed`; `node tools/race-soak.mjs --track coast` →
   `SOAK OK`; `node tools/combat-check.mjs --soak` → `SOAK OK`; `node tools/core-check.mjs` → `core-check OK`.

## Done

- **The rule table** (`src/gameplay/race/ai/skill-rules.ts`, new): a rule for every one of the 39 skills in
  `data/skills.ts`, plus the generic fallback per category (attack / control / move / defense / trap / summon /
  gag) for the skills that have no rule of their own. The 8 signature rules the AI had are kept as they were.
- **The per-slot decision** (`src/gameplay/race/ai/skills.ts`): `useSkill` walks the ult and then slots 1–3 of
  `me.loadout` (the loadout, not the roster), takes the first slot that is ready (cooldown over, SP 100 and a
  target for the ult, not silenced), whose rule says now and whose eagerness roll passes, and presses **that**
  slot (one press per decision). The grudge gate, the 宿敌 `prefer` gate and the eagerness scale are the old
  ones. The pelican-only branch is deleted: the autopilot player rides the same table on its own loadout.
- **The rules the other jobs asked for** (status/r6/r6-skills-elem.md, r6-skills-gag.md) are in as written:
  firebreath 4–10 m, icelance the nearest 8–40 m, thunder 5–40 m (3–60 m in the rain), watergun 3–9 m,
  tornado 10–35 m, snowball two riders 8–30 m, rocket a chaser within 12 m, firecracker a chaser within 15 m,
  bubble a rider within 3 m swinging, boomerang 6–25 m, pie 4–20 m, brainfight two riders within 5 m, blink
  blocked / two within 5 m / the player 5–30 m ahead, thermos under half HP, ducks 6–20 m, popup 4–24 m,
  warsong two riders within 6 m. The ults (any SP-100 skill): SP full and ≥ 2 rivals within 40 m ahead.
- **Eight deliberate choices**, each one fixed a failing acceptance check (the evidence is below):
  1. *The pelican's own three skills keep the rules the old autopilot branch used* (torpedo a rider 5–60 m ahead
     in a 25° cone, gulp a rider within 2.5 m, wing a straight 60 m and a rider 2–15 m ahead) instead of the
     generic category rules. With the generic rules the autopilot player was clearly faster (9 torpedoes instead
     of 5 a race) and the police chase and the brakecheck flipped. The generic category rules are the fallback
     for the skills that have no rule of their own (the meme signatures, the corgi).
  2. *A pool skill is the backup*: it is taken at `BACKUP_EAGER` (0.85) of the signature skill's eagerness. The
     value is tuned so the rivals really do use their whole kit **and** the SP economy stays sane: the autopilot
     player's bar fills from the bot's melee hits and the drafting, and a pack that fights with its kit is a pack
     the player cannot mash its way past — the first SHOWTIME lands at 37.8 s (city) instead of 33.1 s.
  3. *The AI never casts `ult.timestop`* (the brief: an AI freezing the pack is a cutscene, not a fight).
  4. *The spray skills stay holstered while a police officer is in the spray* (`officerAhead`, 12 m). The pool
     skills knock the officers about and an officer that loses the player never catches them: with the spray on,
     the scenario "slow next to police → BUSTED once" failed (the officer was knocked back 9 m and the bust came
     too late).
  5. *The brainfight (the mirrored steering) is not fired in the player's patch of road* (`playerPatch`, 10 m):
     the confused riders swerve into each other, and the brakecheck counts that bump as a ram
     ("bump pelican<seagull k=5.95", the limit is 5).
  6. *The pie and the popup use the skills' own reach* (`inLane`: 4–20 m / ±4 m and 4–24 m / ±5 m). A press that
     the skill refuses is a "无目标！" line every 1.5 s per rider, which broke the chatter check (minGap 1.43 s).
  7. *The water gun shoves the pack, never the player* (`shoveable`). A shove throws the player out of the
     officer's lane and the chase is the player's own fight: with the shove on the player, the soak's "the
     police bust the braking player" failed (the officer rode 3.4 m behind but never got alongside).
  8. The rules aim at `targets(v)` — the riders a skill can really land on (racing, visible, no respawn
     protection), the same condition the skills' own target check uses — so the AI never wastes a skill on a rider
     who has already finished.

## In progress / next

Nothing — the job is finished, waiting for the lead's review.

## How to test (exact commands)

```
node tools/r4/tsc-own.mjs src/gameplay/race/ai/
node tools/r6/skills.mjs --only ai
node tools/race-scenarios.mjs
node tools/race-soak.mjs --track coast
node tools/combat-check.mjs --soak
node tools/core-check.mjs
```

## Evidence (key output lines)

```
$ node tools/r4/tsc-own.mjs src/gameplay/race/ai/
TSC-OWN OK

$ node tools/r6/skills.mjs --only ai
PASS rivals fire their slot-2 pool skills in a race (11 casts of pool.firecracker, pool.thermos, pool.icelance, pool.popup, pool.watergun; 23 rival casts in all)
PASS ai skills: no console errors ()
r6-skills OK

$ node tools/race-scenarios.mjs
62/62 checks passed

$ node tools/race-soak.mjs --track coast
seed 1: ended t=176.5s frames=5520 player=6 (176.5) maxStuck=0.5s
seed 2: ended t=180.6s frames=5700 player=6 (180.6) maxStuck=0.5s
seed 3: ended t=187.5s frames=6030 player=6 (187.5) maxStuck=2.0s
SOAK OK

$ node tools/combat-check.mjs --soak
coast seed 3: place 1 · SHOWTIME ×2 at 56.2 / 147 s · KOs 5 hand + 5 SHOWTIME · SP earned 208
city seed 4: place 8 · SHOWTIME ×2 at 37.8 / 83.2 s · KOs 4 hand + 6 SHOWTIME · SP earned 256
mountain seed 5: place 3 · SHOWTIME ×1 at 71 s · KOs 1 hand + 2 SHOWTIME · SP earned 185
console errors: 0
SOAK OK

$ node tools/core-check.mjs
core-check OK
```

The run above is the last one, on the tree as it stands now (after the r6-species and r6-ui commits): all six
commands green, the same numbers as the previous run. The whole log is in `shots/r6-skills-ai/acceptance6.txt`.

**The SP economy (the line that failed round 1) and how it is fixed.** `tools/combat-check.mjs --soak` wants the
autopilot player's first SHOWTIME no earlier than 35 s. The player's bar fills from the bot's melee hits (the
soak's bot mashes harder than a human), the drafting and the perfect trick landings; with the rivals barely
using their kit the city race filled the bar at 33.1 s. The probe `shots/r6-skills-ai/probe-sp.mjs` (the soak's
three races and its bot, with the SP income split by source) shows the fix: the rivals that fight with their whole
kit leave the player fewer easy hits and wear the officer that tails them down (SPEC §25), so the bar fills at a
sane pace. The same probe is what the tuning is measured with:

```
BACKUP_EAGER 0.4  →  city: first SHOWTIME 33.1 s   (fails the 35 s floor)
BACKUP_EAGER 0.7  →  city: 34.8 s / coast: 45.7 s / mountain: 71.3 s
BACKUP_EAGER 0.85 →  city: 37.8 s / coast: 56.2 s / mountain: 71 s   ← the value in the code
```

The probes I used while tuning are in `shots/r6-skills-ai/` (`probe.mjs` = a race with the skill use, the ults, the
traffic overlaps and the police; `probe-brake.mjs` = the brakecheck timeline; `probe-sp.mjs` = the SP economy).
The soak logs of the old AI and of mine are in `soak-base-456.txt` / `soak-mine-456*.txt`, the full acceptance
logs in `acceptance*.txt`.

## Known issues

- **The soak's "a rider is stuck for more than 5 s" check is knife-edge in this tree.** With the **old** AI the
  same check fails on seed 5 ("rider 5 (shiba) stuck at s=2744", `shots/r6-skills-ai/soak-base-456.txt`); with my
  AI it fails on seed 4 ("rider 1 (seagull) stuck at s=2621") when the soak is run over the seeds 4–6 (the
  acceptance command, the default seeds 1–3, is green). The rivals' control skills (the pie roots, the popup
  blinds, the brainfight mirrors the steering) stop a rider in the road more often than the old AI did, and a
  rider that stands still in the traffic or in a work zone is what the check sees. It is a frequency question, not
  a rule: the same seeds pass at other pool rates.
- **The soak's "traffic spawned inside riders" check can be tripped by the roadworks**, not by the AI: a barrier
  that was held back for a car is put up later without the `spotFree` check the first pass has
  (`src/gameplay/race/events/roadworks.ts`, the `putUp` in the update loop), so it can appear inside a rider. My
  probe caught it with the player at 17.8 m/s and no status: `barrier#5166@rider0(pelican) v=17.8 at 68.5s`
  (the browser stack points at `roadworks.ts:297`, the deferred path). It is a Request below.
- The AI's thunder is more eager in the rain, but the brain does not pass the weather yet (see Requests), so the
  rain branch of `pool.thunder` is dead code until then.
- The tuning numbers are sensitive: the pack's dynamics move the player's SP income by ±20 %, so `BACKUP_EAGER`
  and the 10 m `playerPatch` are numbers to re-check if the other units change the AI's surroundings.

## Requests

- **`src/gameplay/race/ai/brain.ts` + `index.ts` (not my files) — pass the race weather into the view.** The
  `SkillView` already has an optional `weather?: Weather` field and `pool.thunder` uses it (5–40 m, 3–60 m in the
  rain). It needs `weather` on `AiWorld` (`session.config.weather` in `index.ts`) and `weather: w.weather` in the
  view `brain.ts` builds. Without it the rain rule never fires.
- **`status/r6/r6-skills-meme.md` (the meme job) — the AI rules for the six meme signatures.** The
  `## Requests` section was still empty when I wrote the table, so they use the generic rule of their category
  (peel → trap, tears → control, fresh → move, bounce → attack, trash → gag, violin → control). Put your own
  ranges there and I will move them into `skill-rules.ts`.
- **`src/gameplay/race/events/roadworks.ts` (the r6-roadworks job) — the deferred barriers need the rider check.**
  The first pass skips a piece with a rider on it (`spotFree`), the deferred pieces (put up when the car that held
  them back leaves the zone) do not, so a barrier can appear inside a rider — the soak's "traffic spawned inside
  riders" check fails on it (`barrier#5166@rider0(pelican)`, see Known issues).
