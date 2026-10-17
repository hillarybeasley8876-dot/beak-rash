# Unit: combat (gameplay/combat/) — wave 1
Read SPEC.md first (§0–2, §7 is your spec, §8 triggers). You own `src/gameplay/combat/**`,
`src/data/skills.ts`, `src/data/weapons.ts`, `sandbox/combat.*`. Contract: `createCombat(session)`.

## Goal
Road Rash melee + a full skill kit that reads instantly and feels punchy. You own the rules and the
projectile/pickup meshes; fx owns particles/post, actors owns rider poses (you call `view.cue`), audio
and UI react to your bus events — so emit rich, correct events.

## Deliverables
1. Statuses → `rider.mods` each preStep (stun, slow, chill, boost, shield, invisible, intangible,
   blind, wobble, gulped, angry, oiled, wet); timers; stacking rules.
2. Melee per SPEC §7 (swing phases from controls attackL/attackR/heavy, side selection, reach checks
   in track space, damage/crit/counter, knockback via `physics.applyImpulse`, hit-stop, combo + ONE MORE,
   weapon knock-loose/steal/drop/break, blocking by shield/pan). Calls `view.cue('attack'|'heavy'|'hit'…)`.
3. KO pipeline (hp ≤ 0 → `combat:ko` + `physics.crash`), credit rules, SP economy, coins.
4. Pickups: spawn rows from `track.features` (kind 'pickupRow') + weapon drops; toon meshes (小鱼干,
   fish, crate, 能量鱼罐头), bobbing/spinning; collection by proximity; `pickup:take`.
5. Skills (`combat/skills/<id>.ts`, one file each, registry): all of SPEC §7 incl. pelican
   torpedo/gulp/wing/ult and the 9 signature skills; projectiles (salted-fish torpedo with homing &
   trail, honk soundwave rings, etc.) as simple toon meshes; emit skill:cast/hit/end, ult:start/impact.
   The ult must coordinate with fx (`cine:ult` is fx's job: emit `ult:start`, then `ult:impact` at
   the dive impact; you move the pelican (y up to 8 m) via rider.y/vy and handle damage).
6. Bell taunt (angry + SP), cooldowns, `skill:denied` feedback.
7. `sandbox/combat.html` or a test script `tools/combat-check.mjs` that sets up scenarios with
   `__br.teleport` and scripted controls and asserts outcomes (hit lands, damage, KO fires, steal works,
   each skill does its thing). Keep it — critics rerun it.

## Quality bar (gameplay critic)
Every scenario works deterministically under manual stepping; no double hits per swing; KO events fire
exactly once; hits never land through intangible/invisible riders; skills respect cooldown/SP; events
carry correct positions; no runaway projectiles; everything disposes. Visible in screenshots: weapons in
hand (via actors), projectiles, pickups.
