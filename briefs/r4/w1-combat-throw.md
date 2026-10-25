# r4 job w1-combat-throw — throwing weapons, obstacle hits, NPC strikes, pickup requests (combat unit)

Read SPEC.md §7 (combat today), §15 (throwing — your main spec), §14 (police strikes use `npc:strike`), §19 (events use
`pickup:spawn`) and §22. Contracts you implement against (already in core, do not edit core):
`Controls.heavyHeld`, `RiderAction.kind 'throw'`, events `combat:throw`, `combat:obstacleHit`, `pickup:spawn`,
`npc:strike`, `npc:hit` (see the comments in `src/core/events-map.ts`), ObstacleKind incl. `prop`.

## Read first (existing combat code — copy its patterns)
`src/gameplay/combat/system.ts` (preStep/postStep, bus listeners), `melee.ts` (startSwing, swing phases, strikes),
`damage.ts` (damage, knock via physics.applyImpulse, hit-stop, wobble, block rolls with `ctx.force`), `ko.ts` (KO
pipeline: combat:ko + physics.crash), `projectiles/projectiles.ts` (the homing salted-fish torpedo — reuse its
movement/hit/visual approach), `pickups/pickups.ts` + `pickups/items.ts` (road pickups, `spawn(kind, s, x, weapon)`),
`armory.ts` (equip, weapon uses), `meshes/weapon-props.ts` (road-prop geometry per weapon), `tuning.ts`, `debug.ts`
(`__br.combat` — the acceptance test uses pin, give, set, force, items, resetCooldowns, clearItems).

## 1. Throw (SPEC §15)
- A heavy press starts the heavy swing exactly as today. When that swing's WINDUP ends: if `controls.heavyHeld` is still
  true AND the rider holds a weapon other than 'none' (and not 'baton'), do NOT go to the active phase: replace the
  action with `{ kind: 'throw', side: 1, t: 0, dur: 1.5, weapon, skillId: null, resolved: false }` (aiming, weapon cocked).
  While aiming: no melee hit is resolved, skills/other swings don't start. Release (`heavyHeld` false) → throw now;
  holding 1.5 s → throw automatically. A tap (released before the windup ends) stays a normal heavy swing.
- `controls.lookBack` true at the moment of release → throw backwards (dir −1), else forwards (dir 1).
- Thrown projectile: starts at the rider's hand height (y ≈ 1.4 m) at the rider's s/x; forward speed = rider speed +
  16 m/s (backward: rider speed − 14 m/s, so it flies back relative to the rider); launch vy 3 m/s, gravity 12 m/s²;
  ends when it touches the road (y ≤ 0) or after 1.6 s. Soft homing: each step steer toward the nearest valid target
  (a racing rider, not the thrower, not intangible/invisible) inside a ±18° cone within 35 m (backward: 25 m), lateral
  turn rate 1.2 rad/s. Visual: the weapon's prop mesh (meshes/weapon-props.ts geometry) spinning end over end (~12 rad/s)
  with the toon material + outline, like other combat meshes; dispose everything.
- Rider hit: any racing rider (not the thrower) within 1.0 m of the projectile (track space s/x, and |y − 1| < 1.2) →
  damage = weapon.heavyDamage × 1.2 (10 % crit ×1.6 via the existing crit roll so `ctx.force.crit` works), knock like a
  heavy hit from the throw's side, 0.4 s wobble, SP +6 for the thrower, `lastHitBy`/`lastHitTime` = the thrower (KO
  credit through the normal pipeline), `combat:hit` with `attacker` = thrower, `weapon` = the thrown weapon,
  `heavy: true`, `skillId: null`. Block/shield/intangible rules as for a melee hit (block roll honours `ctx.force.block`).
- Obstacle hit: an active obstacle in `session.obstacles` whose kind is not 'oil' | 'puddle' | 'ramp', when the
  projectile is within halfWidth + 0.4 m laterally, halfLength + 0.4 m along s and below height + 0.3 m →
  `combat:obstacleHit { obstacleId, attacker: thrower, weapon, damage (same formula), thrown: true, pos }`; the
  projectile ends there.
- `combat:throw { riderId, weapon, dir, pos, projectileId }` at release; also the existing `projectile:spawn` /
  `projectile:end` events (kind `weapon:<id>`). The weapon leaves the hand at release (`rider.weapon = 'none'`,
  `weaponUses = Infinity`, via armory equip). Where the projectile ends (hit or landing) the weapon drops as a road
  pickup with uses − 1; if that reaches 0 it breaks instead (`combat:weaponBreak`).
- Numbers go to `tuning.ts` (a THROW table). Riders that are not racing (crashed, finished…) cannot aim or throw.

## 2. `npc:strike` → `npc:hit` (SPEC §14)
Listen on the bus. Resolve like a melee hit from nobody: if the victim is not racing, is crashed/respawning/finished,
has `invuln > 0` or is intangible → `npc:hit` with `damage: 0, blocked: false, parried: false`. Weapon block roll
(the held weapon's `block`, honour `ctx.force.block`) or an active shield → `blocked: true, damage: 0`. Otherwise:
`hp -= damage`, lateral impulse AWAY from the attacker (`side` = the attacker's side of the victim, so push toward
−side) of `knock` m/s, 0.4 s wobble, hit-stop 0.06 s, view cue 'hit'; `npc:hit` with the damage. If hp ≤ 0 run the KO
pipeline with `attacker: null` and the event's `cause` (combat:ko + physics.crash with that cause). `parried` stays
false in this job (the pan parry comes in a later job). Always emit exactly one `npc:hit` per `npc:strike`.

## 3. `pickup:spawn`
Listen on the bus and call the pickup system's spawn with the event's kind / s / x / weapon (weapon only for kind
'weapon').

## Files you own
`src/gameplay/combat/` (whole folder; prefer NEW files: `throw.ts`, `projectiles/thrown.ts`, `external.ts`, and keep
every file < 400 lines).

## Acceptance (the runner runs these; read the test first: `tools/r4/w1-throw.mjs`)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/` → TSC-OWN OK
- `node tools/r4/w1-throw.mjs` → w1-throw OK
- `node tools/combat-check.mjs` → all checks pass (it covers today's melee/skills/pickups/KO — keep it green)
- `node tools/core-check.mjs` → core-check OK
