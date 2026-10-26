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

## Integration 10-19
Applied (all additive / optional; every importer still typechecks):
- audio (t6): events-map `police:whistle {riderId, pos}` + `police:knock {riderId, weapon, pos}` (a player swing knocks
  the corgi back). race/police.ts still calls app.audio.sfx → race: emit these instead (audio places / rate-limits them).
- race 6: `npc:say {obstacleId, character, text}`: a line from a non-session speaker riding an Obstacle (corgi = id 900);
  listeners follow session.obstacles by id and drop it when gone. race: emit it instead of ui.toast; ui-hud: bubble it.
- ui-hud 3/4: `race:introFocus {riderId | null}` and `police:busted.hold?` (s). race: emit / fill them.
- combat + sim: `RiderMods.pushImmune: boolean` (defaultMods false). combat's applyMods does not reset it yet, so combat
  must set AND reset it; sim: no speed loss for a pushImmune rider in contacts; combat: then drop wing.ts's contact copy.
- species: `RiderViewOpts {isPlayer, quality, track?}` exported from contracts.ts; Modules.createRiderView takes it and
  session passes `track` (absent in menus / sandboxes). actors stub uses the type.
Deferred:
- track T9 shader precompile: measured (shots/core/i1019/probe-warm.mjs, probe-keys.mjs; coast seed 3): a culling-off
  warm-up render through fx compiles 0 extra programs (57 → 57, 5 ms): every rider/bike program is already compiled on
  the grid. The 8 programs compiled mid-race (~36 s) are lazily created variants: actors/fade.ts clones
  (`actors-rider|fade`, `|fade-depth`, `bikes-body|fade`, `bikes-hull|fade-hull`), fx.particles.solid/add and 2 unnamed
  ShaderMaterials. Owners must pre-warm them (species: build the fade variants at view creation; fx: warm particle
  programs on attach). Note: compileAsync with the null target compiles the wrong keys (fx renders into a HalfFloat RT).
- bikes: stepped cool rim in toon(): obsolete for riders (actors/kit/material.ts has its own rim); putting it in toon()
  would restyle every world prop and traffic mesh, which no art critic asked for.
- sim: SPEC §6 wording + rider contact distance 0.75 → 0.9 m: SPEC.md is outside this agent's edit scope, and the contact
  distance is one decision for sim + combat (wing.ts CONTACT.dx) + species together → main session.
- combat: optional stacked boost API in sim: needs a sim design; combat's mods.speedMul workaround works.
- env-mountain tech#7 per-track env hook: LayoutDef lives in src/world (track-owned) and Track.look already carries the
  EnvLook, so no core contract is needed. env-city's / env-mountain's other "core requests" are addressed to track.
- Older core TODOs: rubber (sim forces.ts), achievements (game.ts), UI sfx (hud/sfx.ts) are done. The acceptance-pass
  list above is unit-owned (no core files) and stays open.
Verification: tsc 0 errors (whole project) · test-core-guard OK · core-check 5/5 PASS · full autopilot races (seed 3,
no stubs, 0 console errors, results screen reached): coast 11400 frames, city 12600, mountain 12000
(shots/core/i1019/race3.mjs; sheet.jpg = mid-race on all 3 tracks; coast-end.jpg = results).
- audio (r3 limit; music 6, tech 7): fix r3 addressed but unverified: tonal balance is lead-dominated (honky ~1 kHz, bright top, thin low end) in every song; the audio thread is still over the 5 % CPU budget (music alone 4.2–6.6 %).
- bikes (r2 limit; art 7): fix r2 addressed but unverified: the tandem's salted-fish passenger reads as a grey plank from the chase camera and covers the hero's back.

## Acceptance round 1 (core fixer, 10-19)
Core-owned issues (reviews/game-r1-*.json): perf#2 save/URL validation (major) · interaction#0 d-pad steer (major) ·
perf#0 race-start shader freeze (major) · interaction#9 Tab/right-click (minor) · perf#6 Retina/MSAA backbuffer (minor) ·
interaction#13 quit/desktop menu (minor).
Plan: perf#2 → interaction#0 → perf#0 → interaction#9 → perf#6 → interaction#13. Checkpoints below.
- [done] perf#2 save/URL validation: new src/core/save-sanitize.ts (pure; field-by-field: quality/slowmo enums, bikes must
  exist in BIKES — unknown equipped bike → roadbike, equipped bike always owned, numbers finite + clamped, booleans,
  career best places 1..99, unique string achievements; one `[save] repaired invalid fields: …` warning). SaveStore.load
  uses it. New src/core/race-config.ts (buildRaceConfig moved out of game.ts): track/bike/rival/rival-bike ids validated
  against TRACKS/BIKES/ROSTER (warn + default), finite seed/level (level 1..10). game.ts validates ?quality, main.ts ?race
  and ?screen (contracts.ts now exports the runtime list SCREEN_IDS; ScreenId = its element type, same union).
  Test: node tools/test-core-save.mjs (new). Browser: shots/accept/r1-perf/badsave.mjs → all 3 bad saves reach the race,
  0 errors, 0 stubs; badparams.mjs → quality=ultra races on 'high', race=nowhere races coast, corrupt save repaired.
