# r5 · records — every achievement readable with keyboard / pad; the pause sheet names the r4 actions

## Plan
1. Read SPEC §5/§10, `src/ui/screens/records.ts|css`, `career.ts`, `pause.ts`, `src/ui/nav.ts`,
   `tools/r5/records.mjs`, `tools/r4/w3-screens.mjs`, `tools/ui-input.mjs`. Baseline: `node tools/r5/records.mjs`.
2. `records.ts`: every cell gets `data-ach="<id>"` (catalogue order) + a `Nav` grid (6 columns) so
   ←→↑↓ / d-pad move the focus; a `[data-ach-detail]` strip shows the focused one's icon, name, FULL
   description and 已解锁 / 未解锁. Proof: `node tools/r5/records.mjs` (focus + detail + walk).
3. `records.css`: the sheet fits the 1920×1080 stage at any scale (dense grid, detail strip in the
   side column, 彩蛋 column kept) + a red jagged focus cursor. Proof: `node tools/r5/records.mjs`
   (the "on screen" check at 1280×720 and 1920×1080).
4. `career.ts`: route the direction actions to the records grid while the sheet is open (the career
   ladder stays put), keep Tab / Esc / pad B closing it. Proof: `node tools/ui-input.mjs`.
5. `pause.ts|css`: name the r4 actions (K/Y 重击·按住投掷, SHIFT/RB 漂移·空中特技, B/BACK 打铃·V我50)
   without breaking the sheet. Proof: `node tools/r5/records.mjs` (the pause block) + `w3-screens`.
6. Acceptance: tsc-own, r5/records, r4/w3-screens, ui-input, core-check + stills in `shots/r5-records/`.

## Done
- **`src/ui/screens/records.ts`** — the sheet is now a real, navigable list:
  - every achievement cell carries `data-ach="<id>"` in catalogue order (71 cells);
  - the grid is its own `Nav` (6 columns, the same `ui/nav.ts` the career screen uses), so ←→↑↓, the
    WASD keys, the pad d-pad and the left stick (the shell maps the pad's skill2/skill3 to up/down)
    move the focus over the cells; → runs along the row and continues on the next row;
  - a `[data-ach-detail]` strip (top of the side column) shows the focused achievement in full: its
    star icon + glyph, its name, the WHOLE description (the cells only fit a cut name) and its state
    — 已解锁 (red badge) or 未解锁;
  - hovering a cell focuses it (a `mouseenter` listener on each cell, so the mouse works too);
  - the sheet opens with the first cell focused and the 彩蛋 column (nine eggs, `data-egg`) is kept.
- **`src/ui/screens/records.css`** — the sheet is sized in stage pixels (the UI is a 1920×1080 stage
  that scales), so it fits at 1280×720 and at 1920×1080: a dense 6 × 12 grid on the left, the detail
  strip and the 彩蛋 column on the right, the lifetime stats in the head. The focus cursor is a red
  jagged block (a chamfered clip-path + a black drop shadow). The cells no longer carry a cut
  description — the detail strip holds the full text.
- **`src/ui/screens/career.ts`** — while the sheet is open the arrows walk the achievement grid
  (`records.handle(a)`) instead of the career ladder, which stays frozen (`nav.enabled = !open`).
  Tab / Esc / pad B / Space still close it; the sheet's Nav is disposed with the screen.
- **`src/ui/screens/pause.ts` / `pause.css`** — the CONTROLS sheet names the r4 actions:
  `SHIFT / RB` 漂移 · 空中特技, `K / Y` 重击 · 按住投掷, `B / BACK` 打铃 · V我50. The key grid went
  from three columns to two so the longer names fit; the sheet still ends 17 px above the bottom.

## In progress / next
Nothing left in the brief. One point for the lead: the grid **wraps** — → on the last cell goes back
to the first one (the row itself never wraps: → at the end of a row continues on the next row). The
lead's own acceptance test walks the whole catalogue with → alone, which only reaches all 71 with the
wrap, so I kept it; say the word and I will clamp at the last cell instead.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/screens/records.ts src/ui/screens/career.ts src/ui/screens/pause.ts`
- `node tools/r5/records.mjs`
- `node tools/r4/w3-screens.mjs`
- `node tools/ui-input.mjs`
- `node tools/core-check.mjs`
- Pad / look: `node shots/r5-records/probe.mjs` (stills), `node shots/r5-records/padprobe.mjs` (d-pad).

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/ui/screens/records.ts src/ui/screens/career.ts src/ui/screens/pause.ts` → `TSC-OWN OK`.
- `node tools/r5/records.mjs` → `PASS every achievement has a cell with data-ach in catalogue order (71/71)`,
  `PASS the sheet opens with the first achievement focused and its full description in [data-ach-detail] (first_win: 冠冠军体质第一次拿下冠军已解锁)`,
  `PASS → moves the focus to the next achievement and shows its name + full description (podium)`,
  `PASS ↓ moves down a row (pacifist, index 7)`,
  `PASS walking with → reaches every achievement with its full description (71/71)`,
  `PASS hovering a cell focuses it; an earned one says so (空鹈鹕后空翻一次后空翻，稳稳落地已解锁)`,
  `PASS Esc closes the sheet and stays on the career screen (career)`,
  `PASS 1280x720: every cell, the detail and the egg column are on screen (0 off)`,
  `PASS 1920x1080: every cell, the detail and the egg column are on screen (0 off)`,
  `PASS the pause controls name the throw (hold K)`, `PASS the pause controls name the air tricks (Shift in the air)`,
  `PASS the pause controls name the bell bribe`, `PASS the pause controls sheet fits the screen` → `r5-records OK`.
- `node tools/r4/w3-screens.mjs` → `PASS records sheet: 彩蛋 6/9`, `PASS the nine egg cells, six found`,
  `PASS the duck cell counts 2/5`, `PASS unfound eggs stay hidden (???)` → `w3-screens OK`.
- `node tools/ui-input.mjs` → `ok pad LB opens the records sheet`, `ok pad B closes it (career stays)`,
  `ok TAB opens the sheet`, `ok Space closes it (no race starts)`, `ok the d-pad then moves the ladder focus (0 -> 1)`
  → `[ui-input] all checks passed`.
- `node tools/core-check.mjs` → `core-check OK`.
- `node tools/r4/w3-achievements.mjs` (not in the acceptance list, but it counts the cells) →
  `PASS the records sheet shows every achievement (71/71)` → `w3-achievements OK`.
- Pad probe (`shots/r5-records/padprobe.mjs`): `open after LB true focus first_win` → `after d-pad right podium`
  → `after d-pad down pacifist` → `after d-pad up podium` → `open after B false`; `errors []`.
- Browser: every run ended with `__br.errors` empty (`shots/r5-records/probe.mjs` printed `errors []`
  for the records sheet at both sizes and for the pause sheet).

## Known issues
- The focus wraps from the last achievement back to the first (see "In progress / next"): the lead's
  acceptance test needs it to walk all 71 with → alone.
- The cells carry only the icon and the name (the description is in the detail strip): at 1280×720
  the name is ~13 real px, so the longest names (「和平从来不是选项」) wrap to two lines.
- The pause CONTROLS sheet is now two columns instead of three (six rows instead of four) to fit the
  r4 action names; it still ends 17 px above the bottom of the screen.

## Requests
- None for the core. The only decision above the brief is the wrap of the records grid — the lead may
  want it clamped at the last cell instead (the `Nav` option `wrap: false` in
  `src/ui/screens/records.ts`), but that would fail the lead's own r5 acceptance test, which walks the
  catalogue with → alone and needs all 71.
