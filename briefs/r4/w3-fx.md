# r4 job w3-fx — effects for the r4 mechanics + weather particles (fx unit)

Read SPEC.md §5 (art: toon, P5 energy, readable), §8 (fx today), §14–§21 (the r4 mechanics) and §22. All events exist
in `src/core/events-map.ts`. Read `src/fx/` first: `presets/index.ts` (44 particle presets: hit, sparks, feathers,
keys, confetti, coin, sparkle, …), `particles/` (pools, budget), `react/` (bus reactions: bus-ride, bus-combat,
emitters), `system.ts`, `debug.ts` (`__br.fx.presets`, `stats().particles = { solid, add }`, `burst()`).

## Build it
1. New presets (exact names): `trickTrail` (bright speed ribbons / streaks shed by a spinning or flipping rider),
   `trickLand` (star burst + ring on a landed trick, bigger with count), `parry` (big metallic spark star + white
   ring — the "当！" moment), `throwTrail` (a short streak fan in the throw direction at release; pink glow for the
   slipper), `policeDown` (cartoon stars + a flying police cap + dust), `fishSplash` (little fish + water drops),
   `truckDust` (a dust cloud when the truck tips), `gooseFeathers` (white feathers), `fruit` (watermelon chunks and
   fruit), `quack` (yellow notes / tiny ducks popping up).
2. Reactions (react/ — new file(s)):
   - `rider:trick` land → `trickLand` at the rider; while `RiderState.trick` is running → `trickTrail` emitted from the
     rider every few frames (cheap); 'fail' → `dust` + `sparks`.
   - `combat:parry` → `parry` at pos; `combat:throw` → `throwTrail` at pos in the throw direction (dir ±1 along the
     track); a keyboard crit (`combat:hit` weapon 'keyboard' + crit) → `keys`.
   - `police:down` → `policeDown`; `police:hurt` → `hit`.
   - `race:event` start: fishSpill → `truckDust` + `fishSplash` at pos; `traffic:honk` from an obstacle of kind 'goose'
     (look it up in session.obstacles) → `gooseFeathers` at it; `npc:say` from an obstacle of kind 'stall' → `fruit`.
   - `secret:found`: ids starting with 'duck_' → `quack`; others → `confetti` + `sparkle` at pos (or ahead of the
     player when pos is null).
3. Weather particles: one layer named `fx:weather` (`userData.kind` = 'rain' | 'snow') around the camera when
   `session.track.weather` is rain or snow: rain = fast slanted streaks (instanced quads, a few thousand, 1–2 draw
   calls), snow = slow drifting soft flakes; absent/hidden for clear / fog / dusk and outside races; quality scales
   the count (low ≈ ⅓); reduced motion keeps it but slower/fewer; never in front of the HUD; disposed on detach.
   Optional: a dust layer (`userData.kind` 'dust') for the gobi in fog.
4. Budget: keep the particle caps; GPU cost of the weather layer ≤ ~0.4 ms at 1080p (measure with `__br.fx.bench`).

## Files you own
`src/fx/` (folder), `sandbox/fx.*`.

## Acceptance (the runner runs these; read `tools/r4/w3-fx.mjs` first)
- `node tools/r4/tsc-own.mjs src/fx/` → TSC-OWN OK
- `node tools/r4/w3-fx.mjs` → w3-fx OK
- `node sandbox/fx.warm.mjs` → exit 0 (no shader compiles mid-race: warm every new preset / the weather layer)
- `node tools/core-check.mjs` → core-check OK
Look at your work: a contact sheet of every new preset + rain / snow at 1920×1080 under `shots/r4-w3-fx/`.
