# r4 job w3-llm-polish — make the 大模型限定款 look wrong at a glance (actors / bikes)

Read SPEC.md §21 #2 (the LLM bike: "LLM drew this bike"), §5 (art: toon + ink outline, readable silhouettes) and
`src/actors/bikes/defs/llm.ts` + `llm-chain.ts` (today: chain to the neck, saddle on the handlebar, one loose pedal,
seven wild spokes). It is too subtle: from the race camera (behind and above the rider) it reads as a normal roadbike
(2 % of the bike region differs), in the garage only a little more. The joke has to land in one glance — think of
the famous "SVG of a pelican riding a bicycle" drawings: impossible frames, wheels that do not match, parts floating.

## Build it (keep it a bike that rides: the rider's hands / feet / seat still fit — `standardRig` geometry)
1. Wheels that do not match: the front clearly bigger than the rear (≈ 1.3×, still touching the ground — the physics
   radius stays the def's `wheelRadius`, only the drawn wheel changes), rims in two loud colours, the seven spokes thick
   and bright, some poking out past the rim.
2. Readable from BEHIND: things that stick out sideways — handlebars mounted backwards and much too wide, two loose
   pedals orbiting slowly beside the frame (one each side, bigger than now), the chain to the neck thick, bright and
   slack (a sagging loop that sways), a small third wheel bolted to the top tube spinning in the air.
3. The frame: one more tube than a bike has (a second top tube crossing diagonally) and the down tube stopping short
   of the bottom bracket.
4. Garage: the turntable shows all of it (it renders the same model); the bike card's blurb stays.
5. Budget: the LLM bike stays within the bike triangle budget (`sandbox/bikes.tris.mjs`) and its LODs; animated parts
   (orbiting pedals, the third wheel, the chain sway) use the bike's existing animation hooks (`b.period`, the wheel /
   crank spin in `animate.ts`) — no per-frame allocation.

## Files you own
`src/actors/bikes/defs/llm.ts`, `src/actors/bikes/defs/llm-chain.ts`, `src/actors/bikes/defs/llm/` (new folder for
any new llm part files), `src/actors/bikes/animate.ts`, `src/actors/rig/bar-fit.ts`, `sandbox/bikes.shots.mjs`.

## Acceptance (the runner runs these; read `tools/r4/w3-llm-polish.mjs` first)
- `node tools/r4/tsc-own.mjs src/actors/` → TSC-OWN OK
- `node tools/r4/w3-llm-polish.mjs` → w3-llm-polish OK (race camera ≥ 10 % of the bike region differs from the
  roadbike, garage ≥ 28 %)
- `node tools/r4/w1-llm.mjs` → w1-llm OK
- `node sandbox/bikes.tris.mjs` → exit 0
- `node tools/core-check.mjs` → core-check OK
Look at your work: side / three-quarter / chase / garage shots of the llm bike next to the roadbike under
`shots/r4-w3-llm-polish/`.
