# w1-llm-bike — 大模型限定款 (Konami) + duck rider cosmetic

## Plan
1. `src/ui/screens/eggs.ts`: add `createActionCode(steps, windowMs)` — an action-stream code matcher
   (each step accepts a set of actions; a wrong action resets; 6 s window). Verify:
   `node tools/r4/tsc-own.mjs src/ui/screens/eggs.ts`.
2. `src/ui/screens/menu.ts`: Konami steps (↑↑↓↓←→←→ B A) on the ACTION stream; the B and A steps are
   consumed (return true) so the menu neither backs out nor picks an item; on completion one
   `app.save.update` adds 'llm' to unlocks + ownedBikes, `ctx.sfx('ui.unlock')`, toast 大模型限定款已解锁…
   Verify: `node tools/r4/w1-llm.mjs` (test 1 keyboard + test 2 pad).
3. `src/ui/screens/garage.ts` (+garage.css): list `BIKE_ORDER` + 'llm' (last) when unlocked; one extra
   row `小黄鸭乘客 DUCK RIDER: 开/关` (class `br-gar-duck`) when unlocks include 'duck', flipping
   `settings.duckRider`. Verify: `node tools/r4/w1-llm.mjs` (test 1) + `node tools/ui-input.mjs`.
4. `src/actors/bikes/defs/llm.ts` (new) + `defs/index.ts`: the LLM bike — roadbike base, chain from the
   chainring to the rider's neck (mesh `llm-chain`), a floating extra pedal, the saddle drawn on the
   handlebar (marker unchanged), 7 seeded random spokes per wheel, a slightly wrong frame triangle.
   Verify: `node tools/actors-check.mjs --bikes llm` (foot/grip 0.0 cm) + `node sandbox/bikes.tris.mjs`.
5. `src/actors/bikes/model.ts` + `types.ts` + `template.ts` + `duck.ts`: attach the per-instance extras
   (the `llm-chain` mesh) and the `duck-rider` toy duck (a child of the steer pivot, on the player's
   untinted bike only, when `settings.duckRider` and the 'duck' unlock are set). Verify:
   `node tools/r4/w1-llm.mjs` (tests 3 + 4).
6. Full acceptance: `node tools/r4/tsc-own.mjs src/actors/bikes/ src/ui/screens/menu.ts
   src/ui/screens/eggs.ts src/ui/screens/garage.ts src/data/bikes.ts`, `node tools/r4/w1-llm.mjs`,
   `node tools/ui-input.mjs`, `node tools/r4/p0-menu-eggs.mjs`, `node sandbox/bikes.tris.mjs`.

## Done
1. `eggs.ts`: `createActionCode` (action-stream code, per-step `consume`, 6 s window, wrong input
   resets; the run can be typed again).
2. `menu.ts`: the Konami on the action stream; the B/A steps are eaten, so the shell also drops the
   pad's twin action (the menu neither backs out to the title nor picks an entry). The unlock = one
   `app.save.update` (unlocks + ownedBikes), `ui.unlock` sfx, the toast 大模型限定款已解锁：链条接在脖子上，
   这很合理。Typing it again only re-shows the toast.
3. `garage.ts`/`.css`: the 'llm' row (last, owned/free when unlocked, equippable) and the
   `小黄鸭乘客 DUCK RIDER` toggle row (class `br-gar-duck`, 开/关, keyboard + pad + mouse). The list
   compacts (`.is-long`) so nine rows still clear the stat bars.
4. `defs/llm.ts` + `defs/llm-chain.ts`: the bike (5930 tris vs the roadbike's 6864): the chain from the
   chainring up through the rider into a tilted collar around the neck (mesh `llm-chain`, the bike's
   own chain loop is gone), a pedal floating loose beside the frame, the saddle on the steerer's top
   (the saddle marker is untouched, so the rider still sits where the pose wants), seven seeded
   random spokes per wheel, a top tube that dives to the head tube.
5. `model.ts`/`types.ts`/`template.ts` + `duck.ts`: `BikeDef.extras()` (per-instance objects outside the
   merged geometry, hidden in the far LOD) and the duck passenger (a 12 cm yellow duck with an orange
   beak and ink-outlined eyes, a child of the steer pivot so it turns with the bars, upright in the
   bike frame, on the player's untinted bike only).
6. `sandbox/bikes-ui.ts` + `sandbox/bikes.tris.mjs`: the sandbox lists the llm bike too.

## In progress / next
- Nothing left in this job; the diff is ready for review.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/actors/bikes/ src/ui/screens/menu.ts src/ui/screens/eggs.ts src/ui/screens/garage.ts src/data/bikes.ts`
- `node tools/r4/w1-llm.mjs`
- `node tools/ui-input.mjs`
- `node tools/r4/p0-menu-eggs.mjs`
- `node sandbox/bikes.tris.mjs`
- `node tools/actors-check.mjs --bikes llm` (the rider's hands/feet still land on the roadbike's grips)

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/actors/bikes/ src/ui/screens/menu.ts src/ui/screens/eggs.ts src/ui/screens/garage.ts src/data/bikes.ts` → `TSC-OWN OK`.
- `node tools/r4/w1-llm.mjs` → 15 PASS lines, `w1-llm OK`
  (`the 'llm-chain' part reaches the rider's neck (closest vertex 0.09 m)`,
  `duckRider on: a visible "duck-rider" object rides the player bike`,
  `pad B completing the code does not back out to the title (menu)`).
- `node tools/ui-input.mjs` → `[ui-input] all checks passed`.
- `node tools/r4/p0-menu-eggs.mjs` → `p0-menu-eggs OK`.
- `node sandbox/bikes.tris.mjs` → `llm 5930` (roadbike 6864), exit 0.
- `node tools/actors-check.mjs --bikes llm,roadbike` → `pelican foot/grip cm llm:0.0/0.0 roadbike:0.0/0.0`
  (the penguin/corgi legs are short by design: the same numbers as the roadbike).
- Screenshots (shots/r4-w1-llm-bike/): `sheet7.jpg` roadbike vs llm side by side (7 spokes, the
  saddle on the steerer, the chain, the wrong top tube), `sheet5.jpg` the chain collar around the
  rider's neck in the chase view, `sheet4.jpg` the chase view (the loose pedal), `sheet6.jpg` the
  garage rows (大模型限定款 / 小黄鸭乘客) with the duck on the bars.

## Known issues
- The chain is a static prop: it does not follow the rider's head when the pose changes (the bikes
  unit has no handle on the rider). The collar is centred on the measured ride-pose neck and tilted,
  so it reads from the chase camera; the acceptance margin (0.09 m of 0.25 m) covers the pose drift.
- The chain passes through the rider on its way up (the joke), so it is hidden behind the body from
  directly behind except for the collar around the neck.

## Requests
- `src/actors/view.ts` (not mine): the duck rider is attached inside the bikes unit, which cannot see
  `RiderViewOpts.isPlayer`. Proxy used: the player is the only rider created without a rival tint
  (`opts.isPlayer ? undefined : ROSTER[...].accent`). A one-line `isPlayer` in the `CreateBike`
  options would be cleaner — `CreateBike` already accepts `player?: boolean`, the view just does not
  pass it yet.
