# r6 job fonts — the title and the menu fetch only the glyphs they draw (ui-screens + build tool; SPEC §26)

SPEC §26: "CJK fonts are subset to the glyphs the game uses (build-time)". Measured on the production build
(`node tools/r6/ui.mjs`, its last part: a first visit at 8 Mbps): the title + the main menu fetch **2.67 MB** of
fonts; the budget is **≤ 1.6 MB**. Why: `src/ui/fonts.ts` imports the @fontsource CSS of five Chinese display
faces (ZCOOL KuaiLe, ZCOOL QingKe HuangYou, Ma Shan Zheng, Zhi Mang Xing, Noto Sans SC 900). Each face is split into
~90 unicode-range slices of 60–110 KB, each holding a few hundred glyphs; the menu's ransom titles touch dozens of
slices per face, and each slice is downloaded whole although the game uses a handful of its glyphs.

## Build it
1. **`tools/fonts/subset.py`** (Python 3.10 + fontTools 4.63, both installed; no network): for each of the five CJK
   faces, read its @fontsource slice files (`node_modules/@fontsource/<face>/files/*-<weight>-normal.woff2` and the
   slice → unicode-range map in its `<weight>.css`), and write one new slice per original slice that holds ONLY the
   game's characters of that slice (`fontTools.subset`, keep the glyph names / layout features the face needs,
   `flavor='woff2'`) into `public/fonts/cjk/<face>-<n>.woff2`; skip slices with none of the game's characters. The
   game's characters = every CJK ideograph, kana, CJK / fullwidth punctuation and symbol in the strings of `src/**/*.ts`,
   `src/**/*.css`, `index.html` (parse the files as text; also the digits, ASCII letters and punctuation so a CJK face
   used for mixed text still covers them). Write `src/ui/fonts-cjk.css`: one `@font-face` per new slice with the
   same family name, weight and `font-display` as the @fontsource rule, `src: url('/fonts/cjk/…woff2')` (the build's
   `base: './'` → use a path that works from the built `index.html`; check it on :5301) and a `unicode-range` that
   lists exactly the characters in that file. `--check`: re-reads the outputs and verifies every game character is
   covered by every face whose original slices covered it; prints `subset OK (<faces>, <files>, <KB>)`.
2. **`src/ui/fonts.ts`**: keep the Latin @fontsource imports; replace the five CJK imports with
   `import './fonts-cjk.css'`. Nothing else in the UI changes: the same family names, the same stacks
   (`p5/tokens.css`).
3. Text not in the game's strings (a player's name typed in the lobby) falls back down the stack — fine.
4. Keep the generated files small and stable: sort by slice number; regenerate whenever text changes (the script
   prints how many characters it found; the acceptance runs `--check`).

## Look at it
Shoot the title, menu, career, roster, lobby and a race HUD (1280×720) after the change and compare with before
(`shots/r6-fonts/`, thumb.py): the same faces everywhere, no tofu boxes, no fallback system font in a ransom title.

## Files you own
`tools/fonts/subset.py`, `public/fonts/cjk/` (generated), `src/ui/fonts-cjk.css` (generated), `src/ui/fonts.ts`.

## Acceptance (the runner runs these; read the last part of `tools/r6/ui.mjs` first)
- `python tools/fonts/subset.py --check` → subset OK
- `node tools/r4/tsc-own.mjs src/ui/` → TSC-OWN OK
- `npx vite build` then `node tools/r6/ui.mjs` → r6-ui OK (its last part measures the fonts of the production build
  served on :5301 — always rebuild before you run it)
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/r4/w3-screens.mjs` → w3-screens OK
- `node tools/core-check.mjs` → core-check OK
