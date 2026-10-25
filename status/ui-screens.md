# ui-screens — status

## Plan (file map)
- `src/ui/index.ts` → `export { createUi } from './shell'` (swap last, after shell works).
- `src/ui/fonts.ts` fonts (stub imports it — keep valid).
- `src/ui/p5/` kit: tokens.css, kit.css, motion.css, dom.ts, ransom.ts, shapes.ts, art.ts,
  portrait.ts, widgets.ts, transition.ts, index.ts.
- `src/ui/shell.ts` createUi: layers (hud / screens / wipe / toasts), 1920×1080 stage scaled to fit,
  router (latest-wins transitions), input routing w/ same-tick dedupe (Esc = pause+back, Space = hop+confirm),
  audio unlock on first gesture, music per screen, hud.setVisible on race/intro.
- `src/ui/nav.ts` focus list (keyboard/gamepad/mouse), `src/ui/toast.ts`, `src/ui/race-tracker.ts`
  (achievements + stats from bus events), `src/ui/progress.ts` (career, grade, save apply).
- `src/ui/screens/*.ts` one per screen (+ css): boot, title, menu, career, track-select, garage
  (+ garage-turntable.ts, own WebGLRenderer, dynamic import of actors/bikes w/ stub fallback),
  loading, pause, results, settings, howto, credits; confirm.ts modal; frame.ts shared chrome.
- `tools/ui-tour.mjs` keyboard tour, 1280×720 + 1920×1080 (+2560×1440, 1440×900 spot checks).
- `sandbox/ui.html` + `sandbox/ui.ts` screen gallery (iframe viewer of `?screen=` URLs).

## Done
- p5 kit `src/ui/p5/` (tokens/kit/motion css, dom, shapes, ransom, art, portrait+artImage, widgets,
  backdrop, track-art, transition). Exported via `src/ui/p5/index.ts` (ui-hud may import it).
- shell (`src/ui/shell.ts`, live via index.ts): router with latest-wins shard-wipe transitions (≈340 ms
  measured), input routing (one consumed action per key press: Esc = pause+back, Space = hop+confirm;
  directional type-ahead buffered during transitions), audio unlock on first key/click, music per screen,
  lazy HUD (`lazy-hud.ts`, stub fallback incl. throwing update), toasts, confirm modal, 1920×1080 stage
  scaled to fit (16:10 letterboxes with full-bleed bg), clickable ESC/ENTER hints (mouse back button),
  gamepad glyphs + d-pad up/down (skill2/3) mapped to menu up/down, guarded screen handlers.
- 12 screens: boot, title (generated key art panel), menu (generated cut-out), career (3 cups × 3 tracks,
  locks, bests, stats), trackSelect, garage (3D turntable via bikes unit createBike, stub/SVG fallbacks,
  buy w/ confirm / equip), loading (calendar card, tip, vignette, road progress), pause (standings,
  controls sheet, restart/quit confirm, settings and back), results (podium, table, grade stamp,
  coin count-up credited once, achievements, retry/next/garage/menu), settings, howto (keyboard /
  gamepad / skills), credits.
- progress.ts (career ladder: tier 1–3 × tracks, top 3 unlocks next; grade S–D; rewards), race-tracker.ts
  (collects `achievement:unlock` ids per race).
- tools/ui-tour.mjs (keyboard-only full tour 1280×720 + 1920×1080, spot 2560×1440 + 1440×900; checks
  errors, visible focus, controls inside viewport) — last run: all checks passed.
- sandbox/ui.html (+ui.ts): screen buttons, size presets, stub toggle.
- Verified: real-unit flow menu → quick race → loading → race (real HUD) → pause → resume, 0 errors;
  career rewards/unlock/next; mouse paths; reduced motion; gamepad glyphs.
- Resume pass (content requests 2 + 5, core follow-ups):
  - [x] achievements: `race-tracker.ts` now only collects `achievement:unlock` ids of the attached race
    (gameplay/achievements saves them); own rules + `applyRewards` achievement saving removed. Results
    chips: catalogue order, icon glyph in a star, max 3 + red “+N MORE” (descriptions hidden at ≥3).
  - [x] strings.ts adopted: loading card 宜/忌 (`calendarFor`, long entries shrink), GRADE_QUOTES under the
    grade title, podium victory line (finished winner) / defeat line (player on podium, not 1st), CREDITS +
    CREDIT_OUTRO (ui copy.ts credits removed), HOWTO_KEYBOARD legend, HOWTO_BASICS block, HOWTO_GAMEPAD
    callouts, HOWTO_SKILL_TIPS on skill cards, HOWTO_SP. Line picks seeded by config.seed (stable re-mount).
  - [x] core applied muffle reset in endSession + Input.press isolation → ui's own setMuffle(0) calls removed.
  - [x] `tools/ui-results.mjs` (real achievements system → results chips / +N / no leak into next race).
  - Verified: ui-tour (stubs, 4 sizes) + ui-tour --real 1920×1080 all checks passed; ui-results passed; tsc clean.

