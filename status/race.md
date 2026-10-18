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
                           hunting; angry → hunt the bell ringer; grudges), skills (rules for all 8 sig skills
                           + pelican kit for autopilot), personality (species temperament + stats + level),
                           taunts (one line at a time across the field, per-rider no-repeat bags, KO/respawn/
                           skill lines), pace (level pace, leader ease, unseen catch-up, rider.rubber),
                           brain (per rider), index (director: pace offsets, hunt token, grudges, bell)
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
- tools/race-scenarios.mjs (see Fix round 3 for the latest counts; police spawn/catch/BUSTED once/alerts/resume, countdown + launch
  boost, finish + results + single race:end, 60 s DNF timeout, restart mid-intro, quit cleanup).
- Perf: race logic ≈ 0.16 ms/frame; traffic 20 draw calls / ~40k tris with 7 vehicles (instance counts
  trimmed to slots in use; was 460k tris before the trim).
- Visual checks (shots/race/): intro sheet, chase strips, aerial, fights, police alongside/busted,
  traffic gallery (day/night, front/back/side).
## Next
- Wave 2: re-tune when city/mountain get their own layouts (hairpins → more braking/drifts; narrow
  2-lane sections → traffic lane logic already collapses to ±hw/2).

## Known issues
- Rival top speeds come from the level pace (±2 % per rider), not their bikes: `rider.rubber` holds fast bikes down
  (≥ 0.7) and lifts slow ones up to the pace (≤ 1.35); bikes still differ in accel / handling / weight. The player's
  bike is the only real top-speed edge (by design: garage upgrades matter).
- Police speech uses `app.ui.toast` (the corgi is not a session rider, so no `taunt` bubble; core request 6).
- Police whistle pushes a `slow` status (1 s, 15 %) onto the player directly (combat owns statuses).
- Finished riders stop where the sim's finish auto-brake puts them (sim forces.ts finishBrake 2.5 m/s², throttle
  ignored: ~60–70 m past the line); race only steers them to the road edge and brakes for riders stopped ahead.
- The passive test player (lane keeping, no draft/drift/skills) finishes 6th–8th more often since rivals use the
  slipstream (fix r3); a fixie or a player who drafts/drifts still wins (`--only bikes`).

## Core requests
1–5 applied by core (rider:boost 'launch', race:intro.duration, outlineMaterial export (traffic uses it since fix r2),
police:alert.reason, RiderState.rubber; sim multiplies rubber in).
6. (open) a world-anchored speech line for non-session riders (the corgi), or let `taunt` take a world position.
Cross-unit (critics r2/r3, not race-owned; sim is wrapped up, so these stay open):
- sim: no draft slingshot while braking (brake > 0.5) or below ~8 m/s, and reset `draft` while braking
  (sim/contacts.ts slipstream(): critic r3 saw a fully braking player get rider:boost 'draft' and go 0.7 → 3.0 m/s).
