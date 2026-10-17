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
  (achievement detection from bus events).
- tools/ui-tour.mjs (keyboard-only full tour 1280×720 + 1920×1080, spot 2560×1440 + 1440×900; checks
  errors, visible focus, controls inside viewport) — last run: all checks passed.
- sandbox/ui.html (+ui.ts): screen buttons, size presets, stub toggle.
- Verified: real-unit flow menu → quick race → loading → race (real HUD) → pause → resume, 0 errors;
  career rewards/unlock/next; mouse paths; reduced motion; gamepad glyphs.

## Next
- polish only (see known issues).

## Known issues
- ZCOOL QingKe's stylised 公 reads oddly in ransom titles (font design, accepted).
- Quality setting is saved but applies after a reload (renderer is created once by core/game.ts).
- Results demo data shows when `?screen=results` has no race props (never saves).

## Core requests
- `src/core/game.ts`: `flow:quitRace`/`flow:restartRace` from pause leave audio muffled (only
  `flow:pause {paused:false}` calls setMuffle(0)); ui calls `app.audio.setMuffle(0)` itself before
  emitting — consider resetting muffle in `endSession()`.
- `src/core/input.ts`: `Input.press()` loops listeners without try/catch; ui guards its own handler.
- Coins: ui-screens credits `RaceResult.coins` of the player to `save.coins` on the results screen;
  race unit saves `save.stats` (agreed in race/results.ts comment).

## How to test
- `node tools/ui-tour.mjs` (add `--real` to use every real unit) → shots/ui-tour/<size>/NN-*.png.
- `/sandbox/ui.html?screen=menu` or `/?screen=<id>` (`&stub=world,sim,camera,actors,combat,race,fx,audio`).
- `npx tsc --noEmit -p tsconfig.json` (ui files clean).
