# r6 job polish — roster keys, the ult cut-in, stat labels, police achievements, rivals that do not boost into you

## Plan
1. `src/ui/screens/roster.ts`: ↓ from any card of the grid's bottom row enters the slot row (column 1–3 →
   slots 1–3, column 4–5 → the ult slot); ↑ from a slot returns to the card it was entered from (also after
   Enter picked a card). Verify: `node tools/r6/roster.mjs` (section 4).
2. `src/ui/hud/events.ts`: the `ult:start` handler passes `e.skillId` to `cutins.ultStart`.
   Verify: `node tools/r6/roster.mjs` (section 3, the SHOWTIME cut-in names 雷暴).
3. `src/ui/screens/howto-pages.ts` + `howto.css`: the 「KIT」 header's inline `style` strings become classes.
   Verify: `node tools/r6/roster.mjs` (the HOW TO 技能 page) + `node tools/core-check.mjs`.
4. `src/ui/p5/kit.css`: `.br-stat-label` gets room (padding-right) so the CN glyph is not clipped; the roster's
   own override in `roster.css` goes. Verify: `node tools/r6/roster.mjs`, `node tools/r4/w3-hud.mjs`.
5. `src/data/achievements.ts` + `src/gameplay/achievements/facts.ts` + `rules-police.ts`: `police_three`,
   `police_off`, `police_skill` (the last `combat:obstacleHit` per obstacle decides whether the downing blow
   was a skill). Verify: `node tools/r6/ach-police.mjs`, `node tools/content-ach.mjs`.
6. `src/gameplay/race/ai/skill-rules.ts` + `skills.ts`: a skill that speeds the caster up is held while a
   slower rider is in my lane 0–15 m ahead and I close on it faster than 4 m/s; `cryingcat.tears` and
   `moodeng.bounce` get their own rules. Verify: `node tools/race-scenarios.mjs --only brakecheck --seeds 1,2,3,4,5,6`,
   `node tools/r6/skills.mjs --only ai`.

## Done
1. **Roster keys** (`roster.ts`): the grid's bottom row is the row the slot row hangs under (`ROWS`, `COLS`);
   ↓ on any card of it enters the slot under that column (`SLOT_FOR_COLUMN`: columns 1–3 → the slots 1–3,
   columns 4–5 → the ult). The slot row remembers the card it was entered from (`slotsFrom`), so ↑ returns
   there — also when the row was entered by picking a card with Enter. `node tools/r6/roster.mjs`:
   `PASS ↓ from every card of the bottom row enters the slot row, ↑ returns to that card
   (cryingcat→1→cryingcat xinxian→2→xinxian moodeng→3→moodeng pedro→ult→pedro hamster→ult→hamster)`.
2. **The cast ult's cut-in** (`src/ui/hud/events.ts`): `p.cutins.ultStart(e.riderId, e.skillId)` — the cut-in
   names the ult that was cast, not the rider's default one.
3. **HOW TO kit header** (`howto-pages.ts` + `howto.css`): the three inline `style` strings are now
   `.br-ht-shead` / `.br-ht-swho` / `.br-ht-scode`; the computed style is the same
   (absolute / right 0 / top 640px / flex / gap 14px, 34px + 24px) — checked in the page
   (`shots/r6-polish/howto-kit.jpg`).
4. **Stat labels** (`src/ui/p5/kit.css`): `.br-stat-label` gets `padding-right: 0.3em` (the box keeps its
   4.2em width, so the bars stay where they are; the ink of the last glyph now has room). The roster's own
   `.br-rs-dstats .br-stat-label` override is gone. Before/after crops of the garage label:
   `shots/r6-polish/labels.jpg` (cut) vs `shots/r6-polish/labels2.jpg` (whole 度).
5. **Police achievements** (`data/achievements.ts`, `achievements/facts.ts`, `rules-police.ts`):
   `police_three` 「一日三下班」, `police_off` 「警局下班」, `police_skill` 「降维打击」 after `bribe`.
   The counters live in the race facts (`policeDowns`, `policeHits`), so they reset every race. The last
   `combat:obstacleHit` per officer is remembered (attacker + skill id or `ko`): on `police:down` the
   downing blow must have been the player's and carried a skill id — a swing after the skill hit takes it
   back. `node tools/r6/ach-police.mjs` → `r6-ach-police OK` (9/9 PASS),
   `node tools/content-ach.mjs` → `31/31 scenarios passed · 74 achievements defined`.
