# w3-achievements — achievements for the r4 mechanics, maps and easter eggs

## Plan
1. Catalogue: add the 26 r4 achievements to `src/data/achievements.ts` (new section comments, one-char icons).
   Verify: `node tools/r4/tsc-own.mjs src/data/achievements.ts` → TSC-OWN OK.
2. Facts: add the r4 per-race facts (`wanted3`, `alliance`, `events`) to `src/gameplay/achievements/facts.ts`.
   Verify: `node tools/r4/tsc-own.mjs src/gameplay/achievements/` → TSC-OWN OK.
3. New rule modules under `src/gameplay/achievements/`: `rules-tricks.ts` (tricks, STYLE, track events, map/mode
   wins), `rules-police.ts` (corgi down, parry, wanted 3, bribe), `rules-rivals.ts` (nemesis, alliance break/win),
   `rules-eggs.ts` (the nine eggs). Register them in `src/gameplay/achievements.ts`.
   Verify: `node tools/r4/tsc-own.mjs src/gameplay/achievements.ts src/gameplay/achievements/` → TSC-OWN OK.
4. `tools/content-ach.mjs`: the career ladder has five tracks now (cup finals are the 5th track) — fix the
   cup scenario; add a scenario per new rule group (positive + near miss).
   Verify: `node tools/content-ach.mjs` → N/N scenarios passed.
5. Acceptance: `node tools/r4/w3-achievements.mjs` → w3-achievements OK; `node tools/ui-results.mjs` → all checks
   passed; `node tools/core-check.mjs` → core-check OK.

## Done
- **Catalogue** (`src/data/achievements.ts`): the 26 r4 ids in four new sections — tricks & style
  (backflip, trick_combo, superman, style_5k, style_broken), police 2.0 (corgi_down, parry, wanted3, bribe),
  rivals (nemesis, alliance_break, alliance_win), events (event_survivor), maps & modes (watertown, gobi, reverse,
  snow, route, llm_win), eggs (ducks, svg, goose_poem, sloth_wait, pelican_god, konami, eggs_all). 45 → 71 ids, the
  old ids keep their order. The egg `sloth` is the achievement `sloth_wait` (the id `sloth` is 比树懒还慢).
- **Rules** (new, all registered in `src/gameplay/achievements.ts`):
  - `rules-tricks.ts`: a trick only counts on a clean landing by the player (`rider:trick` phase 'land');
    `style_5k` = a banked chain ≥ 5,000 without a break, `style_broken` = a broken chain ≥ 2,000;
    `event_survivor` = two started track events and not one `rider:crash` at the player's finish line;
    the map/mode ids (watertown, gobi, reverse, snow, route, llm_win) only on a win (place 1).
  - `rules-police.ts`: `corgi_down` (police:down by the player), `parry` (combat:parry by the player),
    `wanted3` (police:wanted level 3 **then** police:alert reason 'lost'), `bribe` (an accepted police:bribe).
  - `rules-rivals.ts`: `nemesis` (race:nemesisDown by the player), `alliance_break` (an alliance against the
    player breaking with reason 'betrayal'), `alliance_win` (a win while such an alliance existed).
  - `rules-eggs.ts`: the eggs of the save (five ducks → `ducks`, any svg_* → `svg`, goose_poem, sloth → `sloth_wait`,
    pelican_god, unlocks 'llm' → `konami`) unlock at once on `secret:found` and again from the save at every
    `race:end`, so the eggs found outside a race (PELICAN, credits, Konami) are collected at the next race end.
    `eggs_all` = the nine eggs (ducks counts as one, any duck is enough for the egg).
- **Facts** (`facts.ts`): `wanted3`, `alliance`, `events`.
- **content-ach.mjs**: the cup scenario now uses the five-track ladder (the cup final is `gobi`, bests `1-gobi`…);
  six new scenarios, each with its near misses (a rival's trick, a failed trick, 4,900 / 1,900 chains, a rival's
  police KO, a refused bribe, ★2 then lost, a timed-out alliance, a 2nd place, two events with a crash, four ducks).

## In progress / next
Nothing. All five acceptance commands pass.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/data/achievements.ts src/gameplay/achievements.ts src/gameplay/achievements/`
- `node tools/r4/w3-achievements.mjs`
- `node tools/content-ach.mjs`
- `node tools/ui-results.mjs`
- `node tools/core-check.mjs`

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/data/achievements.ts src/gameplay/achievements.ts src/gameplay/achievements/`
  → `TSC-OWN OK`
- `node tools/r4/w3-achievements.mjs` → `PASS near misses unlock nothing (none)`, `PASS the records sheet shows
  every achievement (71/71)`, `PASS achievements: no console errors ()`, `w3-achievements OK`
- `node tools/content-ach.mjs` → `31/31 scenarios passed · 71 achievements defined`
- `node tools/ui-results.mjs` → `[ui-results] all checks passed`
- `node tools/core-check.mjs` → `core-check OK`

## Known issues
- None. (The whole-project typecheck reports 4 errors in files outside this job — other workers mid-edit; none in
  the files of this job.)

## Requests
- None.
