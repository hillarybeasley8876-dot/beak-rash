# w3-hud — the race HUD for every r4 mechanic

## Plan
1. Scaffold `src/ui/hud/r4/` (index, police, banner, style, pops) + `css/r4.css` + r4 copy in `src/data/strings.ts`.
   Check: `node tools/r4/tsc-own.mjs src/ui/hud/ src/data/strings.ts` → `TSC-OWN OK`
2. Police §14: wanted badge `.brh-wanted` (`data-level`, hidden at 0), baton warn `.brh-baton-warn` (world/edge arrow),
   roadblock banner 前方设卡！, `police:down` splash 柯基下班了！, `police:hurt` damage numbers, bribe chip V我50.
   Check: `node tools/r4/w3-hud.mjs` → the police PASS lines
3. Tricks §16 (`.brh-trick` pop, names + `+points`, FAIL stamp) and STYLE §17 (`.brh-style` meter ×mult · total,
   flying action labels, bank pop `+12 SP +4 小鱼干`).
   Check: `node tools/r4/w3-hud.mjs` → the trick/style PASS lines
4. Weapons §15: throw hint 按住 K/Y 投掷 (localStorage `beak-rash.hint.throw`), trait name in the weapon slot,
   `combat:parry` → 当！ pop.
   Check: `node tools/r4/w3-hud.mjs` → the weapons PASS lines
5. Rivals §18: `race:nemesis` card 宿敌 NEMESIS + 宿敌 name-tag mark, `race:alliance` 围剿！ banner with member
   portraits + chain mark on their tags, 塑料友谊！ on betrayal.
   Check: `node tools/r4/w3-hud.mjs` → the rivals PASS lines
6. Track events §19: `race:event` warn banners (鱼车 / 鹅 / 施工) on the r4 diagonal banner.
   Check: `node tools/r4/w3-hud.mjs` → `w3-hud OK`
7. Sandbox: new `fire()` cases in `sandbox/hud.driver.ts`, scenes in `sandbox/hud.shots.mjs`, contact sheet in `shots/r4-w3-hud/`.
   Check: `node sandbox/hud.shots.mjs` → no `FAIL`; `python tools/thumb.py … -o shots/r4-w3-hud/contact-sheet.jpg`
8. Full acceptance: `node tools/r4/tsc-own.mjs src/ui/hud/ src/data/strings.ts`, `node tools/r4/w3-hud.mjs`,
   `node sandbox/hud.shots.mjs`, `node tools/ui-input.mjs`, `node tools/core-check.mjs`.

## Done
- **New module** `src/ui/hud/r4/` — `index.ts` (R4Hud: the bus wiring + the per-race state), `police.ts`
  (WantedBadge, BatonWarn), `banner.ts` (the diagonal warning banner), `style.ts` (StyleMeter), `pops.ts`
  (TrickPop, ParryPop); one stylesheet `src/ui/hud/css/r4.css`.
- **Police §14**: `.brh-wanted` (3 stars, `data-level`, hidden at 0, under the place badge) on `police:wanted`;
  `.brh-baton-warn` (a red "!" + baton over obstacle 900/901 through `session.obstacles`, an edge arrow when the
  corgi is off screen) on `police:windup`; the 前方设卡！ banner on `police:roadblock`; the OFF DUTY / 柯基下班了！
  splash (cut-ins/r4cuts.ts, own splash slot) on `police:down`; a damage number through the existing damage-number
  layer on `police:hurt`; the V我50 −50 / 这次不行！ chip on `police:bribe`.
- **Tricks §16**: `.brh-trick` card over the rider (360° / 后空翻 / 前空翻 / 超人 + `+points`, a red FAIL stamp on
  `phase:'fail'`).
- **STYLE §17**: `.brh-style` meter under the place badge (`STYLE ×2.25 · 1,240`, thousands separator), the action
  label flying in, the `+12 SP +4 小鱼干` bank pop (red when the chain broke).
- **Weapons §15**: the throw hint (按住 K / 按住 Y 投掷) as a chip in the top-right column, once per profile
  (`localStorage` key `beak-rash.hint.throw`); the weapon slot shows the trait name (`WEAPONS[w].traitName`) under the
  weapon name; `combat:parry` → the big 当！ pop.
