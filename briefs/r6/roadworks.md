# r6 job roadworks — the work zone looks solid and traffic respects it (race unit; SPEC §19)

The user: "道路施工 有各种穿模和mesh在闪 然后车会直接开进道路施工 不科学" — the roadworks event has clipping and
flickering meshes, and traffic drives straight into the work zone. Read SPEC.md §19, then
`src/gameplay/race/events/roadworks.ts`, `events/props.ts` (PropPool), `events/tuning.ts`, `events/index.ts`, and the
traffic manager `src/gameplay/race/traffic/index.ts` + `traffic/driver.ts` + `traffic/spawner.ts`.

Measured before r6 (`node tools/r6/roadworks.mjs --tracks coast`):
- Barriers are rigid 14 m slabs placed every 14 m, butted end to end: on any bend the boxes overlap and their
  coplanar tops / red-white faces z-fight (the flicker); 115 butted pairs on the coast.
- `PropPool` allocates 96 barrier and 24 cone instances but only sets the ones used: the rest keep the identity
  matrix and are drawn stacked at the world origin (23 stray instances) — more flicker, visible from some angles.
- The barrier and cone geometries have faces exactly at y = 0 (the base box / cone foot), flush with the asphalt.
- Traffic `surroundings()` only looks at other vehicles and riders: 816 vehicle-frames inside barriers in 50 s.

## Build it
1. Barriers as short pieces that follow the road: each row is made of pieces ≤ 4 m long, consecutive pieces leave a
   5–40 cm gap (the test fails on butted ends and on gaps > 80 cm), each piece posed with `trackPose` at its own
   centre (so it follows curves and slopes). Keep the chicane (the open lane swaps sides at the half), the obstacle
   boxes (solid, one per piece, matching the mesh), the cones, the sign and the capybara crew.
2. `PropPool`: draw only the slots in use (`mesh.count = used`, and the outline hull too) — fix it for every event
   that uses the pool (geese, stalls, fish spill share it).
3. Lift every prop's lowest face ≥ 2 cm above the road (base plate y-offset), no face flush with the asphalt.
4. Traffic respects solid obstacles: in `surroundings()` treat active solid obstacles that are not vehicles
   (barrier, stall, crate, the tipped fish truck…) as stopped leaders in the lane they overlap; in
   `maybeChangeLane()` a blocked vehicle merges into a free lane (the open lane of the work zone) — wait for a gap,
   blinkers on — and a vehicle that cannot merge stops behind the barrier (hazard lights) instead of entering it.
   Oncoming traffic does the same on its side. Never despawn a vehicle the player can see to dodge the problem
   (the test counts vehicles that vanish within 120 m of the player). At least one vehicle must drive through the
   zone in the open lane during the test's 50 s.
5. The AI riders already path around the zone — keep `tools/r4/w2-events.mjs` green (it checks the chicane gap
   widths and sides).

## Files you own
`src/gameplay/race/events/**`, `src/gameplay/race/traffic/**`.

## Acceptance (the runner runs these; read `tools/r6/roadworks.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/race/events/ src/gameplay/race/traffic/` → TSC-OWN OK
- `node tools/r6/roadworks.mjs` → r6-roadworks OK
- `node tools/r4/w2-events.mjs` → w2-events OK
- `node tools/race-check.mjs` → "errors": 0
- `node tools/core-check.mjs` → core-check OK
Look at your work: screenshots of the work zone on a bend (coast) and on the mountain, from the chase camera and from
above (`__br.race.spectate('aerial')`), under `shots/r6-roadworks/`.
