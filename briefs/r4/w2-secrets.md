# r4 job w2-secrets — the easter eggs module (`src/gameplay/secrets/`)

Read SPEC.md §21 (easter eggs — your spec; items 1, 4, 5, 6, 7 and the egg records), §5 (art bible) and §22.
Contracts already in core (do not edit core): `secret:found { id, riderId, pos, first }`, `SaveData.secrets`,
`SaveData.unlocks`, FeatureKind `secret`, ObstacleKind `prop`, `combat:obstacleHit` (combat emits it when a THROWN
weapon reaches an obstacle — any active obstacle that is not oil/puddle/ramp, so a 'prop' works), `police:bribe`,
`taunt`. Core already loads your module: `src/gameplay/secrets/index.ts` `createSecrets(app)` → `{ attach(session |
null), update?(dtSim, dtReal), dispose }` (a no-op scaffold for you to replace; `update` is called once per frame).
Look at `src/gameplay/style/index.ts` (a finished module of the same kind: bus listeners, attach/detach, update).

## Build it
1. 小黄鸭 ducks (`duck_<track>` for coast, city, mountain, watertown, gobi): one small yellow rubber duck per track
   (orange beak, black eyes, toon + ink outline, ~0.35 m, gently bobbing), placed from a track feature of kind
   'secret' with `data.id === 'duck'` if the layout has one, else automatically: seeded per track (fixed seed, same
   spot every race) at 30–85 % of the track, on the drivable surface near one edge (|x| between halfWidth − 1.5 and
   the bound − 0.5), off the racing line, not on a bridge/tunnel/ramp. A racing rider... only the PLAYER finds it:
   within 1.2 m → `secret:found { id, riderId: player, pos, first }` once per race, quack (`app.audio.sfx('ui.coin')`
   is fine until audio adds a quack), toast `找到小黄鸭！(n/5)` (n = ducks found in the save). When all five are
   found, add 'duck' to `SaveData.unlocks` (the garage's DUCK RIDER toggle reads it).
2. SVG 画架 (`svg_<track>`): an easel at a seeded scenic spot (40–70 % of the track) just beyond the drivable edge
   (cannot be ridden into), with a canvas texture of a deliberately wrong flat "SVG" pelican on a bicycle (chain to
   the neck, mismatched wheels) and the caption "Generate an SVG of a pelican riding a bicycle", registered as a
   non-solid Obstacle kind 'prop' (halfWidth ~0.8, halfLength ~0.4, height ~2.2). A `combat:obstacleHit` on it with
   `thrown: true` by the player → it spins, found, `player.coins += 50`, toast `致敬原作！+50 小鱼干`. Melee hits do
   nothing.
3. 鹅鹅鹅 (`goose_poem`): three bell PRESSES within 5 s (count raw presses via `app.input.onAction` — the bell has a 3 s
   cooldown, so do not count `combat:bell`) with the goose racing within 8 m of the player → the goose goes berserk 8 s
   (push an 'angry' status with `source: player.id`, boostTime 8 at power 0.15) and a `taunt { riderId: goose,
   character: 'goose', text: '鹅鹅鹅，曲项向天歌——' }`; found.
4. 比树懒还慢 (`sloth`): the sloth is in the race and the player has not pedalled (throttle 0, speed < 1 m/s) for 8 s
   after GO → found; the sloth stops for 2 s (a strong 'slow' status) with a `taunt` '你也不急？', then floors it
   (boostTime 3 at power 0.6).
5. 鹈鹕神显灵 (`pelican_god`): on coast and mountain, seeded from the race seed so that about 1 race in 15 has it: at a
   seeded time (30–120 s after GO) a giant cloud-pelican silhouette (soft white/grey cloud blobs forming a pelican,
   named `pelican-god`, high in the sky ahead of the player, unaffected by fog) drifts across for 12 s. A bell press
   while it is visible → found, `player.coins += 50`, toast `心诚则灵 +50 小鱼干`.
6. Records: every first find goes into `SaveData.secrets` (one `app.save.update`); also record 'bribe' when a
   `police:bribe` with `accepted: true` arrives for the player (emit `secret:found` for it too).
7. Debug hook (required by the test): `window.__br.secrets = { list(): Array<{ id, kind, s, x, obstacleId? }>,
   forceGod(), godPlanned(): boolean }`, removed on detach. Everything you add to the scene / session.obstacles is
   removed and disposed on detach. Toon materials + ink outlines; no Math.random (session rng / fixed seeds).

## Files you own
`src/gameplay/secrets/` (folder), `src/data/secret-lines.ts` (new, if you want the lines in data).

## Acceptance (the runner runs these; read `tools/r4/w2-secrets.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/secrets/ src/data/secret-lines.ts` → TSC-OWN OK
- `node tools/r4/w2-secrets.mjs` → w2-secrets OK
- `node tools/core-check.mjs` → core-check OK
- `node tools/race-soak.mjs --track coast` → SOAK OK