- **Rivals §18**: the 宿敌 NEMESIS card (cut-in) + the red 宿敌 badge on that rider's name tag; the 围剿！ banner
  with the members' portraits + a chain link on their tags; 塑料友谊！ on a betrayal.
- **Track events §19**: the fishSpill / geese / roadworks warn banners (stalls warn nobody).
- **Wiring**: `src/ui/hud/hud.ts` mounts the r4 corner host, the r4 world layer and the R4Hud; `cutins/layer.ts`
  gained `policeDown()` / `nemesis()` / `note()` / `hint()`; `cutins/chips.ts` gained the note and hint chips;
  `cutins/types.ts` gained the `police` / `nemesis` splash priorities; `world/tags.ts` gained the plate mark;
  `world/overlay.ts` gained `onPoliceHurt()` and `setTagMark()`; `weapon.ts` shows the trait and keeps the picked
  weapon; `fonts.ts` warms the r4 copy (the CJK subsets).
- **Sandbox**: 14 new scenes (`r4Wanted` … `r4Event`) in `sandbox/hud.shots.mjs` with the matching `fire()` cases
  in `sandbox/hud.driver.ts`; the contact sheet is `shots/r4-w3-hud/contact-sheet.jpg` (1920×1080).

## In progress / next
Nothing — all eight steps are done.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/hud/ src/data/strings.ts` → `TSC-OWN OK`
- `node tools/r4/w3-hud.mjs` → `w3-hud OK` (18 PASS)
- `node sandbox/hud.shots.mjs` → no `FAIL`, 64 PASS
- `node tools/ui-input.mjs` → `[ui-input] all checks passed`
- `node tools/core-check.mjs` → `core-check OK`
- `node shots/r4-w3-hud/layout-probe.mjs` → every r4 element "clean" (no overlap with the r3 pieces, on screen)
- `node shots/r4-w3-hud/reduced-motion-probe.mjs` → every r4 element "visible" with 动态效果 = 减弱

## Evidence (key output lines)
- `node tools/r4/w3-hud.mjs`: 18 `PASS` lines — `PASS police:wanted 2 → a .brh-wanted badge with data-level 2 (2)`,
  `PASS style:chain → the .brh-style meter shows ×2.25 and 1240`, `PASS the weapon slot names the trait
  (saltfish 回旋镖)`, `PASS race:alliance betrayal → 塑料友谊`, `PASS hud: no console errors ()` → `w3-hud OK`.
- `node sandbox/hud.shots.mjs`: 64 `PASS` lines (50 old + 14 new r4 scenes), no `FAIL`, `"errors": []`.
- `node tools/r4/tsc-own.mjs src/ui/hud/ src/data/strings.ts` → `TSC-OWN OK` (1 error ignored in
  `src/gameplay/race/police.ts`, another unit's file).
- `node tools/ui-input.mjs` → `[ui-input] all checks passed`; `node tools/core-check.mjs` → `core-check OK`.
- `node shots/r4-w3-hud/layout-probe.mjs`: every r4 element reports its rect and no `:OVER:` / `:OFFSCREEN:` at
  1280×720 and 2560×1440 (e.g. `1280x720 .rb -> rb@260,167,1020,252`, `2560x1440 .rb -> rb@520,333,2040,504`).
- `node shots/r4-w3-hud/reduced-motion-probe.mjs`: `reduced motion on: true` + 8 × `visible`, `errors: []`.
- Contact sheet: `shots/r4-w3-hud/contact-sheet.jpg` (14 scenes, 1920×1080) + the 14 raw PNGs.

## Known issues
- `src/gameplay/race/police.ts(177,3): error TS1109` — a syntax error in the race unit's file (not mine); it is
  ignored by the own-files typecheck but breaks a project-wide `tsc --noEmit`.
- The sandbox's stub camera is a wide broadcast view, so the trick / parry pops sit high on the screen there; in the
  real chase camera they sit just above the rider.

## Requests
- None.