## Next
- nothing open for ui-screens (remaining known issues are accepted).

## Known issues
- ZCOOL QingKe's stylised 公 reads oddly in ransom titles (font design, accepted).
- Quality applies after a restart (renderer is created once by core/game.ts): menu-side settings offer the
  restart (location.reload, save kept); mid-race it only toasts.
- Results demo data shows when `?screen=results` has no race props (never saves).

## Core requests
- (done by core 21:55) muffle reset in endSession; Input.press listener isolation.
- Coins: ui-screens credits `RaceResult.coins` of the player to `save.coins` on the results screen;
  race unit saves `save.stats` (agreed in race/results.ts comment).

## How to test
- `node tools/ui-tour.mjs` (add `--real` to use every real unit) → shots/ui-tour/<size>/NN-*.png.
- `node tools/ui-input.mjs [--real]` → modal Space/pad A/B, results mash (Space 180/450 ms, fake pad B 220 ms,
  arm delay, default focus, first Space after arming nudges, Space / pad A every 0.8 s leave in ≤ 2 presses),
  records sheet (pad LB/B/A, TAB/Space, d-pad after), title ignores back keys, double-click, pills/ticks,
  reduced motion, parked pointer, locked-click toast (exits 1 on failure).
- `node tools/ui-comfort.mjs` → auto-pause (blur / hidden / pad lost), key hold-to-repeat, reset locked
  mid-race, toast quiet in cine:ko, unlock tag, results back hint, credits wheel + reduced motion, quality
  restart offer (reloads the page), no scrolled UI boxes.
- `node tools/ui-track-stills.mjs` → regenerates src/ui/assets/track-*.webp (real units).
- `node tools/ui-results.mjs [--real]` → achievements → results chips check, shots/ui-screens/results-ach.png.
- `/sandbox/ui.html?screen=menu` or `/?screen=<id>` (`&stub=world,sim,camera,actors,combat,race,fx,audio`).
- `npx tsc --noEmit -p tsconfig.json` (ui files clean).

## Fix round 1
Reviews: reviews/ui-screens-r1-{art,interaction}.json (+ cross-unit: audio ui.stamp/ui.count/ui.pause,
bikes m10 garage framing, assets title crop + smug podium, content credits wrap).
Checklist (I = interaction, A = art; [x] = done + verified):
- [x] I-B1 confirm modal: Modal.handle consumes only menu actions (hop/attackR fall through, so the
      confirm/back twin of Space / pad A / pad B arrives). Veil ignores clicks < 320 ms after open.
- [x] I-M1 shell: new `settling` phase (mounted, still under the wipe) drops confirm/back + clicks until
      reveal; results: 900 ms lock after entered(), confirm presses < 320 ms apart = mashing (shell tracks
      ctx.confirmGap()) → they only skip the show (finish animations + count-up).
- [x] I-M2 Nav.gate (set by ctx.nav) blocks clicks while leaving/settling/modal; show(id) joins an
      in-flight transition to the same id; settings backTo = session ? pause : menu.
- [x] I-M3 widgets meter()/choice() take onPick (press/drag picks, click never bubbles to the row).
- [x] I-M4 + A-M4 wipe: reduced motion keeps shards parked (fade only); shards 25 % taller than their
      slot (jy 5) + ink fill behind while covered; palette red/ink/white/hot with a 14 px leading slash;
      'ui.slash' whoosh on cover.
- [x] A-M3 tokens.css: .br-ui font-weight 400 + font-synthesis none; b/strong inherit (Noto ships 900 only,
      so a 400 request still renders its 900 face). NOTE ui-hud: no more faux bold in HUD text either.
- [x] tools/ui-input.mjs (new): modal Space/pad A/pad B, mash, double-click, pills/ticks, reduced motion,
      parked pointer, locked click — all pass; ui-tour 1920 passes.
