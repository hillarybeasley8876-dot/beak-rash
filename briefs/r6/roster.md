# r6 job roster — pick any racer, edit its kit, and the game follows the pick (ui-screens + ui-hud + content; SPEC §23)

The user asked twice for this: "其他角色可以选" (let me pick other characters). Today `ScreenId 'roster'` is an error
placeholder (`src/ui/screens/registry.ts`), the menu's 「角色」 entry leads there, and the game still assumes the
player is the pelican in several places. The race side already works: `RaceConfig.playerCharacter` comes from
`SaveData.character` (core/race-config.ts), the loadout from `SaveData.loadouts[c]` validated by
`data/loadouts.ts validLoadout`, `SaveData.blindBox` rolls a random kit. Sixteen characters exist, fifteen are racers
(`data/roster.ts RACERS`; the police corgi is not).

Read SPEC.md §5 (P5 art bible), §10 (UI), §23, §24, then `src/ui/screens/garage.ts` (a list + detail + live 3D
pattern), `records-screen.ts` (a full screen with a grid and Esc → menu), `src/ui/nav.ts` (Nav: `layout: 'grid'`,
`columns`), `src/ui/p5/*` (portrait, statBar, ransom, jagged, keyGlyph, backdrop, coinBadge, HINT_*),
`src/data/{roster,skills,loadouts}.ts`, `src/core/save.ts` (`save.update`, `save.onChange`).

## Build it
1. **Roster screen** (`src/ui/screens/roster.ts` + `roster.css`, registered in `registry.ts` replacing the placeholder).
   Title 「角色 ROSTER」. Layout at 1280×720 and 1920×1080 (the stage is 1920×1080, scaled):
   - **Grid** of every racer in `RACERS` order: one card each with the portrait (`portrait(id, { mood: 'main' })`),
     the 中文名 and the codename. Cards carry `data-roster="<id>"`; the focused one `.is-focus`; the picked one a
     「出战」 badge. 15 cards: 5 columns × 3 rows on the left ~60 % of the stage is fine.
   - **Detail panel** (`data-roster-detail`) for the focused racer: big portrait (smug mood), 中文名 + codename + title
     (`ROSTER[c].title`), the tagline, the five stat bars (`statBar('力量', stats.power)` … 速度 / 操控 / 体重 / 体力),
     the signature skill (`SKILLS[ROSTER[c].skill]`: glyph, name, nameEn, desc, category 中文 via `CATEGORY_CN`, element
     via `ELEMENT_CN` when set).
   - **Loadout row** for the focused racer: four slots `data-slot="1" | "2" | "3" | "ult"`, each showing the skill's
     glyph + name and `data-skill="<skill id>"`, with the key under it (U / I / O / P; pad LB / ✚↑ / ✚↓ / R3 — copy
     `howto-pages.ts`). The kit shown is `validLoadout(save.data.loadouts[c], c)`.
   - A **「盲盒」 toggle** (`data-blindbox`, click or the bell key B / pad Select) bound to `SaveData.blindBox`, with one
     line: 每场比赛随机三个技能和一个大招.
   - Hint bar: 选择 / 出战 (ENTER) / 改技能 / 返回 (ESC).
2. **Keys** (keyboard, pad and mouse; the focused element always carries `.is-focus`):
   - Arrows walk the grid (`Nav` grid layout). Focus = preview: the detail panel and the slots follow at once.
   - Enter on a card = pick it: `save.update((d) => { d.character = c; })`, a toast 「<name> 出战！」, the focus moves to
     slot 1. ↓ from the bottom row also enters the slots. In the slots ←→ walk them, ↑ goes back to the grid,
     Enter opens the **skill picker** for that slot.
   - **Skill picker** (a modal panel over the screen): for slots 1–3 every skill in `equippable(c)`, for the ult slot
     every skill in `equippableUlts(c)`; grouped under category headers (`data-pick-cat="<category>"` on the headers,
     攻击 / 控制 / 位移 / 防御 / 召唤 / 陷阱 / 整活), one row per skill with `data-pick="<skill id>"`, glyph, name, desc,
     cooldown (or SP 100), the element. ↑↓ walk the rows (`.is-focus`), Enter equips: if the skill is already in another
     slot the two slots swap; save with `save.update` into `d.loadouts[c]` (always store `validLoadout(next, c)`), the
     slot updates at once. Esc closes the picker without a change.
   - Esc on the screen (outside the picker) → `ctx.go('menu')`.
   - Opening focus: the picked character (`save.data.character`; a fresh profile = pelican).
