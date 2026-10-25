# r4 job w1-llm-bike — 大模型限定款 (Konami unlock) + the rubber-duck rider cosmetic

Read SPEC.md §5 (art bible), §21 items 1–2 (your spec) and §22. Contracts already in core (do not edit core):
`BikeId 'llm'` (with stand-in entries: `src/actors/bikes/defs/index.ts` maps it to the roadbike, `src/data/bikes.ts`
has its stats, `src/actors/rig/bar-fit.ts` a roadbike fit), `SaveData.unlocks: string[]`, `settings.duckRider`.

## Read first
`src/actors/bikes/` (template.ts, model.ts, defs/*.ts — copy how roadbike.ts / fixie.ts build a bike from parts; parts/
for frames, wheels, drive/chain, cockpit; build/ for geometry; the far-LOD rules in model.ts/template.ts), `src/ui/
screens/menu.ts` + `src/ui/screens/eggs.ts` (the PELICAN egg: `createSequence`; reuse it), `src/ui/screens/garage.ts`
(+ garage.css, garage-turntable.ts), `src/data/bikes.ts` (BIKES, BIKE_ORDER), `src/core/input.ts` (KEYMAP/PADMAP:
which game actions a key or pad button sends).

## 1. Konami code on the main menu
- Match the code on the menu's ACTION stream (works for keyboard and pad alike): up, up, down, down, left, right, left,
  right, B, A — where up = 'up' or 'skill2' (pad ✚↑), down = 'down' or 'skill3' (pad ✚↓), B = 'bell' (keyboard B) or
  'back' / 'attackR' (pad B), A = 'left' (keyboard A) or 'confirm' / 'hop' (pad A). A pad press sends two actions (e.g.
  'attackR' then 'back'): count each physical step once. Whole code within 6 s, wrong input resets (reuse
  `createSequence` or extend `eggs.ts`).
- When the first 8 inputs matched, the B input must be CONSUMED by the egg (return true from onAction) so the menu does
  NOT go back to the title; also consume the final A so no menu item is picked. Arrow keys still move the cursor
  while typing the code — that is fine.
- On completion: add 'llm' to `save.data.unlocks` and `save.data.ownedBikes` (one `app.save.update`), sound
  `ctx.sfx('ui.unlock')`, toast `大模型限定款已解锁：链条接在脖子上，这很合理。`. Typing it again later only re-shows the toast.

## 2. Garage
- The list shows `BIKE_ORDER` plus `llm` (last) only when `save.data.unlocks` includes 'llm'. Price 0, can be equipped.
- When `save.data.unlocks` includes 'duck', show one extra toggle row `小黄鸭乘客 DUCK RIDER: 开 / 关` (class
  `br-gar-duck`), reachable by keyboard/pad/mouse like the other rows, that flips `save.data.settings.duckRider`.

## 3. The LLM bike model (`src/actors/bikes/defs/llm.ts`, replace the stand-in in defs/index.ts)
"A bike as drawn by a language model": start from the roadbike, then make it delightfully wrong but still rideable and
readable from the chase camera: the CHAIN runs from the chainring up to the rider's neck (a black chain/tube mesh
named `llm-chain` whose upper end sits at the neck: the acceptance test measures its closest vertex to the midpoint
of the rider's head and chest anchors, must be < 0.25 m in the riding pose — attach that end to whatever moves with
the rider, or aim it at the saddle-height neck position of the pelican on this bike), an extra floating pedal beside
the frame, the saddle mounted on the handlebar (the rider still sits where the riding pose expects), seven spokes in
random directions per wheel (seeded, stable), a slightly wrong frame triangle. Keep its triangle budget like the
roadbike's and provide the same far-LOD variant the other bikes have (model.ts). Rider fit: the pelican's hands on
the grips and feet on the pedals must still work (`node tools/actors-check.mjs --bikes llm` → foot/grip 0.0 cm for the
species that are 0.0 on the roadbike).

## 4. Duck rider cosmetic
When `app.save.data.settings.duckRider` is true AND `unlocks` includes 'duck', the PLAYER's bike gets a small yellow
rubber duck (orange beak, black eyes, toon material + ink outline, ~12 cm) riding on the handlebar/stem (child of the
steer pivot so it turns with the bars), named `duck-rider`. Otherwise no duck object (or an invisible one). Rivals
never get it. Read the save when the bike/view is created for a session.

## Files you own
`src/actors/bikes/` (whole folder except `stub.ts`), `src/actors/rig/bar-fit.ts`, `src/data/bikes.ts`,
`src/ui/screens/menu.ts`, `src/ui/screens/eggs.ts`, `src/ui/screens/eggs.css`, `src/ui/screens/garage.ts`,
`src/ui/screens/garage.css`, `src/ui/screens/garage-turntable.ts`, `sandbox/bikes.*`.
(The duck cosmetic needs the player flag where the bike is built: the bike unit's createBike options are yours; if
you need `isPlayer` from the rider view (actors view.ts, NOT yours), write a request in your status file and read the
save inside the bike unit for the player's bike instead.)

## Acceptance (the runner runs these; read `tools/r4/w1-llm.mjs` first)
- `node tools/r4/tsc-own.mjs src/actors/bikes/ src/ui/screens/menu.ts src/ui/screens/eggs.ts src/ui/screens/garage.ts src/data/bikes.ts` → TSC-OWN OK
- `node tools/r4/w1-llm.mjs` → w1-llm OK
- `node tools/ui-input.mjs` → all checks passed (menu/garage input must not regress)
- `node tools/r4/p0-menu-eggs.mjs` → p0-menu-eggs OK (the PELICAN egg keeps working)
- `node sandbox/bikes.tris.mjs` → exit 0
