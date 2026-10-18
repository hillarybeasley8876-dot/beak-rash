# race unit — status

## Files (src/gameplay/race/)
- index.ts → logic.ts      createRaceLogic: wires flow, AI, traffic, police, standings, results, debug
- ctx.ts                   shared per-race state (race clock, winner time, penalties, busted counts)
- flow.ts                  intro (3.6 s, skippable with Enter / `?intro=0`) → countdown 3-2-1-GO →
                           launch boost (throttle held on GO; fresh press during "1" = PERFECT START) →
                           player finish (+3 s FINISH beat) or winner + 60 s (DNF) → race:end once
- intro-camera.ts          rig.override swoop: high in front of the grid → low along the left flank →
                           lands exactly on the chase pose behind the player (blend 0.35 s)
- grid.ts                  re-grid: strongest rivals in front, player mid-pack (slot 5), staggered rows
- standings.ts             progress, places with 0.35 m hysteresis, placeChange / finishLine / finalStretch
- results.ts               RaceResult rows, coins = place bonus + rider.coins (KO/pickups − fines),
                           projected times for riders still racing when the player finishes, saveStats()
- pose.ts                  track-space → world pose helper
- spectate.ts              debug cameras (`__br.race.spectate(id|'aerial'|'side'|null)`)
- debug.ts                 `window.__br.race` (skipIntro, introFocus, results, ai, traffic, police,
                           setHeat, brake, clock, spectate)
- ai/                      line (min-curvature racing line, relaxed per race), sense (riders, obstacles,
                           features), plan (candidate-lane cost planner with commitment), control
                           (P + learned-bias steering → handles curve push), speed (corner speed w/ braking
                           distance, adaptive grip, drift plan), fight (melee side select, heavy, counters,
                           hunting; angry → hunt the bell ringer), skills (rules for all 8 sig skills +
                           pelican kit for autopilot), personality (species temperament + stats + level),
                           taunts (roster lines ~1 per 8–14 s near the player, KO/respawn lines),
                           brain (per rider), index (rubber band ±8 %, bell after passing the player)
- traffic/                 types (7 vehicles), kit/models-cars/models-trucks/models (merged vertex-colour
                           toon geometry), decals (canvas atlas: 鹈鹕海鲜, 冰淇淋, 1路 鹈鹕湾, bus meme ad),
                           render (InstancedMesh per type: paint (instance colour) + trim + decal + outline
                           hulls sharing one matrix buffer; wheel + lamp pools), driver (lanes both ways,
                           following, lane changes with blinkers, brake lights, hazards after a hit, honk),
                           spawner (40–400 m ahead / 60 m behind, not before s 190 or on the finish run,
                           never inside riders), index (manager, session.obstacles, traffic:honk)
- police.ts, police-heat.ts, police-view.ts   heat model, corgi chase (sprint 25.5 → 22 m/s), whistle
                           (slow 1 s), BUSTED (2 s alongside while slow/crashed: fine 100, +4 s, 2.2 s
                           ticket stop), give-up when outrun; corgi = actors RiderView + red/blue beacon

## Done
- Everything above, verified on the full game (real world/sim/camera/combat/actors/fx/ui) and on stubs.
- tools/race-soak.mjs: seeds 1,2,3 OK (races end ~165–181 s, nobody stuck > 1 s, sane positions, no traffic
  spawned inside riders, police busts the braking autopilot, 0 console errors); per race ≈ 60 AI
  overtakes, 50–70 hits, 4–8 KOs, 1–7 traffic crashes, 6–12 AI drifts with L1–L2 mini-turbos, 30–45 taunts.
- tools/race-scenarios.mjs 15/15 (police spawn/catch/BUSTED once/alerts/resume, countdown + launch
  boost, finish + results + single race:end, 60 s DNF timeout, restart mid-intro, quit cleanup).
- Perf: race logic ≈ 0.16 ms/frame; traffic 20 draw calls / ~40k tris with 7 vehicles (instance counts
  trimmed to slots in use; was 460k tris before the trim).
- Visual checks (shots/race/): intro sheet, chase strips, aerial, fights, police alongside/busted,
  traffic gallery (day/night, front/back/side).
