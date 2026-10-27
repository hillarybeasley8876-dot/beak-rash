# r6-ui — readable screens, achievements you can find, no stand-in art

> **BLOCKING — the acceptance suite cannot go green as written (needs one line on the lead's side).**
> `tools/r6/ui.mjs:88` counts every `.br-tc` whose rect touches the viewport (`r.width > 0 && r.right > 0
> && r.left < innerWidth`) and wants `shown <= 3`; `tools/r4/w3-screens.mjs:30` wants five
> `.br-tc[data-track]` fully inside it (`r.left >= -2 && r.right <= innerWidth + 2 && r.width > 80`).
> Inside ⇒ counted, so **five inside ⇒ shown = 5 > 3**: no layout satisfies both.
> Proof in one command: `node shots/r6-ui/conflict.mjs` (per-card table + the implication).
> Fix on the lead's side (one line; the five tracks stay, the focused card stays on screen):
> `tools/r4/w3-screens.mjs:33` — `cards.length === 5 && cards.every((c) => c.inside)`
> → `cards.length === 5 && cards.some((c) => c.inside)`.
> The patch is ready (dry-run clean, **not applied** — the check is the lead's):
> `git apply shots/r6-ui/w3-five-cards.patch`
> The other way round (`t.cards.shown >= 3` in `tools/r6/ui.mjs:97`) means the five-card fan instead of
> SPEC §26's "3 cards per row"; that variant is measured and one edit away (Known issues 1).

## Plan
1. **Menu entries** — 成就 RECORDS + 角色 ROSTER on the stair (after 车库, see Known issues 3).
2. **No stand-in on the menu** — the key art is the hero; the drawn pelican is only the fallback for a
   broken file. The menu waits for `artReady(heroArt, 4000)`; the boot fetches the menu art first.
3. **Records screen** — `records.ts` grows a `screen` mode, `records-screen.ts` is the new screen.
4. **Race fonts with the race** — no `preloadHudFonts()` at boot; the loading screen warms them.
5. **Career readable** — one cup at a time (tabs + ↑↓), a 3-up card carousel, big type.
6. **Quick race readable** — 3 big cards in view (SPEC §26 "3 cards per row at 1280×720"), the row
   scrolls with ←→, the options in a compact strip under the row.
7. **HUD declutter** — one SLIPSTREAM (the speedometer's tag), the AIR TRICK card leaves on landing.
8. **Acceptance** — every command in the brief + the contact sheets under `shots/r6-ui/`.

## Done
- **Menu**: 「成就 RECORDS」 and 「角色 ROSTER」 on the stair (copy.ts); the stair step shrank (92 px) and
  the type to 82 px so all eight entries + the quit step fit above the hint bar at 1280×720.
- **No stand-in**: `menu.ts` draws the pelican only if `art/menu.webp` is missing or broken; the menu
  waits for the art (artReady 4000 ms) and the boot preloads it right after the title art.
- **Records screen**: `ScreenId 'records'` → `screens/records-screen.ts` (the sheet as a full screen:
  the grid, the detail strip, the 彩蛋 column, the lifetime stats; ←→↑↓ walk it, Esc / pad B → menu).
  The career's Tab chip still opens the sheet (r5-records stays green).
- **Fonts**: `hud/hud.ts` no longer preloads the HUD fonts at boot; `screens/loading.ts` does it while
  the track builds. The title + menu now fetch 2.67 MB of fonts on the dev server (was 5.1 MB).
- **Career**: one cup at a time (the cup tabs, ↑↓ or the d-pad switch), 3 big cards + 2 slivers,
  the cup tabs carry the name, the detail panel keeps every row. Card names 24 px, cup names 28 px
  rendered, 3 texts under 14 px (was 47).
- **Quick race**: 3 big cards (341 px wide, names 33 px, blurbs 19 px rendered) that scroll with ←→;
  the two other cards shrink away; the race options are a compact strip under the row.
- **HUD**: the slipstream is announced once (the speedometer's tag; the duplicate callout is gone),
  and the AIR TRICK key card leaves when the player lands.

## In progress / next
Nothing in code — every part of the brief is implemented and measured; the quick race follows SPEC §26
(three big cards, the row scrolls) and the r6 check for it is green. The only outstanding item is the
one-line change in tools/r4/w3-screens.mjs (the lead's file): the r4-era "all five cards fully on
screen" assertion cannot hold together with the r6 job's "3 cards in view" one (see the blocking note
at the top: proof, probe, ready-made patch).

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/screens/ src/ui/copy.ts src/ui/hud/` → TSC-OWN OK
- `node tools/r6/ui.mjs --skip net` → r6-ui OK
- `node tools/r5/records.mjs` → r5-records OK
- `node tools/r4/w3-screens.mjs` → w3-screens FAILED (1): the five-track-cards assertion (see the
  blocking note at the top; it passes after `git apply shots/r6-ui/w3-five-cards.patch`)
- `node shots/r6-ui/conflict.mjs` → the per-card proof that the two assertions are exclusive
- `node tools/ui-input.mjs` → all checks passed
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/core-check.mjs` → core-check OK
- `node tools/r6/ui.mjs` (the net part) → needs the production build on :5301 (the lead rebuilds it)

## Evidence (key output lines)
- Round 3 (after the lead's round-2 rejection of tools/r4/w3-screens.mjs), all commands re-run on the
  current build: `TSC-OWN OK`; `r6-ui OK` (--skip net), incl.
  `PASS quick race: 3 track cards in view, each ≥ 300 px wide, names ≥ 32 px, blurbs ≥ 17 px
  ({"shown":3,"width":341,"name":33,"blurb":19})`,
  `PASS quick race: → walks all five tracks and the focused card is always fully on screen (5)`,
  `PASS career: at most 9 cards in view at once, card names ≥ 22 px, cup names ≥ 26 px
  ({"shown":3,"name":24,"cup":28})`, `PASS career: ≤ 12 texts under 14 px (3 of 72; r5: 47)`,
  `PASS 成就 opens the records screen with every achievement and the detail strip, all on screen
  ({"screen":"records","cells":71,"want":71,"off":0})`,
  `PASS the AIR TRICK key card shows in the air and is gone 0.6 s after landing ({"afterLand":0})`;
  `r5-records OK`; `core-check OK`; `[ui-input] all checks passed`; `[ui-tour] all checks passed`;
  `w3-screens FAILED (1)`: `FAIL all five cards fully on screen at 1280×720 (watertown,gobi)` — every
  other w3 assertion passes (the career, the results, the records, the eggs).
- The five-card fan (the alternative, measured in round 2 and reverted again in round 3):
  `w3-screens` → `PASS all five cards fully on screen (ok)`; but `tools/r6/ui.mjs --skip net` →
  `FAIL quick race: 3 track cards in view … ({"shown":5,"width":306,"name":33,"blurb":19})`.
- Round 5 (after the lead's round-4 rejection of tools/r4/w3-screens.mjs): the build is unchanged
  (the quick race still follows SPEC §26); `node tools/r4/tsc-own.mjs src/ui/screens/ src/ui/copy.ts
  src/ui/hud/` → `TSC-OWN OK`; `node tools/r4/w3-screens.mjs` → `w3-screens FAILED (1)`:
  `FAIL all five cards fully on screen at 1280×720 (watertown,gobi)` (every other w3 assertion passes);
  `git apply --check shots/r6-ui/w3-five-cards.patch` → `PATCH APPLIES CLEANLY (dry run, nothing
  changed)` and `git status --short tools/r4/w3-screens.mjs` → empty (I did not touch the check).
  The constraint is now written where the lead reads the diff: the comment above `const WINDOW = 3`
  in src/ui/screens/track-select.ts names both assertions and both line numbers.
- Round 4 (after the lead's round-3 rejection of tools/r4/w3-screens.mjs): every command re-run again
  on the same build — `TSC-OWN OK`; `r6-ui OK` (--skip net, the same PASS lines as round 3);
  `r5-records OK`; `core-check OK`; `[ui-input] all checks passed`; `[ui-tour] all checks passed`;
  `w3-screens FAILED (1)`: `FAIL all five cards fully on screen at 1280×720 (watertown,gobi)`.
- The conflict probe (`node shots/r6-ui/conflict.mjs`, my own file under shots/r6-ui/):
  `card left right width w3-inside r6-vis` / `coast 159 521 361 true true` / `city 490 830 341 true true`
  / `mountain 810 1150 341 true true` / `watertown 980 980 0 false false` / `gobi 980 980 0 false false`
  → `now: inside (w3 needs 5) = 3, vis (r6 needs <= 3) = 3`, i.e. the three in view are counted by
  both filters; the two parked ones count for neither. Put five inside and r6's `shown` becomes 5.
- Fonts (probe-fonts.mjs, my own file): the production preview on :5301 still serves the OLD bundle
  (5.07 MB at the title, the r5 baseline — the lead rebuilds it); the dev server with my change
  measures 2.67 MB, all of it on the title screen (the menu adds 0) — `standIn=0 art=true`, so the
  net part's first assertion (the menu never shows the drawn stand-in) passes.
- shots/r6-ui/sheet-window.jpg (quick race, three cards + the options strip, 1280×720 and 1920×1080),
  sheet1.jpg (menu, records, career), sheet-fan.jpg (the five-card fan variant).

## Known issues
1. **tools/r4/w3-screens.mjs: "all five cards fully on screen at 1280×720" fails** (watertown, gobi —
   the two cards parked outside the quick-race window). The two lead-owned checks cannot both hold, and
   I measured it both ways:
   - **Three big cards in view (the current build, = SPEC §26 "3 cards per row at 1280×720" = the
     brief's item 6 = the r6 check)**: `node tools/r6/ui.mjs --skip net` →
     `PASS quick race: 3 track cards in view, each ≥ 300 px wide … ({"shown":3,"width":341,…})`;
     `node tools/r4/w3-screens.mjs` → `FAIL all five cards fully on screen (watertown,gobi)`.
   - **All five cards on screen (a fan)**: `w3-screens` → `PASS all five cards fully on screen (ok)`;
     but `node tools/r6/ui.mjs --skip net` → `FAIL quick race: 3 track cards in view …
     ({"shown":5,"width":306,"name":33,"blurb":19})`.
   The reason is in the two filters: `tools/r6/ui.mjs:88` counts every `.br-tc` whose rect touches the
   viewport (`r.width > 0 && r.right > 0 && r.left < innerWidth`); `tools/r4/w3-screens.mjs:30` wants five
   `.br-tc[data-track]` elements fully inside it (`r.left >= -2 && r.right <= innerWidth + 2 &&
   r.width > 80`). A card that is "inside" has `r.left ≤ innerWidth + 2 − 80 < innerWidth` and
   `r.right ≥ 78 > 0`, so **every inside card is counted**: five inside ⇒ `shown = 5 > 3`. No layout
   satisfies both — the counts are the same five elements.
   One-line fix on the lead's side, if the r6 reading wins: in tools/r4/w3-screens.mjs line 33 use
   `cards.length === 5 && cards.some((c) => c.inside)` — the five tracks exist and the focused card is on
   screen, which is exactly what the r6 check's own sibling assertion (tools/r6/ui.mjs:105-109, "→ walks
   all five tracks and the focused card is always fully on screen") already verifies. The other way
   round (the fan) needs `t.cards.shown >= 3` in tools/r6/ui.mjs line 97 and gives up the pre-r4 look;
   I measured it and can ship it in one edit if the lead prefers it — the diff is: in
   src/ui/screens/track-select.ts `const WINDOW = 3` → `5`, `const SLOTS = [225, 705, 1185]` →
   `[30, 390, 750, 1110, 1470]`, and in paintWindow drop the `is-parked` toggle and set
   `card.classList.toggle('is-focus', i === focus)`; in src/ui/screens/track-select.css
   `.br-tracks-row { left: 0; top: 250px; width: 1920px; height: 460px; }`, `.br-tc { width: 410px;
   height: 460px; }`, `.br-tc.is-focus { transform: translateX(var(--x,0px)) translateY(-70px)
   skewX(-6deg); z-index: 10; }`, `.br-tc-art { height: 190px; }`, `.br-tc-body { top: 206px; }`,
   `.br-tc-num { font-size: 66px; }`, `.br-race-opts { top: 740px; }` (that is exactly the build I
   measured in round 2 — the five cards then overlap a little, so the neighbour's name is partly
   covered by the lifted focused card).
2. **tools/r6/ui.mjs's net part (fonts ≤ 1.6 MB) needs the lead's build side, not my files**: the HUD
   preload is gone (the dev server measures 2.67 MB at the title, was 5.07 MB with it; the preview on
   :5301 still serves the old bundle), and the rest is the *title* screen's own glyphs — the title
   uses three CJK families (ZCOOL QingKe HuangYou ≈ 1.15 MB, Noto Sans SC ≈ 0.6 MB, ZCOOL KuaiLe
   ≈ 0.47 MB in @fontsource's ~120 unicode-range blocks; the menu adds 0 on top). SPEC §26 asks for
   build-time subsetting (`tools/r6/subset-fonts.py` — not in the tree yet) and the stacks live in the
   lead-owned src/ui/p5/tokens.css + src/ui/screens/title.css. (Trimming the stacks from a file I own
   did not move the byte count: the cost is the number of CJK families on the page, not the fallback
   chain.) The runner's acceptance runs `tools/r6/ui.mjs --skip net`, so this is not gating today.
3. **The menu order**: the brief puts 角色 right after 快速比赛, but tools/ui-tour.mjs walks the menu by
   index (the third entry has to be the garage, the sixth the credits, and the last ArrowUp×4 has to
   land on 快速比赛) → 角色 sits after 成就 instead (index 4), 成就 right after 车库 (index 3).

## Requests
- **The lead owns tools/r4/w3-screens.mjs** — the one line that unblocks the job. The "all five cards
  fully on screen" assertion contradicts SPEC §26 ("3 cards per row at 1280×720"), the brief's item 6
  and the r6 check's own reference to the pre-r4 look ("pre-r4: 3 cards 378 px"), and the two
  assertions are provably exclusive (Known issues 1: proof, probe, one-line patch). The patch is ready
  and dry-run clean: `git apply shots/r6-ui/w3-five-cards.patch` — I did **not** apply it, the check
  is the lead's. After it, every acceptance command in the brief is green. If the lead prefers the
  five-card fan instead (w3 green, r6's `shown` clause red), the diff for my files is in Known
  issues 1 — one edit.
- The lead owns tools/r6/ui.mjs: its trackSelect measurement uses `r.left` (not `e.left`), so "cards in
  view" counts every card whose rect touches the viewport — that is what forces the two parked cards
  off-stage (Known issues 1).
- The lead owns src/ui/p5/tokens.css, src/ui/screens/title.css and the build (SPEC §26's font
  subsetting): the CJK font stacks decide the first-visit font bill (Known issues 2).
