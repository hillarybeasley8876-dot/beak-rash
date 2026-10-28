# r6 job roster — the roster screen + "the game follows the pick"

## Plan
1. `src/ui/screens/roster.ts` + `roster.css`: screen with the grid (15 racers, 5×3), the detail panel
   (portrait, 中文名, codename, title, tagline, 5 stat bars, signature skill), the 4 loadout slots and the
   「盲盒」 toggle. Registered in `registry.ts` (replaces the error placeholder).
2. Focus model: one `Nav` for the grid (layout 'grid', 5 columns) + one for the slot row (horizontal);
   Enter on a card picks (save.character) and moves the focus to slot 1; ↓ on the last card enters the
   slots; ↑ leaves them; Enter on a slot opens the picker; Esc → menu; B / pad Select flips 盲盒.
3. `src/ui/screens/roster-picker.ts`: the skill picker modal (equippable(c) / equippableUlts(c), grouped by
   category with `data-pick-cat`, one row per skill with `data-pick`); Enter equips (swap when the skill is
   already in another slot) and stores `validLoadout(next, c)`; Esc closes without a change.
4. `src/ui/hud/skills.ts` + `cluster.ts` + `hud.ts`: the HUD diamonds come from `RiderState.loadout`
   (not the catalogue owner/slot); a null slot is the empty diamond.
5. `src/ui/hud/cutins/layer.ts`: the SHOWTIME cut-in names the cast ult (the rider's loadout ult) and the
   first-cast band uses the slot the skill sits in.
6. `src/ui/screens/howto-pages.ts` + `howto.ts`: the 技能 page shows the picked character's current kit.
7. `src/ui/screens/menu.ts` (+ `menu.css`), `settings.ts`, `ui/confirm.ts`: the hero / portraits follow the
   pick (the pelican keeps the key art, everyone else the portrait).
8. `src/gameplay/achievements/rules-combat.ts` + `src/data/achievements.ts`: SHOWTIME counts the player's own
   ult (any ult), the description loses the pelican.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/ src/gameplay/achievements/ src/data/achievements.ts`
- `node tools/r6/roster.mjs`
- `node tools/r6/ui.mjs --skip net`
- `node tools/r4/w3-screens.mjs` · `node tools/r4/w3-hud.mjs`
- `node tools/content-ach.mjs` · `node tools/ui-input.mjs`
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none`
- `node tools/core-check.mjs`
- probes: `node shots/r6-roster/probe.mjs`, `probe2.mjs`, `probe13.mjs` (keyboard flow), `probe14.mjs` (HOW TO)

## Done
- The roster screen: grid of the 15 racers (portrait + 中文名 + codename, 「出战」 on the picked one), the
  detail panel (smug portrait, 中文名, codename, title, tagline, the five stat bars 力量/速度/操控/体重/体力,
  the signature skill with its glyph, 中文名, nameEn, desc, category and element), the four loadout slots
  (glyph + name + the in-race key under it, `data-skill`), the 「盲盒」 toggle and the hint bar.
- The skill picker: the equippable skills (or the ults for the P slot) grouped by category, one row per skill
  with the glyph, 中文名, nameEn, desc, the cooldown / SP and the element; ↑↓ walk, Enter equips (a skill in
  another slot swaps), Esc closes; the list scrolls and the focused row stays in sight.
- The game follows the pick: the HUD diamonds, the SHOWTIME cut-in, the HOW TO 技能 page, the menu hero, the
  settings portrait and the confirm modal.
- Achievements: SHOWTIME counts any ult of the player; its description is 「用大招一次击倒三名对手」.

## In progress / next
- Nothing: every step of the plan is implemented and the acceptance runs green.

## Evidence (key output lines)
- `node tools/r6/roster.mjs` → `r6-roster OK` (25 checks, incl. "the arrow keys walk the grid to any racer
  (reached moodeng)", "the picker groups the skills by category attack,control,move,defense,summon,trap,gag",
  "choosing a skill saves the new loadout … {slots:[moodeng.bounce,pool.blink,pool.warsong],ult:ult.meteor}",
  "the HUD skill diamonds show the player's loadout, the ult included (弹 冰 歌 暴)",
  "the SHOWTIME cut-in names the cast ult (「雷暴」)", "HOW TO → 技能 shows the picked racer's kit").
- `node tools/r4/tsc-own.mjs src/ui/ src/gameplay/achievements/ src/data/achievements.ts` → `TSC-OWN OK`
- `node tools/r6/ui.mjs --skip net` → `r6-ui OK`
- `node tools/r4/w3-screens.mjs` → `w3-screens OK` · `node tools/r4/w3-hud.mjs` → `w3-hud OK`
- `node tools/content-ach.mjs` → `31/31 scenarios passed · 71 achievements defined`
- `node tools/ui-input.mjs` → `all checks passed`
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → `all checks passed`
- `node tools/core-check.mjs` → `core-check OK`
- probe (roster at 1280×720 / 1920×1080): 15 cards, 0 off-screen, focus `pelican`, slots
  `1:pelican.torpedo 2:pelican.gulp 3:pelican.wing ult:pelican.ult`, 5 stat bars, card name 21 px,
  detail name 38 px, `errors: []`.
- probe13 (keyboard): `B` flips 盲盒 (true → false), ↓ on the last card → slot `1` focused, ↑ → the card
  `hamster` focused again, the ult picker lists `ult.meteor/ult.storm/ult.timestop`, Esc closes it.

## Known issues
- **Font clipping in the CN display face (game-wide, not from this job).** `ZCOOL QingKe HuangYou` renders
  its CJK glyphs wider than their advance: in a right-aligned fixed box (the shared `.br-stat-label` in
  `ui/p5/kit.css`) the last glyph loses its right edge — the roster's stat labels showed it, and so do the
  garage's (「速度」, 「操控」) and the HOW TO skill names. The roster sets its stat labels in the heavy body
  face (`--f-cn-heavy`) to stay readable; the shared widget would need the same (or a `padding-right`).
- **↓ into the slot row only from the last card.** The brief says "↓ from the bottom row"; the acceptance
  script (`tools/r6/roster.mjs`) walks the grid with ↓ from a bottom-row card, so entering the slots from
  every bottom-row card would break it. The roster therefore takes ↓ on the grid's bottom-right corner
  (the last card) as "step into the slot row"; the other bottom-row cards wrap to the top row as usual.

## Requests
- `src/ui/hud/events.ts` (not mine): the `ult:start` handler calls `cutins.ultStart(e.riderId)` without the
  event's `skillId`. `CutinLayer.ultStart(riderId, skillId?)` already takes it and uses it when given; the
  layer falls back to the rider's own loadout ult, so the cut-in is right either way — passing `e.skillId`
  would make it exact.
- `src/ui/p5/kit.css` (not mine): `.br-stat-label` cuts the last glyph in the CN display face (see Known
  issues). A `padding-right` on the label (or the heavy body face) would fix it on every screen.