3. **The game follows the pick** (pelican-only code generalised; SPEC §23 last bullet):
   - HUD skill diamonds: `src/ui/hud/skills.ts playerKit()` builds from the player's `RiderState.loadout` (slots + ult,
     `SKILLS[id]`), not from the catalogue's owner/slot. `SkillRow` / `Cluster` get the rider (or its loadout) instead
     of only the character; a null slot shows the empty diamond.
   - The SHOWTIME cut-in (`src/ui/hud/cutins/layer.ts ultStart`): the ult's def is `SKILLS[e.skillId]` from the
     `ult:start` event (pass `skillId` through), so a moodeng casting 雷暴 shows 「雷暴」; the rival chip likewise.
   - The first-cast skill band (`playerSkill`): the key glyph is the slot the skill sits in (`loadout.slots.indexOf`),
     not `def.slot`.
   - HOW TO → 技能 (`src/ui/screens/howto-pages.ts skillsPage`): the cards are the picked character's current kit
     (`validLoadout(save.data.loadouts[c], c)` — `skillsPage` takes the save or the loadout as an argument; howto.ts
     passes `ctx.app.save`). Keep the tips for skills that have one (`HOWTO_SKILL_TIPS`).
   - Main menu hero (`src/ui/screens/menu.ts`): the key art `art/menu.webp` is the pelican's — keep it for the
     pelican; for any other pick show `portrait(c, { mood: 'main' })` in the hero frame (no art), and the name /
     codename / title under it are the pick's. The hero element (or its portrait) carries `data-character="<id>"`.
   - Settings portrait (`settings.ts`) and the confirm modal (`ui/confirm.ts`): the picked character's portrait.
   - Demo results (`results-flow.ts demoResults`, only for `?screen=results`): fine as it is.
4. **Achievements** (content): `src/gameplay/achievements/rules-combat.ts` — SHOWTIME counts the player's own ult
   whatever it is (`SKILLS[skillId]?.slot === 'ult'` instead of `=== 'pelican.ult'`); the other pelican skill
   achievements (torpedo / gulp / wing) stay keyed on those skills (they are the pelican's). In
   `src/data/achievements.ts` change the SHOWTIME desc to 「用大招一次击倒三名对手」 (no pelican in it). Run
   `node tools/content-ach.mjs` (it must stay green; it drives pelican.ult, which is still an ult).

## Look at it
Shoot the roster at 1280×720 and 1920×1080 (grid focused, a slot focused, the picker open) and a race HUD while
riding moodeng, into `shots/r6-roster/`; read them through `python tools/thumb.py … -o sheet.jpg`. The P5 look: black
/ red / white, jagged panels, ransom titles, chunky readable type (card names ≥ 20 px at 1280×720, detail title
≥ 32 px). Nothing overlaps; the picker scrolls if it is taller than the stage.

## Files you own
`src/ui/screens/roster.ts`, `src/ui/screens/roster.css`, `src/ui/screens/roster-picker.ts` (if the picker gets its own
file), `src/ui/screens/registry.ts`, `src/ui/screens/menu.ts`, `src/ui/screens/menu.css`, `src/ui/screens/howto.ts`,
`src/ui/screens/howto-pages.ts`, `src/ui/screens/settings.ts`, `src/ui/confirm.ts`, `src/ui/hud/skills.ts`,
`src/ui/hud/cluster.ts`, `src/ui/hud/hud.ts`, `src/ui/hud/cutins/layer.ts`,
`src/gameplay/achievements/rules-combat.ts`, `src/data/achievements.ts`.

## Acceptance (the runner runs these; read `tools/r6/roster.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/ src/gameplay/achievements/ src/data/achievements.ts` → TSC-OWN OK
- `node tools/r6/roster.mjs` → r6-roster OK
- `node tools/r6/ui.mjs --skip net` → r6-ui OK
- `node tools/r4/w3-screens.mjs` → w3-screens OK
- `node tools/r4/w3-hud.mjs` → w3-hud OK
- `node tools/content-ach.mjs` → scenarios passed
- `node tools/ui-input.mjs` → all checks passed
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/core-check.mjs` → core-check OK