- [x] A-M2 garage: art + slab moved into the stage (aligned with the canvas at 16:10; black backdrop
      fills letterbox); the bike hangs by its (rear) seatpost in the DRAWN repair stand (CLAMP 815,486,
      448 px/m, camera 12° down with a view offset), swings around a 3/4 view (never edge-on; drag still
      works), soft radial contact shadow on the floor, dark pool behind the bike; name/blurb moved below.
      Covers bikes m10 (framing ≈ 45 % of screen height, no full spin).
- [x] A-M1 track art: in-engine stills (tools/ui-track-stills.mjs → src/ui/assets/track-*.webp, 800×450,
      ~40 KB each; vector art stays as onerror fallback) + halftone shade (ui/track-stills.ts). Quick race:
      unfocused cards keep the white body, only the art dims. Career: stills, red-tinted locked art,
      bronze/silver/gold tier tabs, ONE chain-tape sticker per cup row over its locked events (no padlocks).
- [x] I minors: parked pointer (nav hover only after REAL pointer movement); NavItem.onDenied (career +
      下一站 toasts for clicks too; disabled = 'ui.deny'); CTAs (career 出发, garage 购买/装备) clickable via
      nav.pointerActivate() with kb/pad glyph pair (p5 keyGlyph); pause sheet + howto skill keys show pad
      glyphs under .is-pad (.br-kb-only/.br-pad-only); memory: settings recall, pause→设置, career results
      Esc/巡回赛 → ladder focused on the new event; NEW BEST only for a real improvement, first finish =
      首次完赛, tag moved into the title row; "+N MORE" is a nav item opening the full list; pad-only
      players: unlock attempt on pad input + SOUND OFF chip on title/menu (audio-unlock.ts); pad-menu.ts:
      stick X → left/right, hold-to-repeat, LT/RT ignored in menus.
