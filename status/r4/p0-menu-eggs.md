# r4 pilot — PELICAN menu egg + credits idle line (job p0-menu-eggs)

## Plan
1. `src/ui/screens/eggs.ts` (new): `createSequence(codes, windowMs)` → `{ push(code): boolean, reset() }`
   (Konami-style ordered keys, whole word inside 4 s of its first key) + `eggBubble(text, seed)` → `.br-egg-bubble`.
   Verify: `node tools/r4/tsc-own.mjs src/ui/screens/eggs.ts` → `TSC-OWN OK`.
2. `src/ui/screens/eggs.css` (new): P5 bubble (jagged white plate + tail), pop-in / fade-out keyframes.
   Verify: `npx tsc --noEmit -p tsconfig.json` → no error in my files.
3. `src/ui/screens/menu.ts`: window `keydown` listener (removed in `dispose`) → P-E-L-I-C-A-N → bubble next to the
   hero, hero gulp (CSS, skipped under `reducedMotion()`), one `app.audio.voice('pelican_taunt_0')` per trigger.
   Verify: `node tools/r4/p0-menu-eggs.mjs` → `PASS menu: P-E-L-I-C-A-N shows the 嘴大吃四方！ bubble`.
4. `src/ui/screens/credits.ts`: 30 s without input (key / pad / pointer / wheel) → `.br-egg-thanks` plate,
   fixed bottom centre of the stage (not in the roll), stays until the screen closes; any input restarts the timer.
   Verify: `node tools/r4/p0-menu-eggs.mjs` → `PASS credits: the hidden thanks line after 30 s idle`.
5. One menu screenshot with the bubble up (1920×1080), eyeballed for the P5 look.
   Verify: `python tools/thumb.py shots/r4-p0-menu-eggs/bubble.png` then Read the .jpg.
6. Full acceptance run.
   Verify: `node tools/r4/tsc-own.mjs src/ui/screens/menu.ts src/ui/screens/credits.ts src/ui/screens/eggs.ts`
   && `node tools/r4/p0-menu-eggs.mjs` && `node tools/ui-input.mjs`.

## Done
1–6. All steps done and verified (evidence below).

**What was built**
- `src/ui/screens/eggs.ts` (new, 65 lines): `createSequence(codes, windowMs = 4000)` — ordered key sequence; the
  whole word must land within `windowMs` of its first key, a wrong key wipes the run, the first key starts a new
  one; `eggBubble(text, seed)` builds `.br-egg-bubble` (jagged white plate + tail).
- `src/ui/screens/eggs.css` (new): the bubble (P5 plate, 56 px CN block, ink drop-shadow, tail pointing at the
  hero), `br-egg-pop` in / `br-egg-out` out keyframes.
- `src/ui/screens/menu.ts`: window `keydown` listener (added on mount, removed in `dispose` next to `offSave`),
  `repeat` ignored, `PELICAN_CODES` = KeyP…KeyN → bubble next to the hero for 2.5 s + 0.35 s fade, hero
  `.br-menu-portrait.is-gulp` (0.5 s squash-and-stretch, skipped when `reducedMotion()`), one
  `app.audio.voice('pelican_taunt_0')` per trigger. The hero frame and the key art now share one box
  (`.br-menu-portrait`) so the whole pelican gulps; the layout is unchanged.
- `src/ui/screens/credits.ts` + `credits.css`: 30 s idle → `.br-egg-thanks` plate
  (`特别鸣谢：每一只被画歪的鹈鹕。`) fixed on the stage bottom centre (outside the scrolling roll), slides in with
  `br-rise`, stays until the screen closes. Any input restarts the countdown: `onAction` (keys + pad buttons),
  a window `keydown` (unmapped keys too), `pointerdown` and `wheel`; all listeners + the timer are removed in
  `dispose`. A `performance.now()` backstop in `update()` covers a throttled timer.

## In progress / next
Nothing — the job is complete. (Optional follow-up for the r4 Konami egg: `createSequence` is already reusable.)

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/screens/menu.ts src/ui/screens/credits.ts src/ui/screens/eggs.ts`
- `node tools/r4/p0-menu-eggs.mjs`
- `node tools/ui-input.mjs`
- `npx tsc --noEmit -p tsconfig.json`
- probes (scratch, in `shots/`): `node shots/r4-p0-menu-eggs/probe-eggs.mjs`, `probe-menu2.mjs`,
  `probe-credits-input.mjs`, `probe-reduced.mjs`

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/ui/screens/menu.ts src/ui/screens/credits.ts src/ui/screens/eggs.ts` → `TSC-OWN OK`
- `npx tsc --noEmit -p tsconfig.json` → no output (0 errors in the whole tree)
- `node tools/r4/p0-menu-eggs.mjs` → 12 × `PASS`, `p0-menu-eggs OK`:
  `PASS menu: a wrong order (P-E-L-C-I-A-N) shows no bubble` · `PASS menu: P-E-L-I-C-A-N shows the 嘴大吃四方！ bubble`
  · `PASS menu: the egg plays voice pelican_taunt_0 (["pelican_taunt_0"])` · `PASS menu: still on the menu after typing (menu)`
  · `PASS menu: the bubble is gone ~3.8 s later` · `PASS menu: the egg works a second time`
  · `PASS menu: typing too slowly (> 4 s for the word) shows no bubble` · `PASS menu: no console errors ()`
  · `PASS credits: no hidden line after 24 s` · `PASS credits: the hidden thanks line after 30 s idle`
  · `PASS credits: a key press restarts the 30 s idle timer` · `PASS credits: no console errors ()`
