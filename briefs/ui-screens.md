# Unit: ui-screens (ui/) — wave 1 — Persona-5-grade menus
Read SPEC.md first (§0–2, §5 UI, §10 is your spec, §12 content). You own `src/ui/**` except
`src/ui/hud/**` (ui-hud unit) and the core-owned `src/ui/stub.ts`, `src/ui/hud/contract.ts`; `sandbox/ui.*`.
Contract: `createUi(app) → Ui` (show/screen/attach/update/toast). Create one full-screen layer for the
HUD and call `createHud(app, layer)` from `src/ui/hud` (attach/setVisible/update — see hud/contract.ts).

## Deliverables
1. P5 component kit (`ui/p5/`): CSS variables + reusable pieces (ransom-note text generator, skewed
   jagged panels via clip-path, star bursts, halftone backgrounds, torn-paper edges, red jagged menu
   cursor, slanted buttons, stat bars, portrait frames, screen transitions = red/black diagonal shard
   wipes ≤ 450 ms). Pure DOM/CSS/SVG + small TS; no framework. Fonts via @fontsource imports
   (anton, bebas-neue, bangers, black-ops-one, rubik-mono-one, permanent-marker, zcool-kuaile,
   zcool-qingke-huangyou, ma-shan-zheng, zhi-mang-xing, noto-sans-sc — import only weights you use).
2. Screens (`ui/screens/*.ts`, one per file): boot, title, menu, career, trackSelect, garage (3D
   turntable in its own small canvas using `createBike` from `src/actors/bikes`), loading (P5 calendar
   card + tip + road progress), pause, results (podium, table, grade stamp, coins count-up + save,
   achievements), settings (writes app.save + applies volumes via app.audio.setVolumes + autoPedal via
   app.input), howto, credits. Wire flow events (`flow:startRace` with config from selections,
   `flow:pause`, `flow:restartRace`, `flow:quitRace`). Keyboard/gamepad (input.onAction) + mouse.
   Portraits/art from `src/data/assets.ts` with silhouette fallbacks; data from data/*.ts.
3. Audio hooks: call `app.audio.unlock()` on the first key/click; `app.audio.music('title'|'menu'|…)`
   on screen changes; `app.audio.sfx('ui.move'|'ui.confirm'|'ui.back'|'ui.cutin')`.
4. `sandbox/ui.html` (or `?screen=` URLs) to screenshot every screen; `tools/ui-tour.mjs` that visits all
   screens via keyboard and screenshots each at 1280×720 and 1920×1080 (+ a 2560×1440 spot check).

## Quality bar (aesthetic + interaction critics)
Each screen would not look out of place next to Persona 5's menus: bold composition, motion, hierarchy,
crisp type, no generic web look, no overflow/clipping at 16:9 and 16:10, everything reachable by keyboard,
focus always visible, Esc always backs out, no dead ends, no console errors.