- [x] A minors: title art in the stage, centred crop (re-rolled art: hero centred, beak hook ~29 % x);
      header ghost word inside the band after the CN glyphs (13 % white); credits = slamming white/ink
      name cards with character stickers, Latin in Bebas (balanced), halftone + star on the slab; loading
      min 2.0 s, no tip/vignette delay, vignette 80 px higher; confirm modal P5 (burst, ransom, halftone,
      sticker, big YES/NO); toasts: stage lane under the coin badge, 32 px, star icon, max 2; pause sheet
      on an ink plate; boot: brush 暴力鹈鹕 200 px on the band, white burst, halftone sweep; podium all
      smug busts; stamp = inked double ring (#br-ink SVG filter) + thump shake.
- [x] cross-unit: audio ui.stamp / ui.count per tick (+ ui.coin at the end) / ui.pause / ui.unlock /
      ui.slash on wipe; content credits wrap (Bebas + text-wrap: balance); assets title crop + smug podium.
- [x] loading hold: leave() sets clock layer 'ui:loading' = 0 while the card holds (cleared in finally +
      dispose), so the new race's intro/countdown doesn't run behind the card. ui-tour now waits for
      !busy before pausing and asserts pause / pause-settings (that step had silently not paused).
- Verified: ui-input (new) + ui-results + ui-tour (1280, 1920, spots 2560×1440, 1440×900) all pass; tsc clean;
  faux-bold computed-style audit clean on 10 screens.

### Fix round 1 notes / requests
- core (SPEC §2 layer list): ui-screens uses clock layer `ui:loading` (loading card ≥ 2 s hold).
- core (input, optional): menus now get stick-X, hold-to-repeat and trigger filtering from ui/pad-menu.ts;
  if core Input adopts these, delete pad-menu.ts.
- ui-hud FYI: tokens.css now sets `font-synthesis: none` + weight 400 on .br-ui (no faux bold in HUD text).
- Track stills are generated: re-run `node tools/ui-track-stills.mjs` after the track looks change.
- Title crop (object-position 50 %) is tuned for the re-rolled key art (hero centred); retune if re-rolled.

## Fix round 2
Reviews: reviews/ui-screens-r2-{art,interaction}.json (art pass 8.2, interaction 7.5 with 1 major) + cross-unit
(ui-hud: hide in-race toasts during cine:ko; bikes: garage wheel speed ~0.6 m/s).
Checklist (I = interaction, A = art; [x] = done + verified):
- [x] I-M1 results: the button row is hidden and inert until the show is over (stamp + count-up) AND 700 ms
      passed with no key / pad press (shell `ctx.sincePress()`, one timestamp per press; replaces confirmGap);
      it then slams in (`.is-armed`). Any press before that (confirm / back / hop / swings) only skips the show.
      Default focus 再来一局. Title ignores Esc / Backspace / pad B (isDown('back') spots B's attackR twin), so
      back-mashing ends on the title. ui-input: Space 180 + 450 ms, fake-pad B 220 ms, arm delay, title checks.
- [x] I-m1 `ui/auto-pause.ts`: window blur / tab hidden / gamepaddisconnected → flow:pause while a race view
      is live (not finished, not autopilot, no transition); pad loss toasts 手柄断开了，已暂停.
- [x] I-m2 `ui/key-repeat.ts`: OS auto-repeat keydowns of arrows / WASD re-send the direction every 110 ms
      on menu screens (not race views, transitions or modals).
- [x] I-m3 results hint bar adds ESC/B 主菜单 or 巡回赛 (clickable); the +N sheet footer is keyGlyph pairs.
- [x] I-m4 settings: 重置存档 disabled mid-race (grey, onDenied toast, INFO says why); the reset row is never
      remembered, so settings reopen on a harmless row.
- [x] I-m6 credits: reduced motion = no auto-scroll; ↑↓ and the mouse wheel (window listener; the overlay
      passes pointer events through) scroll and pause the auto-scroll for 3 s; hint ↑↓ 滚动.
- [x] I-m7 career unlock = a white/red tag in the RESULTS title row (pops at 1.5 s + ui.unlock), no toast.
- [x] I-m8 quality: leaving menu-side settings with a changed quality asks 重启 / 稍后 → location.reload();
      mid-race it keeps the toast. New tools/ui-comfort.mjs covers I-m1/2/3/4/6/7/8 + toast quiet: all pass.
- [x] I-m5 + A-m6 career: the focused card rises above its cup's chain tape (z 4, scale 1.08) inside a jittering
      red jagged frame with the menu's white pointer, plus a GO! / LOCKED (striped) sticker.
- [x] A-m1 garage: backing store 2× the on-screen pixels (min 1.5, ≤ ~8 MP); wheels at 0.6 m/s (bikes request:
      real spokes, no blur disc); `garage-clamp.ts` = inked light-grey jaw barrel + red band + red lever on the
      seatpost at the pivot (own geometries/materials, disposed) so the hang reads as clamped.
- [x] A-m2 br-pulse = scale only at full opacity (title pill also throbs its ink shadow 10→16 px); pill at
      left 104 px, EN letter-spacing .03em → ends before the art border.
- [x] A-m3 title logo top 100, EN line 104 px / margin 24: the H box ends above-left of the beak at 1920×1080
      and 1440×900 (measured from the art: beak top edge ≈ (950,458)→(1175,309), hook ≈ (850,480)).
- [x] A-m4 header ghost word: font-size min(112px, (1060px − left) / (en-n × .5)) via --en-n → QUICK RACE fits.
- [x] A-m5 boot: word-spacing .45em on the Black Ops One line (BEAK RASH, two words).
- [x] A-m7 settings: the chosen value is a 38 px ink-on-white slab with a red offset shadow (slams on change),
      other options 30 px at 80 % white; disabled reset row greyed.
- [x] A-m8 widows: `.br-screens, .br-toasts { text-wrap: pretty }`; modal text + settings INFO balance and
      break at punctuation (keep-all + overflow-wrap anywhere).
- [x] A-m9 + ui-hud request: the toast lane goes quiet (opacity 0) while `cine:ko` runs in a race view. The lane
      itself stays at stage top 136 (ui-hud's chips.ts mirrors it and drops its chip column below live toasts, so
      moving it would break their fix).
- [x] Found while testing: `.br-ui` / `.br-screen` / `.br-bg` overflow hidden → clip (a hidden box can still be
      scrolled by scrollIntoView / find-in-page; an automated click had shifted the results screen 442 px up).
- Verified: ui-input (stubs + --real), ui-comfort (new), ui-results, ui-tour (1280/1920 + 2560×1440, 1440×900)
  all pass; real-unit probe (coast s7, player 25 m before the line): Space @450 ms and pad B @220 ms keep
  results up for 7-10 s of mashing, row arms after the stop; 0 console errors; tsc clean for ui files.
  Shots: shots/ui-screens/r2/sheet-{a,b,c,d}.jpg.

### Fix round 2 notes / requests
- core (input, optional): menus get keyboard hold-to-repeat from ui/key-repeat.ts (core Input drops e.repeat);
  if core forwards directional repeats to onAction listeners, delete key-repeat.ts.
- ScreenCtx.confirmGap() was replaced by sincePress() (ms since the latest key / pad press of any action).
- track A7 (intro title card over the START header) belongs to ui-hud / race (intro cards), not ui-screens.

## Acceptance round 1
Reviews: reviews/game-r1-{aesthetic,e2e,feel,interaction,perf}.json, owner ui-screens (16 issues).
Checklist ([x] = done + verified, [-] = skipped with reason):
- [-] e2e#4 (major) character select: skipped per SPEC design decision (pelican is the only playable hero).
- [x] int#1 (major) career finale: progress.ts isCupFinal/isCareerFinal/cupCleared/careerCleared + Reward.clear
      (first top-3 on a cup's last event pays CLEAR_BONUS 300/600/1000 as a breakdown row). Results: title-row
      stamp ★ <杯名> CUP CLEAR! / ★ 巡回赛通关 CAREER CLEAR! (pops 1.5 s + ui.unlock); after the final event 下一站
      becomes 通关！ FINALE → credits finale (screens/finale.ts token: header 通关 CAREER CLEAR, trophy card +
      three cup chips, bubble line, Esc → career ladder); disabled 下一站 on the final event says 已经是最后一站了：
      前三名即可通关. Career ladder: inked CLEAR! stamp per cleared cup, ★ 巡回赛通关 chip by the stats, detail row
      目标 = 前 3 名解锁下一站 / 通关<杯名> / 通关巡回赛. Verified (stubs, 1920): final 1st → +1000, 通关 focused →
      credits finale → Esc → career with 3 stamps; cup 1 clear; final 5th; repeat clear (no bonus); 0 errors.
- [x] e2e#8 results: a confirm that arrives as a hop twin (Space / pad A) needs ≥ 1 s since the previous press
      (shell ctx.pressGap()); Enter always works once armed. Default focus never RETRY: 下一站 / 通关！ in a career
      (巡回赛 when locked), 主菜单 after a quick race. ui-input: Space right after arming + 400 ms rhythm do nothing.
- [x] int#4 results: shell notes a press on every window pointerdown on menu screens (clicks delay arming like
      keys); row clicks wait 350 ms after arming (slide-in); a click anywhere skips the show. ui-input clickChecks.
- [x] int#3 title: pad START (pause without a back twin) proceeds; Esc still ignored (isDown('back')); menu: pad
      START = confirm (keyboard Esc's pause twin is ignored there). ui-input: 4 new title/menu checks pass.
- [x] int#6 pause 退出比赛 in a career race: quitRace, then go('career') focused on that event (remember). Verified
      (stubs + real): quick → menu, career city T1 → career, focus index 1.
- [x] int#8 loading: same track again from pause / results (restart, 再来一局) holds 0.5 s instead of 2 s
      (module-level lastTrack). Real units: fresh start → race 4.3 s, pause restart → race 2.4 s.
- [x] int#11 settings: rows with > 2 options (画质, 慢镜头) clamp at their ends (ui.deny), 2-option toggles wrap;
      pressing the lit first meter tick again mutes (meter onPick gets a drag flag, so dragging never toggles).
      ui-input: 6 new settings checks pass.
- [x] int#14 title logo: CN row 196 → 184 px, logo top 100 → 116, and the last glyph (鹕, where the -7° tilt lifts
      most) gets k 1 / dy .05em / r +1.5°. Glyph tops now 11 / 16 / 22 / 57 px inside at 1280 / 1920 / 2560 /
      1440×900; the EN H box moved 2 px (still ends left of the beak).
- [x] int#5 key art: p5 preloadArt() (boot: title decoded before boot ends, cap 1.5 s; menu / garage / loading
      vignettes warm in the background) + artReady(img, cap) as ready on title / menu / garage (1.2 s) and loading
      (0.3 s), so the wipe reveals the art in place. Cold start (fresh browser): title settles at 1.9 s with its art
      decoded; menu and garage art decoded at reveal.
- [x] perf#8 loading: bar (scaleX) + runner (a road-wide box moved by translateX(p×100 %)) glide on CSS transform
      transitions (creep to 90 % over 6 s, real progress 0.5 s, leave 0.3 s); JS sets targets + reads the % text
      from the computed transform. No per-frame 'left' writes. Verified: runner at 0.7 s = 29 % (real units).
- [x] int#10 settings row 动态效果 MOTION (跟随系统 / 减弱 / 完整), ui-side pref in localStorage 'beak-rash.motion'
      (p5/motion-pref.ts; core request below): .br-ui.is-reduced = the CSS kill-switch, .is-full-motion opts out
      of the OS query; p5 reducedMotion() honours it (wipe shards, credits scroll, coin count-up). Reset save
      resets it. Rows 74 → 66 px so 10 rows fit (list ends at 968, hints at 1008). Enter cycles choices (wraps),
      ←→ clamp. ui-input motion checks + ui-comfort (reset row found by class) pass.
- [x] ae#13 garage turntable: bikes shorter than the road bike (Box3 length < 1.39 m) grow about the clamp
      (≤ 1.6×, wheels kept above the drawn floor; shadow scaled too): 儿童滑步车 0.94 m → ×1.48, fills the stand
      like the road bike. Longer bikes unchanged (they already fill it).
- [x] e2e#7 garage: p5 statBar(label, v, max, ref) draws gained segments solid red, lost ones red-hatched and a
      ±n badge; garage compares with the equipped bike (caption 对比当前：…, 当前座驾 on the equipped one); bikes
      with speed ≤ 2 carry a 整活 sticker; the buy modal adds （整活向，比赛不一定更快） + 对比…：速度 −3、加速 +1….
- [x] ae#11 track stills: CSS print treatment — 6-level posterise SVG filter (defs injected once by
      track-stills.ts), contrast/saturation up, exposure lifted for 霓虹夜城 (×1.5) and 落日山道 (×1.22), red corner
      slash + ink wedge + 6 px ink frame (::after, multiply) over the existing halftone; quick-race dimming composes
      with it (var(--still-fx)). Checked on track select + career at 1920.
