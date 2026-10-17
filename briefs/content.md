# Unit: content (memes, text, achievements) — wave 1.5
Read SPEC.md first (§0 pillar 5, §5 characters, §12 seed list). You own: text fields of
`src/data/roster.ts` (name, codename, title, tagline, taunts, koLines, hurtLines + new optional arrays you
add: victoryLines, defeatLines, skillLines), `src/data/tips.ts`, `src/data/memes.ts`, new
`src/data/strings.ts` (UI copy: howto, credits, calendar lines, grade quotes, announcer text), new
`src/gameplay/achievements.ts`, `sandbox/content.*`. Do not change numbers/stats/ids in roster.ts or
bikes.ts; do not edit other units' code. Other agents read these files live: keep every existing export
name and type stable (add fields/arrays, never remove or rename).

## Deliverables
1. Tone: Chinese internet humour, playful and kind, short and punchy (taunts ≤ 12 字, billboard lines
   ≤ 14 字, tips ≤ 40 字). Each character has a distinct voice (goose = aggressive chaos, capybara = zen
   deadpan, cat = smug/cute, doge = broken English "such/very/wow" + 狗头, pigeon = 下次一定/在路上了,
   penguin = cool slider, seagull = thief "MINE!", sloth = s-l-o-w with …… dots, corgi = by-the-book cop
   with short-leg self-awareness, pelican = cocky hero with fish obsession). No real people, brands,
   politics, vulgarity, body-shaming, or meanness. Benchmark meme ("Generate an SVG of a pelican riding a
   bicycle") may appear a few times.
2. Volume: 60+ tips; 40+ billboard lines; 20+ road signs; per racer 12 taunts, 6 KO lines, 6 hurt lines,
   4 victory, 4 defeat, 3 skill-cast shouts; corgi police lines (alert/chase/busted/lost: 6 each);
   announcer text set (countdown, GO, KO, double/triple KO, SHOWTIME, perfect landing, final stretch,
   1st–8th finish, busted, wrecked, comeback, near miss); grade quotes (3 per grade); P5-calendar card
   lines per track (日期旁的 宜/忌: e.g. 宜：撞鹅 忌：放鸽子) ×10; credits (meme credits: 鹈鹕 本色出演…);
   howto copy (keyboard + gamepad + skills, concise).
3. `src/gameplay/achievements.ts`: export `createAchievements(app: AppContext): { dispose(): void }`.
   It listens to bus events (race:*, combat:*, skill:*, police:*, rider:*) and tracks per-race state to
   unlock ~30 achievements (expand ACHIEVEMENTS in memes.ts with id/name/desc/icon glyph), persists to
   `app.save` (achievements array, no duplicates), and emits `achievement:unlock { id }` (core adds it to
   events-map; until then cast through a local typed helper is NOT allowed — wait for core: check
   src/core/events-map.ts, it will contain 'achievement:unlock'). Make detection rules robust (a rule only
   fires from real events; no false unlocks on restart/quit). game.ts instantiates it (core does that).
4. `sandbox/content.html`: a text gallery page rendering every line in the UI fonts at real sizes (catch
   overflow), plus a node script `tools/content-lint.mjs` that checks length limits, duplicates, banned
   words list, and that every racer has every array.

## Quality bar (meme critic)
Genuinely funny to a Chinese gamer, fresh (not only the seed list), varied, in-character, correct Chinese
(no typos/awkward machine phrasing), lengths fit the UI, nothing offensive.
