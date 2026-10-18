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
  overflow (and lone-glyph tip endings) outlined yellow + `window.__content.overflow`; billboard faces use the real
  poster art.
- tools: `content-lint.mjs` (+ `content-ts.mjs` TS import hook, `content-fonts.mjs` WOFF cmap glyph coverage),
  `content-ach.mjs` (22 node rule scenarios), `content-shots.mjs gallery|game` (+ `content-game.mjs`).

## Done
- All deliverables above; lint 0 errors (977 strings), 22/22 rule scenarios, gallery 756 checks 0 overflow.
- Resume (10-18): in-game check re-run through game.ts's own instance (`__br.game.achievements`) with NO stubs:
  OK — race 1 unlocks 9 (perfect_start, first_ko, goose, double, first_win, clutch, podium, untouched, blowout),
  restart race unlocks only triple + hat_trick, autopilot none, save has no duplicates, 0 page errors. Shots
  (shots/content/game-*.png): taunt bubbles, results (3 chips + “+6 MORE”, podium victory line, grade quote),
  loading card with the 宜/忌 calendar line — all from content data via ui-screens.
- Fix: 情绪稳定 (pacifist) unlocked next to 开饭了/一鱼两吃 when combat credited a KO without a swing (hard bump →
  rival wrecks within 3 s). Rule now also needs 0 player KOs. Regression `credited-ko-is-not-pacifist` (failed
  before the fix, passes after; rival-on-rival KOs keep pacifist); content-game.mjs asserts no pacifist in race 1.
- Polish: gallery world section now mirrors world/scenery/signs as it is today — plain 512×256 faces and poster
  faces (512×288, line on the tilted band over the real poster art from data/assets.ts BILLBOARDS, as every track
  draws them): all billboard lines 37–74 px (min 34), track extras shown on their own track's posters.
- Polish: new gallery check `noOrphan` (no lone glyph under a full line, 孤字) on loading tips; reworded 6 tips
  (Shift drift colours, ONE MORE!, capybara + 温泉, penguin slide, corgi 风阻, 滑总 借力) → 0 orphans.
- WRECK_LINES.obstacle[0] duplicated ANNOUNCER.wrecked alt 「人仰车翻……」 → 「锥桶表示很无辜……」.

## Next
- Nothing open on the content side. Remaining work is other units adopting requests 3, 4, 6, 7 below.

## Known issues
- New roster lines have no voice clips yet (audio falls back to animal calls / existing clips).
- `clutch` + `blowout` both unlock in the scripted game check only because it teleports the player past 85 %.

## Core requests
1. DONE (core 22:25) — core/game.ts wires the achievements system: created once, `attach(session)` after
   `audio.attach`, `attach(null)` before `session.dispose()`.
2. DONE (ui-screens race-tracker.ts) — results show the `achievement:unlock` ids of the race, 3 chips + “+N”.
3. OPEN, ui-hud — toast/chip on `achievement:unlock` (成就解锁 + icon + name). `hudCnText()` font warm-up lists only
   taunts; bubbles also show koLines / hurtLines (race taunts.ts) → add koLines, hurtLines, skillLines. Splash text
   can come from strings.ts ANNOUNCER / PLACE_CALLOUTS / WRECK_LINES (alt lines are sub-captions).
4. OPEN, race — `police:alert` `reason` ('spawn' | 'lost' | 'busted') and launch boosts as kind 'launch' (both handled
   already, legacy payloads too); corgi toasts can use `POLICE_LINES[phase]`; `skillLines` for rivals' sig casts.
5. DONE (ui-screens) — loading calendar 宜/忌 (`calendarFor`), GRADE_QUOTES, CREDITS, podium victory/defeat lines,
   HOWTO_* are on screen (checked in game-loading.png / game-results.png).
6. OPEN, track — TRACK_BILLBOARDS / TRACK_SIGNS for city & mountain dressing; ROAD_SIGNS[5] is now 「连续弯道 弯弯有鹅」
   (was too long for the 256 px sign: 22 px → 30 px glyphs).
7. OPEN, audio — regenerate barks for the new lines with tools/gen-tts.mjs when convenient (clip texts unchanged).

## How to test
- `node tools/content-lint.mjs [--verbose]` · `node tools/content-ach.mjs [--only name]`
- `node tools/content-shots.mjs gallery` → shots/content/gallery-*.png (exit 1 on overflow) ·
  open http://127.0.0.1:5300/sandbox/content.html
- `CONTENT_STUB= node tools/content-shots.mjs game` (all real units; default stubs audio; e.g. `CONTENT_STUB=audio,camera`
  isolates units that are mid-edit)