- [x] int#12 records sheet (screens/records.ts + .css; no new ScreenId needed): on the career screen TAB / pad
      LB·RB or the 成就 N/42 chip (top right) opens a white sheet over an ink veil: all 42 achievements in a 6 × 7
      grid (earned = red star + glyph, tinted cell; locked = grey ? silhouette, name + desc greyed), N/42 counter,
      杯赛通关 n/3 + lifetime stats. Esc / B / Enter / TAB / veil click close it (Esc then backs out to the menu).
      Verified 1280 / 1920 / 2560: inside the viewport, no clipped cells, 0 errors. Per-track best times: not in
      the save (request below).
- Verified at the end: tsc clean for ui files; ui-input (stubs + --real), ui-comfort, ui-results, ui-tour (stubs:
  1280/1920 + 2560×1440, 1440×900; --real 1920) all pass; 0 console errors. Tool fixes: ui-input new checks
  (results Space-after-arm, click mash, START, settings clamp/mute/motion), ui-comfort finds the reset row by class
  and judges hold-to-repeat by rate (the machine ran at load 30-50), ui-tour boot shot tolerates a late __br.
  Shots: shots/ui-screens/acc1/ (sheet-finale, sheet-garage, sheet-stills, records-1280, sheet-tour).

### Acceptance round 1 requests
- core: add `Settings.motion: 'system' | 'reduced' | 'full'` to the save (ui keeps it in localStorage
  'beak-rash.motion' via src/ui/p5/motion-pref.ts until then; swap motionPref()/setMotionPref() to the save).
  fx (reducedFlashes, chromatic punch) and camera (shake ×0.35) should read it alongside the media query.
