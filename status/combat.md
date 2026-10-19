# combat — status

## Layout (src/gameplay/combat/)
- system.ts (createCombat: step order) · ctx.ts (context, per-rider private data, queries) · tuning.ts (numbers)
- statuses.ts (status → mods) · feedback.ts (hit-stop/shake/rumble by player involvement) · damage.ts (one hit path)
- melee.ts · armory.ts (loadouts/uses/steal/drop/break) · ko.ts · sp.ts · bell.ts · debug.ts (`__br.combat`)
- pickups/{items,render,pickups}.ts · meshes/{build,catalog,library,pickup-props,weapon-props}.ts · projectiles/projectiles.ts
- skills/{types,common,runner,registry,swallow,ult-aim}.ts + one file per skill (13) · visuals/{visuals,frame,follower,ribbon,trail,
  waves,auras,shield,rim,bolts,tell,materials}.ts
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
  every skill (ult included) ends with skill:end. skill:denied slot 4 = ult; presses blocked by a swing or hit
  stagger are buffered 0.32 s, by another skill whose lock ends within 0.6 s (or the ult in a hop) 0.6 s, and denied
  only if that expires; the player's ult press waits out a running KO cinematic (cine:ko start..end). SHOWTIME with
  nobody to hit → skill:denied 'state' + a 无目标！ taunt (player quip). Boost skills emit rider:boost{kind:'skill'}.
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
- Wing Dash still mirrors sim's rider-contact box to hand back the speed a ram takes (core request pushImmune).
- A skill's very first cast still costs ~0.5–1 ms more combat CPU than a repeat (JIT of its code path; geometry
  is prebuilt, shaders are warmed up).

