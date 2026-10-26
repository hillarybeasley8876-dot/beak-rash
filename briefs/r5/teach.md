# r5 job teach — explain the r4 mechanics: a HOW TO tab, loading tips, first-time hints in the race

Read SPEC.md §10 (screens), §11 (HUD), §14–§21 (the r4 mechanics: police 2.0, weapons 2.0 / throws / the pan parry,
air tricks, STYLE, nemesis / alliances, track events, maps, easter eggs). None of them is explained anywhere today:
the HOW TO screen (`src/ui/screens/howto.ts` + `howto-pages.ts`, words in `src/data/strings.ts` HOWTO_*) has three
tabs (键盘 / 手柄 / 技能) from r3, the loading tips (`src/data/tips.ts`, TIPS + PAD_TIPS) have no r4 tip, and the HUD's
first-race prompts (`src/ui/hud/hints.ts`: launch / swing / drift / hop / ult) know nothing of tricks, the baton or
the bribe (only the throw has a one-off chip in `src/ui/hud/r4/index.ts`). Keys: tricks = Shift (pad RB) + A/D
(spin) · + S (backflip) · + Space (frontflip) · alone (superman, release before landing); throw = hold K (pad Y);
the pan parries a swing pressed ≤ 0.15 s before a hit lands; the bell = B (check `src/core/input.ts` and
`src/ui/hud/glyphs.ts` for the real bindings and pad glyphs — never guess a key).

## Build it
1. **HOW TO tab 「新玩法 NEW」** (4th tab, after 技能): short P5 cards, one per mechanic, each with its key chips
   (keyboard and pad, drawn like the other tabs): 空中特技 (the four tricks, the chain, the landing rule), 投掷 +
   武器特性 (one line per weapon trait), 平底锅弹反, 柯基警官 (通缉星级, the baton tell → brake / swerve / hop or parry,
   down it, ★3 backup + roadblock), 「V我50」 (ring the bell next to the corgi at ★1–★2 with 50 小鱼干), STYLE 连段
   (what feeds it, what breaks it, what it pays), 宿敌 / 围剿 / 塑料友谊, 赛道突发事件, and a line about weather,
   reverse and seeded routes. Everything fits 1280×720 and 1920×1080 (no scrolling, no clipping).
2. **Loading tips**: at least 12 new tips about the r4 mechanics in the house tone (meme, short); the ones that name a
   key also get their pad wording in PAD_TIPS.
3. **First-time hints in the race** (`hints.ts` style: device-aware key chips, bottom centre, never over a cut-in),
   shown at most twice per profile each (persist the counts in localStorage, like `beak-rash.hint.throw`) — for every
   profile, not only the first two races:
   - `trick`: while the player is airborne with enough predicted air for a spin (≥ 0.55 s) → 「空中！」 + the chips
     (Shift/RB + ←/→ 转体 · + S 后空翻 · + 跳 前空翻);
   - `baton`: the first `police:windup` aimed at the player → 「警棍！刹车 / 闪开，或者平底锅弹反」;
   - `bribe`: the player is wanted (`police:wanted` level 1–2) and has ≥ 50 小鱼干 → 「靠近柯基按铃：V我50」.
   Each card carries `data-hint="<id>"` (trick / baton / bribe; add it to the existing ones too).

## Files you own
`src/ui/screens/howto.ts`, `src/ui/screens/howto-pages.ts`, `src/ui/screens/howto.css`, `src/data/strings.ts`,
`src/data/tips.ts`, `src/ui/hud/hints.ts`, `src/ui/hud/css/hints.css`, `src/ui/hud/r4/index.ts`,
`src/ui/hud/glyphs.ts`, `src/ui/hud/hud.ts`.

## Acceptance (the runner runs these; read `tools/r5/teach.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/screens/howto.ts src/ui/screens/howto-pages.ts src/data/strings.ts src/data/tips.ts src/ui/hud/` → TSC-OWN OK
- `node tools/r5/teach.mjs` → r5-teach OK
- `node tools/r4/w3-hud.mjs` → w3-hud OK
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/core-check.mjs` → core-check OK
Look at your work: the new tab at 1280×720 and 1920×1080 and the three hints in a race under `shots/r5-teach/`.
