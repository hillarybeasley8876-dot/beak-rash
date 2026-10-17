# Unit: race (gameplay/race/) — wave 1
Read SPEC.md first (§0–2, §9 is your spec, §7 for what AI can do). You own `src/gameplay/race/**`,
`sandbox/race.*`. Contract: `createRaceLogic(session)` (preStep: AI controls + traffic + police;
postStep: standings, finish, results).

## Deliverables
1. Race flow: intro flyover via `app.rig.override` (~3 s orbit/dolly over the grid, then hand back),
   countdown events, launch boost for throttle held on GO, phase changes, finish detection, results,
   DNF timer, `race:end` once. Re-grid riders if you like (front rows = higher level rivals).
2. AI drivers (`race/ai/`): per-rider brain with personality from roster stats/species (aggression,
   skill timing, line preference) + level scaling; racing line through curves (look-ahead curvature),
   speed control, drafting, overtaking around riders/traffic, obstacle & wall avoidance, drift on
   tight bends, hop puddles/oil when possible, attack riders alongside (side select), heavy when
   armed, use signature skill (controls.skill1) when useful (honk when someone ahead, ghost when
   behind, chill when crowded…), react to 'angry' (hunt the player), taunt events (roster lines),
   gentle rubber band. Autopilot: when `config.autopilot`, the player uses the same brain.
3. Traffic (`race/traffic/`): spawn/despawn around the player (ahead 40–400 m, behind 60 m), lanes
   (same direction + oncoming), lane changes with blinkers, braking for obstacles, honks; toon vehicles
   with outlines (compact car, van, pickup, truck, bus, a fish delivery truck "鹈鹕海鲜" , ice-cream van);
   wheels spin; instanced where sensible; written into `session.obstacles` each step.
4. Police (`race/police.ts`): heat model, Corgi officer bike (use `app.modules.createRiderView(app,
   'corgi','mtb',…)` and drive it with your own simple chase physics in track space or as an extra
   obstacle), siren light, whistle, BUSTED rules per SPEC, events police:alert/busted.
5. Results & rewards (coins per SPEC; save stats via `app.save.update` at race end).
6. `tools/race-soak.mjs`: run full races with `autopilot=1` at high speed (manual steps) for 3 seeds:
   asserts race ends, no rider stuck (speed < 2 m/s for > 5 s while racing), positions sane, traffic
   never spawns inside riders, police can bust, no errors. Prints a summary.

## Quality bar (gameplay critic)
AI looks like competent, distinct racers (not trains on rails): they jostle, overtake, fight, crash
sometimes, recover. Races are close and exciting; traffic is a hazard but fair; police chases are funny.
