# combat — status

## Layout (src/gameplay/combat/)
- system.ts (createCombat: step order) · ctx.ts (context, per-rider private data, queries) · tuning.ts (numbers)
- statuses.ts (status → mods) · feedback.ts (hit-stop/shake/rumble by player involvement) · damage.ts (one hit path)
- melee.ts · armory.ts (loadouts/uses/steal/drop/break) · ko.ts · sp.ts · bell.ts · debug.ts (`__br.combat`)
- pickups/{items,render,pickups}.ts · meshes/{build,library,pickup-props,weapon-props}.ts · projectiles/projectiles.ts
- skills/{types,common,runner,registry}.ts + one file per skill (13) · visuals/{visuals,frame,ribbon,trail,waves,auras,bolts}.ts
- data/weapons.ts (+weight, block, ARMORY) · data/skills.ts (unchanged) · tools/combat-check.mjs + tools/combat-check/*.mjs
  · tools/combat-shots.mjs

## Done
- Rules: tuning, ctx, statuses (→ mods each preStep), feedback (hit-stop/shake scaled by player involvement),
  sp, damage (single hit path: block/reflect/crit/knock/combo/ONE MORE), armory (loadouts/steal/drop/break),
  melee (phases, buffer, side select, counter), ko (exactly-once, credit ≤ 3 s, wall/traffic credit, 70 % respawn), bell
- Pickups (rows from track 'pickupRow' or auto rows; instanced toon props + shadows; drops fly & land; respawn 6 s)
- Projectiles (homing torpedo + trail), visuals (cone waves, flat rings/shockwave, aura, bubble, swirl, lightning,
  tether, vacuum spiral, trails), all 13 skills in skills/<id>.ts + runner/registry, debug API `__br.combat`
- tools/combat-check.mjs (+ tools/combat-check/*.mjs): 26 scenarios, 26/26 PASS isolated (stubs fx,audio,ui,actors)
  and 26/26 with every real unit except audio (`--stub audio`), incl. restart-mid-skill disposal
- tools/combat-shots.mjs: screenshots of every prop/visual (shots/combat/fx-*.png); autopilot soak: 13 KOs, 37 casts,
  no errors, no runaway visuals/projectiles
- statuses.ts interop: combat owns entries it creates (WeakSet), ticks everyone's timers, aggregates duplicate ids
  once (sim mirrors 'oiled'/'wet'/'wobble' with source null; police pushes 'slow')

- Visual pass with every real unit (fx post on): props gallery, all skill visuals, melee strip (windup → spark →
  flinch), KO strip (hit → slow-mo tumble → KNOCK OUT → back), real-track pickup rows; fx preset names aligned
  (no duplicate bursts: fx reacts to skill events itself; combat only bursts weapon breaks/expiries/gulps)
- Soak (autopilot, traffic + police, all real units): 50 casts, 82 hits, 6 KOs (incl. traffic credit), 0 errors,
  max 5 visuals / 1 projectile alive

## Next
- (fix round 1 done) wave 2 ideas: per-weapon swing arcs tuning with actors; rival ult-style moves if design wants them

## Event semantics (for ui-hud / audio / fx / race)
- combat:swing at swing start; combat:hit once per landed/blocked hit (blocked → damage 0; doge reflect = a blocked
  hit + a second hit attacker=shiba skillId 'shiba.doge'); skill hits carry skillId and weapon 'none'.
  Same-substep swings trade (both land). skill:hit once per victim per cast (gulp: at the spit, not the catch).
- combat:combo on every hit with count ≥ 2; ONE MORE! bonus (+10 SP, next hit crits) at count 3, 6, 9…
- combat:ko exactly once per wreck: hp ≤ 0 (cause 'ko') OR any crash within 3 s of a hit/debuff (cause = crash
  cause, e.g. knocked into traffic/wall); attacker null when nobody is credited.
- skill:cast slot 1–3 (rivals' signature = slot 1); the ult emits ult:start (no skill:cast) and later ult:impact;
  every skill (ult included) ends with skill:end. skill:denied slot 4 = ult; presses blocked only by a swing or
  hit stagger are buffered 0.3 s and denied only if that expires. Boost skills emit rider:boost{kind:'skill'}.
- combat:bell {riderId,pos,angered} on every ring (+ a 'taunt' 叮叮叮！ bubble); +5 SP only if angered ≠ [].
- combat:weaponBreak before the breaker goes bare-winged; projectile:spawn / exactly one projectile:end per
  projectile (hit = victim id, or null for poof / swallowed / disposed).
- SP-paid skills (the ult) give their caster no SP from hits, ONE MORE or KOs; SHOWTIME executes ≤ 20 % HP.
- RiderAction kinds: attack/heavy (dur = swing), hit (0.28 s), bell (0.45 s), skill (exclusive skills: whole
  duration; others 0.35 s cast pose), ult (1.2 s, pelican y driven by combat up to 8 m).
- Statuses combat creates: stun, slow, chill, boost, shield (0.5 block-once / 1 melee-immune / 2 reflect),
  invisible, intangible, wobble, gulped, angry (source = ringer).

## Known issues
- Default check mode stubs fx/audio/ui/actors (deterministic sim time); `--stub audio` runs real units and passes,
  but fx slow-mo makes frame counts longer there (scenarios wait on events, not fixed frames).
- Rivals accumulate SP with nothing to spend it on (only the pelican has an ult) — harmless; AI decides ult use.
- Track rows off the asphalt are clamped ≥ 1 m inside it; coast rows are sparse (51 coins, 1 crate, 2 cans, 2 fish
  over 3.3 km) — track's data (cross-unit note below).
- Ribbons are re-faced per sim substep, so during hit-stop (0 substeps) they don't follow a camera kick (needs the
  per-frame hook below). others() still builds a small array per query (measured cost negligible).

## Core requests
- (applied by core, now emitted) combat:weaponBreak, combat:bell, projectile:spawn / projectile:end.
- Optional per-frame hook `CombatSystem.frame?(dtReal)` after views.update: sync visuals/pickups once per rendered
  frame and re-face ribbons during hit-stop.
- Optional stacked boost API in sim (combat now keeps skill boosts in mods.speedMul to avoid merging durations).

## Requests to other units
- actors: hide 'gulped' riders completely (now they flicker 1/7 frames like 'invisible'; combat parks them grounded
  0.4 m behind the pelican).
- ui-hud: thin / corner player cut-ins while a projectile is in flight (the band hides the torpedo).
- track: a crate or can row about every 400 m on coast; keep rows inside halfWidth − 1 m.

## How to test
- `node tools/combat-check.mjs` (41 scenarios, isolated; last group finishes + restarts races) · `--full` (all real
  units) · `--stub fx,audio,ui,actors,camera` if another unit is broken · `--only torpedo`
- `node tools/combat-shots.mjs --stub audio [--only gallery]` → shots/combat/fx-*.png (props gallery, every skill)
- In game: `/?race=coast&seed=3&traffic=0` — J/L/K swing, U/I/O skills, P ult (needs 100 SP), B bell.
  Debug: `__br.combat.{pin,give,set,status,cast,swing,force,spawn,items,projectiles,running,counts}`.

## Fix round 1
Plan (critic issues → fix; [x] = done + verified in the browser). Resume: skip [x] items.
- [x] A ult refunds SP + ult flight scored as sim 'launch' → sp.ts spRefund(skillId): SP-paid skills give the attacker 0 SP for hits, ONE MORE bonus and KOs (ko.ts koMethod/award); ult keeps r.airborne=true from the cast step so sim adopts the flight as 'external' (no rider:land / land boost / crash rule). Check: fixes 'SHOWTIME refunds no SP' (4 KOs, SP < 1, no landing, 1 hit-stop)
- [x] B gulp (rewritten): catch zone ds −0.5…3, |dx| < 1.6 (inBeakReach); held victim hidden + grounded at caster.s − 0.4, never past length − 1; spit = the 25 dmg hit at the beak (on screen, hit-stop, number, flinch; KO there hands over to the crash), then an 'external' flight (airborne from its first step) 15 m back, stun 0.5 on landing; one skill:hit per victim (catch emits none). Vacuum: only items the rider accepts, pull capped at radius + 1, tags released when the pouch closes (row items pop back home; taken row items respawn at home). Checks: skills 'gulp swallows…', fixes2 'Big Gulp vacuum…', finish 'a rival held in the pouch…' (pelican P1, pigeon P2, held max L−1)
- [x] C bell → +5 SP only if ≥ 1 rival angered; emits combat:bell {riderId,pos,angered} (taunt 叮叮叮！ kept as bubble flavour; audio shares one bell cooldown key). Check: fixes 'bell: no SP on an empty road'
- [x] D events → armory.consumeUse emits combat:weaponBreak; ProjectileSystem emits projectile:spawn and exactly one projectile:end (hit / poof / swallow / dispose). Check: fixes 'events: …'
- [x] E wing → speed restored only on substeps where sim would resolve a rear-end contact (pre-physics box check), minus brake decel; rams need ds > −0.5. Check: fixes 'wing dash: braking still slows you' (−6 m/s+ in 1 s)
- [x] F statuses.applyMods: canAttack=false while invisible/intangible (AI canFight reads it); startSwing + tryCast clear r.invuln. Check: fixes 'ghosting riders cannot attack'
- [x] G ghost → no jump unless racing and unfinished; s = max(s, min(L−5, s+25)); reappears in the first clear lane (0, ±1.6, ±3.2 m) free of solid obstacles/riders. Check: finish 'ghost: no backwards jump…'
- [x] H melee → resolveSwings(): targets for every swing picked first, then applied (same-substep swings trade); a swing whiffs when the attacker loses canAttack mid-swing. Check: fixes2 'a swing whiffs…'
- [x] I skills → presses blocked by a swing / hit stagger are buffered (RiderCombat.skillBuf, SKILL_BUFFER 0.3 s to cover the 0.28 s stagger), retried each step, skill:denied only on expiry. Check: fixes2 'a skill pressed during a hit stagger…'
- [x] J weapons → PickupSystem.accepts(): armed riders skip crates and road weapons; takeWeapon never swaps (armed biter/stealer knocks the weapon onto the road). Check: fixes2 'no forced downgrades…'
- [x] K pickups/render.ts → items shrink to nothing between 4 m and 1.6 m from the camera (no screen-filling coin over the speedo). Looked: shots/combat/fix1-coins-46.png
- [x] L feedback.impact() queues; flushImpacts() at the end of preStep/postStep plays the strongest kind once (one hit-stop/shake/rumble per AoE). Check: SHOWTIME scenario (1 shake on the impact frame)
- [x] M ctx.pos() = physics.pose() + rider-local lift (follows lean/yaw/pitch). Critic misc.mjs: median 0.10 m (was 0.19), worst 0.26 m at any lean (was 0.55 m at 25°)
- [x] N meshes/build.ts instancedToon uses render/toon outlineMaterial; hullMaterial/disposeHullMaterials deleted
- [x] O whistle → offenders only. Check: fixes2 'whistle slows offenders only'
- [x] P skill boosts → 'boost' status now sets mods.speedMul = max(1, (1+k)/(1+shared)) and accelMul, never boostTime/boostPower (stronger boost wins, each on its own clock); skillBoost() also emits rider:boost{kind:'skill'} (camera kick, fx burst). Check: fixes2 'skill boosts keep their own clock…'
- [x] Q visuals/materials.ts MaterialPool: tinted glow/line materials recycled (release on visual end, disposed with the session), ribbons share one vertex-coloured material per blend; warmUp() draws one sub-pixel instance of every variant (glow front/double, line, ribbon rgba, toon prop + 0.03/0.035 outlines) on the first rendered frame. Aura/wave geometries now come from the PropLibrary (disposeWaveGeometry gone). Critic churn.mjs: linkProgram per cast 2–4 → 0 (honk/torpedo/doge, first casts included)
- [x] R pickups rewrite instance matrices at most once per rendered frame; Trail recycles sample vectors; Lightning/Tether/VacuumSpiral draw into reused point buffers (Ribbon.set(count)). Not done: others() arrays per call (cheap, measured 0.14–0.19 ms combat CPU) and re-facing ribbons during hit-stop (needs a per-frame combat hook: core request)
- [x] S tools/combat-check: +fixes.mjs, fixes2.mjs, finish.mjs (15 new scenarios incl. finish-line cases and a 3-race GPU-memory / program / bus-listener loop); new page events (combat:bell, weaponBreak, projectile:*, rider:land/boost, cam:shake, race:finishLine), cc.topMul/cc.restart; error gate fails on any combat-tagged or unattributed console error (other units' tagged errors are listed, not failed). 41/41 isolated and 41/41 --full
- [x] extra: bell can't be rung during a hit stagger (critic edge-b 'bell spam cancels the stagger'); SHOWTIME executes victims it leaves at ≤ 20 % HP (ULT.execute — chain KOs stay the money shot now that the ult refunds nothing). Check: fixes2 'the bell cannot ring a hit stagger away…'
- [x] gulp spit on screen: shots/combat/fix1-gulp-sheet.png (HEAVY 25 at the beak, pigeon arcs back over the camera)
- cross-unit (not combat files): ONE MORE! already shows only at count % 3 == 0 (ui-hud layer.ts); cut-in over the
  torpedo and sparse coast rows → "Requests to other units" above. Combat side: off-road rows now clamped onto the
  asphalt (pickups.keepOnRoad), coast row at s 550 x −9.5 → −6.
