# r6 job police — 薄纱警察: the police can be beaten (race unit; SPEC §25)

Read SPEC.md §14 (Police 2.0) and §25, then the police code: `src/gameplay/race/police.ts` (the chase), `police/fight.ts`
(knocks, HP, down), `police-chase.ts` (riding, `knock()`), `police/field.ts` (backup + roadblock), `police/corgi.ts`,
`police/tuning.ts`, `police/wanted.ts`. The user's complaint: "薄纱警察怎么没有" — you cannot beat the police up.
Measured before r6 (tools/r6/police.mjs): a player swinging at every chance has the officer in reach 6 % of a ★2
chase (each knock throws it 3 s away at ×0.6 speed with a 4 m/s sideways shove), bare wings never down it, and
skills / SHOWTIME cannot reach it at all.

## Build it
1. **Knocks keep the officer close** (police-chase.ts `knock`, fight.ts): a hit nudges it ≤ 1.5 m aside over ≤ 0.4 s
   and slows it only a little (×0.85 for 0.8 s), and it rides straight back alongside. Officer HP 60 → 40 (tuning
   `T.hp`); bare wings (7 dmg) need 5–6 hits, a pan heavy two or three. Keep the existing rules that wind-ups,
   dodging and the baton still work (tools/r4/w2-police.mjs must stay green; it reads the officer's HP from
   `__br.race.police().hp`).
2. **Skills and SHOWTIME hurt officers**: `combat:obstacleHit` now carries `skillId` and `ko` (SPEC §27). In
   fight.ts treat `ko: true` as an instant down. Skills already in the game must reach officers: you do not own
   combat, so emit nothing from combat — instead, in the police unit, listen to `skill:cast` / `ult:impact` /
   `projectile:end` and resolve the obvious ones yourself:
   - `ult:impact` (any rider's ult; SHOWTIME is `pelican.ult`): every active officer within 40 m ahead / 20 m behind
     the impact point's track position (project `pos` with `track.project`) goes down (ko).
   - `projectile:end` with `hit === null` whose position is within 1.2 m of an officer: the torpedo hit it (14 dmg).
   - `skill:cast` of `cat.spin` / `goose.honk` / `pelican.wing` / any skill: officers within the skill's reach take
     the damage listed in `src/gameplay/combat/skills/<skill>.ts` (spin 10 within 2.6 m; honk stuns it 0.8 s =
     no wind-up; wing dash already knocks via `wingT` — keep it, it now also hurts 8).
   The combat jobs of this round will add `combat:obstacleHit` emits for the new skills; your listener must accept
   any `combat:obstacleHit` on an officer id (damage, `ko`).
3. **The payoff when an officer goes down** (`knockDown`): a 0.6 s slow-mo beat (`app.clock.setScale('police', 0.35)`
   then back to 1 over 0.25 s, real-time timer, never stacks), the line 「柯基下班了！」 as the officer's
   `npc:say` (bypassing the rate limit), its baton drops as a weapon pickup (`pickup:spawn` kind 'weapon', weapon
   'baton', at the officer's s/x) and `police:bounty { riderId, obstacleId, bounty: 80, refund, downs, pos }`
   pays the player (`player.coins += 80 + refund`, refund = the fines this race), only when the player downed it.
   Make sure a dropped baton can be picked up by the player (combat pickups give dropped weapons to unarmed
   riders; if 'baton' is refused somewhere in combat, write it under `## Requests`).
4. **特警 squad**: count officers the player downs this race. At the third, call the squad (`police:squad` phase
   'call', then 'arrive' when they are on the road): three corgis with riot shields, obstacle ids 910, 911, 912
   (build them like `createCorgiUnit`, hidden until needed, `kind: 'police'`), 40 HP each, riding in a line
   behind/alongside the player, batons armed. A frontal swing (the attacker more than 1 m behind the officer) is
   blocked by the shield (no damage, `police:knock` still fires); hits from the side, thrown weapons and skills
   hurt them. Each down → `police:squad` phase 'down' (left = how many remain); all three down → phase 'clear'
   and `police:offDuty { riderId }` → 警局下班: no police for the rest of the race (heat pinned at 0, no spawn,
   `__br.race.police()` reports mode 'off' and wanted 0). A squad member uses the same view as the officer
   (PoliceView) plus a shield prop (simple toon box in front of the corgi, your own small mesh in police/).
5. Debug: keep `__br.race.police()` and add `downs` (officers downed this race) and `squad` (active squad ids).

## Files you own
`src/gameplay/race/police.ts`, `src/gameplay/race/police-chase.ts`, `src/gameplay/race/police-view.ts`,
`src/gameplay/race/police/**` (new files allowed there), `src/data/police-lines.ts`.

## Acceptance (the runner runs these; read `tools/r6/police.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/race/police.ts src/gameplay/race/police-chase.ts src/gameplay/race/police-view.ts src/gameplay/race/police/` → TSC-OWN OK
- `node tools/r6/police.mjs` → r6-police OK
- `node tools/r4/w2-police.mjs` → w2-police OK
- `node tools/race-scenarios.mjs` → checks passed
- `node tools/core-check.mjs` → core-check OK
Look at your work: screenshots of the squad with shields and of an officer going down, under `shots/r6-police/`.

## Lead review after round 1 (read this first when you resume)
Good work: the fight plays well (6 wing hits, the officer in reach 89 % of the time). Changes now required:
1. **Officer HP must be 40** (SPEC §25 and step 1 of this brief) — `police/tuning.ts` still says `hp: 60` (your status
   file says "it has 60 HP"). The lead updated `tools/race-scenarios/chase.mjs` to read the HP from
   `__br.race.police().hp`, so that check passes with 40.
2. **Combat now routes the old skills to the officers itself** (lead change in combat, 2026-10-27): SHOWTIME
   (`pelican.ult`) emits `combat:obstacleHit { skillId: 'pelican.ult', ko: true }` for every officer in its
   shockwave, and its `ready()` accepts an officer in reach as a target (so it is no longer denied next to an
   officer); the torpedo hits officers via the projectile's `onObstacle` (`combat:obstacleHit { skillId:
   'pelican.torpedo', damage: 14 }`) and aims at an officer when no rival is in its cone; `cat.spin` hits officers
   within its radius. Therefore in `police/skills.ts` REMOVE: the `skill:denied` → ult workaround, the
   `ult:impact` → knockDown listener, the `projectile:end` proximity hack, and the `cat.spin` / `pelican.torpedo`
   rules (they would now count twice). Keep `goose.honk` (stun only, combat sends no obstacle hit for it) and the
   wing dash timer. Your `combat:obstacleHit` listener (with `ko`) is now the one path for skill damage; the
   `skillHits` de-dup map is then no longer needed — remove it too if nothing else uses it.
3. Keep everything else. Run the acceptance again (r6-police must still pass with the combat routing).
