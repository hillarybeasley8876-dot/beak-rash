# r4 job w3-hud — the race HUD for every r4 mechanic (ui-hud unit)

Read SPEC.md §5 (UI palette, P5 rules), §10 (HUD today), §14–§19 (the r4 mechanics and their events) and §22. Every
event below already exists in `src/core/events-map.ts`; most are already emitted by the gameplay units. You only add
HUD reactions — in the P5 style of the existing HUD (`src/ui/hud/**`: cutins, world-anchored tags/bubbles, chips,
splashes, anim.ts envelopes, reduced motion, pad/keyboard glyphs). Quiet while cruising, loud on events. Never cover
the place badge, the speedometer or the skill cluster; keep the r3 layout rules (status/ui-hud.md).

## Build it
1. Police (§14): a wanted badge `.brh-wanted` with `data-level` (★ count 1–3, P5 red/black, near the place badge;
   hidden at 0) on `police:wanted`; a `.brh-baton-warn` "!" + baton icon over the corgi (world-anchored to obstacle
   900/901 via session.obstacles; an edge arrow when off-screen) for the wind-up time on `police:windup`; a P5 banner
   `前方设卡！` on `police:roadblock`; a splash `柯基下班了！` on `police:down`; damage numbers on `police:hurt`
   (reuse the damage-number layer); a coin chip `V我50 −50` on an accepted `police:bribe`, `这次不行！` refused.
2. Tricks (§16): a `.brh-trick` pop on `rider:trick` land: the trick names (360° / 后空翻 / 前空翻 / 超人) and
   `+points`; FAIL stamp on 'fail'.
3. STYLE (§17): a `.brh-style` meter under the place badge while a chain is alive: `STYLE ×mult · total` (thousands
   separator) with the action labels flying in; on `style:bank` a pop `+sp SP +coins 小鱼干` (red if broken).
4. Weapons (§15): the first time per profile the player picks up a throwable weapon, a hint `按住 K 投掷` (pad:
   `按住 Y 投掷`) — remember it in localStorage key `beak-rash.hint.throw`; the weapon slot shows the trait name
   (`WEAPONS[w].traitName`, e.g. 回旋镖) under the weapon name; `combat:parry` → a big `当！` pop near the player.
5. Rivals (§18): `race:nemesis` → a red `宿敌 NEMESIS` card at the intro (or a short cut-in if the intro is over) and a
   red `宿敌` badge on that rider's name tag for the race; `race:alliance` form → a banner `围剿！` with the members'
   portraits (data/assets portraits) and a chain icon on their name tags; break → `塑料友谊！` for betrayal, else the
   banner just leaves.
6. Track events (§19): `race:event` warn → a P5 diagonal banner: fishSpill `前方鱼车侧翻！小心路滑`, geese
   `前方鹅群过马路！`, roadworks `前方施工！`, stalls none.
7. Every new element: reduced motion respected (anim.ts), visible at 1280×720 and 2560×1440, no overlap with the r3
   HUD pieces, pad/keyboard glyphs via glyphs.ts. Strings in `src/data/strings.ts` (yours to extend).

## Files you own
`src/ui/hud/` (folder), `src/data/strings.ts`, `sandbox/hud.*`.

## Acceptance (the runner runs these; read `tools/r4/w3-hud.mjs` first)
- `node tools/r4/tsc-own.mjs src/ui/hud/ src/data/strings.ts` → TSC-OWN OK
- `node tools/r4/w3-hud.mjs` → w3-hud OK
- `node sandbox/hud.shots.mjs` → every scene PASS (existing HUD scenes keep working)
- `node tools/ui-input.mjs` → all checks passed
- `node tools/core-check.mjs` → core-check OK
Look at your work: a contact sheet of every new element at 1920×1080 under `shots/r4-w3-hud/`.
