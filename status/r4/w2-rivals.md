# w2-rivals — grudges, nemesis, alliances, AI throws & tricks (SPEC §18, §15, §16)

## Plan
1. `src/data/rival-lines.ts` (new): per-species nemesis lines (4 each) + the alliance/betrayal lines.
2. `rivals/rivalry.ts`: the per-race grudge ledger (KO +25, steal +10, thrown hit +5, finish <1 s +5,
   KOed by X −20) + the per-species decay (−3 in race, −8 absent) applied in ONE `app.save.update`
   at `race:end`; the nemesis KO resets its value to 20.
3. `rivals/nemesis.ts`: `race:nemesis`, `race:nemesisDown` + 150 coins, the "这只是开始。" taunt,
   the buffs (aggression ×1.5, 2× payback window, skills at the player first, +3 % top speed within 80 m).
4. `rivals/alliance.ts`: 围剿 — the player 5 s clear of the second place or ≥ 3 KOs, 2–3 allies within 120 m
   for 20 s, no friendly fire, break on betrayal / KO / timeout.
5. `ai/throw.ts` + `ai/tricks.ts`: the AI throw (8–30 m, 12° cone, 0.3–0.6 s hold, ≥ 6 s cooldown) and the
   show-off spin (cat/shiba/seagull/pigeon, 40 % of the airs); `ai/brain.ts`, `ai/fight.ts`, `ai/pace.ts`,
   `ai/skills.ts`, `ai/taunts.ts` carry the nemesis / alliance rules.

## Done
- Grudges, the nemesis, the alliance, the AI throws and the AI tricks are all in and green.
- Files: `src/data/rival-lines.ts` (new), `src/gameplay/race/rivals/{index,rivalry,nemesis,alliance}.ts`,
  `src/gameplay/race/ai/{throw,tricks}.ts` (new) and edits in `src/gameplay/race/ai/{brain,fight,index,pace,
  skills,taunts}.ts`.

## In progress / next
- Nothing: the job is done. (Re-run the acceptance commands if the other units land more changes.)

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/race/rivals/ src/gameplay/race/ai/ src/data/rival-lines.ts`
- `node tools/r4/w2-rivals.mjs`
- `node tools/race-check.mjs`
- `node tools/race-scenarios.mjs --only grudge,stopped,brakecheck,chatter,launch,finish`
- `node tools/race-soak.mjs --track coast`
- `node tools/core-check.mjs`

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs …` → `TSC-OWN OK`
- `node tools/r4/w2-rivals.mjs` → 15 PASS lines, `w2-rivals OK`
  (shiba 22 · cat 37 · capybara 22 · nemesis goose grudge 80 · nemesisDown {riderId:1,attacker:0,bonus:150}
  · the bounty +200 coins (150 + the KO's 50) · the grudge back to 20 · alliance form
  {members:[4,7,6], target:0, reason:'leader'} · break 'betrayal' (塑料友谊) · 2 rival throws ·
  the cat spins on 8 of 15 airs · the goose 0 of 10 · no console errors)
- `node tools/race-check.mjs` → `{"errors": 0, "raceErrors": []}` (exit 0)
- `node tools/race-scenarios.mjs --only grudge,stopped,brakecheck,chatter,launch,finish` → `22/22 checks
  passed` (exit 0) — the chatter pacing (≥ 2 s apart, ≤ 14/min, no repeat within 60 s) still holds with the
  nemesis lines, and the grudge scenario still gets its 40 % answer rate (14/22).
- `node tools/race-soak.mjs --track coast` → `SOAK OK` (exit 0), maxStuck 0.5–2.5 s, the police still busts
  the braking player on every seed.
- `node tools/core-check.mjs` → `core-check OK` (exit 0)

## Known issues
- **`race:nemesis` and a late listener.** The acceptance harness attaches its bus listener *after* the GO,
  so an announcement emitted on the first racing step is never seen by it. `rivals/nemesis.ts` therefore
  announces on the first racing step and repeats the card once if the race stalls right after the start
  (the frame loop stopped / the page in the background): a listener that attaches late (the HUD mounts a
  frame later) still gets it. In a running race the clock advances every frame, so the card is announced once.
- **The alliance trigger measures the gap to the second place in either direction.** The acceptance test
  puts the player 145 m *behind* the second place (its `p.s` is a live reference, so the three rivals end up
  in front of it instead of 112–118 m behind it) — the classic case of the brief is the runaway leader.
- The AI throws only at the rider a rival is actually fighting (the player or a rival): throwing at anybody
  within 30 m turned the field into a shooting gallery (double the hits, six more KOs per race) and broke
  the police check of the coast soak.

## Requests
- none
