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
- 00:10 desktop: tools/package-desktop.sh builds desktop/build/暴力鹈鹕.app (Electron 44 from npmmirror, app:// protocol).
  NOTE: VS Code's env has ELECTRON_RUN_AS_NODE=1 — launch with `env -u ELECTRON_RUN_AS_NODE`; Finder launches are fine.
  Smoke: BR_DEBUG_PORT=9471 + chromium.connectOverCDP (port 9333 belongs to another app — never use it).
  Preview v0.1 (commit 0b2dd79 snapshot) installed at ~/Desktop/暴力鹈鹕-预览版.app.

## Requests from core to units (fixers: grep your unit name here)
- sim: multiply the effective top speed by `rider.rubber` (race-owned factor, default 1; see types.ts).
- sim (camera): hero framing — the pelican spans only ~21 % of screen height at speed and less while
  boosting (feel critic r1). Bring the chase cam closer/lower at speed and cap the boost FOV kick so the
  rider stays ≥ 26 % of the screen height; keep the bike centre-low (the HUD covers both bottom corners).
- ui-screens / ui-hud: every cut-in, stamp, count-up and pause open/close should call `app.audio.sfx(...)`
  (`ui.cutin`, `ui.stamp`, `ui.coin`, `ui.move`, `ui.confirm`, `ui.back`) — audio critic: the UI is silent.
- ui-hud: the player portrait panel showed an empty orange/red frame in the production build at race start
  (shots/core/prev-race.png): make sure the portrait image is preloaded/decoded before the race HUD shows,
  with the vector fallback until it is ready.
- track (wave 2 note): coast's tightest curve is R 150 m, so nothing calls for a drift. When the track unit
  next touches layouts, add 2–3 tight corners (R 35–70 m) incl. one near-hairpin and an S-chicane.
- 11:20 (10-18) core: unit factories are wrapped by src/core/guard.ts (guard/guardAsync) — a factory that
  throws logs `[modules] unit "<name>" threw …` and the game continues on that unit's stub.
  Regressions: `node tools/test-core-guard.mjs` (unit), `node tools/core-check.mjs` (browser: broken
  AudioContext still boots + races; normal race has no console errors).
- 11:20 species unit now owns all of src/actors/** except bikes (actors maker done; its critics never ran).
- 11:40 (10-18) applied: `CombatSystem.frame?(dtReal)` (session calls it once per rendered frame after the
  rider views); `CameraRig.chasePose?(outPos, outQuat): fov` (optional); `RiderState.weaponUses` (Infinity
  for 'none'; combat owns it); SPEC §6 camera numbers updated per sim's proposal (4.3→5.1 m, FOV 60→70,
  counter-dollied boost kick, hero ≥ 24 % of screen height).

## Requests from core to units, round 2 (fixers: grep your unit name here)
- combat: write `rider.weaponUses` whenever a weapon is picked/stolen/used/broken (Infinity for 'none').
- ui-hud: read `rider.weaponUses` for the weapon slot (fixes "full uses after stealing a worn weapon");
  also add the 成就解锁 chip on `achievement:unlock` (content request 3).
- sim: implement `CameraRig.chasePose` if cheap; apply the new SPEC §6 camera numbers; sim may read track
  frames up to `length + runoff` (track implements runoff = 250 m) instead of extrapolating past the finish.
- race: core keeps rivals on their signature bikes (character identity, matches the portraits). Derive the
  rival pace from a per-level baseline (e.g. BIKES.roadbike.topSpeed × level factor), never from the
  player's current bike, so buying a faster bike is a real upgrade. Corgi toasts may use content's POLICE_LINES.
- env-city / env-mountain: use content's TRACK_BILLBOARDS / TRACK_SIGNS (src/data/strings.ts or memes.ts)
  for neon signs / billboards / road signs.
- audio: regenerate barks for content's new roster lines with tools/gen-tts.mjs when convenient.

## Open for the whole-game acceptance pass (integrator, 10-19)
- race (r3 limit reached, critic 7/10): predictable podium: when the player doesn't win, the pigeon or the penguin wins almost every race. Needs per-rival pace variety / rubber-banding spread across the field.
- sim (r3 limit reached; feel 7/10, camera 8/10 pass): fix r3 addressed but unverified: releasing an L3 drift mid-corner flings the bike outward (nose ~60° past the tangent, runs 4–12 m wide); rider-rider side bumps snap the heading 20–25° in one frame and repeat every 0.4 s while pressing.
- ui-hud (r2 limit reached; art 7, correctness 7): fix r2 addressed but unverified: name tags + taunt bubbles stack into a column over the road in packs; the progress strip shows all 7 rivals as one badge; the player quip bubble covers rival taunts docked on the right edge.
- fx (r2 limit reached; art 7, timing 7): fix r2 addressed but unverified: KO hold renders orange/tan victims (cat, shiba, corgi) as flat red-orange silhouettes on the red rays; KO framing crops the victim's head at the top letterbox; SHOWTIME impact victims are small specks in a cluttered clump, and the letterbox pops off at impact; a KO credited during the SHOWTIME rise aborts the rise and plays an unrelated KO cinematic.
- ui-screens (r2 limit reached; art 8.2 pass, interaction 7.5): fix r2 addressed but unverified: results still get dismissed by finish-line input (hop rhythm on Space/A fires 下一站; mashing pad B bails to the menu).
- track (r2 limit; art 7, tech 8 pass): fix r2 addressed but unverified: shadow acne shimmers on the limestone cutting/cliff faces at default quality (s 1260-1320, 1890-1930, 2088-2120).
- env-city (r2 limit; art 7, tech 7): fix r2 addressed but unverified: the wet-road overlay is depth-occluded at grade changes (hard seams, the reflection pops off ~2 s at the underpass); trees and the roundabout statue sit in the unlit, outline-less glow batch (flat faceted blobs); neon arcade right-side shophouse fronts render as a flat black wall from the right lane (s≈850-1060).
- env-mountain (r2 limit; art 6, tech 8 pass): fix r2 addressed but unverified: rock faces read as flat plywood (planar walls, plank strata, pinstriped slopes); the waterfall looks like a flat blue camouflage card from the bridge; the three hairpins look identical at speed and the roadside is sparse.
- species (r2 limit; art 7, anim 6.5): fix r2 addressed but unverified: the hero pelican shows neither beak nor pouch from the chase cam at rest; signature skill poses last ~0.3 s in the real game (8 of 12 crushed).