## Next
- Wave 2: re-tune when city/mountain get their own layouts (hairpins → more braking/drifts; narrow
  2-lane sections → traffic lane logic already collapses to ±hw/2).

## Known issues
- Rival bikes differ a lot in top speed (kidbike 16.5 … fixie 22.5 m/s); with the ±8 % rubber band the
  shared/kidbike riders (capybara, penguin) always trail. Variety, but sim/content may narrow it.
- Rubber-band catch-up and the hunting sprint (+7 %) use tiny `boostTime/boostPower` pulses (the SPEC
  boost API), so a hunting rival may show boost streaks/tuck. A dedicated mod would be cleaner (core req 5).
- Police speech uses `app.ui.toast` (the corgi is not a session rider, so no `taunt` bubble).
- Police whistle pushes a `slow` status (1 s, 15 %) onto the player directly (combat owns statuses).

## Core requests
1. `rider:boost.kind` add `'launch'` (race currently emits `'pad'` for launch boosts).
2. `race:intro` payload: optional `duration` (s) so the HUD can pace intro cards (intro is 3.6 s).
3. Export `outlineMaterial(color, width)` from render/toon.ts (traffic gets it via a probe outline()).
4. Optional `police:alert` field `reason?: 'spawn' | 'lost' | 'busted'` (achievement 腿短不是借口).
   Current levels: 1 = chase/siren, 2 = alongside/closing (whistle), 0 = gave up / ticket done.
5. `RiderMods.rubber` (or a race-owned speed factor physics multiplies in) for rubber band/hunt sprint.

## How to test
- Play: `/?race=coast&seed=3` (Enter skips the intro). Autopilot: `&autopilot=1`. Aerial debug cam:
  `__br.race.spectate('aerial')`. Police: `__br.race.setHeat(0.9)` then slow down.
- `node tools/race-scenarios.mjs [--only police,launch,finish,restart,timeout] [--shots]`
- `node tools/race-soak.mjs --seeds 1,2,3` (full autopilot races, any console error fails; isolate with
  `--stub world,fx,ui,audio --lenient`)
- `node tools/race-gallery.mjs --views row,front,side` → shots/race/gallery-*.png
- `node tools/race-check.mjs --url "/?race=coast&seed=3&manual=1" --frames 1800 --every 300 --ai`

## Fix round 1
Plan (critic reviews/race-r1-gameplay.json, 12 issues). Order: 1 mugging → 3 pace → 2 police → 4 finish order →
minors (5 launch kind, 6 early skills, 7 place flicker, 8 visible band pulses, 9 traffic pop-in, 10 event fields,
11 corgi toasts, 12 cross-unit damage) → regressions in tools/race-scenarios(+ modules) → soak.
Status per issue (append "DONE" lines as each lands):
- [1 mugging] DONE: personality aggression ×(0.7+0.1·lv), heavy base −0.1, playerPull 1.5 (L1-2) / playerFury /
  huntBudget 2 (L1-2) / grace 1.2 s; fight.ts: no hunts/swings on the player before 6 s (unless angry at them), one
  hunter on the player (HuntToken in ai/index), no fresh hunt below 30 % HP, budget spent → drop + 3–5 s rest, heavies
  vs player ×0.7; ai/index listens to combat:hit; grid keeps the most aggressive rival off slots 1/3/5/7 at L1-2.
  Regression `node tools/race-scenarios.mjs --only mugging` (seeds 1-6 PASS: 0 early hits, no KO < 30 s).
  Scenario runner split: tools/race-scenarios.mjs + tools/race-scenarios/{basic,fair,chase,order}.mjs, tools/race-lib.mjs.
- [3 pace] DONE (verify soak later): ai/pace.ts replaces the ±8 % band: pace = player's flat top ×(1+0.02(lv−1)±0.02 by
  rating rank) caps every rival (fast bikes compressed, coast instead of brake); leaders ease 40→120 m to −8 %;
  catch-up up to +12 % only > 20 m behind under the chase cam (pulses, out of view); sloth.flash only when out of the
  top 3 or trailing the player, after 8 s. `--only close`: seeds 1-3 median leader gap 112/42/19 m (was 217-271),
  winners cat/cat/pigeon, last capybara/capybara/goose. Core request: level-appropriate rivalBikes in buildConfig.
