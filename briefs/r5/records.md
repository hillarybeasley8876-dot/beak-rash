# r5 job records — read every achievement with keyboard / pad; the pause sheet names the r4 actions (ui-screens)

Read SPEC.md §10 (screens), §5 (P5 art) and the records sheet: `src/ui/screens/records.ts` + `records.css` (opened with
Tab / pad LB·RB from `career.ts`; 71 achievements in a dense grid + the 彩蛋 n/9 column) and `src/ui/screens/pause.ts`
(the CONTROLS sheet). With 71 achievements most cells cut their description with "…"; the full text is only in a
mouse tooltip, so keyboard and pad players cannot read how to earn most of them.

## Build it
1. Records sheet navigation: every achievement cell gets `data-ach="<id>"` (catalogue order). The sheet opens with the
   first cell focused (class `is-focus`, a clear P5 cursor: red jagged frame); ←→↑↓ (and the pad d-pad / stick, through
   the same action stream the career screen uses) move the focus across the grid (→ at the end of a row continues on
   the next row; it does not wrap past the last cell); hovering a cell focuses it. A detail strip
   (`data-ach-detail`) under or beside the grid shows the focused achievement: its icon, name, the FULL description
   and its state (earned → 「已解锁」 / not yet → 「未解锁」). Keep the egg column. Tab / Esc / pad B close the sheet
   as today; while it is open the career grid does not move.
2. Everything stays on screen at 1280×720 and 1920×1080 (shrink the grid cells if the detail strip needs the room).
3. Pause CONTROLS: name the r4 actions without breaking the layout — `K / Y` 「重击 · 按住投掷」, `SHIFT / RB`
   「漂移 · 空中特技」, `B / BACK` 「打铃 · V我50」.

## Files you own
`src/ui/screens/records.ts`, `src/ui/screens/records.css`, `src/ui/screens/career.ts`, `src/ui/screens/career.css`,
`src/ui/screens/pause.ts`, `src/ui/screens/pause.css`.

## Acceptance (the runner runs these; read `tools/r5/records.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/screens/records.ts src/ui/screens/career.ts src/ui/screens/pause.ts` → TSC-OWN OK
- `node tools/r5/records.mjs` → r5-records OK
- `node tools/r4/w3-screens.mjs` → w3-screens OK
- `node tools/ui-input.mjs` → all checks passed
- `node tools/core-check.mjs` → core-check OK
Look at your work: the records sheet with a focused cell at 1280×720 and 1920×1080, and the pause screen, under
`shots/r5-records/`.
