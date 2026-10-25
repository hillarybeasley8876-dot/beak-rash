# r4 job w2-events — random track events: fish truck spill, geese crossing, roadworks, market stalls (race unit)

Read SPEC.md §9 (race), §19 (track events — your spec) and §22. Contracts already in core (do not edit core):
event `race:event { kind, phase: 'warn' | 'start' | 'end', s, pos }`, `pickup:spawn` (combat puts coins / fish / crates
on the road — implemented), `npc:say`, ObstacleKind `truck | goose | barrier | stall | oil`. Race logic already calls
your module: `src/gameplay/race/events/index.ts` `createEventDirector(ctx, traffic)` with `preStep` / `postStep` /
`dispose` (a no-op scaffold for you to replace).

## Read first
`src/gameplay/race/logic.ts`, `src/gameplay/race/police.ts` + `police-view.ts` (how race code adds an Obstacle to
`session.obstacles` and its own toon meshes to the scene), `src/gameplay/race/traffic/` (vehicle meshes, how traffic
obstacles move), `src/sim/obstacles.ts` (solid obstacles: riders bounce off, or crash above 16 m/s relative for props /
8 m/s for vehicles; non-solid ones are ignored by the sim — YOUR code handles touching them), `src/render/toon.ts`
(toon materials + outlines), `src/core/contracts.ts` (PhysicsSystem.applyImpulse). Test: `tools/r4/w2-events.mjs`.

## Build it (one file per event under `src/gameplay/race/events/`)
- Director: seeded (session.rng fork) 1–2 events per race (level ≥ 1), at 25–80 % of the track, ≥ 600 m apart, never
  inside or within 20 m of a tunnel/bridge feature, never within 150 m of the finish; an event arms when the player is
  180–260 m before its spot: `race:event` phase 'warn' (the HUD banner and audio come later), then 'start' when it
  begins, 'end' when its props are gone. Stalls only on coast / city / watertown.
- Debug hook (required by the test): `window.__br.events = { list(): Array<{ kind, s }>, force(kind, s) }` — `force`
  arms that event at track position s now (warn → start as usual), whatever the schedule; remove it on dispose.
- 鱼车侧翻 fishSpill: a truck (your own toon truck mesh + a solid Obstacle 'truck' in the player's lane or the next one)
  brakes and tips onto its side over 0.6 s (animate the mesh), blocking that lane; behind it, 60 m across two lanes:
  `pickup:spawn` 18–26 coins + 3 fish, and 3 slick patches (non-solid Obstacle 'oil' — the sim already treats oil).
  Warn line `npc:say`-free: just the event. Props removed 25 s after the player passed.
- 大鹅过马路 geese: a column of 7 small toon geese (non-solid Obstacle 'goose', ~0.5 m) waddling across the road at
  1.2 m/s (about 6 s to cross), bobbing. A rider touching one (within 0.6 m): wobble 0.5 s (add a 'wobble' status
  like police.ts adds 'slow'), speed −20 % (`physics.applyImpulse` forward), a honk (`traffic:honk` with the goose id
  is fine), the goose flaps away (removed). Threading the flock untouched is fine — no event needed yet.
- 施工改道 roadworks: a 140 m zone: solid 'barrier' obstacles (≈2 m wide) close every lane but one, and the open lane
  switches side at the half (a chicane); cones lining it, a "前方施工 请绕行" sign and two capybara workers in hard
  hats waving (simple static toon props). Removed 20 s after the player passed.
- 水果摊 stalls: 3–4 market stalls (non-solid Obstacle 'stall') on one road edge, inside the drivable bounds; a rider
  running into one above 6 m/s smashes it: speed −15 % (applyImpulse), the stall goes inactive (debris pieces fly a
  little — simple tumbling boxes or fruit spheres, 1 s), `pickup:spawn` 2–4 coins and a crate 25 % of the time, and the
  owner shouts `npc:say { obstacleId: stall id, character: 'sloth', text: '我的西瓜！' }`.
- Meshes: toon + ink outline, instanced/merged where repeated (geese, cones, barriers), everything disposed on
  dispose(); ≤ 30 extra draw calls per event. No Math.random (session rng). Lines in `src/data/event-lines.ts` (new).

## Files you own
`src/gameplay/race/events/` (folder), `src/data/event-lines.ts` (new).

## Acceptance (the runner runs these; read `tools/r4/w2-events.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/race/events/ src/data/event-lines.ts` → TSC-OWN OK
- `node tools/r4/w2-events.mjs` → w2-events OK
- `node tools/race-soak.mjs --track coast` → SOAK OK
- `node tools/race-soak.mjs --track mountain` → SOAK OK
- `node tools/core-check.mjs` → core-check OK
