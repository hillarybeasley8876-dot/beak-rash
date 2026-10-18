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
- tools: `content-lint.mjs` (+ `content-ts.mjs` TS import hook, `content-fonts.mjs` WOFF cmap glyph coverage,
  `content-repeat.mjs` near-duplicates / one-note caps / dated memes / tics),
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
- env-mountain BANNERS still show two retired content lines (request 11); env-city's gantry reuses 「夜骑请开灯 鹅在暗处」
  (theirs now; content's city list no longer has it).
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
6. OPEN, track / env-city / env-mountain — TRACK_BILLBOARDS / TRACK_SIGNS for dressing (city + mountain already read them;
   coast does not). Fix round 1: ROAD_SIGNS[5] is now 「连续弯道 漂起来」 (「弯弯有鹅」 repeated the mountain blurb); positions,
   ROAD_SIGNS[8] 「急弯 别急」 and TRACK_SIGNS.mountain roles [downhill, tunnel, view, rocks] unchanged.
7. OPEN, audio — regenerate barks for the new lines with tools/gen-tts.mjs when convenient (clip texts unchanged).
8. OPEN (fix round 1, critic minor «33 written lines never reach the player»), ui-hud — a small player bubble (rate-limited
   like rivals') on the player's KO (ROSTER.pelican.koLines), skill cast (skillLines[0..2] = torpedo / gulp / wing) and
   respawn (hurtLines). Also request 3: hudCnText() still warms up taunts only.
9. OPEN (same), audio — bark the player's voiced lines too (pelican_taunt_0/1, pelican_ko_0/1, pelican_hurt_0 in
   data/voice.ts); audio/events-combat.ts skips the player today.
10. OPEN (same), race — race/police.ts toasts alert / busted / lost only: show a POLICE_LINES.chase line when the chase
   reaches level 2 (the corgi alongside), same toast style.
11. OPEN (fix round 1), env-mountain — mountain/index.ts BANNERS copies two old content lines: 「秋名山？不，落日山」 (dated
   meme per the critic) and 「山路十八弯 弯弯有大鹅」 (repeats the track blurb); suggest TRACK_BILLBOARDS.mountain picks
   instead (e.g. 「海拔越高 鱼越贵」, 「弯道多 漂移券免费领」). Content's own lists no longer contain either line.

## How to test
- `node tools/content-lint.mjs [--verbose]` (lengths, glyphs, exact + near duplicates, one-note caps, dated memes, tics —
  repetition rules live in tools/content-repeat.mjs) · `node tools/content-ach.mjs [--only name]`
- `node tools/content-shots.mjs gallery` → shots/content/gallery-*.png (exit 1 on overflow) ·
  open http://127.0.0.1:5300/sandbox/content.html
- `CONTENT_STUB= node tools/content-shots.mjs game` (all real units; default stubs audio; e.g. `CONTENT_STUB=audio,camera`
  isolates units that are mid-edit)

## Fix round 1
Critic: reviews/content-r1-meme.json (score 6, 4 major + 7 minor) + track note (gallery poster band 0.30 → 0.38).
Plan ([x] = done + verified; a resumed fixer skips [x]):
- [x] 1 gulp rule (major) → rules-combat.ts: a pelican.gulp skill:hit on a rider with ROSTER scale ≤ 0.85 (SPEC §7) is a
  swallow (the spit), bigger = bite; no status read. Scenario follows the real order (cast → bites → rival hit → cat spit →
  end). content-game.mjs: real Big Gulp of the cat (I) in the restarted race → gulp unlocks (no stubs: game check OK).
- [x] 2 corgi rule (major) → rules-ride.ts: only reason 'lost' counts (legacy reasonless branch gone). Scenario (a) now
  expects no unlock for a reasonless 0, also after a 'spawn' chase. Critic's ach-police.mjs case A: unlocks [] (was corgi).
- [x] 3 near-duplicates (major) → new tools/content-repeat.mjs, run by content-lint: any two flavour lines (roster, police, tips,
  billboards, signs, calendar, grade quotes/titles, achievement names, bike blurbs, announcer alts, wreck, credits, howto)
  sharing a run of ≥ 4 tokens (CJK glyph / Latin word; names + game terms fold to 1 token) also vs read-only context
  (track blurbs, env-city CITY_LINES + GANTRY); recycled set phrases (热身/启动/让一让/骄傲/这叫/我只是/会回来/记住你/专业/…) once
  each. First run: 92 near-dups + 14 templates (critic's list) → all rewritten, 0 left. Three lines that world units copied
  into gantries/banners were replaced in content's lists so each joke shows once per track (本路段已被 AI 画过 → 鹈鹕骑车 3D 版
  已上线, 夜骑请开灯 鹅在暗处 → 夜骑三件套 灯铃头盔, 登山不易 骑车更难 → 上坡靠腿 下坡靠胆).
- [x] 4 fresher memes / one-note voices (major) → lint: dated-meme list (了解一下/我全都要/永远的神/还有谁/飘了/落地成盒/秋名山/
  不存在的/亿点点/稳如老狗/C 位/承包/全村的/怀疑人生/全家桶/城市套路深 …) + one-note caps per pool (鹅/鸽/咸鱼/嘴 ≤ 10 % outside
  their owner; pelican 嘴 ≤ 25 %, pigeon late ≤ 35 %, penguin 冰/冷/优雅 ≤ 25 %, doge 狗头 ≤ 20 %, …). Every racer got 3–6
  new lines in its voice with 2023–25 memes (硬控, 菜就多练, 开香槟, 已老实, 淡人, 松弛感, 尊嘟假嘟, 显眼包, 班味, i 人,
  已读, 偷感, 赛鸽/信鸽, 古希腊掌管薯条的神, 主打一个, 泼天的鱼, 这对吗, 情绪价值, deal with it …); 4 dated achievement
  names renamed (冠军体质, 粉色火花, 落地生根, 贴脸艺术家; ids unchanged). Voice-clip lines untouched (lint enforces).
- [x] 5 flat lines (minor) → roadbike 「轻到海风一吹就跑，所以骑快点。」, mtb 「避震拉满，颠簸路段也能睡着。」, kidbike 「…童年回来了。」;
  WRECK_LINES with a twist (汽车：我也没想到…… / 技能说明，没骗人…… / 路障：站着也有错？ / 和护栏贴贴了…… / 警官：请出示鱼证……);
  skill shouts (咸鱼快递，到付！ / 借过！翅膀比路宽！ / 顺走！不用谢！ / 加载完毕，冲！！ / 肚皮着地，起滑！); filler taunts
  replaced; place alts (银牌也能换不少鱼 / 中间位置，视野最好 / 六六大顺，下把更顺 / 倒数第一，也是第一); calendar 带伞/当落汤鹈,
  出片/糊片, 当显眼包/当背景板, City Ride/City Walk, 特种兵骑行/中途下车, 腾空/空中犹豫 …; announcer alts no longer reuse
  achievement names or taunts.
- [x] 6 awkward Chinese (minor) → all critic rewrites applied (别跑！腿短，但我执着！ / 全体，原地哆嗦！ / 跑了鹈鹕，跑不了鹈鹕湾！ /
  你瞅啥？再瞅一个试试？ / 大鹅最吃这一套 / 说好一起骑，人呢？这就叫放鸽子 / 都归我这张嘴 / 赢了喵 / A 级 「再快半秒，就封神了。」 /
  double/triple desc); oil tip ends 「绕着走不丢人」; the 薯条大盗 tip is now the corgi's own line (「主要是腿的问题。」).
- [x] 7 tics + doge (minor) → the three 不是…是 / 不叫…叫 lines rewritten; lint flags the template; every doge line ends on
  ASCII '.' (lint rule; none of the changed ones had a clip).
- [x] 8 hurt lines (minor) → every hurtLines entry works for any respawn cause (wall/water/traffic/KO by anyone): goose
  「谁？！谁偷袭鹅？！」 replaces 「偷袭！卑鄙的鹈鹕！」; 「你给我等着」/「记住你了」-style blame lines gone from hurtLines.
- [x] 9 slingshot (minor) → 蹭饭达人 = 3 slingshots in a race that each gain a place within 2 s (facts.slingshotAt /
  slingshotPasses, rules-ride.ts race:placeChange; one credit per slingshot). Desc 「一场比赛尾流弹射超车三次」. Scenario:
  grid pull-out / late pass / lost place / pass without slingshot / double pass on one slingshot do not count.
  Also (item 6) double/triple desc → 「3 秒内连续击倒两/三名对手」.
- [x] 10 unused lines (minor) → requests 8 (ui-hud player bubble), 9 (audio player barks), 10 (race chase toast) below;
  lines kept (all rewritten/linted with the rest). Also request 11 (env-mountain banners that copy retired lines).
- [x] 11 credits (minor) → gallery credits now mirror ui/screens/credits (880 px column, (i % 3)×36 px indent, block 58 px) with
  new kit check `balanced()` (last line ≥ 30 % of the letters): it caught 「…riding a / bicycle」 (7 of 37). Data fix: U+00A0
  inside 「riding a bicycle」 → real screen shows 「Generate an SVG of a pelican / riding a bicycle」 (shots/content/fix1/
  credits.png). Lint checks credits names in the block font (the screen's), NBSP allowed as fallback glyph.
- [x] 12 track note → sandbox/content.world.ts poster band 0.30 → 0.38 (= world/scenery/signs/faces.ts bandH); gallery 806 checks,
  0 overflow (2 tip orphans + 『City不City？ 很City！』 glyph size fixed on the way).
Fix round 1 result (all 4 majors + 7 minors + track note done): `node tools/content-lint.mjs` 0 errors (978 strings; new
repetition checks), `node tools/content-ach.mjs` 22/22 (gulp/police/riding scenarios rewritten to the real event order),
`node tools/content-shots.mjs gallery` 806 checks 0 overflow, `CONTENT_STUB= node tools/content-shots.mjs game` OK with all
real units (race 1: 9 unlocks incl. untouched, no slingshot; restart: real gulp → gulp + triple + hat_trick; autopilot none;
0 page errors); npx tsc clean. 鹅 now in 36 of 654 flavour lines (19 outside the goose's own voice; was 45 of 687).
Shots: shots/content/game-{taunts,results,loading}.png (new lines in game), shots/content/fix1/credits.png (balanced prompt).