6. **Rivals that do not boost into a slower rider** (`race/ai/skill-rules.ts`, `race/ai/skills.ts`):
   - `BOOST_HOLD` (15 m ahead, 1.6 m sideways, closing faster than 4 m/s) + `rammingAhead(v)`: a rider in
     my own lane that I close on fast.
   - `SELF_SPEED` (rocket, tears, fresh, warsong, doge, slide, flash, wing, ghost, blink, the time stop):
     `useSkill` holds them while `rammingAhead(v)` — the check runs on the whole field, so the 宿敌 `prefer`
     path cannot slip past it.
   - `cryingcat.tears` has its own rule: a rival inside the 9 m rain, and the hold above.
   - `moodeng.bounce` has its own rule: a rival inside the slam's own reach (6 m ahead, 5 m radius; the
     brief's window — 3–9 m ahead, within 3 m sideways — is the core of it).
   - `hamster.violin` (the 悲伤小提琴) stays out of the player's patch of road, like the brainfight: the
     silence takes the player's skills away too, and the silenced pack's formation under the player is what
     the brakecheck's ram rides on. This is the change that makes brakecheck seed 3 pass (see "Known issues").

## In progress / next
- Nothing — the job is finished, waiting for the lead's review.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/ src/gameplay/ src/data/`
- `node tools/r6/roster.mjs`
- `node tools/r6/ach-police.mjs`
- `node tools/content-ach.mjs`
- `node tools/race-scenarios.mjs --only brakecheck --seeds 1,2,3,4,5,6`
- `node tools/r6/skills.mjs --only ai`
- `node tools/race-soak.mjs --track coast`
- `node tools/r4/w3-hud.mjs`
- `node tools/core-check.mjs`
- extra: `node tools/race-scenarios.mjs` (the whole file) → `62/62 checks passed`;
  `node tools/r6/skills.mjs` (the whole file) → `r6-skills OK`.
- probes: `node shots/r6-polish/probe-stats.mjs` (the stat labels), `probe-label.mjs` (the label crop),
  `probe-howto.mjs` (the KIT header), `probe-brake.mjs <seed> [from] [character]` (the brakecheck timeline).

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/ui/ src/gameplay/ src/data/` → `TSC-OWN OK`
- `node tools/r6/roster.mjs` → `r6-roster OK` (28 PASS, 0 FAIL; section 4 as quoted above)
- `node tools/r6/ach-police.mjs` → `r6-ach-police OK` (9 PASS)
- `node tools/content-ach.mjs` → `31/31 scenarios passed · 74 achievements defined` (no FAIL)
- `node tools/r6/skills.mjs` (the whole file) → `r6-skills OK` (9 PASS)
- `node tools/race-scenarios.mjs --only brakecheck --seeds 1,2,3,4,5,6` → `6/6 checks passed`
  (seeds 1, 2, 3, 4, 5, 6 PASS; the whole file: `62/62 checks passed`)
- `node tools/race-soak.mjs --track coast` → `SOAK OK`
- `node tools/r4/w3-hud.mjs` → `w3-hud OK`
- `node tools/core-check.mjs` → `core-check OK`

## Known issues
- **The AI's followers still brake late for a rider that brakes** (the race unit's `followLimit` /
  `huntLimit`, `src/gameplay/race/ai/brain.ts`): a rival happily rides 2–3 m/s faster than the player 10 m
  behind it and only reacts when the gap is under ~2 m, because the plan uses `FOLLOW_DECEL = 4 m/s²` and
  the rider ahead's *current* speed, while the player brakes at 12.6 m/s² and the AI can only shed 8 m/s².
  Measured with `shots/r6-polish/probe-brake.mjs 3` (the cryingcat, seed 3):
  `t=12.43 th=1 br=0 v=21.8 ds=9.3` → `t=13.03 th=0 br=1 v=19.2 ds=4.8` → `t=13.33 v=16.0 ds=1.9` (the
  player at 6.0 m/s) → the bump at k=8. The brakecheck seed 3 now passes because the AI's skill usage no
  longer shifts the pack into that formation, but the underlying late braking is still there (it is a
  knife-edge: with the AI casting no skills at all the seed passes too, and with the sad violin played next
  to the player it failed).
- The `moodeng.bounce` rule uses the slam's own reach (6 m ahead, 5 m radius) instead of the brief's narrow
  window (3–9 m ahead, within 3 m sideways): with the narrow window alone the moodeng stopped using its slam
  at all in the brakecheck and seed 1 flipped to a fail (`moodeng:5.8`); the reach keeps 6/6.

## Requests
- **race unit (`src/gameplay/race/ai/brain.ts`): the followers should brake earlier for a rider that
  brakes.** `followLimit()` plans with `FOLLOW_DECEL = 4` (m/s²) and the rider ahead's current speed, and
  `huntLimit()` lets a hunter of the player ride up to 5 m/s faster than it — so a rival closes on the
  player and only reacts at the last moment. Raising `FOLLOW_DECEL` to the real deceleration (8–10) and
  assuming the rider ahead *decelerates* (or braking for the rider behind) would make the ram impossible
  instead of merely unlikely. Not touched here: `brain.ts` is not in this job's file list.
