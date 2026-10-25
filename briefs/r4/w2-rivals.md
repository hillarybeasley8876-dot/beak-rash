# r4 job w2-rivals — grudges, the nemesis, alliances, AI throws and AI tricks (race unit)

Read SPEC.md §9 (race AI today), §18 (rivals — your main spec), §15 (throwing: `Controls.heavyHeld`), §16 (air tricks:
the input rules) and §22. Contracts already in core (do not edit core): `SaveData.rivalry`, `RaceConfig.nemesis` (core
fills it: the rival with the biggest grudge ≥ 50 in this field; `?nemesis=<id>` forces one), events `race:nemesis`,
`race:nemesisDown`, `race:alliance`, `taunt`, `combat:ko`, `combat:hit`, `combat:weaponPick`, `combat:throw`,
`race:end`. Race logic already calls your module: `src/gameplay/race/rivals/index.ts` `createRivals(ctx, ai)` with
`preStep` / `postStep` / `dispose` (a no-op scaffold for you to replace).

## Read first
`src/gameplay/race/logic.ts` (where rivals plug in), `src/gameplay/race/ai/` (brain.ts, fight.ts — the 5 s grudge /
payback hunt, the hunt token, pace.ts paybackPace, personality.ts per species, control.ts the controls an AI writes),
`src/gameplay/race/results.ts`, `src/gameplay/combat/throw.ts` (how a throw is triggered from controls),
`src/sim/tricks.ts` (how a trick is triggered from controls: a FRESH drift press in the air + steer, only if there is
enough air left), `src/data/roster.ts` (species, taunt lines). Test: `tools/r4/w2-rivals.mjs` (read it first).

## Build it
1. Grudges (`rivals/rivalry.ts`): track this race's events, apply at `race:end` (one `app.save.update`):
   the player KOs X +25 · steals X's weapon +10 · lands a thrown hit on X +5 · finishes ahead of X by < 1 s +5 ·
   X KOs the player −20 · then every species in the race −3, every rival species NOT in the race −8; clamp 0..100;
   keys only for the 8 rival species. If the player KO'd the nemesis this race, its value ends at exactly 20.
2. The nemesis (`config.nemesis`): emit `race:nemesis { riderId, character, grudge }` once on the first step; it
   fights harder: aggression ×1.5, the payback hunt on the player always armed with a 2× window, signature skills
   aimed at the player first, +3 % top speed (`rider.rubber`) while behind the player and within 80 m, nemesis taunts
   (`taunt` event) from a new line table (2+ lines per species in `src/data/rival-lines.ts`, the game's kind voice).
   The player KOs it → `race:nemesisDown { riderId, attacker, bonus: 150 }` and `player.coins += 150`. It KOs the
   player → a `taunt` "这只是开始。".
3. Alliances 围剿 (`rivals/alliance.ts`): when the player is 1st with a lead > 5 s over 2nd (lead = (player.s −
   second.s) / max(player.speed, 12)) or has KO'd ≥ 3 riders this race, at most once per 60 s, the 2–3 rivals nearest
   behind the player within 120 m ally for 20 s: `race:alliance { phase: 'form', members, target: player, reason:
   'leader' | 'rampage' }`. Allies never attack each other, all hunt the player (skills and swings), draft each other.
   It breaks with `phase: 'break'` and reason 'betrayal' (an ally's `combat:hit` on another ally → those two fight
   each other for 5 s, a 塑料友谊 taunt), 'ko' (the player KOs a member) or 'timeout' (20 s).
4. AI throws (`ai/`): an armed rival (weapon not 'none' / 'baton') with a target (the player, or a rival it fights)
   8–30 m ahead within ~12° of its heading holds `heavy` + `heavyHeld` for 0.3–0.6 s, then releases (combat throws);
   per-species aggression, ≥ 6 s between a rider's throws, nemesis and allies throw more eagerly. Rivals never throw
   during the intro/countdown or at the player while it is invulnerable/crashed.
5. AI tricks (`ai/`): show-off species (cat, shiba, seagull, pigeon) on an air with ≥ 0.25 s behind it and enough air
   left (≥ 0.55 s: estimate from y, vy and gravity 17 m/s²) do a spin 40 % of the airs (a fresh drift press + steer
   for 2–4 steps, then release); every other species never tricks. Seeded rng, deterministic.
Numbers in tuning tables. Keep the race fair (no visible cheating), keep today's race scenarios green.

## Files you own
`src/gameplay/race/rivals/` (folder), `src/gameplay/race/ai/` (folder), `src/data/rival-lines.ts` (new).

## Acceptance (the runner runs these; read `tools/r4/w2-rivals.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/race/rivals/ src/gameplay/race/ai/ src/data/rival-lines.ts` → TSC-OWN OK
- `node tools/r4/w2-rivals.mjs` → w2-rivals OK
- `node tools/race-check.mjs` → exit 0
- `node tools/race-scenarios.mjs --only grudge,stopped,brakecheck,chatter,launch,finish` → exit 0
- `node tools/race-soak.mjs --track coast` → SOAK OK
- `node tools/core-check.mjs` → core-check OK