- ui-hud: honour `.br-ui.is-reduced` (and the p5 `reducedMotion()` helper) wherever the HUD checks
  prefers-reduced-motion, and skip motion under `.is-full-motion` only if you want 完整 to override the OS.
- content: please review / restyle the finale copy (src/ui/copy.ts FINALE) and add achievements for a cup clear and
  the career clear (ids e.g. cup1/cup2/cup3/career); the records sheet lists whatever data/achievements.ts holds.
- core / race (optional): store per-track best times in the save so the records sheet can show them.
- ScreenCtx gained pressGap() (ms between the latest press and the one before; clicks count as presses on menu
  screens). p5 statBar() takes an optional 4th `ref` arg; meter onPick gets a drag flag (both backwards compatible).

## Acceptance round 2
Reviews: reviews/game-r2-{aesthetic,e2e,feel,interaction,perf}.json, owner ui-screens (9 issues).
Checklist ([x] = done + verified, [-] = skipped with reason, [ ] = open):
- [x] int#0 (major) results: the hop-twin guard now judges only the FIRST Space / pad A confirm after arming, against
      the last press before arming (quietFrom): < 1 s → ignored with ui.deny + a 240 ms scale nudge of the focused
      button (WAAPI, skipped under reduced motion); the next one ≥ 350 ms later goes through; an arrow / d-pad move
      after arming ends the guard. ScreenCtx.pressGap() removed (unused). ui-input: first Space after arming nudges,
      the next 0.8 s later acts; Space and pad A every 0.8 s from the reveal leave within 2 presses after arming;
      180 / 450 ms Space and 220 ms pad B mashing still never arm the row.