## Core requests
- (applied by core, now emitted) combat:weaponBreak, combat:bell, projectile:spawn / projectile:end.
- (applied by core, now used) `CombatSystem.frame?(dtReal)`: visuals + pickup instances sync once per rendered frame.
- NEW (fix round 2, tech critic r2 #8): `RiderMods.pushImmune: boolean` (default false), honoured by sim's rider
  contacts: a pushImmune rider loses no speed in a rear-end / side contact (the other rider still gets pushed and
  the rider:bump still fires). Combat would set it while Wing Dash is out and delete the copy of sim's contact box,
  solid-rider rule and pre-physics speed restore in skills/wing.ts (it already reads the bike's own brake from
  BIKES instead of a hardcoded 12 m/s²). Alternative: a per-substep `rider:contact {a, b, speedLossA, speedLossB}`.
- Optional stacked boost API in sim (combat now keeps skill boosts in mods.speedMul to avoid merging durations).

## Requests to other units
- ui-hud + core (acceptance r1, A2): grey the P diamond / "SHOWTIME READY" when SHOWTIME has no target. Needs a shared
  flag, e.g. core `RiderState.ultTarget: boolean` (combat would write it every preStep from planUlt) or a
  `CombatSystem.ultReady?(id)` query; optionally a 'target' skill:denied reason so the diamond says 无目标 instead of
  现在不行 (combat already shouts 无目标！ through the player's quip line on such a denial).
- species (owns src/actors/** now): hide 'gulped' riders completely. actors/view.ts visibleFor() flickers them 1/7
  frames like 'invisible' (combat maps gulped → mods.invisible and parks them grounded 0.4 m behind the pelican);
  return false while `state.statuses` has a live 'gulped' entry. (Both critics, r1 + r2.)
- ui-hud (their fix plan #13): thin / corner cut-in for player projectile skills while a projectile is in flight
  (projectile:spawn / projectile:end are emitted), or delay the band until projectile:end; the FISH TORPEDO band
  also shows a blank white portrait panel (use the pelican eyes portrait or the vector fallback).
- fx: a bigger burst + stun stars on skill:hit for pelican.torpedo (the 14 dmg hit 16 m ahead reads small); pre-warm
  the non-combat ShaderMaterial (USE_FOG + USE_SHADOWMAP) that links 3 frames after the first torpedo cast (0 links
  with fx/ui/audio/actors stubbed; combat's own materials are warmed up).
- track: (done, track.md) a crate or can row about every 400 m on coast; rows inside halfWidth − 1 m.

## How to test
- `node tools/combat-check.mjs` (60 scenarios + error gate, isolated; finish group restarts races) · `--full` (all real
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

## Fix round 2
Plan (critic issues r2 → fix; [x] = done + verified in the browser). Resume: skip [x] items.
- [x] 1 bell SP faucet (major) → bell.ts fresh(): +5 only when a rival ahead or within 6 m behind (BELL.payReach) wasn't already angry at the ringer and hasn't paid this ringer in the last 8 s (RiderCombat.bellPaid[]); still angers everyone in 15 m. Check fixes3 'bell: three rings…' (5,5,5; 10 m behind pays 0; 4 m behind pays; pays again after expiry). Autopilot B-every-3 s soak (shots/combat/r2fix/bellsoak.txt): 8/29 and 7/27 rings paid (40/35 SP per race, was 77 % ≈ 99 SP)
- [x] 2 finish line → ctx.finished(r) (mode 'finished' or finishTime set): SkillRunner ends a finished caster's running skills with the new EndReason 'finish' (ult drops the pelican as on a crash: sim adopts the fall as external air); applyHit / skillAffect ignore finished attackers; creditFor() never credits a finished attacker (no KO, coins, SP; combat:ko attacker null → no KO cinematic over FINISH); projectiles of a finished owner poof; SHOWTIME is denied ('state') when its dive would land < 3 m before the line (ult ready()). Checks finish 'past the line nothing scores…' and 'a finished rider scores nothing…'
- [x] 3 status merge → statuses.addStatus keeps one own entry per (id, strength): equal strength refreshes (time = max), a different strength gets its own entry, fully covered entries are dropped; applyMods already takes the strongest live entry. Check fixes3 'statuses: a strong short slow…' (both orders: 0.65 → 0.85 → 1)
- [x] 4 KO credit tie → damage.credit() (shared by land, skillAffect, gulp catch) runs before the damage and keeps the existing credit when the victim is already at 0 HP. Check fixes3 'KO credit tie…' (hits [0,1], KO credited to 0)
- [x] 5 torpedo vs traffic → ProjectileSystem.blocked(): active solid obstacles (|ds| < halfLength + r, |dx| < halfWidth + r, y < height + r) end it with no hit (scales + poof burst, projectile:end hit null). Check fixes3 'torpedo: a car in the way…' (fails with the check disabled: hit 1)
- [x] 6 PickupSystem.accepts(): fish only below max HP, cans only below 100 SP (riding through and the Big Gulp vacuum). Check fixes3 'fish at full HP…'
- [x] 7 input buffer → a swing or the bell cuts a pose short (ctx.posing: bell pose or a non-exclusive cast pose); swing presses are held (PRESS_HOLD 0.32 s) through a hit stagger or the last 0.18 s of any other action; bell presses are held through swings/staggers (bell.requestBell, never rings a stagger away; dropped on cooldown or while unable to attack); skill presses keep one buffered entry per slot (RiderCombat.skillBuf[]), each cast or denied. Checks fixes3 'presses are never lost…' ×2 (J after U, B in a cast pose, J after B, J in a stagger, U then I in one swing → casts 1,2)
- [x] 8 gulp → ActiveSkill.exclusive may change while running: TimedSkill exposes it as a getter (constructor `lockout`), Gulp overrides it: exclusive while the pouch is open (1.2 s) or a rival is held; the spit flight + landing are a free tail. Check fixes3 'Big Gulp: busy only while…' (swing 7 frames after a late spit, gulp still running)
- [x] 9 counter-crit → tuning HEAVY_TELL {windupMul 1.6, range 6}: a rival heavy within 6 m of the player winds up 1.6× longer (baguette 0.19 → 0.30 s) behind visuals/tell.ts HeavyTell (yellow-white 4-point glint over the raised weapon, pops in, twinkles, shrinks as the blow comes). Check fixes3 'rival heavies near the player are telegraphed…' (J 0.2 s in counter-crits, far rivals unchanged); looked: shots/combat/r2fix/tell-2.png, tell-3.png
- [x] 10 skills/swallow.ts: while the pouch is open (ActiveSkill.swallows?, SkillRunner.swallowing) skillAffect lets HONK / WHISTLE waves go down the pouch instead (no stun/slow, wave spent for that rider), and swallowed rival projectiles get the same payoff: notes/scales + poof burst at the beak, white ring, +4 SP, a 咕嘟！ taunt bubble, light shake. Check fixes3 'Big Gulp eats HONK and WHISTLE waves…' (SP 8, 2 bubbles, no skill:hit; honk lands once the pouch is shut)
- [x] 11 finish '3-race loop…' now compares combat-owned state during each race (objects, unique geometries/materials under the combat root + counts()) and global GPU memory / programs / bus listeners only after each race. Passes isolated and --full
- [x] 12 projectile ids live in ProjectileSystem, item ids in PickupSystem (makeItem/layRow take the id), so a same-seed restart repeats every event payload
- [x] 13 SHIELD_BLOCK_ONCE + the unreachable block-once branch removed (shield ≥ 1 blocks); stray blank lines in bolts.ts / waves.ts; ctx.ts comment says system.ts; checkKos emits combat:ko before physics.crash (SPEC §7 order; fx/hud/audio/achievements/race handlers only read ids, positions and the tracker)
- [x] 14 per-substep render work → system.ts implements core's `CombatSystem.frame(dtReal)`: visuals.update(sim dt summed over the frame's substeps) and PickupSystem.sync() (instance matrices) run once per rendered frame after the rider views, on final poses; a hit-stop frame runs update(0), so ribbons re-face the camera. meshes/catalog.ts lists every prop geometry (PropKey) and PropLibrary.prebuild() builds them all at session start (lib.get(key) no longer takes a maker). ctx.nearest() (no allocation) for single-target queries (torpedo, gulp, heavy auto-side); others() insertion-sorts without scratch objects. Trail samples at ≥ 0.75/60 s so 60 fps frame jitter never skips one. Deleted the unused visuals/frame-gate.ts. Check fixes4 'render sync…' (2 wing ribbons + coin instances: +1 version per frame, +1 in a hit-stop frame with 0 substeps). First casts (shots/combat/r2fix/firstcast.json, all real units, combat incl. frame): torpedo 2.4 → 1.6 ms, ult 1.9 → 1.5, spin 1.4 → 0.9, wing 1.3 → 0.9 (repeat 0.2–0.7). combat-check 55/55 isolated and --full; combat-shots r2fix/sheet-a/b.png all visuals render
- [~] 15 wing.ts sim-contact copy → core request `RiderMods.pushImmune` now actually filed under Core requests (it was missing); rider:bump can't replace the copy (fires only above 1 m/s and once per 0.25 s per pair). Meanwhile the restore allows the rider's own bike brake (BIKES[r.bike].brake, was a hardcoded 12 m/s², wrong on every bike but the road bike) and the header says the copy goes once core lands the flag. fixes 'wing dash…' still passes
- [x] 16 cross-unit notes → "Requests to other units" rewritten: species (gulped riders fully hidden; actors/view.ts is theirs now), ui-hud (thin band while a projectile flies: already their plan #13; blank portrait panel), fx (torpedo hit burst + stun stars; pre-warm the fog/shadow ShaderMaterial that links after the first torpedo); track rows marked done. No combat-side workaround (would mean overriding another unit's view.root.visible)
- [x] 17 core round-2 request → armory.equip / consumeUse / takeWeapon read and write `rider.weaponUses` (Infinity for 'none'); the private RiderCombat.uses is gone (one source of truth for the HUD). Debug spawn of a road weapon now carries the weapon's full uses (was 0: broke on the first hit). Check fixes4 'rider.weaponUses follows the weapon…' (stolen worn baguette keeps 2, a hit → 1, break → Infinity + one weaponBreak, dropped pan with 2 → picked up with 2)
- Verified (resumed fixer, 10-18 15:15): tsc clean; combat-check 55/55 isolated and 55/55 --full
  (shots/combat/r2fix/check-iso.txt, check-full.txt); combat-shots → shots/combat/r2fix/frame/ (sheet-a/b.png).
  Real-time perf copy (shots/combat/r2fix/perf.json) ran at load average 21 (other agents' browsers): 0 errors,
  47 combat draw calls / 40k tris at the skill-heavy A/B, the 9-first-casts frame 8.3 ms combat (critic: 10.8);
  fps/hitch numbers are machine-load noise there, not comparable with the critic's run.

## Acceptance round 1
Issues owned by combat in reviews/game-r1-*.json (no "## Acceptance round 1" existed: fresh start). [x] = done + verified.
- [x] A1 (major, aesthetic #1) Doge shield → visuals/shield.ts ShieldBubble: smooth unit sphere ('aura:shell' =
  SphereGeometry 48×32, radius 1 m, centre 0.95 m up) with visuals/rim.ts RimMaterial (fresnel: clear centre, one hard
  gold rim band, thin white edge, screen-space halftone ramp, a ripple ring from the hit direction) + 3 twinkling
  star glints; opacity × smoothstep(2.5, 5, camera distance) (hidden < 2.5 m). Wireframe + MaterialPool.line() gone;
  pool has rim() (warmed up with the other variants). Doge listens to the blocked half of a reflect (combat:hit,
  victim = shiba, blocked) → bubble.bounce(dir): ripple + glint flare. Follower base moved to visuals/follower.ts.
  Looked: shots/combat/acc1/doge-sheet.jpg (3.3 m: faint; 6.7 m: clear gold rim, rider visible; 10/17 m; bounce).
- [x] A2 (major, e2e #2) SHOWTIME hits nobody → skills/ult-aim.ts planUlt(): rivals 120 m ahead … 30 m behind, each
  scored by how many rivals its impact spot would catch (predicted at impact, 40 m ahead / 12 m behind, not past the
  line); the natural landing wins ties, else the leap homes (homeStep, closed loop, ease-out) onto the best anchor and
  lands 2.5 m behind it in a clear lane. No plan → skill:denied 'state' + 无目标！ quip (SkillImpl.noTarget, ≤ 1 per
  1.5 s), SP kept. clearLane moved ghost.ts → common.ts. Checks acc1 ×3 pass (lone rival 90 m ahead: lands 2.4 m
  behind it after 98 m; pack 70–90 m: all 3 hit; rival 25 m behind: hit; near-line rival that will have finished:
  denied). Looked (real units): shots/combat/acc1/ult-sheet.jpg (cut-in → leap streaks 98 m onto the goose + cat,
  both hit) and hand-sheet.jpg (camera back on the chase 4.5 m behind, no pop). HUD greying needs a core flag (below).
- [x] A3 (minor, e2e #5) runner listens to cine:ko: the player's ult press is 'held' (buffered, never ages) from start to
  end (cap ULT_KO_LATCH 3 s real if no end arrives), then casts. Check acc1 'SHOWTIME pressed during a KO cinematic…';
  with real fx: KO cine start 9.62 → peak 10.07 → end 11.07 s (full length), ult:start 11.08 s.
- [x] A4 (minor, feel #8) ActiveSkill.lockLeft(): a press while another skill is exclusive is buffered ('busy', hold
  SKILL_QUEUE 0.6 s) when that lock ends within 0.6 s, else denied at once; also the combat-r3 minor: an ult press
  in a hop/crest is buffered (0.6 s) and fires on landing. Checks acc1 'a skill pressed late…' (wing 0.67 s into
  gulp casts at 1.20 s; 0.3 s in → denied at once) and 'SHOWTIME pressed in a hop…'.
- Verified (10-19): tsc clean; combat-check 61/61 isolated and 61/61 --full (shots/combat/acc1/check-iso.txt,
  check-full.txt; 6 new scenarios in tools/combat-check/acc1.mjs); combat-shots +doge-bounce, +ult-homing
  (shots/combat/acc1/shots-sheet.jpg); autopilot soak 40 s, all real units: 12 casts, 21 hits, 6 KOs, 2 ults hitting
  7 and 6 riders, 0 denials, 0 errors. Note: core added RiderMods.pushImmune but sim doesn't read it yet, so
  skills/wing.ts keeps its contact mirror (core request stays open for sim).
