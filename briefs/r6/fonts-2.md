# r6 job fonts-2 — one source for the CJK faces: the world and the HUD use the subset too (ui + world; SPEC §26)

The fonts job subset the five CJK faces (`tools/fonts/subset.py` → `public/fonts/cjk/`, `src/ui/fonts-cjk.css`,
imported by `src/ui/fonts.ts`). Two other modules still import the full @fontsource CSS of the same families:
`src/world/fonts.ts` (canvas signs and road paint) and `src/ui/hud/fonts.ts` (the HUD warm-up). Two copies of a
family fight: the browser takes the last `@font-face` that covers a character, and `document.fonts.load(family,
text)` downloads every face of the family that covers the text. To keep the title + menu under budget the fonts job
added `dropSupersededFaces()` to `src/ui/fonts.ts`, which deletes the @fontsource CJK rules from every stylesheet at
runtime (also the ones Vite injects later) — a patch that has to go. Read `status/r6/r6-fonts.md` (its Known issues
and Requests), `tools/fonts/subset.py`, `src/ui/fonts.ts`, `src/ui/fonts-cjk.css`, `src/world/fonts.ts`,
`src/ui/hud/fonts.ts`.

## Build it
1. `src/world/fonts.ts` and `src/ui/hud/fonts.ts`: drop their CJK @fontsource imports (zcool-kuaile,
   zcool-qingke-huangyou, ma-shan-zheng, noto-sans-sc) and import the subset instead (`../ui/fonts-cjk.css` /
   `../fonts-cjk.css`); keep their Latin @fontsource imports, `FONT`, `warmFonts`, `ensureFonts`, `preloadHudFonts`
   exactly as they are (the family names do not change).
2. `subset.py` must cover every character these two modules draw: the world's canvas texts (sign boards, road
   paint, billboards — they come from strings in `src/`, check that the scan sees them, e.g. `src/world/**`) and
   the HUD's `hudCnText()` sources (`src/data/*`). Run `python tools/fonts/subset.py` to regenerate, then `--check`.
3. Remove `dropSupersededFaces*()` from `src/ui/fonts.ts`; nothing else may delete or rewrite style rules.
4. Rebuild (`npx vite build`) and confirm on :5301 that no `@fontsource/<cjk face>` file is requested anywhere: not
   on the title / menu, not in a race (load a race on the production build and list the font requests).

## Files you own
`src/world/fonts.ts`, `src/ui/hud/fonts.ts`, `src/ui/fonts.ts`, `src/ui/fonts-cjk.css`, `tools/fonts/subset.py`,
`public/fonts/cjk/`.

## Acceptance (the runner runs these)
- `python tools/fonts/subset.py --check` → subset OK
- `node tools/r4/tsc-own.mjs src/ui/ src/world/fonts.ts` → TSC-OWN OK
- `npx vite build && node tools/r6/ui.mjs` → r6-ui OK
- `node tools/r6/fonts.mjs` → r6-fonts OK (on the rebuilt :5301: no @fontsource CJK slice fetched on the menu or in a
  race, no style-rule deletion left in the font modules)
- `node tools/r4/w3-hud.mjs` → w3-hud OK
- `node tools/r4/w3-world-polish.mjs --shots shots/r6-fonts-2/world` → w3-world-polish OK
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/core-check.mjs` → core-check OK
Look at a race's signs and road paint and the HUD cut-ins (screenshots via thumb.py): the same faces as before.
