# r6-fonts-2 — one source for the CJK faces (ui + world; SPEC §26)

## Plan
1. Prove the character scan of `tools/fonts/subset.py` really sees the world's canvas texts
   (`src/world/**`) and the HUD's `hudCnText()` sources (`src/data/*`).
   — `python shots/r6-fonts-2/scan-probe.py` → every world / data char is in `game_chars()`, 0 gaps.
2. `src/world/fonts.ts`: drop `noto-sans-sc` / `zcool-qingke-huangyou` / `zcool-kuaile`
   @fontsource imports, `import '../ui/fonts-cjk.css'`; keep Anton + `FONT` / `warmFonts` /
   `ensureFonts` unchanged. — `node tools/r4/tsc-own.mjs src/ui/ src/world/fonts.ts`.
3. `src/ui/hud/fonts.ts`: same — keep the four Latin faces, `import '../fonts-cjk.css'`,
   `preloadHudFonts` untouched. — same tsc-own command.
4. Regenerate: `python tools/fonts/subset.py` then `python tools/fonts/subset.py --check` → `subset OK`.
5. Delete `dropSupersededFaces*` + the MutationObserver from `src/ui/fonts.ts` (imports only).
   — `grep -c deleteRule src/ui/fonts.ts` → 0; `node tools/r4/tsc-own.mjs src/ui/`.
6. `npx vite build` + probes on :5301 listing every woff2 the menu and a race fetch
   (`shots/r6-fonts-2/probe-race-fonts.mjs`, `probe-signs.mjs`) → no @fontsource CJK slice.
7. Acceptance list + screenshots of the signs / road paint / HUD cut-ins via thumb.py.

## Done
- 1 — `shots/r6-fonts-2/scan-probe.py`: `game_chars()` (the string / template literals of `src/**/*.ts`)
  already contains every character of `src/world/**`, `src/data/tracks.ts`, `src/data/track-content/*`,
  `src/ui/hud/**` and `src/data/*` (0 outside), and the generated subset holds every one of them its
  ORIGINAL @fontsource face held, for all four families the two modules draw with.
- 2 — `src/world/fonts.ts`: `import '@fontsource/anton/400.css'` + `import '../ui/fonts-cjk.css'`.
  `FONT`, `loadFonts`, `warmFonts`, `ensureFonts` untouched (same family names, same weights).
- 3 — `src/ui/hud/fonts.ts`: Anton / Bebas Neue / Bangers / Black Ops One @fontsource +
  `import '../fonts-cjk.css'`; `LATIN`, `FIXED_CN`, `hudCnText()`, `preloadHudFonts` untouched.
- 4 — `python tools/fonts/subset.py` regenerated **byte-identically** (no diff in `public/fonts/cjk/` or
  `src/ui/fonts-cjk.css`), because the world's and the HUD's characters were already inside the scan.
- 5 — `src/ui/fonts.ts` is now imports only (six Latin @fontsource faces + `./fonts-cjk.css`).
  `dropSupersededFaces`, `dropSupersededFacesEverywhere`, the MutationObserver and the
  `CJK_FAMILIES` / `SUBSET_PREFIX` constants are gone; nothing deletes or rewrites a style rule.
- 6/7 — `dist/assets/` holds 15 Latin woff2 and **no** CJK one. On :5301 a menu visit + a race fetch
  0 bundled CJK slices; on :5300 the race has 244 `@font-face` rules and 0 errors.

## In progress / next
Nothing.

## How to test (exact commands)
- `python shots/r6-fonts-2/scan-probe.py` → `scan-probe OK` (world / hud characters covered per family)
- `python tools/fonts/subset.py --check` → `subset OK (5 faces, 228 files, 2266 KB)`
- `node tools/r4/tsc-own.mjs src/ui/ src/world/fonts.ts` → `TSC-OWN OK`
- `npx vite build && node tools/r6/ui.mjs` → `r6-ui OK` (fonts 1.17 MB, budget 1.6)
- `node tools/r6/fonts.mjs` → `r6-fonts OK`
- `node tools/r4/w3-hud.mjs` → `w3-hud OK`
- `node tools/r4/w3-world-polish.mjs --shots shots/r6-fonts-2/world` → `w3-world-polish OK`
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → `all checks passed`
- `node tools/core-check.mjs` → `core-check OK`
- `node shots/r6-fonts-2/probe-signs.mjs city` / `probe-race-fonts.mjs` / `probe-dev.mjs` — font requests
  + in-page unicode-range coverage on :5301 (race) and :5300 (dev).

