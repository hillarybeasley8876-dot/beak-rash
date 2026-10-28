# r6 job react-fx — every skill looks like itself, elements and reactions read on screen (fx + ui-hud + content; SPEC §24)

The user asked for skills that are "要素拉满". The 26 r6 skills (meme signatures, pool skills, shared ults) get the
generic sparkle in `src/fx/react/skills.ts` (`DEFAULT`), and the element system (`src/gameplay/combat/elements.ts`)
is invisible: nothing shows which rider carries 火 / 冰 / 雷 / 水, and a reaction (蒸发 / 感电 / 超载 …) has no burst
and no callout. SPEC §24: "fx shows an element glyph over the victim and a reaction burst; the HUD calls the
reaction name (蒸发！/感电！…) near the victim". Measured by `node tools/r6/present.mjs --only visual`: 0 of 7.

Read SPEC.md §5 (art: P5 comic, readable from the chase cam), §10 (HUD), §24, then `src/data/skills.ts` (each
skill's desc, category, element), `src/gameplay/combat/elements.ts` (the auras: fire → `burn`, ice → `cold` stacks /
`frozen`, thunder → `charged`, water → `wet`; wind carries; rain's endless `wet` has `source === null`), the skill
files under `src/gameplay/combat/skills/{elem,gag,meme,ults}/` (the combat visuals they already draw), `src/fx/react/
skills.ts` (TABLE + skillFlair), `src/fx/react/bus-combat.ts`, `src/fx/presets/*` (the presets and their options),
`src/fx/debug.ts` (`stats()`), `src/ui/hud/world/{overlay,damage,tags}.ts` + `css/world.css` (world-anchored HUD:
projected positions, pooled DOM, P5 slam animation), `src/data/strings.ts` (`HOWTO_NEW`).

## Build it
1. **fx flair per skill** (`src/fx/react/skills.ts`): a TABLE entry for every skill in `SKILLS` (39), cast and hit
   (and end where it reads), chosen from the presets with the skill's own colours — fire orange/red embers, ice
   pale-blue shards and sparkle, thunder yellow zaps, water splash/droplets, wind dust swirl, the gags their joke
   (pie crumbs, duck feathers yellow, confetti for the ad pop and the war song, smoke + debris for the firecracker),
   the meme signatures their meme (banana-yellow peel bits, tear-blue droplets, fish/food crumbs for 新鲜哥, a dust
   ring for the bounce, trash bits for pedro, notes for the violin). Add a preset in `src/fx/presets/` only when no
   existing one fits (register it in `presets/index.ts`; mind the particle budget). Export
   `FLAIR_SKILLS: readonly string[]` = the TABLE's keys (the test reads it). Keep `DEFAULT` for unknown ids.
2. **Reaction bursts** (fx): on `combat:reaction` a burst at the victim per reaction — vaporize = a white steam
   puff, melt = orange-to-blue drip splash, freeze = ice shards + a frost ring, electro = yellow zaps on every victim
   in `victims`, superconduct = blue-white shatter, overload = a big orange explosion ring, swirl = a coloured dust
   swirl. One burst per event (electro: a small zap per victim, capped at 6). Count them: `__br.fx.stats()` reports
   `reactionBursts` (bursts spawned since the race started).
3. **Element glyph** (ui-hud, new `src/ui/hud/world/elements.ts` + `src/ui/hud/css/elements.css`, wired in
   `overlay.ts`): above each on-screen rider who carries an element aura, a small round P5 badge with the element's
   glyph (火 burn · 冰 cold / frozen · 雷 charged · 水 wet; `ELEMENT_CN` in data/skills.ts) in the element's colour,
   `data-element="<fire|ice|thunder|water>"`, sitting just above the rider's name tag (never on top of it). It
   shows while the aura status is active and leaves with it; rain's endless wet (status `source === null`) shows no
   badge. Several auras: the newest one. Pooled DOM like `damage.ts`; hidden off-screen.
4. **Reaction callout** (ui-hud, same module): on `combat:reaction` a big slammed word at the victim —
   `REACTION_CN[reaction] + '！'` (蒸发！ 融化！ 冻结！ 感电！ 超导！ 超载！ 扩散！), `data-reaction="<reaction>"`, P5
   style (ransom-ish, black outline, the reaction's colour, slight tilt), rises and fades in ~1 s, larger when the
   player made it or took it. Electro chaining through a pack: one callout, not one per victim.
5. **Content** (`src/data/skills.ts`): `export const REACTION_CN: Record<Reaction, string>` = 蒸发 融化 冻结 感电 超导
   超载 扩散. (`src/data/strings.ts`) a `HOWTO_NEW` card 「元素反应 REACTIONS」 (wide): the four elements and the seven
   reactions, one line each — what makes it and what it does, e.g. 「火 + 水 = 蒸发：爆发伤害」, 「雷 + 水 = 感电：
   电流传给周围所有湿身的人（下雨天全员湿身）」.

## Look at it
Shoot a race with the reactions firing (cast pairs as `tools/r6/present.mjs` does) at 1280×720: the badge over a
wet rider, the 感电！ callout over a pack, the overload burst. Contact sheet into `shots/r6-react-fx/` via
`python tools/thumb.py … -o sheet.jpg`; check it reads at a glance and covers nothing important (the speedometer,
the skill diamonds, the progress bar).

## Files you own
`src/fx/react/skills.ts`, `src/fx/react/bus-combat.ts`, `src/fx/react/bus-r6.ts` (new, if you want the reaction
wiring apart), `src/fx/debug.ts`, `src/fx/presets/skills.ts`, `src/fx/presets/r6.ts` (new), `src/fx/presets/index.ts`,
`src/ui/hud/world/elements.ts` (new), `src/ui/hud/world/overlay.ts`, `src/ui/hud/css/elements.css` (new),
`src/ui/hud/css/world.css`, `src/data/skills.ts`, `src/data/strings.ts`.

## Acceptance (the runner runs these; read `tools/r6/present.mjs` first)
- `node tools/r4/tsc-own.mjs src/fx/ src/ui/hud/ src/data/` → TSC-OWN OK
- `node tools/r6/present.mjs --only visual` → r6-present OK
- `node tools/r4/w3-fx.mjs` → w3-fx OK
- `node tools/r4/w3-hud.mjs` → w3-hud OK
- `node sandbox/fx.warm.mjs` → exit 0
- `node tools/content-lint.mjs` → no new errors (it reports 93 errors today; your strings must add none)
- `node tools/core-check.mjs` → core-check OK
