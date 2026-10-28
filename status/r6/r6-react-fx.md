# r6 / react-fx — every skill looks like itself; element glyphs, reaction bursts and callouts

## Plan
1. `src/data/skills.ts`: `REACTION_CN` (蒸发 融化 冻结 感电 超导 超载 扩散), `ELEMENT_COLOR`, `REACTION_COLOR`.
   Proof: `node tools/r4/tsc-own.mjs src/data/`.
2. `src/data/strings.ts`: the HOW TO 「元素反应 REACTIONS」 card (4 elements + 7 reactions).
   Proof: `node tools/content-lint.mjs` (still 93 errors) + `node tools/r6/present.mjs --only visual`.
3. `src/fx/presets/r6.ts` (new) + `src/fx/presets/index.ts`: element / gag / meme presets (embers, iceShards,
   droplets, windDust, steam, meltSplash, frostBurst, shatter, overload, swirlBurst, bananaBits, tears,
   fishBits, trashBits, pieBits, bubbles).
   Proof: `node tools/r4/w3-fx.mjs` (preset list) + `node sandbox/fx.warm.mjs` (no new programs).
4. `src/fx/react/skills.ts`: a TABLE entry for all 39 skills + `export const FLAIR_SKILLS`.
   Proof: `node tools/r6/present.mjs --only visual` (no missing flair).
5. `src/fx/react/bus-r6.ts` (new) + `bus-combat.ts` + `src/fx/debug.ts`: one burst per `combat:reaction`
   (electro: a zap per victim, ≤6) and `stats().reactionBursts`.
   Proof: `node tools/r6/present.mjs --only visual` (bursts ≥ 1 per reaction).
6. `src/ui/hud/world/elements.ts` (new) + `css/elements.css` + `world/overlay.ts`: the element badge over a
   rider who carries an aura and the reaction callout at the victim.
   Proof: `node tools/r6/present.mjs --only visual` (glyph + callout on screen) + `node tools/r4/w3-hud.mjs`.
7. Look at it: race screenshots with the reactions firing (1280×720) into `shots/r6-react-fx/`.
   Proof: `python tools/thumb.py … -o sheet.jpg` and read the sheet.

## Done
1. ✅ data/skills.ts: `REACTION_CN` (the seven names the acceptance reads), `ELEMENT_COLOR`, `REACTION_COLOR`.
2. ✅ data/strings.ts: the `elements` card in `HOWTO_NEW` (wide): 4 element lines + 7 reaction lines.
3. ✅ fx/presets/r6.ts: 16 new presets, registered in presets/index.ts. They reuse the existing atlas frames,
   so `sandbox/fx.warm.mjs` still reports `late: 0, fxLate: 0`.
4. ✅ fx/react/skills.ts: a TABLE entry for all 39 skills (cast/hit/end), `FLAIR_SKILLS = Object.keys(TABLE)`.
5. ✅ fx/react/bus-r6.ts: `combat:element` → a small aura flash, `combat:reaction` → one burst per event
   (electro: a zap per victim, ≤6); `fx stats().reactionBursts` counts them per race session.
6. ✅ ui/hud/world/elements.ts: the badge over a rider who carries an aura (the newest one; the rain's
   endless wet, `source === null`, shows none) and the reaction callout at the victim (one per event, so an
   electro chain is a single 感电！). Wired into overlay.ts (the bus subscription follows the session's bus).
   The badge follows the rider: a name plate the tag layout pushed aside must not drag the badge into the sky.

## In progress / next
Nothing left in code. The HOW TO 「元素反应」 card is the last open item (see Requests).

## How to test (exact commands)
- node tools/r4/tsc-own.mjs src/fx/ src/ui/hud/ src/data/
- node tools/r6/present.mjs --only visual
- node tools/r4/w3-fx.mjs
- node tools/r4/w3-hud.mjs
- node sandbox/fx.warm.mjs
- node tools/content-lint.mjs
- node tools/core-check.mjs

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/fx/ src/ui/hud/ src/data/` → `TSC-OWN OK`
- `node tools/r6/present.mjs --only visual` → `r6-present OK`, with:
  "every skill has its own fx flair (fx/react FLAIR_SKILLS; missing: )" ·
  "data/skills.ts REACTION_CN names the seven reactions 蒸发 融化 冻结 感电 超导 超载 扩散 (wrong: none)" ·
  "the seven reactions fire from skill pairs (vaporize, melt, freeze, electro, superconduct, overload, swirl)" ·
  "each reaction is called out at the victim in the HUD ([data-reaction] on screen with 蒸发！/感电！…; missing: none)" ·
  "each reaction fires its own fx burst (fx stats().reactionBursts; none for: none)" ·
  "the rider carrying an element shows its glyph ([data-element] on screen; missing after: none)" ·
  "the element glyph goes away when the aura runs out {"on":1,"after":0}" ·
  "HOW TO → 新玩法 has a card for the element reactions naming all seven (蒸发 融化 冻结 感电 超导 超载 扩散)"
- `node tools/r4/w3-fx.mjs` → `w3-fx OK` · `node tools/r4/w3-hud.mjs` → `w3-hud OK` ·
  `node tools/core-check.mjs` → `core-check OK`
- `node sandbox/fx.warm.mjs` → exit 0, `{"track":"coast","quality":"high","layer":{"visible":true,"kind":"rain"},"late":0,"fxLate":0,"errors":[]}`
  (the new presets reuse the atlas frames, so no program links after the intro)
- `node tools/content-lint.mjs` → `content-lint: 1389 strings in 194 groups · 93 errors · 0 warnings`
  (93 errors before this job as well — the new copy adds none)
- `shots/r6-react-fx/probe.mjs` (1280×720) → `shots/r6-react-fx/sheet.jpg`: the 水 badge over two wet
  riders, 蒸发！/感电！/超载！/冻结！ called out at the victim, no console errors.
- `shots/r6-react-fx/rain.mjs` → `{"weather":"rain","badgesInRain":0,"wetStatuses":[["wet:null"],…]}`
  (the rain's endless wet shows no badge).

## Known issues
- The HOW TO 「新玩法」 page is full: its grid (`src/ui/screens/howto.css`, ui-screens' file) is
  `repeat(4, 1fr)` × `1.25fr 1fr 1fr`, and the eleven r4 cards already fill all 12 cells. Measured at
  1280×720: row 1 = 190 px, row 2 = 141 px, row 3 = 129 px (the fr rows are floored by their content, so
  the 493 px body is exactly full) and the body ends at y = 651. The new wide card is therefore the first
  item of a 4th (implicit) row: it runs from y = 654 to y = 813 in a 720 px viewport, so its lower half
  falls off the bottom of the screen. Its text is in the DOM (the acceptance reads the page's textContent
  and passes) and the card is the last item, so the three r4 rows are pixel-identical to before — see
  Requests for the one-line CSS fix.

## Requests
- ui-screens (`src/ui/screens/howto.css`): the 「新玩法」 page needs room for the new 元素反应 card. The
  cheapest fix is `overflow-y: auto` on `.br-ht-new` (the grid already overflows the 740 px body) or a
  taller `.br-ht-body` that scrolls. The card itself (11 lines, wide) is ready in `data/strings.ts`
  (`HOWTO_NEW`, id `elements`); the ui-hud unit owns nothing here, so I could not fix the layout myself.