- [x] int#1 (major) career records sheet: while open, back / confirm / pause / LB·RB close it, directions are eaten,
      every other action returns false (pad B's attackR, pad A's / Space's hop twins fall through to back / confirm).
      nav.ts isDirection() shared by shell / results / career. ui-input: LB opens, B closes, LB + A closes (no race),
      the d-pad then moves the ladder, TAB + Space closes.
- [x] e2e#2 grade: progress.ts gradeFor caps the KO bonus at 3 KOs (×8), S needs a top-2 finish, A the podium
      (field of 8: 3rd + 8 KOs = A, was S; last + 8 KOs = C, was B; 1st needs 2 KOs for S). Reward.place added;
      results-parts gradeQuote drops lines that claim the win (/最快|第一|冠军/) unless the player won (no quote
      if none fit). Content request below for place-tagged S lines.
- [x] e2e#6 records sheet: the stats.wrecked cell (KOs suffered, combat ko.ts) is now labelled 被击倒 (fits, 1920).
      An all-crashes count needs race/core to track one (optional request below).
- [x] int#3 menu: with AppContext.quit (desktop shell) a 7th, smaller step 退出游戏 QUIT ends the stair (step 124 →
      112 px, 62 px type) and asks 退出游戏？ (退出 / 再骑会, default NO) before app.quit(). Browser: unchanged (6 items).
      Verified 1920 with a fake quit: NO keeps the menu, YES calls quit once; quit box ends at y 956 (hints 1022).
      The macOS app menu / Cmd+Q is desktop/main.cjs (core).
- [x] int#5 screens/memory.ts persists the 'menu' and 'trackSelect' focus in localStorage 'beak-rash.ui-focus'
      (validated on load, warn on failure; other screens stay session-only). Verified: 快速比赛 + 落日山道 → reload →
      menu on 快速比赛, track select on 03 落日山道.
- [x] int#6 menu 操作 blurb per device (MenuEntry.padBlurb, .br-kb-only / .br-pad-only spans): pad shows
      'X 往左扇，B 往右扇，Y 用力扇。'; pause CONTROLS steer pad label 左摇杆 / ✚←→ (fits the sheet). HOWTO_BASICS
      ('按 P') is on the KEYBOARD tab only (the GAMEPAD tab has its own R3 callout), so it stays; content may still
      make it device-neutral.
- [x] int#7 cold start: boot preloads the title art first and only then (or after its 1.5 s cap) warms menu /
      garage / loading art. p5 artImage keeps every key art hidden (.br-art-pending = visibility, works under the
      br-pop animations) until img.decode() resolves, then fades it in 150 ms (WAAPI, none under reduced motion); an
      optional stand-in is removed on reveal and stays as the fallback on a broken file: title = the drawn hero on
      the ink art panel, menu = a drawn pelican sticker (portrait drawn: true; a broken cut-out swaps in the
      portrait). Verified with title.webp / menu.webp held 3.5 s: title settles with the drawn hero, the art fades in
      when it lands (hero removed), request order title → rest; 0 errors.
- [x] perf#6 loading: the lane dashes are a strip one period (86 px) wider than the road, scrolled by a
      transform keyframe (br-road-run, 0.215 s ≈ the old 400 px/s, also removes the old 28 px loop jump),
      will-change: transform → compositor. The % text already reads the CSS bar's computed transform each frame,
      so it catches up right after a long task (it cannot tick during one). Verified: animation running, 0 errors.
- Verified at the end: tsc clean; ui-input (stubs + --real, new steady-cadence + records-sheet checks), ui-comfort,
  ui-results, ui-tour (stubs: 1280/1920 + 2560×1440, 1440×900) all pass; 0 console errors. Shots:
  shots/ui-screens/acc2/ (sheet-menu = quit step / modal / pad blurb, sheet-rec-pause, sheet-cold, sheet-tour).