- [2 police] code done (police.ts + new police-chase.ts + police-heat.ts): cruise 0.97× player top after the 8 s
  sprint, tires after 15 s alongside (−15 % 6 s, no whistle), brakes behind traffic + slow lane change, player swing /
  Wing Dash within reach knocks it back 3 s (+0.05 heat), lose at gap > 38 m for 2 s or heat < 0.3 while > 15 m
  ahead, heat cools ×3 after 10 s clean, whistle every 9 s only within 12 m, KO/skill crashes never count toward
  BUSTED, spawn gate uses s (not stale progress). Testing next.
- [4 order] code done: BUSTED penalty = the 4 s ticket stop (no phantom time; ctx.penalties removed, held again after a
  respawn); standings interpolate crossing time inside the substep and place same-substep crossers in t order.
- [10 fields] code done: police:alert reason spawn/lost/busted; race:intro duration (0 when skipped).
- [2 police] DONE: corgi sprints at 1.28× player top until 4 s alongside (max 15 s), then 0.97×; tires after 15 s
  within 12 m. Regressions `--only outrun,koNoBust,selfBust`: lost at 40 s (alongside 9 s, tired once), KO by a
  rival alongside → no BUSTED, wall crash alongside → BUSTED + reason 'busted'. Heat: outrun cooling removed (lose
  rule covers it), debug setHeat counts as an offence (police.setHeat).
- [4 order] DONE: `--only penalty,tie` PASS (busted player held 4 s; finishLine place = final place; same-substep
  crossers placed by interpolated time, standings agree).
- [11 corgi toasts] DONE: chatter + first-whistle toasts removed; toasts only on arrival and the fine (+ the 'escaped'
  meme toast). Core request 6 below for a world-anchored line.
- [5 launch] DONE: rider:boost kind 'launch' (0.3 perfect / 0.18 normal); HUD no longer shows "BOOST! 加速带" at GO.
  PERFECT START toast kept until ui-hud adds a 'launch' callout (request 1 updated). `--only opening` PASS.
- [6 early skills] DONE: no AI skill before a per-rider first-cast time (rng 5–15 s); sloth.flash's speed<10 clause
  only within 3 s of a respawn. `--only opening`: first AI cast 6.7 s (was 0.4–4 s).
- [7 flicker] DONE: places from post-stagger s order at regrid (no phantom 5>6 at GO); passes involving the player
  need 1.0 m held 0.4 s (vsPlayer map in standings). `--only flicker` (±0.7 m jitter → 0 changes; was 11).
- [8 visible pulses] DONE via ai/pace.ts: pulses only > 20 m behind under the chase cam (hunt sprint > 8 m behind),
  never ahead/in view. `--only pulses`: 0 unexplained boosts on rivals within −4…+80 m over 120 s.
- [9 pop-in] DONE: spawn band [0.75·fog.far, +50 m] (coast 735–785 m), density scaled by window so per-metre density
  is unchanged (coast L1: 12 alive). `--only popin`: 18/18 in-view spawns ≥ 0.67 fogged (was 17–26 %).

