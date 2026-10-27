# r6 job ui — readable screens, achievements you can find, no stand-in art (ui-screens; SPEC §26)

The user, about the r5 build: "怎么ui越改越丑了" (the UI got uglier), and twice: "成就看不到" (can't find the
achievements). Read SPEC.md §5 (art bible: P5 style), §10 (UI), §26, then the screens below. Lead measurements
(`node tools/r6/ui.mjs`, 1280×720; pre-r4 = the v1.0 build before the r4 features were added):
- **Career** (`screens/career.ts` + `.css`): r4 put all 15 events (3 cups × 5 tracks) on one screen: 137 px cards,
  15 px card names, 16 px cup names, 47 text elements under 14 px (pre-r4: 9 cards, 21 / 24 px).
- **Quick race** (`screens/track-select.ts` + `.css`): 5 cards of 183 px with 20 px names and 13 px blurbs plus a
  small options panel (pre-r4: 3 cards of 378 px, 39 px names, 20 px blurbs).
- **Achievements**: there is no 「成就」 on the main menu; the sheet only opens from a small "TAB 成就" chip in the
  career screen's corner.
- **The ugly menu in the user's screenshot** is the drawn stand-in pelican (`portrait(..., { drawn: true })`) shown
  while `art/menu.webp` (124 KB) decodes; menu.ts waits ≤ 1.2 s (`artReady`) then reveals the stand-in. On a first
  visit the art queues behind 5.5 MB of fonts: `ui/hud/hud.ts` calls `preloadHudFonts()` at boot, which fetches every
  CJK subset any race line might use (≈ 2.9 MB of that 5.5 MB is the HUD preload; the title + menu need ≈ 2.7 MB).

## Build it
1. **Main menu** (`copy.ts` MENU + `screens/menu.ts`): add 「角色 ROSTER」 (→ `roster`, blurb: 选谁骑车？技能也在这儿配)
   after 快速比赛 and 「成就 RECORDS」 (→ `records`) after 车库. Everything still fits at 1280×720 (shrink the stair
   step a little if needed; the quit step stays last in the desktop shell).
2. **Records screen** (`ScreenId 'records'`, new `screens/records-screen.ts`, registered in `screens/registry.ts`
   replacing the placeholder): the existing `recordsSheet()` (records.ts) as a full screen — title 「成就 RECORDS」,
   the achievement grid with the detail strip, the 彩蛋 column, the lifetime stats; arrows walk the grid (same as the
   sheet), Esc / pad B → menu. Keep the career Tab chip as a shortcut (tools/r5/records.mjs must stay green).
3. **No stand-in on the menu**: the menu art is fetched early (boot already preloads it after the title art — make
   sure nothing large competes with it) and the menu waits for it (`artReady(heroArt, 4000)` while the title is up
   is fine: the title → menu wipe can wait); the drawn stand-in only appears if the art file is broken or missing.
4. **Race fonts load with the race, not at boot**: `ui/hud/fonts.ts preloadHudFonts()` must not run in `createHud`
   at boot — call it when a race starts loading (`flow:loading` / the loading screen), so the title + menu fetch only
   what they draw. (You own `src/ui/hud/fonts.ts` and the one line in `hud.ts` that calls it.)
5. **Career back to readable**: show ONE cup at a time (5 big event cards in a row is fine only if each card is
   ≥ 220 px; prefer the pre-r4 look: a cup per page or a 3-up carousel), cup tabs or LB/RB / ↑↓ to switch cups,
   card names ≥ 22 px, cup names ≥ 26 px, at most 2 chips per card (weather + one of 反向 / 路线), the detail panel
   keeps the full info (难度, 天气, 方向, 路线, 对手等级, 最佳名次, 目标). At most 9 cards in view, ≤ 12 texts under 14 px.
6. **Quick race back to readable**: 3 big cards in view (≥ 300 px wide, names ≥ 32 px, blurbs ≥ 17 px) in a row
   that scrolls with ←→ to the other tracks (the focused card always fully on screen); the race options (weather,
   reverse, route) fold into the focused card's lower part or a compact strip under the row, still reachable with ↓.
7. **Race HUD declutter** (ui-hud files listed below): the slipstream is announced once (r5 shows the SLIPSTREAM
   callout and the speedo tag together — keep the speedo tag, drop the callout or vice versa); the AIR TRICK key
   card (`hud/hints.ts`) leaves as soon as the player lands.
Keep the P5 look (jagged panels, red / black / white, ransom titles) — this is about size and density, not a new
style. Compare with the pre-r4 screenshots: `F:/dev/beak-rash-out/r6/uicmp/cmp-career.jpg`, `cmp-trackSelect.jpg`,
`cmp-race.jpg` (left = pre-r4, right = r5).

## Files you own
`src/ui/copy.ts`, `src/ui/screens/menu.ts`, `src/ui/screens/menu.css`, `src/ui/screens/career.ts`,
`src/ui/screens/career.css`, `src/ui/screens/track-select.ts`, `src/ui/screens/track-select.css`,
`src/ui/screens/records.ts`, `src/ui/screens/records.css`, `src/ui/screens/records-screen.ts`,
`src/ui/screens/registry.ts`, `src/ui/screens/boot.ts`, `src/ui/screens/loading.ts`, `src/ui/screens/weather-ui.ts`,
`src/ui/hud/fonts.ts`, `src/ui/hud/hud.ts`, `src/ui/hud/hints.ts`, `src/ui/hud/css/hints.css`,
`src/ui/hud/cutins/callouts.ts`, `src/ui/hud/css/callouts.css`, `src/ui/hud/speedo.ts`, `src/ui/hud/css/speedo.css`.
(The roster screen is another job's: leave `roster` to it, only add the menu entry.)

## Acceptance (the runner runs these; read `tools/r6/ui.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/screens/ src/ui/copy.ts src/ui/hud/` → TSC-OWN OK
- `node tools/r6/ui.mjs` → r6-ui OK (its last part runs the production build on :5301 at 8 Mbps — the lead rebuilds
  :5301 before the runner's check; you can run `node tools/r6/ui.mjs --skip net` while you work)
- `node tools/r5/records.mjs` → r5-records OK
- `node tools/r4/w3-screens.mjs` → w3-screens OK
- `node tools/ui-input.mjs` → all checks passed
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/core-check.mjs` → core-check OK
Look at your work: menu, records, career (each cup), quick race, and the race HUD at 1280×720 and 1920×1080, contact
sheets under `shots/r6-ui/`.