- [done] interaction#0 d-pad steer: input.ts digitalSteer() merges arrows/A-D with the pad d-pad (PADMAP 14/15) and ramps
  with the same STEER_RISE/FALL incl. instant reversal; the stick still wins when deflected. core-check case 3 (fake
  stickless pad, RT pedals): d-pad right steer 1.00 / dx +6.4 m, left −1.00 / −6.5 m (was 0 / 0.00).
- [done] perf#0 race-start shader freeze: new src/core/warmup.ts + game.ts warmUp() between the attaches and
  show('race'), sim time frozen (clock layer 'warmup') and frame rendering paused while compiling:
  1. compileScene(): renderer.compileAsync per light-free subtree (no double-counted lights), with a 1×1 HalfFloat RT bound
     so keys match fx's off-screen scene target (null target when fx is stubbed); 12 ms slices, a frame yielded between;
     hidden (LOD/fog-culled/pooled) objects included. Loading bar gets flow:loading 0.92 → 0.97 '鹈鹕热身 WARM-UP'.
  2. drawEverything(): one hidden frame with visible + frustumCulled forced for the call (restored after): shadow-depth
     programs, texture + geometry uploads (loading screen is opaque — checked shots/core/a1/loading-cover.jpg).
  3. restart handover: detachSession() stops the old race's systems (RaceSession.stopSystems(): logic/combat/physics) and
     takes its world out of the scene; its track + views are disposed only after the new race compiled, so shared
     programs survive. renderer.debug.checkShaderErrors = import.meta.env.DEV.
  Measured (shots/core/a1/warm-probe.mjs, 1920×1080 high; before = shots/core/a1/cold-start-before.json): programs compiled
  in the race screen cold 50–73 → 13, restart 25–45 → 12; worst intro frame cold coast 460 → ~110–250 ms, city 1300+1133 →
  ~110–230 ms, restart city 915+442 → ~90–220 ms (machine shared with other agents, noisy). The 12–13 left are species'
  lazily created fade variants (`|fade`, `|fade-depth`, `|fade-hull`; shots/core/a1/race-progs.mjs) → species request.
  Restart warm-up: 6 new programs (combat/traffic visuals), track + rider programs reused. 0 console errors.
- [done] interaction#9 Tab / right-click: input.ts attach() now prevents Tab (focus stays in the game), prevents the
  context menu and maps right-click and the mouse back button (MouseEvent.button 3; forward 4 is only prevented) to the
  'back' action, which every menu screen already handles (race view ignores 'back'). Verified
  (shots/core/a1/input-mouse.mjs): Tab defaultPrevented, focus BODY; right-click settings → menu; mouse-back howto → menu.
- [done] perf#6 Retina / MSAA backbuffer: canvas antialias off (fx renders into its own multisampled target; kept only
  when fx runs on its stub); drawing buffer capped by a pixel budget per quality (high ≈ 2560×1440, medium/low ≈
  1920×1080; dpr caps 2/1.5/1 kept; floor 0.5), recomputed on resize (game.ts renderDpr). Verified
  (shots/core/a1/dpr-probe.mjs): 1280×720@1 → 1280×720 (unchanged); 1920×1080@2 → 2560×1440 (was 3840×2160);
  1512×982@2 → 2382×1547 (was 3024×1964); antialias false; 0 errors; shots/core/a1/dpr2-sheet.jpg looks clean.
  Not done: dynamic-resolution governor (needs hysteresis + fx target re-allocation; the static budget removes the 4K
  worst case) and half-res bloom (fx-owned) → fx request.
