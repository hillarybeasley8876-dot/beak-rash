# r6 roadworks (race unit) — status

## Plan (round 1 — done)
1. `events/props.ts`: PropPool.commit() sets `mesh.count = used` and `hull.count = used` (no unused slot
   drawn at the origin).
2. `events/tuning.ts` + `events/roadworks.ts`: the wall is short pieces on one global s-grid (piece 4.0 m,
   gap 0.15 m, pitch 4.15 m), each piece posed with trackPose at its own centre, one solid obstacle per
   piece, the open lane still swaps sides at the half. Every prop lifted 2 cm above the road.
3. `traffic/blocks.ts` (new): the solid obstacles that are not traffic and the free lateral band at any s.
4. `traffic/driver.ts`: a lateral target with a rate-limited move; blinkers while merging.
5. `traffic/index.ts`: the static obstacles are stopped leaders; a blocked vehicle merges into the open
   band; a vehicle is only removed behind the player.
6. Full acceptance + screenshots under `shots/r6-roadworks/`.

## Round 2 (the lead rewrote tools/r6/roadworks.mjs: the player RIDES to 600 m, a zone is planned 700 m
## further on and built at the game's own start distance, then the traffic runs 50 s around it)
Findings (probes: shots/r6-r6-roadworks/probe-round2.mjs, probe-fog.mjs, probe-traffic-setup.mjs):
- coast FAIL "35 vehicle-frames inside": the cars that already stand in the zone's stretch when the wall
  goes up are in a closed lane → the wall goes up on top of them.
- coast FAIL "0 vehicles through": the traffic around the zone is frozen. The population sits at its target,
  nothing is despawned in 50 s, and no new car spawns: `fogStart` needs a point `far` (750 m on the coast)
  ahead that is 750 m away in a straight line; on a curve it never gets there within FOG_PUSH = 60 m and
  returns null → no spawns → the oncoming traffic (the only cars that can cross the zone) never comes.
Fix (all in):
1. The event director tells the traffic manager the planned zone when the event arms ('warn', 260 m ahead):
   `traffic.planZone(id, pieces)` puts the wall's pieces in the traffic's road list as a ghost, so the cars
   merge into the open lane long before the barriers go up → nobody is in a closed lane when they appear.
   `traffic.dropZone(id)` takes the ghost away when the zone is over.
2. The roadworks leaves out the pieces a car is standing on and the ones on its way out of the zone, and puts
   them up once the car has left (never a dead end): `traffic.carsIn(s0, s1)` tells the event what is on the
   road and which way it goes.
3. The traffic's fog search gets a tolerance (0.85 of the fog distance) so the cars keep coming on a curvy
   road (on the coast the traffic froze, on the mountain it did not).
4. The event's spot is now the middle of the work zone (`lead` 140 → 70): the traffic is seen merging into
   the open lane over a 120 m approach instead of 50 m, and the zone's middle is where the rider meets it.

## Done
- PropPool draws only the slots in use (barriers, cones, geese, fruit, slicks) — no stacked copies at the
  world origin any more. `PropPool.reset()` added; the stalls' fruit pool starts over every frame (it used
  to freeze in the air after 0.3 s).
- The work zone is a wall of 4.0 m pieces with a 15 cm gap, on one s-grid: no butted ends, no overlaps, no
  flush faces (the lowest face is 2 cm above the asphalt), every piece square on the road (max tilt 0.0°).
  108–190 pieces per zone (one instanced draw call + its ink hull). The sign stands in front of the zone on
  the driver's side, the crew waves from the verge behind the wall.
- The traffic respects the wall: it merges into the open band (the lane that slides from the right side of
  the road to the left one), waits for a gap with the blinkers on, and stops with the hazard lights if it
  cannot merge. Oncoming traffic does the same on its side of the band, so the two ways never meet head on.
- The traffic knows about the work zone before the wall goes up (the ghost) and the pieces a car is standing
  on are put up behind it once it has left the zone.
- The traffic keeps coming on a winding road (the fog search tolerance): before, the cars stopped spawning
  on a curve and the road ahead went empty.
- The AI riders ride through the zone (autopilot probe: the player crosses the barriers at 20+ m/s, no crash).

## In progress / next
- nothing left in this job.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/race/events/ src/gameplay/race/traffic/` → TSC-OWN OK
- `node tools/r6/roadworks.mjs` → r6-roadworks OK (coast, mountain, city)
- `node tools/r4/w2-events.mjs` → w2-events OK
- `node tools/race-check.mjs` → "errors": 0
- `node tools/core-check.mjs` → core-check OK
- probes: `node shots/r6-r6-roadworks/probe-round2.mjs [track]`, `probe-fog.mjs`, `probe-traffic-setup.mjs`
- screenshots: `node shots/r6-r6-roadworks/shoot.mjs` → `shots/r6-roadworks/*.png`

## Evidence (key output lines)
- r6-roadworks, the lead's new test, all three tracks: "the game builds it ({"spot":1300,"at":1101,
  "zone0":1230,"vanished":0})", "no vehicle in front of the player vanishes when the zone goes up (0)",
  "no vehicle ever overlaps a barrier (0 vehicle-frames inside)", "no vehicle near the zone just disappears
  (0)", "traffic merges into the open lane and drives through the zone (2 vehicles through)" → r6-roadworks OK
- w2-events: "roadworks: one open lane, switching sides halfway ({"first":{"w":5.82,"mid":2.38},
  "second":{"w":5.82,"mid":-2.42},"n":224})" → w2-events OK
- race-check: "errors": 0, "raceErrors": []; core-check OK; TSC-OWN OK; `npx tsc --noEmit` 0 errors.
- probe-round2 (coast, the lead's scenario): {"inside":0,"seen":5,"stopped":5,"vanished":0,"through":2}.
- probe-traffic-setup (coast, at the watch spot): level 1, fogFar 1000 → far 750, the target is 12 cars, the
  population is 10 — and with the fog tolerance it keeps turning over (new cars 1017/1018/1019-/1020+).
- probe-fog (coast): the straight-line distance is 679 m at 750 m along the track and 735 m at 810 m → before
  the tolerance `fogStart` returned null (no spawns at all) on the curve.
- screenshots (shots/r6-roadworks/): the coast and the mountain, chase and aerial, the traffic in the zone.

## Known issues
- Pre-existing (not from this job): in `tools/race-check.mjs` the player stands still on the start grid, so
  the oncoming traffic drives over it and it ends the run "crashed" (the same happens with the old despawn
  rule — checked by reverting it, so it is not a regression of this job).
- The work zone is one lane for the whole road, so the oncoming traffic uses the player's side of the road
  inside the zone (a contraflow work zone). The two directions keep ~2 m between them.
- The lead's three round-1 fixes are kept: the original despawn rule, the concrete grey barrier caps
  (#b9bcc4) and the line break before `createRoadworks`.

## Requests
- none
