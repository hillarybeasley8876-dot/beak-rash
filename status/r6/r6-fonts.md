# r6-fonts — CJK subsets for the title + menu (SPEC §26)

## Plan
1. Probe the game's own characters + the @fontsource slice layout. — inline probe: 926 files, 1450 hanzi.
2. `tools/fonts/subset.py`: parse the five faces' `<weight>.css`, intersect each slice's unicode-range with
   the game characters, subset that slice into `public/fonts/cjk/<face>-<n>.woff2`, emit `src/ui/fonts-cjk.css`
   (same family / weight / font-display, `url('/fonts/cjk/…')`, exact unicode-range) + a `--check` mode.
   — `python tools/fonts/subset.py` → "N game characters, 228 files, 2266 KB".
3. `src/ui/fonts.ts` keeps the Latin @fontsource imports and imports `./fonts-cjk.css`.
   — `node tools/r4/tsc-own.mjs src/ui/`.
4. Make the subsets actually win (see Known issues): world/hud still declare the same five families.
   — `npx vite build` + a CDP probe of every woff2 the built page fetches (`shots/r6-fonts/probe-fonts.mjs`).
5. Measure the first visit: `npx vite build && node tools/r6/ui.mjs` → fonts ≤ 1.6 MB.
6. Before/after screenshots (title, menu, career, roster, lobby, race HUD) + a pixel diff of the text crops.
   — `node shots/r6-fonts/shoot.mjs before|after`, `python tools/thumb.py …`.
7. Full acceptance.

## Done
- `tools/fonts/subset.py` (319 lines): `game_chars()` takes the string / template literals of `src/**/*.ts`,
  `src/**/*.css` (comments and code dropped) and the text nodes of `index.html`, keeps CJK + kana + fullwidth
  + ASCII, and subsets each @fontsource slice that holds at least one of them (glyph names, all layout
  features, `recalc_timestamp=False` so a rebuild is byte-identical). Stale outputs are swept.
  `--check` re-reads the CSS + every woff2 and verifies each face still holds every game character its
  ORIGINAL slices held, that no rule over-declares and that no orphan file is left.
- `public/fonts/cjk/` — 228 files, 2266 KB total (the @fontsource originals are ~40 MB).
- `src/ui/fonts-cjk.css` — 228 `@font-face` rules, sorted by slice number, `url('/fonts/cjk/…')`
  (Vite rewrites it to `../fonts/cjk/…`, which resolves from the built `index.html`).
- `src/ui/fonts.ts` — Latin imports + `./fonts-cjk.css` + `dropSupersededFaces()` (see Known issues).
- Screenshots before/after and a pixel diff of the text regions.

## In progress / next
Nothing. If `src/**` text changes, rerun `python tools/fonts/subset.py` (then `--check`).

## How to test (exact commands)
- `python tools/fonts/subset.py` then `python tools/fonts/subset.py --check` → `subset OK (5 faces, 228 files, 2266 KB)`
- `node tools/r4/tsc-own.mjs src/ui/` → `TSC-OWN OK`
- `npx vite build && node tools/r6/ui.mjs` → `r6-ui OK` (fonts 1.17 MB, budget 1.6)
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → `all checks passed`
- `node tools/r4/w3-screens.mjs` → `w3-screens OK`
- `node tools/core-check.mjs` → `core-check OK`
- `node shots/r6-fonts/probe-fonts.mjs` — lists every font the built page on :5301 fetches for title + menu.

## Evidence (key output lines)
- `subset: 1572 game characters (1458 CJK), 5 faces, 228 files, 2266 KB -> src/ui/fonts-cjk.css`
- `subset OK (5 faces, 228 files, 2266 KB)` (regenerating twice leaves the md5 of a slice and of the CSS unchanged)
- `TSC-OWN OK` / `core-check OK` / `w3-screens OK` / `[ui-tour] all checks passed`
- `PASS title + menu fetch ≤ 1.6 MB of fonts (race fonts load with the race) (1.17 MB; r5: 5.1 MB)` → `r6-ui OK`
- probe: `TOTAL 1.43 MB over 87 files` (only `/fonts/cjk/*.woff2` + the latin faces; was `3.84 MB over 161 files`)
- before/after pixel diff of the text crops (title logo, menu entries, cup names, roster names, lobby,
  HUD strip) is inside the run-to-run animation noise — `after` vs `after2` differs as much as
  `before` vs `after` (race HUD: 0 differing pixels in both).

## Known issues
- **world / hud still declare the same five CJK families.** `src/world/fonts.ts` and `src/ui/hud/fonts.ts`
  (not my files) `import '@fontsource/<face>/*.css'`. That defeats a subset two ways: the browser picks the
  LAST face of a family covering a character (their lazily loaded chunk CSS lands after the entry
  stylesheet), and `document.fonts.load(family, text)` — which both call — downloads EVERY face of the
  family covering the text. Importing the @fontsource CSS into the entry stylesheet ahead of the subsets
  was not enough (still 3.86 MB); the only thing that works from `src/ui/fonts.ts` is
  `dropSupersededFaces()`, which deletes the superseded `@font-face` rules from every stylesheet (now and
  as Vite injects later ones). It is ~25 lines and clearly marked for deletion — see Requests.
- Text that is not in the game's strings (a name typed in the lobby) falls back down the stack
  (`--f-*` in p5/tokens.css ends in a system CJK face), as the brief allows.

## Requests
- **ui-screens / world / ui-hud:** drop the five `@fontsource` CJK imports from `src/world/fonts.ts` and
  `src/ui/hud/fonts.ts` and import the generated subset instead (`import '../../ui/fonts-cjk.css'` /
  `import '../fonts-cjk.css'`). Then delete `dropSupersededFaces()` + the MutationObserver from
  `src/ui/fonts.ts` (keep the Latin `@fontsource` imports and `import './fonts-cjk.css'`). Nothing else
  changes: the family names, weights and stacks stay the same.
- **core (optional):** SPEC §26 names the tool `tools/r6/subset-fonts.py`; it lives at
  `tools/fonts/subset.py` (a worker's own path). Worth aligning the SPEC line.