- [partial] interaction#13 quit / macOS app menu: core side done — `AppContext.quit?()` (contracts.ts) is set only when the
  game runs in the desktop shell (location.protocol 'app:') and calls window.close(); verified with a throwaway Electron 44
  app (sandbox + contextIsolation, app:// page): window.close() closes the window → window-all-closed → app.quit().
  The menu entry (ui-screens) and the macOS app menu (desktop/main.cjs, outside this fixer's files) → Requests below.
Requests (acceptance round 1, from the core fixer):
- species (perf#1): after core's warm-up the only programs still compiled in the race are your lazily created fade variants
  (`|fade`, `|fade-depth`, `|fade-hull`: 12–13 programs, one 100–250 ms frame when the intro camera first nears a rider;
  shots/core/a1/race-progs.mjs). Create the variant materials at view creation and keep them reachable from view.root
  (e.g. hidden proxy meshes of the same kind — SkinnedMesh for skinned parts): core's warm-up (src/core/warmup.ts)
  compiles every material in the scene graph, hidden objects included, with fx's render-target keys, behind the loading screen.
- ui-screens (interaction#13): show 退出游戏 QUIT (with your confirm) in the main menu only when `app.quit` is set; call it.
  Loading bar: core now emits flow:loading 0.92 → 0.97 '鹈鹕热身 WARM-UP' while it compiles; the final hidden frame is one
  60–400 ms task (a CSS-driven runner, perf#8, would keep moving through it).
- main session / desktop shell (desktop/main.cjs is outside this fixer's files): on macOS replace
  Menu.setApplicationMenu(null) with a minimal menu ({role:'appMenu'}, {role:'editMenu'}, {role:'windowMenu'}) so Cmd+Q/H/M
  work; repackage so app.quit appears in the desktop build.
- sim: physics.dispose() sets `__br.sim.riders = noRows` unconditionally; guard it by identity (`if (dbg.riders === rows)`).
  Core now stops the old race's systems before it builds the next race, so restarts keep the live rows anyway.
- fx: perf#3 (particle programs compiling in the GO frame) is covered by core's warm-up (fx.particles.solid/add compile on
  the loading screen; 0 compiles at GO in a 14 s probe). perf#6 leftovers: bloom from a half-res copy (fx-owned).
Verification (round 1 end): tsc 0 errors (whole project) · test-core-guard OK · test-core-save OK (new) · core-check 8/8 PASS
(new d-pad case) · full autopilot coast race to results, 0 errors (shots/core/a1/race-full.mjs) · handover coast → city →
quit → city: one world in the scene, old track freed, 0 errors (flow-probe.mjs) · ?stub=all / ?stub=fx start + restart OK
(stub-probe.mjs) · `__br.sim.riders()` keeps live rows after an in-page restart (sim-rows.mjs).

## r4 (2026-10-26) — Police 2.0, Weapons 2.0, tricks + STYLE, rivals, track events, maps, easter eggs
Lead = this session (design SPEC §14–§22, core contracts, acceptance tests `tools/r4/*.mjs` self-tested on the old
code first, review + fixes, commits). Every unit change was built by a MiniMax-M3.1 worker (lead runner outside the
repo; one brief per job in `briefs/r4/`, checkpoints in `status/r4/`), one job per set of owned files, up to ~10 in
parallel on the shared tree.
- core: TrackId watertown/gobi + TRACK_ORDER of five; `TRACK_WEATHER` (own weather first: watertown drizzles);
  RaceConfig weather / reverse / route / nemesis; per-session modules style + secrets; SaveData rivalry / secrets /
  unlocks / duckRider / stats; the r4 events (events-map.ts).
- wave 1: combat throw, sim tricks, actors poses, style, llm bike + Konami, watertown, gobi, weather variants.
- wave 2: combat traits, police 2.0, rivals (grudges / nemesis / alliances / AI throws + tricks), track events,
  easter eggs.
- wave 3: reverse tracks, HUD, fx (+ rain / snow), audio (r4 sfx, two race songs, weather beds, 82 voice lines),
  screens (race options, 3 × 5 career, race report, 彩蛋 n/9), achievements (+26), seeded routes.
- polish: LLM bike exaggerated, water town / gobi look, sea + clouds per weather, STYLE for roadblock / geese / stalls.
- Lead fixes in review (tests were wrong as often as the code): pan-parry/chill-throw bypass removed, slipper homes on the
  nearest rider, bonus SP capped at the bar, alliance only for a runaway leader, nemesis card once, fx trick trail on
  events (no property watcher), line endings (python writes on Windows turn LF into CRLF — normalise before commit).
Residual: `features/bridge.ts` red arch is removed at runtime by the water town (make the arch style per track);
SHOWTIME now fires about twice a race (more fighting + the STYLE / trick bonus, budget 40 SP per race) — the soak
accepts it; the records sheet lists 71 achievements in dense one-line cells.

## r5 (2026-10-26) — air, teaching, hitches, water-town paving, records, web
Same workflow as r4 (lead tests in `tools/r5/`, briefs in `briefs/r5/`, checkpoints in `status/r5/`).
- air: a shared kicker / jump-hill catalogue (`world/layouts/jumps.ts`), 6+ jumps per track, 2+ big ones (≥ 1.3 s);
  mega: one landmark mega jump per track (≥ 1.9 s, three chained spins land clean) with its own set dressing.
- teach: HOW TO 「新玩法」 tab, 18 r4 loading tips, first-time race hints (trick / baton / bribe, twice per profile).
- hitch: the r4 set pieces (events, roadblock, cloud pelican) and the city's reflection layer compile behind the
  loading screen — 0 shader programs after GO on every track (was 2–5).
- wt-look: the flagstone texture covered only part of the lane (courses laid from x 0 instead of −halfWidth); granite
  setts on the shoulders; a softer drizzle per track.
- records: a keyboard / pad focus over all 71 achievements with a detail strip; the pause sheet names the r4 actions.
- lead: Shift-then-direction and take-off trick presses are buffered (sim/tricks.ts); r4 banners wait behind cut-ins;
  events are never planned under a jump; web meta (Open Graph card, icons) and a touch-device note on the title.
Residual: the events module warms the city's reflection layer (`gameplay/race/events/warm.ts`) — it belongs in the
world unit; the water town still removes the shared red bridge arch at runtime; SHOWTIME ~2 per race.
