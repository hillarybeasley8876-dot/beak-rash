# r4 job w3-achievements — achievements for the r4 mechanics, maps and easter eggs (gameplay/achievements)

Read SPEC.md §14–§21 (the r4 mechanics, maps and eggs) and §22. All events exist in `src/core/events-map.ts`.
Read `src/data/achievements.ts` (catalogue: ids are stable, order = display order), `src/gameplay/achievements.ts`
(the system: rules only fire while a human race is attached; `unlock` saves once and emits `achievement:unlock`),
`src/gameplay/achievements/` (facts.ts = per-race facts + RuleCtx; rules-race / ride / combat / career), and
`tools/content-ach.mjs` (node scenarios driving the real rules through a fake app).

## Build it
1. Add these 26 achievements to the catalogue (Chinese name, one-line desc, ONE-character icon; meme tone like the
   existing ones; group them under new section comments in a sensible display order):
   - tricks & style: `backflip` (land a backflip), `trick_combo` (land a trick with `count` ≥ 3), `superman` (land a
     superman), `style_5k` (bank a STYLE chain ≥ 5,000 that was NOT broken), `style_broken` (a chain ≥ 2,000 broken —
     `style:bank` with `broken: true`, "煮熟的鸭子飞了");
   - police: `corgi_down` (柯基下班了 — `police:down` by the player), `parry` (当！— the player parries:
     `combat:parry` with riderId = player), `wanted3` (reach ★3 — `police:wanted` level 3 for the player — and then lose
     the police: `police:alert` reason 'lost'), `bribe` (V我50 — `police:bribe` accepted for the player);
   - rivals: `nemesis` (`race:nemesisDown` by the player), `alliance_break` (塑料友谊 — an alliance against the player
     breaks with reason 'betrayal'), `alliance_win` (win a race in which an alliance formed against the player);
   - events: `event_survivor` (two track events started in the race — `race:event` phase 'start' — and the player
     finished without a single crash);
   - maps & modes (a WIN = the player finishes 1st): `watertown`, `gobi`, `reverse` (config.reverse), `snow`
     (config.weather 'snow'), `route` (config.route > 0), `llm_win` (on the 'llm' bike);
   - eggs: `ducks` (all five `duck_*` in `save.data.secrets`), `svg` (any `svg_*`), `goose_poem`, `sloth_wait` (the egg
     id is `sloth`; the achievement id `sloth` is already taken by 比树懒还慢), `pelican_god`, `konami` (`save.data.unlocks`
     has 'llm'), `eggs_all` (all nine eggs: ducks (any duck counts for the egg), konami, bribe, svg, goose_poem, sloth,
     pelican_god, pelican_word, credits_thanks).
2. Rules in new rule module(s) (e.g. `rules-r4.ts`, `rules-eggs.ts`) registered in `achievements.ts`. A win is decided
   like `first_win` (`race:finishLine` of the player with place 1). Egg achievements unlock on `secret:found` during a
   race AND at every race end from the save (the UI eggs — PELICAN, credits, Konami — happen outside races, so their
   achievements are collected at the next race end, like the cup rules do). Near misses must not unlock: rivals'
   tricks, failed tricks, a chain of 4,900, a broken chain of 1,900, a corgi downed by a rival, a refused bribe,
   ★2 then lost, an alliance that times out, two events with a crash, a 2nd place.
3. Update `tools/content-ach.mjs`: the track order now has five tracks (cup finals are the 5th track — the
   `cup-and-career-clears` scenario fails today because it assumes three) and add scenarios for the new rules (each
   positive + its near miss).

## Files you own
`src/data/achievements.ts`, `src/gameplay/achievements.ts`, `src/gameplay/achievements/` (folder), `tools/content-ach.mjs`.

## Acceptance (the runner runs these; read `tools/r4/w3-achievements.mjs` first)
- `node tools/r4/tsc-own.mjs src/data/achievements.ts src/gameplay/achievements.ts src/gameplay/achievements/` → TSC-OWN OK
- `node tools/r4/w3-achievements.mjs` → w3-achievements OK
- `node tools/content-ach.mjs` → every scenario passed (`N/N scenarios passed`)
- `node tools/ui-results.mjs` → all checks passed
- `node tools/core-check.mjs` → core-check OK
