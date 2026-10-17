# Unit: assets — wave 1 — AI-generated 2D art for the P5 UI
Read SPEC.md §5 (characters, UI palette), §10 (where art is used), §13 (API + outputs). You own
`public/assets/{portraits,art,billboards}/**`, `public/assets/PROMPTS.md`, `src/data/assets.ts`,
`tools/gen-image.mjs`, `tools/cutout.py`. Python has PIL + numpy (no scipy); cwebp exists.

## Deliverables
1. `tools/gen-image.mjs`: submit → poll → download with retries/timeouts (see SPEC §13; 4 tries, 10 s
   poll, 8 min cap per image), run up to 4 jobs concurrently, skip outputs that already exist, log to
   `public/assets/gen.log`. Never put any key in files (the endpoint needs none on IOA).
2. Character art for all 10 characters (pelican first): `<id>_main` (3/4 dynamic riding pose on a
   bicycle, helmet per SPEC), `<id>_smug`, `<id>_hurt` (comedic dizzy/dazed, no gore), `<id>_eyes`
   (16:9 extreme close-up of the eyes, intense, for skill cut-in strips). Designs MUST match SPEC §5
   (same colours, accessories) so they agree with the 3D models. Style line for every prompt: bold
   sticker comic illustration, thick black ink outlines, flat cel shading, limited palette crimson red,
   pure black and white plus the character's own colours, halftone shading, jagged starburst background
   shapes, high contrast, no text, no letters, no watermark, plain white outer background.
3. `tools/cutout.py`: flood-fill near-white from the image border → alpha (soft 1–2 px edge, keep
   interior whites like the pelican's feathers because they are enclosed by black outlines), trim, save
   PNG (≤ 900 px tall) + WebP. Check every result visually (Read the image) and regenerate failures
   (text in image, wrong species/colours, cropped limbs, cut-out holes).
4. Key art: `art/title.png` (16:9: the pelican charging at the viewer on its bike, rivals behind,
   red/black burst), `art/menu.png` (pelican pose, transparent cut-out), `art/loading_*.png` (2–3 fun
   vignettes), `art/results.png` (podium celebration). Billboard posters, text-free, 6 for coast (sardine
   can, fish market, sunscreen with a pelican, surf school, gull warning, seaside ice cream), 6 for city,
   6 for mountain → `billboards/<track>_<n>.webp` (16:9 or 1:1).
5. `src/data/assets.ts`: keep the exported names/types, fill PORTRAITS/ART/BILLBOARDS with files that
   exist (relative to public/assets). `public/assets/PROMPTS.md`: final prompt per file.
6. A contact sheet `shots/assets/sheet.png` of everything for the critic.

## Quality bar (art critic)
Consistent style across the set, on-model to SPEC §5, appealing and funny, clean cut-outs, no text or
artefacts, total size ≤ 25 MB.
