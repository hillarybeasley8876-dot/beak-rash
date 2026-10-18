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
  arm delay, default focus), title ignores back keys, double-click, pills/ticks, reduced motion, parked
  pointer, locked-click toast (exits 1 on failure).
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
