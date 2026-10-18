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

- Title red tip: re-rolls cand6–8 tried (cand8 checked in game) → kept cand2; the missing red hooked tip is
  painted by `tools/cutout.py --tint X,Y,RX,RY` (orange → crimson inside an ellipse, shading kept). Tints on
  title, menu, loading_1..3, results (`> cutout: --tint` lines in PROMPTS.md); verified zoomed + in game.
- Consumers re-checked after the pelican re-roll + tints (2026-10-18): title, menu (cut-out wheelie),
  loading (vignette), results podium, race HUD cluster portrait, skill cut-in eyes band, rival cut-in:
  shots/assets/game_{title,menu,loading,results}.png, race_*.png, hud/rt_{skill,rival}.png; __br.errors [].
- Contact sheet regenerated: shots/assets/sheet.png (65 assets; CJK header font fixed). Gallery 65/65 load.
- Size audit: portraits 8.2 MB + art 2.2 MB + billboards 1.7 MB = 12.1 MB (≤ 25 MB); runtime uses WebP
  only (6.5 MB); PNG twins (5.7 MB) kept because SPEC §10 names the .png paths.

## Next
- (none: wave-1 deliverables complete)

## Known issues
- Title screen (ui-screens framing, not an asset bug): `.br-title-art` is a 64 %-wide box with
  object-position 42 % 50 %, so the pelican's red beak tip (x ≈ 92 % of the art) is cropped off-screen.
  Tried in-page (shots/assets/review/title_pos{75,85}.png, bin/titlepos.mjs): 85 % 50 % shows the whole
  pelican incl. the tip, but the goose/capybara slide behind the tagline band. ui-screens' call.
- Step-mode screenshots (`--step`) can catch the HUD before images decode (blank cut-in band); use real
  time (shots/assets/bin/cutin.mjs) to judge portraits in the HUD.

## Core requests
- none

## How to test
- Gallery: /sandbox/assets.html (backdrops split/red/black/checker/white) · `node sandbox/assets.shots.mjs`.
- Regenerate/re-cut: `node tools/gen-image.mjs [--recut] [files…]`, `--pick out=i`, `--manifest`.
- Contact sheet: `python3 -E shots/assets/bin/sheet.py shots/assets/sheet.png`.
- In game: `node shots/assets/bin/screens.mjs title menu loading results`, `node shots/assets/bin/race.mjs`,
  `node shots/assets/bin/cutin.mjs`.