- combat: seagull.steal shouts 'MINE!' on every steal (4–12 repeats a minute): draw from a no-repeat bag
  (MINE! / 我的了！/ 薯条归我！…) or drop it (race already shouts the seagull's roster skillLines on 60 % of casts).
- ui-hud: the 'launch' callout shipped (race's PERFECT START toast removed, fix r3); the BUSTED '+4S' timer chip
  should be a 4-3-2-1 ticket-hold countdown while the player's mode is 'busted' (no time is added).

## How to test
- Play: `/?race=coast&seed=3` (Enter skips the intro). Autopilot: `&autopilot=1`. Aerial debug cam:
  `__br.race.spectate('aerial')`. Police: `__br.race.setHeat(0.9)` then slow down.
- `node tools/race-scenarios.mjs [--only police,launch,…] [--shots] [--stub combat]` (all quick groups ≈ 8 min; the full-race
  checks run only when named: `--only close,bikes,mugging,arrive`; groups listed in the file header)
- `node tools/race-soak.mjs --seeds 1,2,3` (full autopilot races, any console error fails; isolate with
  `--stub world,fx,ui,audio --lenient`)
- `node tools/race-podium.mjs --seeds 1-24 [--par 3]` (72 passive full races over coast/city/mountain: who wins; PASS = no
  species > 35 % of rival wins, every species podiums; ~12 min at --par 3)
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
- Continuation (resumed fixer): remaining → full suite re-run (scenarios + soak) → 10 launch callout (drop the race
  toast if ui-hud has 'launch') → content req 4 (POLICE_LINES corgi toasts, skillLines for rival sig casts) →
  rider.rubber (sim now multiplies it in) replaces boost pulses → cross-unit notes 8/9/10 → final suite.
- [content req 4 / core r2 note] DONE: corgi toasts use content's POLICE_LINES (arrival = alert, fine = busted + "罚 100
  小鱼干，靠边 4 秒", escape = lost line); rivals shout their roster skillLines on a signature cast (60 %, next tick so
  combat's own MINE! / 咕嘟 is not doubled, same 2 s / burst limits as KO lines).
- [rubber, known issue 2 / core req 5] DONE: sim now multiplies `rider.rubber` in, so the catch-up and the hunt sprint
  set `rider.rubber` (ai/pace.ts easeRubber: cap ÷ own bike top, ≤ 1.35, eased 0.1/s, 1 when in view / not racing)
  instead of boostTime pulses (no boost streaks, no `free`-road gate); brain's top includes it. `--only pulses` now also
  asserts rubber ≤ 1.01 on rivals in view (0 of 9812 samples; max unseen 1.297), opening PASS.
- Continuation 2 (resumed fixer #2, 14:20): all code items above are in; remaining = full suite re-run (scenarios +
  soak) → 10 launch callout / ticket chip (ui-hud) → cross-unit notes 8/9 → final suite.
- Suite re-run 14:25: `race-soak --seeds 1,2,3` SOAK OK (busted 1/1/1, stuck ≤ 2.0 s, 0 errors); default scenarios 44/48,
  the 4 failures (brakecheck s4, penalty, tie, popin) threw `ctx.pickups.sync is not a function` inside combat/system.ts
  (combat mid-edit, not race) → re-running.
- Re-runs 14:45: brakecheck seeds 1,2,3,5,6 PASS, tie PASS, penalty + popin PASS (`--stub combat`: combat/melee.ts threw
  `nearest is not defined` mid-edit); `--only bikes` PASS (caps identical; roadbike 8th 167.1 s → fixie 3rd 143.2 s);
  `--only arrive` brawler 1-2 PASS (reach 4.7 s, lost 25–35 s later, alongside 10–12 s); rest of arrive blocked by combat.
- [8 results tracker] not race-owned; not reproduced: `ctx.tracker.earned` no longer exists in src/ui; autopilot seed 2
  finished in real time builds the results screen with 0 errors (shots/race/r2fix/results.mjs → results-s2.png).
- [9 draft while braking] not race-owned (sim/contacts.ts slipstream has no brake gate yet) → request under Core requests.
  Race side already copes: brakecheck seeds 1,2,3,5,6 clean.
- [10 launch / ticket HUD] ui-hud has both queued (its fix items 4 and 13, not done yet) → the race keeps its PERFECT START
  toast until the 'launch' callout exists (else nothing marks the perfect start); request under Core requests.
- [cleanup] traffic/render.ts uses core's exported `outlineMaterial(INK, w)` instead of a probe outline() (core req 3);
  gallery shot shots/race/r2fix/gallery-row.png unchanged (outlines on all 7 vehicles); sandbox/race.html favicon 404 gone.
- Visual check (shots/race/r2fix/visual.mjs, brawler seed 1): POLICE banner + arrival toast, corgi beside the player
  4.7 s after the spawn (police-along-s1.png), escape toast with content's lost line at 25 s (police-lost-s1.png),
  pack shots with one bubble at a time (pack-s1-*.png); 0 errors.
- Final suite 15:15 (full game): default 48/50 — FAIL grudge 11/32 landed back (< 40 %, was 12/28–14/26; combat changed
  melee targeting meanwhile), FAIL popin one spawn at fog 0.59 (ds 746 m but only 661 m straight-line on a curve);
  `--only close,mugging`: mugging 6/6, close FAIL (median leader gap 126/124/67 m vs < 120; last place capybara ×3 —
  slow-bike rivals are capped by their own bike in view, catch-up now only +8 %). Plan: (a) popin: spawn by straight-line
  distance; (b) grudge: payback swings are quick light jabs (heavy windup gets countered); (c) close: in view, rubber may
  lift a slow bike up to the field's pace (never above it), pulses check asserts "never above the pace in view".
- [popin regression] DONE: traffic/index.ts spawns at the first s past `far` that is also `far` away in a straight line
  (fogStart, ≤ +60 m; skip the tick otherwise; despawn limit moved out by the same margin). `--only popin` PASS (min fog 0.70).
- [grudge regression] DONE: fight.ts payback swings are light jabs (a heavy's 0.16 s windup got countered). `--only grudge`
  PASS 14/31 landed back, 20/31 swung back, 0 early hits.
- [close regression] DONE: (1) pace.ts easeRubber: in view a slow bike may be lifted to its base pace (never above it;
  unseen it still gets the +8 % catch-up); (2) a fast bike gets rubber < 1 (cap ÷ own top, floor 0.7), so after a boost or
  a descent the sim's overspeed drag returns it to the cap instead of coasting above the field (the fixie cat led by
  120–275 m and won 3/3); brain aims CAP_SLACK 0.5 m/s above the cap so the pedals stay floored up to it. Brain summary
  exposes `base` / `top`; `--only pulses` now asserts "in view, rubber never lifts a rival above its pace" (0 of 13668;
  4138 slow-bike lifts). `--only close` PASS: median leader gap 69/31/75 m, first→last 5.5/8.4/8.1 s, winners pigeon/sloth/
  pigeon, last cat/capybara/capybara; `--only bikes` PASS (roadbike 6th 167.1 s → fixie 1st 143.4 s); koGap PASS
  (−62.8/−62.5 m at +15/+30 s); opening PASS.
- FINAL 16:05 (full game, real units): `race-scenarios` default 50/50; named `close,bikes,mugging,arrive` 4/4 + 2/2 + 6/6 + 8/8;
  `race-soak --seeds 1,2,3` SOAK OK (winners shiba/pigeon/sloth, busted 1/1/1, stuck ≤ 2.0 s, 0 errors); tsc: 0 errors in
  race files. Fix round 2 complete; open items are cross-unit only (sim draft-while-braking, ui-hud launch callout + ticket
  countdown → then drop flow.ts PERFECT START toast).

## Fix round 3
Plan (critic reviews/race-r3-gameplay.json, 9 issues; 2 cross-unit; + env-city note, content req 10). Order: 6 PERFECT START
toast → 1 predictable podium (form dice, purposeful speed skills, podium regression) → 4 grudge payback → 5 corgi vs riders →
2 police tail (re-sprint / cap / let-go toast, content req 10) → 7 finisher roll-out (+ env-city note) → 3 suite re-run →
8/9 cross-unit notes. Status per issue (append DONE lines as each lands):
- [6 PERFECT START twice] DONE: flow.ts launch() no longer toasts (ui-hud's 'launch' callout shows PERFECT START / GOOD START);
  core request 1 and the known issue are closed.
- [1 podium] code in: ai/index.ts offsets = 25 % strength rank + 75 % per-race form dice; ai/skills.ts speed skills (slide,
  flash, doge, ghost) only with a purpose (overtake: rider 3–25 m ahead in lane; defence: threatened; comeback: behind the
  player or bottom half), holstered as race leader or > 20 m ahead of the player; sloth.flash only from the bottom 3 or
  trailing the player; brain cap × slipstream (+10 % × draft, as the sim) so drafters catch and pass a pack leader; pigeon
  drafter 0.95 → 0.8. New tools/race-podium.mjs (passive player, seeds × tracks, own seed block per track, form % + speed
  casts + leader per race; PASS = no species > 35 % of rival wins, every species podiums). Baseline 12 races: pigeon 9/12
  (75 %), goose no podium. After: 24 races (seeds 5-12) PASS max 33 % (cat 8, shiba 6, penguin 5, pigeon 2, capybara/goose/
  seagull 1), all podium. Full 72-race run after the other AI fixes.
- [4 grudge] DONE: fight.ts payback owed for 5 s (was a 2 s window that ran out while the knocked victim was out of
  reach), taken as soon as the player is in reach (a failed roll retries after 0.25 s, not a full reaction period); a
  grudge only fires hitting/robbing skills (honk/spin/steal: shields and slides block its own swing) and brakes to let a
  player behind come alongside (Fighter.owes); catch-up in view while owed and the player 0.5–8 m ahead, 3 s per grudge:
  pace.ts paybackPace = max(pace ×1.06, player speed + 1.5) (a boosted player outran ×1.06), rubber rate 0.4/s; hot
  species' grudge chance up (goose 1, seagull .95, cat .9, shiba .8; × (0.9 + 0.05·lv)). Scenario: fights = hits from
  within 6 m (torpedo/ult hits from 8–45 m listed as ranged, not checked; race-lib logs ds at each combat:hit).
  `--only grudge` PASS 10/21 landed back, 12/21 swung back (39 ranged hits left out); 0 early hits. Brain summary now
  exposes fight timers (`__br.race.ai()[i].fight`).
- [7 finishers] code in: brain.ts rollOut(): past the line riders pull over to the road edge (sides alternate by place)
  and roll out ≥ 6 m/s for 60 m (3 m/s² from the finish speed), then stop at 2 m/s²; followLimit (stopping distance)
  now also runs for finished riders. drive() split into raceSpeed / rollOut / followLimit / huntLimit. env-city note:
  standings.rollOutLate() marks riders crossing after race:end as finished (they rolled on to s≈5400).
- [2 police tail + content req 10] DONE: police.ts: spawn 20 m back (arrives in ~3 s); behind the chase camera
  (> 4.5 m) for 2 s → one re-sprint (police-chase.ts resprint(): sprint ≤ 8 s, hold 3 s) with a POLICE_LINES.chase
  line, the next time (or when tired) it gives up with the escape toast; chases end by 25 s (escape when the player
  rides ahead of it, else a let-go: own toast 算了，下不为例 + police toot); the heat let-go also toasts; first time
  alongside → a POLICE_LINES.chase toast (content request 10). New `--only visible` (6 brawler races, coast/city/
  mountain L1–3): 8 chases, in view 60 % (critic 35 %), 12–25 s each, 7 lost + 1 busted; arrive brawler 1-2/auto 2 PASS
  (reach 2.7–3.8 s, lost 19–23 s); outrun PASS (alongside 11 s, lost at 20.2 s).
- [5 corgi through riders] DONE: police-chase.ts blocker() also treats racing rivals (0.45 × 0.9 m) as blockers (brake
  behind / pass on the free side, 2.5 m/s lateral), police.ts picks the alongside side with 1.2 m clearance from
  rivals. `--only visible` overlap check: 0.0 s corgi/rival overlap in 8 chases.
- [1 podium] DONE: full regression `node tools/race-podium.mjs --seeds 1-24` (72 races, coast/city/mountain, L1–4 cycling,
  passive player) PASS: rival wins pigeon 17 (24 %), cat 16, penguin 14, shiba 12, capybara 6, goose 3, seagull 3, sloth 1;
  podiums goose 12, seagull 15, sloth 15 … all species ≥ 12; 0 console errors. Races are closer: median field spread L1
  5.7 s (baseline 8.9), player−winner gap unchanged at L1–2 (3.3 / 7.2 s), smaller at L3–4 (10 / 15.6 s, was 20.6 / 20.8).
- [7 finishers] DONE: the sim's finish auto-brake (sim-owned, throttle ignored) decides where finishers stop (~60–70 m past
  the line, was 3–27 m when the brain braked hard), so race's roll-out only coasts (never pedals/brakes hard), pulls
  over to the road edge by place and brakes for anyone stopped ahead (followLimit). Probe shots/race/r3fix/finish-probe.mjs
  (passive s4 L3, critic's case): all 8 stopped 62–69 m past the line, 0 bumps involving finished riders (the player's
  roll-out no longer hits a parked goose); finish-sheet.jpg.
- [3 suite] DONE, final runs on the current tree (full game, real units): `race-scenarios` default 53/53 (new: visible ×3,
  grudge melee-range fights, koGap keeps the passive player's HP topped up: its own KO at 56.5 s by rival 6 had handed the
  field the gap back → gaps −98/−58/−29 m at +15/+30/+45 s, playerDown 0); named `close,bikes,mugging,arrive` 20/20 (leader
  gap 59/18/113 m; roadbike 7th 169.1 s → fixie 1st 144.2 s); `race-soak --seeds 1,2,3` SOAK OK (winners pigeon/cat/goose,
  stuck ≤ 2.5 s, busted 1 each, 0 errors); `race-podium --seeds 1-24` PASS (above); tsc 0 errors.
- Visual (shots/race/r3fix/, 5 images read): launch.jpg (one ransom PERFECT START from the HUD, no toast), pol-sheet.jpg
  (corgi + beacon riding beside the player around the goose; escape toast 甩掉了柯基警官), finish-sheet.jpg (finishers
  rolled out 60 m+ past the line, results).
- [8 sim draft while braking] not race-owned, sim is wrapped up: kept under Core requests / cross-unit.
- [9 seagull MINE! repeats] not race-owned (combat's steal shout): note under Core requests / cross-unit for combat.
- Other units' requests: env-city late finishers (done above), content req 10 chase line (done above); ui-hud's optional
  race:introFocus / police:busted.hold need core event changes (not requested by core; HUD works without them).
Fix round 3 complete.
