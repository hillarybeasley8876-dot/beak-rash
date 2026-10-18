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
- Quality setting is saved but applies after a reload (renderer is created once by core/game.ts).
- Results demo data shows when `?screen=results` has no race props (never saves).

## Core requests
- (done by core 21:55) muffle reset in endSession; Input.press listener isolation.
- Coins: ui-screens credits `RaceResult.coins` of the player to `save.coins` on the results screen;
  race unit saves `save.stats` (agreed in race/results.ts comment).

## How to test
- `node tools/ui-tour.mjs` (add `--real` to use every real unit) → shots/ui-tour/<size>/NN-*.png.
- `node tools/ui-results.mjs [--real]` → achievements → results chips check, shots/ui-screens/results-ach.png.
- `/sandbox/ui.html?screen=menu` or `/?screen=<id>` (`&stub=world,sim,camera,actors,combat,race,fx,audio`).
- `npx tsc --noEmit -p tsconfig.json` (ui files clean).
