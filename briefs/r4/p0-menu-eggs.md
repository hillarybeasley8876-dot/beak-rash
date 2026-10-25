# r4 job p0-menu-eggs — two small easter eggs (pilot)

Read SPEC.md §1–§5 and §21 items 8–9. This is the pilot job of round r4: small on purpose. Do it carefully and
completely; the lead reads every line.

## What to build
1. **PELICAN on the main menu** (SPEC §21 #8 — on the MENU, because on the title any key leaves the title).
   - While the main menu is up, typing the letters P, E, L, I, C, A, N in this order (KeyboardEvent.code KeyP, KeyE,
     KeyL, KeyI, KeyC, KeyA, KeyN; the whole word within 4 s of its first letter) triggers the egg. Any other key in
     between, or a gap that makes the word take longer than 4 s, resets the progress (a fresh `P` starts again).
   - Effect: a P5 speech bubble (element with class `br-egg-bubble`, text `嘴大吃四方！`) appears next to the menu's
     pelican hero for 2.5 s, then disappears (a short fade-out is fine; it must be gone 3.5 s after the trigger).
     The hero art does a quick "gulp" squash-and-stretch (≈0.5 s CSS animation; none under reduced motion — use
     `reducedMotion()` from `src/ui/p5`). Call `app.audio.voice('pelican_taunt_0')` once per trigger.
   - It can trigger again after it finished. It must not change the screen, the menu cursor or anything else.
   - Listen with a `window` keydown listener added when the menu mounts and REMOVED in the screen's `dispose`
     (menu.ts already returns `dispose: offSave` — combine both). Ignore events with `repeat === true`.
     Letters A / L / P / I / C are also game actions (left / attackR / ult / skill2 / lookBack): the menu's own
     `onAction` must keep working exactly as now.
   - Put the key-sequence logic in a NEW small module `src/ui/screens/eggs.ts` (e.g. `createSequence(codes, windowS)`
     returning `push(code): boolean` (true when the sequence completes) and `reset()`), so later eggs (the Konami code
     in r4) can reuse it. Bubble styles go into a NEW `src/ui/screens/eggs.css` imported by eggs.ts. Use the P5 kit
     (`h`, `jagged` from `../p5`; look at how menu.ts / credits.ts build jagged plates; palette in SPEC §5).
2. **Credits idle line** (SPEC §21 #9).
   - On the credits screen, 30 s without any input (no key, no pad button, no mouse click/wheel) shows a plate
     (class `br-egg-thanks`, text exactly `特别鸣谢：每一只被画歪的鹈鹕。`) fixed on screen (NOT inside the scrolling roll),
     bottom centre, fading/sliding in; it stays until the screen closes.
   - Any input before that restarts the 30 s. Use the screen's existing input path (`onAction`) plus `wheel`/`pointerdown`
     listeners if credits.ts has them; remove any listener you add in `dispose`. Real time (the UI runs on real time).

## Files you own
`src/ui/screens/menu.ts`, `src/ui/screens/menu.css`, `src/ui/screens/credits.ts`, `src/ui/screens/credits.css`,
`src/ui/screens/eggs.ts` (new), `src/ui/screens/eggs.css` (new).

## How to test while you work
- `node tools/r4/p0-menu-eggs.mjs` (the lead's acceptance test — read it first to see exactly what is checked; do not
  edit it). It takes about 100 s.
- `node tools/r4/tsc-own.mjs src/ui/screens/menu.ts src/ui/screens/credits.ts src/ui/screens/eggs.ts`
- `node tools/ui-input.mjs` must stay all green (menu/title input regressions).
- Look at one screenshot of the bubble on the menu at 1920×1080 (save under `shots/r4-p0-menu-eggs/`, convert with
  `python tools/thumb.py`) and check it sits next to the hero, is readable and matches the P5 style.
