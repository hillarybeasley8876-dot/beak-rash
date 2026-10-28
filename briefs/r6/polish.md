# r6 job polish — the roster's keys, the police achievements, rivals that do not boost into you (ui + content + race)

A batch of small fixes found reviewing r6. Read SPEC.md §23–§25 and each file before changing it.

## Build it
1. **Roster keys** (`src/ui/screens/roster.ts`): ↓ from ANY card of the grid's bottom row enters the slot row (the
   slot under that column: columns 1–3 → slots 1–3, columns 4–5 → the ult slot), not only from the last card. ↑
   from a slot returns to the card the player came down from (remember it; when the slots were entered by picking a
   card with Enter, ↑ returns to that card). Today only the last card does it (`tools/r6/roster.mjs` section 4).
2. **The cast ult's cut-in** (`src/ui/hud/events.ts`): the `ult:start` handler passes the event's `skillId` to
   `cutins.ultStart(e.riderId, e.skillId)` (the layer already takes it).
3. **HOW TO kit header** (`src/ui/screens/howto-pages.ts` + `howto.css`): the 「KIT」 header of the 技能 tab uses inline
   `style` strings; move them into classes in `howto.css` (same look).
4. **Stat labels** (`src/ui/p5/kit.css`): `.br-stat-label` (right-aligned, fixed 4.2em) cuts the edge of its last glyph
   in the CN display face on every screen that uses `statBar` (garage, roster). Give the label room (padding-right
   0.3em, or the box a little wider) so no glyph is clipped; the bars stay aligned. Then drop the roster's own
   override in `roster.css` (`.br-rs-dstats .br-stat-label`).
5. **Police achievements** (SPEC §25; `src/data/achievements.ts` + `src/gameplay/achievements/rules-police.ts`). The
   one-officer achievement exists (`corgi_down` 柯基下班了). Add, in the police block after `bribe`:
   - `police_three`: name 「一日三下班」, desc 「一场比赛里让三名柯基警官提前下班」, icon 「三」 — the player's third
     `police:down` in one race.
   - `police_off`: name 「警局下班」, desc 「打退特警小队，这一程再也没有警察」, icon 「警」 — `police:offDuty` for the
     player.
   - `police_skill`: name 「降维打击」, desc 「用技能让柯基警官下班」, icon 「技」 — the hit that downed the officer
     was the player's skill: remember the last `combat:obstacleHit` per obstacle (attacker, skillId or `ko`), and on
     `police:down` check that it was the player's and carried a skill id. A swing after the skill hit takes it back.
   Counters live in the race facts (`facts.ts`, reset per race). Check every unlock and non-unlock in
   `tools/r6/ach-police.mjs`.
6. **Rivals never boost into a slower rider ahead** (`src/gameplay/race/ai/skill-rules.ts`): measured by the
   brakecheck scenario, seed 3: a cryingcat 9.5 m behind a braking player casts 泪如雨下 (it boosts the caster +25 %)
   and rams the player at strength 8. A skill that speeds the caster up (rocket, tears, fresh, warsong, doge, slide,
   flash, wing, ghost, blink, the time stop) is held while a rider is in my lane (|dx| < 1.6 m) 0–15 m ahead and I
   close on it faster than 4 m/s — the boost waits until the lane is clear. Give the two meme signatures their own
   rules instead of the category's: `cryingcat.tears` — a rival inside the rain (9 m) and the hold above;
   `moodeng.bounce` — a rival 3–9 m ahead within 3 m sideways (the slam lands 6 m ahead, 5 m radius).

## Files you own
`src/ui/screens/roster.ts`, `src/ui/screens/roster.css`, `src/ui/hud/events.ts`, `src/ui/screens/howto-pages.ts`,
`src/ui/screens/howto.css`, `src/ui/p5/kit.css`, `src/data/achievements.ts`,
`src/gameplay/achievements/rules-police.ts`, `src/gameplay/achievements/facts.ts`,
`src/gameplay/race/ai/skill-rules.ts`, `src/gameplay/race/ai/skills.ts`.

## Acceptance (the runner runs these; read `tools/r6/roster.mjs` and `tools/r6/ach-police.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/ src/gameplay/ src/data/` → TSC-OWN OK
- `node tools/r6/roster.mjs` → r6-roster OK
- `node tools/r6/ach-police.mjs` → r6-ach-police OK
- `node tools/content-ach.mjs` → scenarios passed (no FAIL)
- `node tools/race-scenarios.mjs --only brakecheck --seeds 1,2,3,4,5,6` → 6/6 checks passed
- `node tools/r6/skills.mjs --only ai` → r6-skills OK
- `node tools/race-soak.mjs --track coast` → SOAK OK
- `node tools/r4/w3-hud.mjs` → w3-hud OK
- `node tools/core-check.mjs` → core-check OK
