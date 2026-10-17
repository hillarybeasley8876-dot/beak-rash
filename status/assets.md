# assets — status

## Plan
1. tools/gen-image.mjs (submit → poll → download; 4 tries, 10 s poll, 8 min cap, 4 concurrent,
   skip existing, log public/assets/gen.log). Jobs defined in tools/gen-jobs.mjs? -> NO: brief owns
   only gen-image.mjs + cutout.py; job list lives inside gen-image.mjs (prompt table) and
   public/assets/PROMPTS.md documents the final prompt per file.
2. Probe API once (pelican_main) → check response shapes, style.
3. tools/cutout.py: border flood fill near-white → alpha, soft edge, trim, ≤900 px tall, PNG + WebP.
4. Generate pelican set first, review, tune style line; then other 9 characters.
5. Key art (title 16:9, menu cut-out, loading_1..3, results) + billboards 6×3.
6. src/data/assets.ts manifest + PROMPTS.md; contact sheet shots/assets/sheet.png.

## Done
- tools/gen-image.mjs: PROMPTS.md-driven (tokens + `### out · aspect · mode` sections), submit/poll/download,
  4 tries, 8 min cap, 4 concurrent, skip existing, gen.log, --variants N / --pick out=i, history of re-rolls.
- tools/cutout.py: border flood fill (light + neutral light greys → also strips die-cut sticker borders),
  ink dilation seals gaps, colour-to-alpha 2 px band, speck removal, trim, fit, 256-col PNG + WebP, --flip.
- Pelican set generated (main = cand1 picked). Style tokens settled (burst behind whole figure).
- All 40 portraits generated (2–3 candidates each, best picked, reviewed on dark bg). Wheel-spoke gaps
  cleared via per-file `> cutout: --hole x,y,rx,ry` ellipses in PROMPTS.md (verified with
  shots/assets/bin/holes.py). goose_smug, pelican_eyes, capybara_eyes re-rolled with better prompts.

- Key art done + reviewed (shots/assets/review/keyart_*.jpg): title (16:9 full), garage (16:9 full, dark
  centre for the turntable), menu (cut-out wheelie), loading_1..3 (cut-out vignettes), results (cut-out podium).

- Billboards: 18 text-free 16:9 posters (coast/city/mountain × 6), 2–4 candidates each, picks reviewed
  (shots/assets/review/bill_*.jpg); `{STYLE_BILL}` now demands full-bleed (pillarboxed rolls rejected).
- Manifest: `node tools/gen-image.mjs --manifest` regenerates src/data/assets.ts from shipped WebP files
  (also runs after every gen/pick/recut run). Added export LOADING_ART (ART.loading = first).

- tools/cutout.py --frame CX,CY,S re-centres eyes strips (cat/capybara/pigeon/penguin/seagull/sloth/corgi)
  so the eyes sit inside the HUD skill band (900×186) and the SHOWTIME band (1520×200): verified with
  shots/assets/review/eyes_bands.jpg.
- sandbox/assets.html + assets.ts (manifest-driven gallery, backdrops split/red/black/checker/white, MISSING
  tiles, body[data-ready]/[data-failed]) + sandbox/assets.shots.mjs → shots/assets/gallery_*.png: 65/65 load.

- Game consumers checked (shots/assets/game_*.png, race_*.png, hud/rt_*.png): title art, menu card
  (pelican_main), results podium (busts), HUD cluster portrait, skill cut-in eyes band, SHOWTIME, KO splash.
- Pelican re-rolled on-model (red hooked beak tip, S-neck): main cand6 (+3 wheel holes), smug cand3,
  hurt cand3 (+flip so busts all face left). {PELICAN} token now insists on the red tip.

## Next
- title re-roll (cand6–9) for the red tip; else keep cand2
- check consumers in the game (title, menu, HUD cluster + cut-ins, results) → contact sheet → size audit
- polish if time: title pelican beak lacks the red hook tip

## Known issues

## Core requests

## How to test
