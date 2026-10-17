# Core (main session) — applied core requests
- 16:55 `src/render/toon.ts outline()`: now offsets along `normal` (always declared) instead of
  `objectNormal` (MeshBasicMaterial declares it only with skinning/envmap). Verified on plain meshes
  (`/sandbox/core-toon.html`). Units may switch back to the shared helper.
- 17:35 audio request: `AudioSystem.attach?(session | null)` added to core/contracts.ts (optional);
  game.ts calls it on race start (after ui.attach) and on session end.
- 17:58 actors: fixed `src/actors/bikes/stub.ts` (read-only position via Object.assign) — stub bike works.
- 17:58 race: `rider:boost.kind` += 'launch'; `race:intro.duration?`; `police:alert.reason?`
  ('spawn'|'lost'|'busted'); `outlineMaterial(color, width)` exported from render/toon.ts.
- 18:09 combat: added `combat:weaponBreak {riderId, weapon, pos}` and `combat:bell {riderId, pos, angered}`
  to events-map (combat may emit them now; audio/HUD/fx can listen).
- 19:20 track: `Track.runoff?` (m of drivable road past the finish); frameAt/toWorld/project/bounds valid
  on [0, length + runoff] — track may stop clamping at `length`; sim may let finished riders roll on.
- 19:20 ui-hud: added `projectile:spawn {id, owner, target, kind, pos}` and `projectile:end {id, hit, pos}`
  to events-map (combat may emit; HUD warns precisely when present).
- 19:58 added `achievement:unlock {id}` to events-map; launched the content unit (briefs/content.md).
  TODO core: instantiate `createAchievements(app)` from src/gameplay/achievements.ts in game.ts once it exists.
- 20:08 race: `RiderState.rubber` (race-owned top-speed factor, default 1) added in types.ts + rider.ts.
  TODO integration: sim must multiply top speed by `rider.rubber` (not yet wired in sim/forces).
- 20:40 bikes: `BikeMarkers.bell?: Object3D` added to actors/bikes/types.ts (BikeMarkersEx no longer needed).

## Integration TODO (main session, after wave 1)
- Track design: coast min radius is 150 m → no corner needs a drift (feel critic r1). Wave 2 must add
  2–3 tight corners (R 35–70 m), one hairpin-ish bend, and an S-chicane per track; re-run feel tour.
- sim must multiply top speed by `rider.rubber` (race-owned) — check after sim fix rounds.
- Instantiate `createAchievements(app)` in game.ts once content ships it.
- UI cut-ins should call audio sfx ('ui.cutin' etc.) — audio critic says UI never triggers them.
- Hero framing: pelican spans ~21 % of screen height at speed (feel critic) — consider closer chase
  distance / lower FOV kick on boost; P5 HUD covers bottom corners so keep the bike centre-low.
- 21:55 ui-screens: game.ts endSession() now resets audio muffle (quit/restart from pause); Input.press()
  isolates listener exceptions (console.error, other listeners still run).
- 22:25 content: achievements wired — modules.ts loads `gameplay/achievements` (stub fallback
  `gameplay/achievements-stub.ts`); game.ts creates it once, `attach(session)` after audio.attach on race
  start and `attach(null)` before session.dispose().