## Evidence (key output lines)
- `scan-probe`: `world: 517 characters …, 0 outside game_chars()` / `ZCOOL QingKe HuangYou draws 513, subset
  has 513, missing 0` (KuaiLe 514/514, Noto Sans SC 517/517); `hud: 1464 characters …, 0 outside`;
  `Ma Shan Zheng 1455/1455` … → `scan-probe OK`
- `subset: 1572 game characters (1458 CJK), 5 faces, 228 files, 2266 KB` and `git status` shows **no**
  change under `public/fonts/cjk/` or `src/ui/fonts-cjk.css` → the regeneration is a no-op
- `subset OK (5 faces, 228 files, 2266 KB)` · `TSC-OWN OK` · `core-check OK` · `w3-hud OK` ·
  `w3-world-polish OK` · `[ui-tour] all checks passed`
- `r6-ui`: `PASS title + menu fetch ≤ 1.6 MB of fonts (1.17 MB; r5: 5.1 MB)` → `r6-ui OK`
- `r6-fonts`: `PASS no bundled @fontsource CJK slice is fetched on the menu or in a race (0: )`,
  `PASS the Chinese glyphs come from the subset /fonts/cjk/ (230 files; 76 font requests on the menu, 235
  in all)`, `PASS no font module deletes style rules at runtime`, `PASS no font module imports a bundled
  @fontsource CJK face` → `r6-fonts OK`
- race probe (:5301, coast): `font requests: 159 | bundled @fontsource CJK: 0 | subset: 155 | other: 4`,
  faces in the document: Anton/Bebas/Bangers/Black Ops/Rubik/Permanent Marker + the five subset families,
  `page errors: 0`
- sign probe (:5301, city): `coverage ZCOOL QingKe HuangYou / ZCOOL KuaiLe / Ma Shan Zheng / Noto Sans SC
  all sample glyphs covered`, `page errors: 0` (the only warning is the map's own
  `[track] city sign at s=1064 skipped (no room behind the kerb)`)
- dev probe (:5300, coast): `font-face rules in the document: 244`, `errors: 0`
- screenshots: `shots/r6-fonts-2/city.jpg` (neon signs + 「后空翻 BACKFLIP」 / 「擦肩」 STYLE / 「出没注意」
  police banner / 「前方鹅群出没」), `shots/r6-fonts-2/hud.jpg`, `shots/r6-fonts-2/sheet.jpg` (coast
  gantry 「暴力鹈鹕 · 滨海湾海岸公路」, road paint START, 「第八名」, skill diamonds 鱼/舌/翼/天),
  `shots/r6-fonts-2/dev-race.jpg` — the same faces as before.

## Known issues
- `tools/fonts/__pycache__/subset.cpython-310.pyc` is an untracked byproduct of my probe importing
  `subset.py`; `scan-probe.py` now sets `sys.dont_write_bytecode` so it is not recreated, but I am not
  allowed to delete files from Bash, so the stale one is still there (see Requests).
- Text that is not in the game's strings (a name typed in the lobby) still falls back down the stack
  (`--f-*` in p5/tokens.css ends in a system CJK face), unchanged from r6-fonts.

## Requests
- **lead:** `git clean` / delete `tools/fonts/__pycache__/` (untracked, created by my probe's
  `import subset`), and consider a `__pycache__/` line in `.gitignore`.
- **core (optional, carried over from r6-fonts):** SPEC §26 names the tool `tools/r6/subset-fonts.py`;
  it lives at `tools/fonts/subset.py`. Worth aligning the SPEC line.