### Acceptance round 2 requests
- core (int#2, still open from acc1): `Settings.motion: 'system' | 'reduced' | 'full'` in the save + one
  app-level reducedMotion() that fx / camera / ui-hud read; ui swaps p5/motion-pref.ts over to it then.
- core (int#3 second half): desktop/main.cjs minimal macOS app menu ({role:'appMenu'}, editMenu, windowMenu) so
  Cmd+Q / Cmd+H work; the in-game 退出游戏 entry appears whenever AppContext.quit is set.
- content: grade quotes tagged by place (S lines that do not claim the win, or a win-only pool) — ui filters
  /最快|第一|冠军/ off non-wins meanwhile; optional device-neutral HOWTO_BASICS SP line ('按 P' sits on the keyboard
  tab only); cup1/cup2/cup3/career achievements (int#8, still open from acc1).
- race / core (optional, e2e#6): an all-crashes counter in save.stats (the sheet's 被击倒 is KOs suffered).
- core (optional): SaveData.ui = { menu, track } could replace ui's localStorage 'beak-rash.ui-focus'.
- API notes: ScreenCtx.pressGap() removed (unused); nav.ts exports isDirection(); p5 artImage(rel, cls, onFail?,
  stand?) keeps art hidden until decoded (+ optional stand-in); portrait() takes { drawn: true }.


## r3 polish (2026-10-25)
Owner ui (screens + HUD), reviews game-r2-*; screens part (acc2 fixes re-verified, then polished). [x] = done + verified.
- [x] e2e#2 grades: gradeFor(r, results) — KO bonus capped at 3, + up to 12 for the lead over 2nd (4/s), S only
  for a win (score ≥ 92), a win is at least A, A otherwise needs the podium (≥ 65), B ≥ 45, C ≥ 22. Table
  (shots/r3-ui/grades.mjs): 1st A (0-1 KO) / S (2+ KOs or a 3 s lead); 2nd A; 3rd B (0 KO) / A; 4th B; 8th D-C;
  DNF D. Quotes: GRADE_QUOTES stay place-neutral per grade (3 each, content-lint shape), new GRADE_QUOTES_PLACE
  adds win / podium lines (A, B); '你最快' & co. only on a win. ui-results.mjs now asserts table + quotes.
- [x] e2e#6 records: cell stays 被击倒 (KOs suffered; the save has no crash count) + hover note; grid tightens
  (.is-dense) past 42 entries — fits 54 at 1280×720 / 1920×1200 (records-dense.mjs).
- [x] int#3 quit (acc2) re-verified 1280 + 1920: 7th step 退出游戏 QUIT, confirm default 再骑会, 退出 → quit() ×1,
  Esc → title.  [x] int#5 focus memory across reload (menu 快速比赛, track 03) re-verified.
- [x] int#6 pad copy: HOW TO opens on the GAMEPAD tab for a pad player; HOWTO_BASICS SP line device-neutral
  (攒满 SP 就放大招); loading skips the 6 tips that name keyboard keys for pad players; 自动踩踏 desc and the
  error-screen hint device-neutral / per device. Menu blurb + pause steer (acc2) re-verified.
- [x] int#7 cold start (acc2) re-verified: title.webp held 3.5 s → drawn hero shown, art hidden until decoded,
  then shown; request order title > menu > garage > loading (cold.mjs).
- [x] perf#6 loading (acc2) re-verified: .br-road-dash animates transform only (br-road-run, will-change);
  after a 0.7 s main-thread task the % text = bar (53 % / 53 %).
- 设置 › 动态效果 desc now says it covers race flashes too (fits 3 lines, clear of the sticker).
- Tools: ui-results / ui-comfort take --out; probes in shots/r3-ui/*.mjs.

### r3 requests
- content: data/tips.ts has 6 keyboard-only tips (按住 Shift, 刹车键在 S, 按 C, 按 B, J 往左扇…, 按 P) that pad
  players never draw now; pad-worded twins or device-neutral rewrites would give them back.
- economy / content: achievements that should not count (silent tutorial ticks) must leave ACHIEVEMENTS (or
  get a flag ui can filter) so the records N/total stays honest; the sheet fits up to 54 entries.
- race / core (optional, still open): a save.stats crash counter if the sheet should show 翻车.