## Fix round 2
Plan (critic reviews/race-r2-gameplay.json, 10 issues; 3 cross-unit). Order: 1 phantom police → 2 bike pace → 4 rear-end
rams → 3 suite green (holdBrake + soak) → 7 catch-up → 5 grudges → 6 taunt spam → cross-unit notes (8 results, 9 draft
brake, 10 launch/ticket HUD) → re-run scenarios + soak. Status per issue (append DONE lines as each lands):
- [1 phantom police] DONE: spawn 28 m back (was 45); arrival sprint = max(1.28× player top, player speed + 4) so boosts
  can't outrun the arrival; 'lost' (and the calm give-up) needs ≥ 8 s of chase and a lead of 25 m built from the corgi's
  closest approach, then > 38 m for 2 s. Corgi traffic fix: it braked behind cars it was already beside (blocker used the
  player's lane) → now brakes only in the car's lane, passes on its own side, dodges oncoming faster. New `--only arrive`
  (brawler 1-4, autopilot 1-2: 13 chases, all reached in 3.9–7 s, alongside 4–15 s, no 'lost' < 15 s; was 11/16 phantoms).
- [2 bike pace] DONE: ai/pace.ts pace = REF_TOP (roadbike 20 m/s) ×(1+0.02(lv−1)+offset), independent of the player's
  bike (each rival still capped by its own bike in view). `--only bikes` (seed 3): rival caps identical on roadbike vs
  fixie; player roadbike 5th 165.1 s → fixie 2nd 142.9 s.
- [7 catch-up] DONE: CATCH_UP 0.12 → 0.08 (SPEC ±8 %); no catch-up (nor hunt sprint) for 12 s after a rider's respawn
  (ai/index tracks rider:respawn → PaceInput.recovering). `--only koGap`: KO'd seagull −67/−55 m at +15/+30 s (was level
  within 20–30 s).
- [4 rear-end rams] DONE: brain.drive() recomputes `soft` after every limit (coast only while the pace cap binds or a
  rider ahead closes < 2 m/s; hunters closing on slow prey brake); rider follow speed = stopping-distance speed
  (√(2·4·room), binds at any gap) instead of only within 2.4 m; planner: riders < 4 m/s are roadblocks (×4 weight, +0.35 m
  berth, not ignored even when hunted), no swinging across the nose of something reached within 1.5 s, and the current
  lane still counts for following until left; drafters drop a wheel that slows 3 m/s below them; rubber pulses only on a
  free road (sim boosts push even off the pedals). New tools/race-scenarios/contact.mjs: `--only stopped` 6/6 (was a 16.6
  goose ram), `--only brakecheck` seeds 1-3,5,6 clean (seed 4: penguin rams at 12.8 under a sim draft slingshot, see
  cross-unit 9).
- [5 grudges] DONE: personality.grudge by species (goose .95, seagull .85, cat .8, shiba/pelican .6, penguin .45,
  pigeon .35, capybara .15, sloth .1; ×(0.85+0.05·lv)); combat:hit by the player → Fighter.wronged(): never before 6 s
  or while resting after the hit budget; swings back on the first chance in reach within 2 s (chance 0.9, grace still
  respected) and hunts the player 4–6 s outside the token (budget/grace/low-HP rules kept). Hunters of the player no
  longer ease off at the pace (pace.ts: cap ≥ pace×1.04, own bike + draft decide; pulses still unseen only).
  While grudging, signature skills fire 3× as eagerly (SkillView.grudge). `--only grudge` (brawler, 100 s, seeds 1-6):
  goose/seagull/cat/shiba land a hit back in 14/26 fights within 5 s (7/29 with personality.grudge forced to 0),
  sloth/pigeon rarely; 0 hits on the player in the first 6 s.
- [6 taunt spam] DONE: ai/taunts.ts rewritten: one idle line at a time across the field (4.5–6.5 s apart) from the
  nearest due rider in front of the camera (not > 3 m behind, not invisible); per-rider gap 8–14 s ÷ taunty ×(1 + 0.15
  per extra rider within 25 m); KO/respawn lines need 2 s since any line; any `taunt` (incl. combat's skill shouts /
  bell) holds idle chatter ≥ 2.5 s; per-rider shuffled no-repeat bags. New `--only chatter` (L1/3/5, 90 s): race lines
  7.7–10.4/min (was 17–31), min gap 2.5–5.3 s, 0 bursts of 3 in 3 s, 0 repeats within 60 s.
- [3 suite red] DONE: Brain.holdBrake (debug `__br.race.brake`) now also drops skills, swings, heavy, hop, ult and bell
  (the soak's braking autopilot fired a torpedo at 50.3 s); the ram is fixed by issue 4. Outrun check retuned to the
  design: the corgi rides alongside ≥ 4 s first and the escape takes ≥ 15 s (no 'lost' < 8 s); calm escapes (heat < 0.3,
  15 m ahead) count only after the corgi caught up (≤ 6 m). `node tools/race-soak.mjs --seeds 1,2,3` SOAK OK (busted 1/1/1).
