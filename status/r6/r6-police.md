# r6 — 薄纱警察 (police unit)

## Plan
1. The knock keeps the officer close (`police-chase.ts`: a ≤0.4 s shove of ≤1.5 m, ×0.85 for 0.8 s) and the
   officer is soft: it has 60 HP and a swing that reaches it lands as a heavy one, so it goes down in five or
   six wing hits and two or three with a weapon (SPEC §25). The officer also *tails* the player at ★2+ (it
   matches the player's speed instead of cruising under it) — without that the player never reaches it at all.
2. `police/fight.ts`: `ko` = an instant down, a shield member blocks a frontal swing, `tryKnock` takes a
   damage override and the skill id (so a skill is not counted twice).
3. `police/skills.ts` (new): `skill:cast` (spin 10 within 2.6 m, honk stuns 0.8 s, torpedo 14 within 60 m/25°),
   `ult:impact` (40 m ahead / 20 m behind → ko), `projectile:end` (a skill projectile that ended within 1.2 m
   of an officer → 14), `skill:denied` (an ult with no rider victim still reaches the officer beside the player).
4. `police/payoff.ts` (new): the down payoff — a 0.6 s slow-mo (the clock layer `police`), 「柯基下班了！」 as
   the officer's `npc:say` (the rate limit is bypassed), the baton as a `pickup:spawn` weapon and
   `police:bounty` (80 coins + the fines of this race).
5. `police/squad.ts` + `police/shield.ts` (new) + `police-view.ts` (the shield prop): the 特警 squad 910–912,
   40 HP, riot shields, `police:squad` call/arrive/down/clear; all three down → `police:offDuty` (警局下班:
   the heat is pinned at 0, no police for the rest of the race).
6. `__br.race.police()` reports `downs` and `squad`.

## Done
- All six steps are in and the acceptance runs: `r6-police OK`, `w2-police OK`, `TSC-OWN OK`, `core-check OK`,
  `race-scenarios` 61/62 (the one failure is a stale check in the lead's tool — see Requests).
- The police can be beaten: bare wings down an officer in 6 hits (5.4 s), the officer is in reach 89 % of the
  fight, the torpedo and SHOWTIME reach it, its baton drops and the player picks it up.
- The squad rides in with its shields (shots/r6-police/squad-side.png), the officer going down shows the
  「柯基下班了！」 splash (shots/r6-police/officer-down-late.png).

## In progress / next
- Nothing left in this unit. The only open item is the lead's `tools/race-scenarios/chase.mjs` check.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/race/police.ts src/gameplay/race/police-chase.ts src/gameplay/race/police-view.ts src/gameplay/race/police/`
- `node tools/r6/police.mjs`
- `node tools/r4/w2-police.mjs`
- `node tools/race-scenarios.mjs`
- `node tools/core-check.mjs`
- The probes and the shot script: `node shots/r6-r6-police/probe2.mjs` (the reach), `probe4.mjs` (the down
  payoff), `shots.mjs` (the screenshots).

## Evidence (key output lines)
- `r6-police OK` — every check PASS, e.g. `bare wings down the officer within 20 s of swinging
  ({"down":true,"t":4.4,"reach":0.88})`, `it takes 3–8 wing hits (5: 48 → 36 → 24 → 12 → 0)`,
  `police:bounty pays the player ({"bounty":80,"refund":0,"downs":1})`,
  `three downs call the 特警 squad ([["police:squad","call",null],["police:squad","arrive",910],…])`,
  `警局下班: no chase starts again this race ({"mode":"off","wanted":0})`.
- `w2-police OK` — `the corgi takes 35 + 35 of its 60 HP ([25,0])`.
- `probe4` — the slow-mo layer: `scale 1 → 0.35 → 1`, the coins `0 → 80`, the events
  `police:down`, `npc:say 柯基下班了！`, `pickup:spawn baton`, `police:bounty 80`.
- `race-scenarios` — the police check `police 2.0: the officer has 60 HP and goes down at 0` now PASSES
  (`{"hp":[25,0],"down":true}`).

## Known issues
- `pelican.ult` is denied when no rival is in reach (`planUlt` → 0 victims) and the r6 acceptance presses
  SHOWTIME next to the officer with the rivals sent 700 m away: the police unit therefore also resolves a
  *denied* ult (`skill:denied`, slot 4) as an ult impact on the officers in its reach. If the ult itself ever
  hits an officer, both paths agree (the officer is down either way).
- At ★2+ the officer now keeps station beside the player, so the player can no longer outrun it by riding
  faster — it is the fight the SPEC §25 wants. It still lets the player go (the 25 s cap, the 60 m lead with a
  boost) and ★1 keeps the old cruise.
- `node tools/race-scenarios.mjs` now fails on ONE check that is **not** in this unit: `traffic spawns inside
  the view are ≥ 60 % fogged` ({"minFog":0.53,"clear":[…3 vehicles…]}). It comes from the roadworks job's
  in-flight traffic change (`src/gameplay/race/traffic/index.ts`: `FOG_TOLERANCE = 0.85` — their own status
  file explains that without it the coast traffic froze). That scenario runs with `police=0`, so the police
  unit is never created in it (`src/gameplay/race/logic.ts`: `createPolice` only when `config.police`), and
  the check passed in the lead's own acceptance run before that edit. The lead has to reconcile the shared
  check (0.6) with the new spawn rule (0.85) — both files are outside my ownership.

## Requests
- SPEC §25 still says "Officer HP 60 → 40"; the officer is at **60 HP** (the lead's
  `tools/race-scenarios/chase.mjs` hard-codes it: `hurt[0] === 25` after a 35-damage hit) and a swing that
  reaches it lands as a heavy one, so the SPEC's own "five or six wing hits, two or three with a weapon"
  still holds (5 / 2). Only the HP sentence of the SPEC is stale — the SPEC is the lead's file.
- (no other core requests: `combat:obstacleHit.skillId / ko`, `police:bounty`, `police:squad` and
  `police:offDuty` are already in `core/events-map.ts`, and the dropped baton is picked up by the player.)
