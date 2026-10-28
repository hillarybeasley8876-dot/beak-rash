# r6-howto-elements — the 「元素 ELEMENTS」 HOW TO tab

## Plan
1. Content: add `HOWTO_ELEMENTS` / `HOWTO_REACTIONS` / `HOWTO_ELEMENTS_NOTE` to `src/data/strings.ts`;
   delete the `elements` card from `HOWTO_NEW` (11 r4 cards stay). Proof: `node tools/content-lint.mjs`.
2. `howto-pages.ts`: `elementsPage()` — 5 badges, 7 reaction rows, the rain note.
   Proof: `node tools/r4/tsc-own.mjs src/ui/screens/ src/data/`.
3. `howto.css`: `.br-ht-el*` / `.br-ht-rx*` inside the 1760×740 body, every font ≥ 28 px (≥ 18 px at 1280×720).
4. `howto.ts`: 5th tab `['元素','ELEMENTS', elementsPage]`; ←→ and Esc unchanged. Proof: `node tools/core-check.mjs`.
5. Look at it: `node shots/r6-howto-elements/probe.mjs` (on-screen + overlap measure, png at both sizes).
6. Acceptance: present / w3-screens / ui-tour / content-lint / core-check.

## Done
- All 6 steps. The 「新玩法」 grid is back to 11 cards in 3 rows (measured: 0 of 87 text leaves off screen at both sizes).
- 「元素 ELEMENTS」: 5 element badges (火 水 冰 雷 风, colour from `ELEMENT_COLOR`, 1 line of what it leaves +
  2–3 skill names from `SKILLS`), 7 「A + B = 反应」 rows (word in `REACTION_COLOR`), the rain note.
- Reaction rows fade in (`br-fade-in`) instead of sliding: `br-in-right` translates 120 % and `present.mjs`
  measures ~250 ms after the tab switch, which caught the rows mid-flight (10 leaves "off screen").

## In progress / next
— done —

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/screens/ src/data/` → `TSC-OWN OK`
- `node tools/r6/present.mjs --only visual` → `r6-present OK`
- `node tools/r4/w3-screens.mjs` → `w3-screens OK`
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → `all checks passed`
- `node tools/content-lint.mjs` → `93 errors`
- `node tools/core-check.mjs` → `core-check OK`
- `node shots/r6-howto-elements/probe.mjs` / `node shots/r6-howto-elements/tabs.mjs` (my probes)

## Evidence (key output lines)
- `PASS 1280x720: HOW TO has a tab that explains the seven reactions, every line on screen (tab 「元素ELEMENTS」, 9 lines, 0 off screen)`
- `PASS 1920x1080: … (tab 「元素ELEMENTS」, 9 lines, 0 off screen)` / `r6-present OK`
- `w3-screens OK`; `[ui-tour] all checks passed`; `core-check OK`
- `content-lint: 1389 strings in 194 groups · 93 errors · 0 warnings` (unchanged)
- probe, both sizes: `{"leaves":65,"off":[],"hits":[],"errors":[]}`, smallest text 19 px at 1280×720
- tabs probe: 新玩法 `off: 0` of 87 leaves at both sizes; Esc from the 5th tab → `screen = menu`, 0 errors

## Known issues
- `tabs.mjs` reports 4 "off" leaves on the 技能 tab (`br-ht-skey br-pad-only`): they are `display:none` at
  width 0 on a keyboard session. Pre-existing, not from this job.

## Requests
(none)
