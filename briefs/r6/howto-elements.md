# r6 job howto-elements — the element reactions get their own HOW TO tab (ui-screens + content; SPEC §24)

The HOW TO 「新玩法」 tab is full: its grid (`src/ui/screens/howto.css`) holds the eleven r4 cards in 3 rows; the
element-reactions card added in r6 (`src/data/strings.ts` HOWTO_NEW id `elements`) becomes a 4th row that runs off
the bottom of the screen (measured: 6 of its 8 lines off screen at 1280×720 and at 1920×1080). Read SPEC.md §10
(UI) and §24 (elements and reactions), `src/ui/screens/howto.ts`, `howto-pages.ts`, `howto.css`, `src/data/strings.ts`
(HOWTO_*), `src/data/skills.ts` (`ELEMENT_CN`, `ELEMENT_COLOR`, `REACTION_CN`, `REACTION_COLOR`, which skills carry
which element), and the acceptance `tools/r6/present.mjs` (its last part).

## Build it
1. A fifth tab 「元素 ELEMENTS」 after 「新玩法」 (`howto.ts` TABS; `howto-pages.ts elementsPage()`), designed for
   the stage (1920×1080, scaled), P5 style:
   - the four elements as big badges in their colours (火 水 冰 雷 + 风 as the carrier), each with one line: what
     it leaves on the rider (from HOWTO_ELEMENTS in strings.ts) and two or three skills that carry it (their names
     from `SKILLS`, e.g. 火：喷火、火箭冲刺、陨石雨);
   - the seven reactions as a 「A + B = 反应」 row each, the reaction word in its colour, one line of what it does;
   - a note: 「下雨天所有人都是湿的——一个雷就能电一串」.
   Everything on screen at 1280×720 and 1920×1080, nothing overlapping, text ≥ 18 px at 1280×720.
2. Content: move the reactions text out of HOWTO_NEW into its own `HOWTO_ELEMENTS` export in `strings.ts` (the
   eleven r4 cards stay as they are, so 「新玩法」 fits again).
3. Keys: ←→ walk the five tabs (the first-visit tab stays as today); Esc → menu.

## Files you own
`src/ui/screens/howto.ts`, `src/ui/screens/howto-pages.ts`, `src/ui/screens/howto.css`, `src/data/strings.ts`.

## Acceptance (the runner runs these; read `tools/r6/present.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/screens/ src/data/` → TSC-OWN OK
- `node tools/r6/present.mjs --only visual` → r6-present OK
- `node tools/r4/w3-screens.mjs` → w3-screens OK
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/content-lint.mjs` → no new errors (93 today; the runner checks the count)
- `node tools/core-check.mjs` → core-check OK
Look at the new tab at both sizes (`shots/r6-howto-elements/`, thumb.py) before you report.
