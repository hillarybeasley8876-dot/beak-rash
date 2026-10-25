# r4 job w3-style-events — STYLE for the police roadblock, the goose flock and the fruit stalls (gameplay/style)

Read SPEC.md §17 (STYLE chains: the action list) and §14 / §19 (the roadblock, the track events), then
`src/gameplay/style/` (index.ts = the bus listeners + `update(dtSim)`, actions.ts, chain.ts, tuning.ts). Three
actions of §17 are still missing: **roadblock gap threaded 150**, **goose flock threaded 120**, **fruit stall
smashed 100**. The events already exist (`src/core/events-map.ts`):
- `police:roadblock { riderId, s, gapX, gapWidth, pos }` (race unit) — the barrier row stands at `s` with one open
  gap of `gapWidth` m centred on `gapX`.
- `race:event { kind: 'geese', phase: 'start', s, pos }` (race events) — a flock waddles across around `s`; a rider
  that touches a goose makes it honk: `traffic:honk { obstacleId }` where the obstacle (in `session.obstacles`) has
  kind 'goose'.
- a smashed stall: its owner shouts `npc:say { obstacleId, character: 'sloth', text }` where the obstacle has kind
  'stall' (the event does not say who smashed it).

## Build it (player only, like every STYLE action)
1. `roadblock` (label 冲卡, 150): remember each roadblock; when the player crosses its `s` racing (not crashed) with
   `|x − gapX| ≤ gapWidth / 2` → score it once.
2. `geese` (label 鹅群穿行, 120): remember each flock spot; when the player has ridden 40 m past it and no goose
   honked at the player in between (a `traffic:honk` from a 'goose' obstacle within 6 m of the player) → score it
   once.
3. `stall` (label 砸摊, 100): an `npc:say` from a 'stall' obstacle within 8 m of the player → score it once per stall.
4. Labels and points in tuning.ts like the others; forget the remembered spots on detach / race end.

## Files you own
`src/gameplay/style/` (folder).

## Acceptance (the runner runs these; read `tools/r4/w3-style-events.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/style/` → TSC-OWN OK
- `node tools/r4/w3-style-events.mjs` → w3-style-events OK
- `node tools/r4/w1-style.mjs` → w1-style OK
- `node tools/core-check.mjs` → core-check OK
