# content — status

## Files
- `src/data/roster.ts` text: all 10 characters 12 taunts / 6 KO / 6 hurt / 4 victory / 4 defeat / 3 skill shouts
  (new fields `victoryLines`, `defeatLines`, `skillLines`; pelican skillLines = torpedo, gulp, wing) +
  `POLICE_LINES` {alert, chase, busted, lost} × 6. Numbers/ids untouched (diffed vs HEAD). Every line that has a
  voice clip (data/voice.ts, matched by exact text) is kept — the lint enforces it.
- `src/data/tips.ts` 72 tips in `TIP_GROUPS` (ride / fight / rivals / trivia) → `TIPS` (flat, unchanged export).
- `src/data/memes.ts` 43 `BILLBOARD_LINES`, 22 `ROAD_SIGNS` (first six keep their roles: limit「：」, fish, pelican,
  lane →, ← lane, curves), `TRACK_BILLBOARDS` / `TRACK_SIGNS` per track, `GRADES` (shape unchanged); re-exports
  `ACHIEVEMENTS` / `AchievementDef` from data/achievements.ts.
- `src/data/achievements.ts` 42 defs {id, name, desc, icon}; `AchievementId` type; the 8 original ids kept.
- `src/data/strings.ts` HOWTO_KEYBOARD / HOWTO_GAMEPAD (match core/input.ts) / HOWTO_SKILL_TIPS / HOWTO_BASICS /
  HOWTO_SP, CREDITS (24) + CREDIT_OUTRO, CALENDAR 宜/忌 ×10 per track + `calendarFor(trackId, date)` (stable per
  day), GRADE_QUOTES ×3 per grade, ANNOUNCER (19 callouts: cn / en / voice clip id / alt lines), PLACE_CALLOUTS
  (1st–8th), WRECK_LINES per crash cause.
- `src/gameplay/achievements.ts` `createAchievements(app)` → `{ attach(session|null), fresh(), dispose() }`;
  rules in `src/gameplay/achievements/{facts,rules-race,rules-ride,rules-combat}.ts`. Saves each id once
  (`app.save` achievements), emits `achievement:unlock {id}`. Autopilot races, quit/restart and anything after
  `race:end` never unlock. Debug: `__br.ach.{fresh, facts, allowAutopilot, forget}`.
- `sandbox/content.html` (+ content.ts / .kit.ts / .world.ts / .css): gallery of every line in the game's fonts at
  the game's sizes (bubbles, toasts, tip boxes, calendar, grade stamps, chips, callouts, billboard/sign faces);
  overflow outlined yellow + `window.__content.overflow`.
- tools: `content-lint.mjs` (+ `content-ts.mjs` TS import hook, `content-fonts.mjs` WOFF cmap glyph coverage),
  `content-ach.mjs` (21 node rule scenarios), `content-shots.mjs gallery|game` (+ `content-game.mjs`).

## Done
- All deliverables above; lint 0 errors (977 strings), 21/21 rule scenarios, gallery 732 checks 0 overflow,
  in-game check OK (real units; audio+camera stubbed because their files were mid-edit by other agents).

## Next
- Polish pass from screenshots; after core wiring, re-run `content-shots.mjs game` against game.ts's instance.

## Known issues
- New roster lines have no voice clips yet (audio falls back to animal calls / existing clips).
- Billboards drawn next to poster art shrink 12+ glyph lines to ~22–25 px (track layout; see gallery world section).

## Core requests
1. core/game.ts — wire the achievements system like the other app systems:
   `import { createAchievements } from '../gameplay/achievements';` · constructor: `this.achievements =
   createAchievements(app)` · startRace after `audio.attach?.(session)`: `this.achievements.attach(session)` ·
   endSession next to the other `attach(null)` calls, i.e. BEFORE `session.dispose()` (police teardown emits
   `police:alert` level 0 during dispose): `this.achievements.attach(null)`.
2. ui-screens — my system now saves unlocks itself, so `progress.applyRewards`' `fresh` filter (not yet in save)
   will drop them and the chips say 本场无新成就. Please collect `achievement:unlock` ids while a race is attached
   and show those (RaceTracker's achievement rules can go; ids are unchanged). A results row of 1000 px holds ~3
   chips; a first race can unlock 6–9 → show 3 + “+N”. Optional: `AchievementDef.icon` glyph in the chip.
3. ui-hud — toast/chip on `achievement:unlock` (成就解锁 + icon + name). `hudCnText()` font warm-up lists only
   taunts; bubbles also show koLines / hurtLines (race taunts.ts) → add koLines, hurtLines, skillLines. Splash text
   can come from strings.ts ANNOUNCER / PLACE_CALLOUTS / WRECK_LINES (alt lines are sub-captions).
4. race — `police:alert` `reason` ('spawn' | 'lost' | 'busted') and launch boosts as kind 'launch' (both handled
   already, legacy payloads too); corgi toasts can use `POLICE_LINES[phase]`; `skillLines` for rivals' sig casts.
5. ui-screens — adopt strings.ts: loading card `calendarFor(trackId, new Date())` → 「宜：撞鹅 忌：放鸽子」 (free
   space above the weather line), GRADE_QUOTES under the grade title, CREDITS (24 entries), victory/defeat lines on
   the podium, HOWTO_* (keyboard legend identical to howto-pages LEGEND).
6. track — TRACK_BILLBOARDS / TRACK_SIGNS for city & mountain dressing; ROAD_SIGNS[5] is now 「连续弯道 弯弯有鹅」
   (was too long for the 256 px sign: 22 px → 30 px glyphs).
7. audio — regenerate barks for the new lines with tools/gen-tts.mjs when convenient (clip texts unchanged).

## How to test
- `node tools/content-lint.mjs [--verbose]` · `node tools/content-ach.mjs [--only name]`
- `node tools/content-shots.mjs gallery` → shots/content/gallery-*.png (exit 1 on overflow) ·
  open http://127.0.0.1:5300/sandbox/content.html
- `CONTENT_STUB=audio,camera node tools/content-shots.mjs game` (default stub: audio; `CONTENT_STUB=` for none)