- `node tools/ui-input.mjs` → `[ui-input] all checks passed` (last line)
- Round 2 stability: `node tools/r4/p0-menu-eggs.mjs` run twice back-to-back on the current tree → 12 × `PASS`,
  `p0-menu-eggs OK` both times (no `FAIL `, exit 0) — the timing-sensitive checks (2.5 s bubble, 3.8 s gone,
  4 s word window, 30 s credits idle) are not flaky.
- `shots/r4-p0-menu-eggs/probe-menu2.mjs` → `focus before/after: "巡回赛CAREER" "巡回赛CAREER" screen menu bubbles 1`
  and `after leaving: screen title bubbles 0 errors []` (cursor unmoved, screen unmoved, listener dies with the screen)
- `shots/r4-p0-menu-eggs/probe-credits-input.mjs` → `after wheel: plates = 0` · `after click: plates = 0 errors []`
  (wheel and click both restart the 30 s idle)
- `shots/r4-p0-menu-eggs/probe-reduced.mjs` (OS `prefers-reduced-motion: reduce`) →
  `reduced motion: {"bubbles":1,"text":"嘴大吃四方！","gulp":false} errors []` (bubble shows, no gulp animation)
- screenshots: `shots/r4-p0-menu-eggs/bubble.png` (bubble left of the pelican's head, tail pointing at it),
  `shots/r4-p0-menu-eggs/credits.png` (plate bottom centre under the roll) — read as `sheet2.jpg`.

## Known issues
- None. The bubble sits ~120 px left of the pelican's helmet (the tail bridges the gap); the hero art is not
  covered.
- The idle countdown is real time (`setTimeout` + a `performance.now()` backstop in `update()`); a tab that is
  hidden for >30 s shows the line as soon as it is visible again.

## Round 2 (lead: "round 1 did NOT pass — edits outside your owned paths were REVERTED")
Re-read the notice, then re-ran every acceptance command on the current tree and read the output:

- `node tools/r4/tsc-own.mjs src/ui/screens/menu.ts src/ui/screens/credits.ts src/ui/screens/eggs.ts` → `TSC-OWN OK`, exit 0
- `node tools/r4/p0-menu-eggs.mjs` → 12 × `PASS`, no `FAIL `, `p0-menu-eggs OK`, exit 0 (same 12 lines as in round 1)
- `node tools/ui-input.mjs` → `[ui-input] all checks passed`, exit 0
- `npx tsc --noEmit -p tsconfig.json` → no output, exit 0 (whole tree clean)

**The five reverted paths are not mine.** My whole diff is
`src/ui/screens/{menu.ts,menu.css,credits.ts,credits.css}` (modified) + `src/ui/screens/{eggs.ts,eggs.css}` (new)
+ `status/r4/p0-menu-eggs.md`. `git status --short -- src/ui/screens/ status/r4/` lists exactly those seven paths,
and `git diff --stat` over the five named paths shows no diff of mine in them (only `lots.ts`, which the world
worker re-applied after the revert, as `+9` lines against HEAD). The five files belong to the audio / world /
sandbox units, so I did not touch them — please route the re-apply to their owners (see `## Requests`).

**What I did find (and it is very likely what broke round 1):** the tree-wide typecheck was broken when this
round-2 session started, because the revert of `src/world/dressing/city/lots.ts` (world unit) removed
`Lots.reserve()` while `src/world/dressing/city/landmarks.ts` (not reverted) still called it:

    src/world/dressing/city/landmarks.ts(81,12): error TS2339: Property 'reserve' does not exist on type 'Lots'.

That was the very first `npx tsc --noEmit` I ran this round. A minute later the same command was clean
(`lots.ts` had been re-applied), so the tree is green now — but any runner that typechecks the whole tree, or
boots a city track, would have failed in that window. Nothing in my files causes or fixes it; I did not touch
`lots.ts` / `landmarks.ts`.

No code change was needed in my files for round 2: every acceptance command already passes on the current tree.
I did not touch any check (`tools/r4/**`, `tools/ui-input.mjs`) and made no edit outside my owned paths.

## Requests
1. **Re-apply / route these reverted files to their owners** (they are not mine; I never edited them):
   - `src/audio/music/band-fx.ts` — the file was DELETED by the revert. Nothing in `src/`, `sandbox/`, `tools/` or
     `index.html` imports it any more, so the tree does not break; but the audio unit's new file is gone. Please
     let the audio worker re-create it (or confirm the feature was dropped).
   - `src/audio/music/instruments/brass.ts` — back at HEAD. `src/audio/music/band.ts` (still modified) imports
     `{ Brass }` from it and typechecks, so the tree is consistent; the audio unit should re-apply its brass
     changes if they are still wanted.
   - `src/world/env/lights.ts` — back at HEAD; its callers (`src/world/track.ts`, `src/fx/post/pipeline.ts`) still
     typecheck. The world unit should re-apply it.
   - `src/world/dressing/city/lots.ts` — the revert broke `landmarks.ts` (see above). It has since been re-applied
     and the tree typechecks; please make sure the re-apply is kept (the `Lots.reserve()` API is required by
     `landmarks.ts`).
   - `sandbox/city.black.mjs` — back at HEAD; a standalone sandbox script, nothing imports it. The env-city unit
     should re-apply it.
2. **Whole-tree typecheck:** please run `npx tsc --noEmit -p tsconfig.json` as part of the round-2 gate — it is
   the check that caught the broken `lots.ts`/`landmarks.ts` pair, and it is green now.
