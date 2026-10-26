# r5 · teach — explain the r4 mechanics (HOW TO 新玩法 tab, loading tips, first-time race hints)

## Plan
1. `src/data/strings.ts`: add `HOWTO_NEW` (11 cards: id/cn/en/keys[kb,pad,text]/lines) — the copy of the new tab.
   Verify: `node tools/r4/tsc-own.mjs src/data/strings.ts` → TSC-OWN OK
2. `src/ui/screens/howto-pages.ts`: add `newPage()` — the 4×3 card grid (the traits card spans 2 columns).
   Verify: same tsc-own command.
3. `src/ui/screens/howto.css`: the grid, the cards, the key chips (kb = white, pad = ink).
   Verify: `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
4. `src/ui/screens/howto.ts`: the 4th tab 「新玩法 NEW」 after 技能.
   Verify: `node tools/r5/teach.mjs` → the HOW TO part passes (tab ≥ 4, all 8 keywords, SHIFT + RB, fits 1280×720).
5. `src/data/tips.ts`: a new `r4` tip group (18 tips) + the PAD_TIPS wording of the key tips.
   Verify: the r5 tips part (≥ 10 keyboard tips, ≥ 4 pad tips).
6. `src/ui/hud/glyphs.ts`: the new glyphs (steer A D/摇杆, brake S/LT, bell B/BACK).
   Verify: `node tools/r4/tsc-own.mjs src/ui/hud/` → TSC-OWN OK
7. `src/ui/hud/hints.ts`: the three r4 hints (trick / baton / bribe), per-profile counters in
   localStorage (`beak-rash.hints`), the bus wiring (police:windup, police:wanted), the r4 trigger
   (airborne + ≥ 0.55 s of predicted air / wanted 1–2 + ≥ 50 coins) and the priority over the classic prompts.
   Verify: `node tools/r5/teach.mjs` → the three hints pass.
8. `src/ui/hud/hud.ts`: hand the bus to the Hints; dispose them with the HUD.
   Verify: `node tools/r4/w3-hud.mjs` → w3-hud OK
9. Shots: the new tab at 1280×720 and 1920×1080, the three hints in a race → `shots/r5-teach/`.
   Verify: `python tools/thumb.py` + Read the .jpg.

## Done
- HOW TO tab 「新玩法 NEW」 (4th, after 技能): 11 P5 cards in a 4-column grid, every card with its
  keyboard AND gamepad key chips (kb = white skewed kbd, pad = ink kbd): 空中特技 (the four tricks, the
  chain, the landing rule) · 投掷 · 武器特性 (one line per trait, 2 columns, spans 2 grid columns) ·
  平底锅弹反 · 柯基警官 (★1/★2/★3, the baton tell, brake/dodge/hop, the parry, knocking it down) ·
  ★3 路障 (backup + roadblock) · 「V我50」 · STYLE 连段 (feeds / breaks / pays) · 宿敌·围剿 (塑料友谊) ·
  赛道突发 · 天气·反向·路线. The copy lives in `src/data/strings.ts` (`HOWTO_NEW`), the drawings in
  `howto-pages.ts` (`newPage()`), the layout in `howto.css`.
- Loading tips: a new `r4` group in `src/data/tips.ts` (18 tips, house tone, ≤ 40 字) + 5 PAD_TIPS
  wordings for the ones that name a key (Shift→RB, S→LT, Space→A, K→Y, B→BACK).
- First-time race prompts in `src/ui/hud/hints.ts`: `trick` (airborne with ≥ 0.55 s of predicted air),
  `baton` (the first `police:windup` at the player), `bribe` (wanted ★1–★2 with ≥ 50 小鱼干). They run in
  EVERY race (not only the first two), at most 2 times per profile each, the counters persisted in
  localStorage under `beak-rash.hints`; they jump the queue over the classic prompts. Every prompt card
  (classic ones too) carries `data-hint="<id>"`; the r4 throw cut-in chip is tagged the same way.
- `src/ui/hud/glyphs.ts`: the new key glyphs (steer A D/摇杆, brake S/LT, bell B/BACK).

## In progress / next
Nothing — the brief is done. The 5 acceptance commands pass (see the evidence).

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/ui/screens/howto.ts src/ui/screens/howto-pages.ts src/data/strings.ts src/data/tips.ts src/ui/hud/`
- `node tools/r5/teach.mjs`
- `node tools/r4/w3-hud.mjs`
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none`
- `node tools/core-check.mjs`
- probes: `node shots/r5-teach/probe-howto.mjs` (the tab), `node shots/r5-teach/probe-hints.mjs`
  (the three prompts), `node shots/r5-teach/probe-r4-late.mjs` (a 9-race profile still gets the prompts),
  `node shots/r5-teach/probe-fit.mjs` (no card overflows its box), `node shots/r5-teach/probe-tips.mjs`.

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs …` → `TSC-OWN OK`
- `node tools/r5/teach.mjs` → 22 PASS, `r5-teach OK`; e.g.
  `PASS a HOW TO tab for the new mechanics (键盘KEYBOARD | 手柄GAMEPAD | 技能SKILLS | 新玩法NEW)`,
  `PASS the new-mechanics tab explains tricks (/空翻|转体|特技/)` … `explains alliance (/围剿/)`,
  `PASS it names the keyboard key (Shift) and the pad button (RB) for tricks`,
  `PASS → shows the tab and everything on it is on screen at 1280×720 (ok)`,
  `PASS at least 10 loading tips about the new mechanics (16)`,
  `PASS the pad wording covers the new tips that name keys (5)`,
  `PASS a big air shows the trick prompt (data-hint="trick") while the player is airborne`,
  `PASS the trick prompt is remembered in localStorage (shown a limited number of times per profile)`,
  `PASS the first baton wind-up shows the dodge / parry prompt (data-hint="baton")`,
  `PASS it says how: brake / dodge, or parry with the pan (BATON警棍！SLT刹车A D摇杆闪开KY平底锅弹反)`,
  `PASS wanted with ≥ 50 coins shows the 「V我50」 prompt (data-hint="bribe")`,
  `PASS it says: ring the bell next to the corgi (BRIBEV我50BBACK靠近柯基打铃)`.
- `node tools/r4/w3-hud.mjs` → 19 PASS, `w3-hud OK`.
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → `[ui-tour] all checks passed`.
- `node tools/core-check.mjs` → `core-check OK`.
- probes: `hints in a 9-race profile: {"seen":["launch","trick"]}` (the r4 prompts are not limited to the
  first two races), `throw chip data-hint: throw`,
  `localStorage: { 'beak-rash.hints': '{"trick":1,"baton":1,"bribe":1}' }`,
  card fit: every card `over` < 0 (nothing overflows its box), `off: []` (nothing off screen at 1280×720).
- shots: `shots/r5-teach/howto-new-1280x720.png`, `howto-new-1920x1080.png`, `hint-trick.png`,
  `hint-baton.png`, `hint-bribe.png` (+ the .jpg thumbs).

## Known issues
- None blocking. The classic `hop` prompt (跳！) rarely fires on the coast because the SETTLE delay (3 s
  after GO) can outlast its 12–55 m look-ahead window — pre-existing behaviour, untouched by this job.

## Requests
- None.
