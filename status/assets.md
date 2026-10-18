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
- (fixed in fix round 1) the new title art keeps the pelican's head + red hook at x 25-45 %, inside the title
  window (.br-title-art shows x 15-80 % of the art), so the old object-position problem is gone.
- City track build currently throws in env-city's landmarks.ts (`p5Face is not defined`, 2026-10-19), so the
  city LED-screen posters could only be checked with band.py, not in a drive-by.
- Step-mode screenshots (`--step`) can catch the HUD before images decode (blank cut-in band); use real
  time (shots/assets/bin/cutin.mjs) to judge portraits in the HUD.

## Core requests
- none

## Requests to other units
- ui-screens (critic r1 cross-unit note): results podium mixes the 'smug' bust (1st) with full-body 'main'
  riding art (2nd/3rd), so the cards have different subject scale; suggest smug busts for all three cards.

## How to test
- Gallery: /sandbox/assets.html (backdrops split/red/black/checker/white) · `node sandbox/assets.shots.mjs`.
- Regenerate/re-cut: `node tools/gen-image.mjs [--recut] [files…]`, `--pick out=i|eN`, `--manifest`;
  edits: put `> edit:` (+ optional `> model:` / `> canvas:`) under the file in PROMPTS.md, run
  `node tools/gen-image.mjs --edit [--variants N] --only <file>`, review raw/<file>.editN.png, `--pick file=eN`,
  then turn the line into `> note: edit (picked eN): …`. Reference sheet for the title: bin/castsheet.py.
- Billboards vs the track's text band: `python3 -E shots/assets/bin/band.py OUT.jpg 3 public/assets/billboards/*.webp`;
  drive-by: `node shots/assets/bin/bb.mjs coast,mountain 3` (TITLE=1 also shoots the title screen).
- HUD consumers: `node shots/assets/bin/hudimgs.mjs` (which portrait files each HUD event shows, decoded size).
- Contact sheet: `python3 -E shots/assets/bin/sheet.py shots/assets/sheet.png`.
- In game: `node shots/assets/bin/screens.mjs title menu loading results`, `node shots/assets/bin/race.mjs`,
  `node shots/assets/bin/cutin.mjs`.

## Fix round 1 (critic reviews/assets-r1-art.json: score 5.5, 1 blocker, 3 major, 7 minor)
API findings (2026-10-18): nano_banana accepts `image_urls: [url]` (url from `POST /api/fileupload`, multipart
`file`) = image edit that keeps the composition; `image_url` (singular) is ignored. `model_name: nano_banana_2`
works and returns 2752x1536 JPEG (2K) for 16:9. `/super_resolution` rejects every parameter shape tried.
Checkpoints (x = done):
- [x] B1 shiba_hurt rune-like lens bolts -> `--edit` (nano_banana + image_urls): both lenses solid black, rest
      identical (zoom-checked: no white marks); base prompt now forbids bolts/zig-zags on the lenses.
- [x] M1 billboards: 14/18 subjects under the text band -> 15 posters (the 14 + city_1) recomposed: cutout.py
      `--canvas S[,DY]` shrinks the raw to the bottom of a white canvas (city_1/city_5 `--frame` first to drop the
      inset field), nano_banana_2 outpaints it ({OUTPAINT} token) -> 2752 px raws, subject fully in the lower
      ~52 %, plain sky above. Checked with shots/assets/bin/band.py (faces.ts band simulation) + full sheet.
- [x] M2 title: fresh nano_banana_2 rolls with `> ref: shots/assets/ref/cast.png` (model sheet of the 9 shipped main
      portraits, bin/castsheet.py); cand1 picked (two wings on the bars, no spread wings, pouch, red hook inside the
      middle half), then an edit swapped its duplicated shiba for the seagull (yellow helmet, fry, yellow bike).
      Ships 2752x1536 (`--max-h 1536`, webp 634 KB). Checked in game: shots/assets/game_title.png.
- [x] M3 pelican main/smug/hurt: edits added the salmon-pink pouch along the lower beak (smug: hammock pouch with
      the fish inside + a 2nd pass removing the stray chest fish tail); {PELICAN} token now leads with the pouch;
      menu / loading_2 / loading_3 / results pelicans got the pouch too (loading_3 also red helmet + goggles,
      teal pigeon helmet; results capybara amber helmet) -> m4 done. Cut-outs checked on black.
- [x] m1 sloth_eyes: nano_banana_2 edit -> pupils + highlights + yellow sparks, strip now 1612x900 (was 968x553).
- [x] m2 goose_hurt: edit -> plump chest + folded wings, cropped at mid-chest, no feet (base prompt updated too).
- [x] m3 capybara_main / sloth_smug: edit removed the white die-cut halo (checked cut-outs on black).
- [x] m4 seagull main/smug/hurt/eyes: red spot on the lower beak tip added by edits (zoom-checked); loading_3 /
      results helmets fixed (see M3).
- [x] m5 city_1 / city_5 inset panels: now full-bleed (part of M1: --frame crop + outpaint).
- [x] m6 resolution: garage + 8 eyes strips redrawn by nano_banana_2 edits ({REDRAW} token; corr >= 0.65 on 64 px
      thumbs, pairs eyeballed: same composition) -> garage 2752x1536 (`--max-h 1536`), strip mode now --max-h 900 so
      all 10 eyes strips are 1612x900 (cover the 1520 px SHOWTIME band). Billboards stay 1032x576 (2x the 512x288
      atlas cell). Total 17.5 MB (webp 8.0 MB) <= 25 MB.
- [x] m7 cross-unit: title framing solved on the art side (see Known issues); podium busts noted for
      ui-screens under "Requests to other units". No requests to assets found in other status files.
Verification (2026-10-19): drive-bys shots/assets/bb_{coast,mountain}_*.png (coast_1/coast_3/mountain_1/mountain_2
subjects fully under the text band); hudimgs.mjs: KO splash shows the new shiba_hurt.webp (792x860 at 460x490),
SHOWTIME band pelican_eyes 1612x900 at 1683x336; gallery 65/65 load on split/checker/black, no console errors;
__br.errors [] in every run; tsc 0 errors; contact sheet shots/assets/sheet.png regenerated.
