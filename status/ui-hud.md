# ui-hud status

## Done (all in src/ui/hud/, every file ≤ 300 lines; index.ts now exports the real createHud)
- base: dom.ts (cached writers), anim.ts (slam/enter/exit/fadeOut/pop/jitter, reduced-motion aware), ransom.ts,
  shapes.ts, fonts.ts (font imports + preload), heads.ts / eyes.ts (SVG portrait + eyes fallbacks), badge.ts
  (portraits from data/assets.ts with fallbacks), icons.ts (weapon icons), css/*.css (one per module).
- static HUD: place.ts (giant skewed place + slam/arrow on change, timer frozen at finish, BUSTED +4S, KO/小鱼干
  counters), progress.ts (strip, rival badges above, player on the bar, KO/invisible states, flag, km left),
  speedo.ts (jagged dial, needle, km/h, drift ring + L1–3 pips/sparks in level colour, BOOST/SLIPSTREAM tags),
  cluster.ts + skills.ts + weapon.ts (tilted portrait w/ mood swaps, HP + damage chunk, SP → SHOWTIME READY [P],
  U/I/O diamonds w/ glyph, cooldown sweep + seconds, ready pop, denied shake + reason; ult diamond fills w/ SP;
  weapon icon/name/uses pips).
- world/: project.ts, tags.ts (≤25 m ahead, fade, de-overlap, place, HP, chip angry/stun/shield/weapon),
  bubbles.ts (taunts above the tag; clamped to edges off-screen), damage.ts (crit/heavy/block/hurt),
  edges.ts (rear chevrons for angry/closing/swinging rivals, skill-cast warnings w/ glyph + "!", police glow+chip).
- cutins/: director.ts (exclusive splash slot w/ priority + 1.2 s queue, skill-band slot, 0.1 s fade on interrupt),
  countdown.ts (3-2-1-GO + skill band w/ eyes), splash.ts + splashes.ts (KNOCK OUT + DOUBLE/TRIPLE…, WRECKED w/
  cause line, BUSTED stamp, FINISH + place + time, SHOWTIME), callouts.ts (PERFECT, DRIFT L1–3, NEAR MISS ×n,
  SLIPSTREAM/SLINGSHOT/BOOST, ONE MORE!, ▲/▼ place, pickups; max 3, merge), banner.ts (FINAL STRETCH),
  chips.ts (rival skills ≤30 m), intro.ts (track banner + calling card per rival, follows the camera), layer.ts.
- (fix r2) world/zones.ts (static module rects + keep-clear zone), world/taglayout.ts (plate/pip LOD + layout),
  world/occlusion.ts (riders behind the cluster gauges); progress.ts fans rival badges from the player's marker.
- events.ts routes the bus; hud.ts composes; HUD fades out (JS, real time) for intro + cine:ko/cine:ult.
- KO flow: cine:ko start hides HUD, peak → splash (fx chain count), end → HUD back; no cine within 0.55 s →
  splash anyway with our own chain count. Same-key splashes never restart (crash + cine for one wreck).
- Matches combat/race rules read from their code: weapon wear only on landed (unblocked) melee hits; ONE MORE!
  on every 3rd chained hit; skill:denied slots 1–3 = U/I/O, 4 = ult; police:alert is a level state (0 clears
  the siren glow, 1 chase, 2 alongside); BUSTED shows the race unit's +4 s penalty next to the timer.
- Real portrait art (data/assets.ts) is live: cluster/main pose, KO/WRECKED/BUSTED busts, eyes strips in the
  skill band + SHOWTIME, badges crop the smug bust's face; SVG fallbacks remain for missing/broken files.
- Verified: sandbox tour (all states), real race /?race=coast&seed=4 (intro cards, countdown, tags, taunts,
  damage, chips, chevrons, callouts, real fx KO cinematic + splash), 1280×720 / 1440×900 / 1920×1080 /
  2560×1440, reduced motion, dispose (DOM empty, later events inert). ui.update ≈ 0.14 ms avg, 0.3 ms max.

## Known issues
- (fix r1) Weapon uses now come from combat's rider.weaponUses; incoming warnings from projectile:spawn/end.
- Intro cards mirror race's intro look-target height (core request 3 would remove the mirror).
- (fix r2) Plates of riders in the middle of the road stand at the keep-clear zone's edge with a leader line; with three
  plates on one side they stack into a short column there (not over the road centre). Pips may touch each other.
- (fix r2) The chip column reads ui-screens' `.br-toast` count (class name + toast.ts lane constants mirrored) to sit below
  the toast lane; if ui-screens moves its lane, update TOAST_TOP / TOAST_STEP in cutins/chips.ts.
- Cross-unit (not HUD files): race police.ts corgi lines are ui-screens toasts and stay up during cine:ko; emit them as
  `taunt` events from the police rider (the HUD docks them and hides them in cinematics) or have ui-screens hide in-race
  toasts while the HUD is quiet.

## Core requests
1. DONE (core 10-18 11:40) RiderState.weaponUses — the weapon slot reads it.
2. DONE (core 19:20) projectile:spawn / projectile:end.
3. Optional `race:introFocus { riderId: RiderId | null }` (race emits when IntroCamera.focus() changes) so intro.ts
   needs no mirrored look-target height. 4. Optional `police:busted.hold?: number` (ticket-stop seconds; HUD assumes 4).

## How to test
- Sandbox (stub units): http://127.0.0.1:5300/sandbox/hud.html (?live=1 = real units). Driver: window.__hud
  (pose(name), fire(cut, opts), place(id, ds, x), reset(), freezeSim(on), dispose(), names()).
- Screenshot tour: node sandbox/hud.shots.mjs [--only a,b] [--size 1280x720] [--live] → shots/ui-hud/*.png
- Real race: node tools/shot.mjs --url "/?race=coast&seed=4" --step 600 --controls '{"throttle":1}' --out shots/ui-hud/x.png
- Asserting sandbox scenes (exit 1 on FAIL): merge, launch, bandWreck, achievement, pack, packLater, behind, incoming,
  incomingEnd, skillThin, skillWide, bandCallout, quip, quipKo, quipHurt, sfx, ticket (window.__hudSfx = UI sound spy).
- Fix r2 tools (shots/ui-hud/fix2/t/): audit.mjs [size seed frames track] (overlap/clutter audit of a real autopilot race),
  spread.mjs (progress badges), intro.mjs (card covers its rider), occl.mjs (gauges dimmed), t15-chev.mjs, t16-toast.mjs,
  t14-tagvals.mjs, t9-perf.mjs; new sandbox scenes quipDock, chipStack, tagLod, koFallback, koEnd.
- Real-race checks: shots/ui-hud/fix1/t*.mjs (weapon, bubbles, police/ticket, intro focus, combo, down labels, km,
  edges, incoming) and shots/ui-hud/fix1b/t13-band.mjs (thin torpedo band), t14-quip.mjs (player quip).

## Fix round 1
Plan (critic reviews/ui-hud-r1-correctness.json + requests from core/content/race/combat). [x] = done + verified.
Resume: skip [x] items.
- [x] 1 weapon uses (major) → weapon.ts reads combat's `rider.weaponUses` (core r2; combat writes it on equip/steal/
  pickup/hit/break): pips = remaining of the weapon's full uses, `?` if a weapon has no finite count (stub combat),
  ∞ for wings, is-last blink at ≤ 1; the HUD's own hit counting + weaponPick reset are gone (events.ts). Verified
  shots/ui-hud/fix1/t7-weapon.mjs: stolen worn baguette HUD 2 = sim 2 → 1 (blink) → break → 翅膀 ∞; crop-t7.png.
- [x] 2 merged callouts (major) → callouts.ts fill() rewrites title (if changed), Chinese line, kind/mod classes, colour
  and ×N on every merge. New asserting scene `node sandbox/hud.shots.mjs --only merge` (drift 1→2→3, place up→down,
  SLIPSTREAM→SLINGSHOT): PASS 'DRIFT L3|三段!', '▼ 5TH|被超了|down', 'SLINGSHOT!|尾流弹射' (fix1/crop-merge.png).
- [x] 3 taunt bubbles (major) → world/avoid.ts (rect settle: up past obstacles, sideways at the ceiling); tags.ts
  exposes the drawn tag boxes (measured size + chip overhang); bubbles.ts rewritten: tail tip above the speaker's
  drawn tag (or head), nearest speaker settles first, then farther ones clear of all tags + earlier bubbles (tail
  hidden once displaced); ≤ 2 float at once, later lines queue nearest-first (≤ 2 s; a queued line hurries a
  floating one out after 1.3 s read; full pool bumps the farthest queued line); off-screen speakers dock flush to
  their side, stacked. Checks: sandbox `--only pack,packLater,behind` PASS (0 bubble-bubble / bubble-tag overlaps);
  real race fix1/t3-bubbles.mjs (pack of 7 + bell, close cat + 2 behind-camera speakers): overlaps [] (t3-*-pack.png,
  t3-*-behind.png).
- [x] 4 BUSTED +4S (major) → penalty bookkeeping gone (events.ts TICKET_HOLD = race's 4 s ticket stop); place.ts shows
  「罚停 4·3·2·1」 next to TIME (slam per digit) while player.mode === 'busted' (counted from police:busted in sim
  time, so a bust while crashed counts down the remaining hold); splash sub 「罚款 100 小鱼干 · 靠边 4 秒」.
  fix1/t5-police.mjs: 罚停4→1 over the hold, back to racing at +4.27 s; finish timer 0:22.20 = results 22.206, no tag.
- [x] 5 POLICE false alarm (major) → edges.ts glow + chip follow police:alert only (heat ignored). fix1/t5-police.mjs:
  heat .95 at 91 % (police 'off') → glow 0 chip 0; real chase → glow .85 chip 1; cleared by the busted alert.
- [x] 6 intro cards (major) → intro.ts picks the subject like race's IntroCamera.focus(): rider nearest in s (≤ 4.5 m)
  to the camera's look point (view ray ∩ look-target height, mirrored from intro-camera.ts; player allowed from 80 %
  of race:intro.duration), keeps the card when nobody is near, repeats allowed, card changes only with the subject
  (min 0.25 s), no grid cycling. fix1/t10-intro.mjs vs __br.race.introFocus(): seeds 4/1/7 → 45/45, 44/44, 45/45
  (was 4/35). Core request 3 (race:introFocus event) would remove the mirrored look height.
- [x] 7 skill band under WRECKED/BUSTED (minor) → director.ts: any splash ≥ WRECKED (also when it comes off the queue)
  retires the band, and bandIn is refused while one is up. Sandbox `--only bandWreck` (skill → crash → 2nd skill):
  PASS only ci-wrecked on stage, 0 visible bands (bandWreck.png).
- [x] 8 km readout (minor) → progress.css: distance-to-go moved right of the finish flag (out of the badge's path;
  the YOU tag no longer needs hiding near the end). fix1/t8-km.mjs at 91 % / finish, 1080p + 720p: overlap=false
  (crop-km91.png, crop-km-end-720.png).
- [x] 9 cast chevrons (minor) → edges.ts shows a hot side chevron only when the caster's head projects off-screen
  (rear chevrons unchanged); tags.ts castFlash(): the caster's tag pulses with a hot outline + yellow 「glyph!」
  chip for 1.1 s (overlay.ts calls both). fix1/t8-edges.mjs: cat 2.5 m ahead / beside-in-view casts → chevrons [],
  tag 「哈基米 7 转!」 flashing; angry cat behind still gets its rear chevron (crop-cast.png).
- [x] 10 callouts during cinematics (minor) → callouts.ts / banner.ts freeze lifetimes while the stack is dimmed
  (calm < 1), so they play after the KO splash. fix1/t11-combo.mjs case B (3rd hit = KO): ONE MORE! held through the
  cinematic and shown at alpha 1 for 1.1 s after cine:ko end ('visible with HUD alpha > 0.5: true', was false).
- [x] 11 down labels (minor) → progress.ts labels by cause from RiderState: crashed with crash.cause 'ko' → KO,
  any other crash → 翻车 (ink), mode 'busted' → 罚停 (police blue). fix1/t11-down.mjs: wall crash 翻车, __br.ko KO,
  busted player 罚停 (crop-down.png).
- [x] 12 projectile warning (minor) → world/incoming.ts: projectile:spawn aimed at the player → hazard chip above the
  bottom edge (▲ glyph INCOMING! 咸鱼鱼雷 · shooter, ETA dead-reckoned in sim time from launch at shooter speed
  + 22 m/s, SPEC §7), side by lateral offset, kept clear of the battle cluster; cleared on projectile:end. Rear
  chevrons now also stay in the free bottom band (20–60 % of the width, they sat on the SP bar). Real race
  fix1/t12-incoming.mjs (pelican rival 18 m behind fires): chip 0.7s→0.1s, gone at the hit (t12-*-incoming.png);
  sandbox `--only incoming,incomingEnd` PASS.
- [x] 13 requests: achievement chip; font warm-up lines; 'launch' callout; UI sfx; thin band while a projectile flies; player quip
  - [x] portrait preload (core) → badge.ts: preloadPortraits() on attach (player main/smug/hurt/eyes + rivals'
    main/smug/hurt, decoded Image refs kept per URL); imgOr() shows the vector silhouette until the <img> is decoded,
    already-decoded art goes in at once (no empty orange frame; sandbox reattach shots show the art on frame 1).
  - [x] 'launch' callout (race) → rider:boost kind 'launch': power ≥ 0.25 → ransom PERFECT START! 起步完美, else
    GOOD START! 起步加速. Callouts + FINAL STRETCH now also wait (frozen, hidden) while any splash is up, so it plays
    right after GO! instead of under it. Sandbox `--only launch` PASS (crop-launch.png). Race may drop its toast.
  - [x] 成就解锁 chip (content req 3 / core r2) → achievement:unlock → chips.ts achievement(): gold icon square,
    成就解锁 ACHIEVEMENT, name, desc; 2.6 s, stacks with rival skill chips by height; frozen during cinematics.
    Sandbox `--only achievement` PASS (crop-ach.png).
  - [x] font warm-up (content req 3) → fonts.ts adds koLines / hurtLines / skillLines, achievement names/descs/icons
    and the new HUD strings (罚停, 起步, 成就解锁, 咕嘟…).
  - Resumed 17:50 by a 2nd fixer. Left: [x] UI sfx · [x] thin band + blank eyes panel · [x] content req 8 player bubble.
  - [x] thin band (combat request) → countdown.ts skillBand() returns a BandCut with thin(); layer.ts slims the player's
    band when projectile:spawn (owner = player, kind = the band's skill) arrives in the same tick: a slim corner band
    upper left (x −360…1200, y ~270–390, in/out on the left), so the shot and its target stay in view (css/cutins.css
    .is-thin). Callouts + FINAL STRETCH also wait while any skill band is up (both bands crossed the callout stack).
    Blank eyes panel: already fixed by the portrait preload (vector eyes until decoded). Sandbox `--only skillThin,
    skillWide,bandCallout` PASS; real race fix1b/t13-band.mjs: torpedo band thin@1 with art eyes, hit at +18 frames,
    gulp band wide (t13-*-torpedo.png).
  - [x] UI sfx (core request) → hud/sfx.ts hudSfx(app.audio) (guarded, logs once) wired in hud.ts; sounds only for what
    audio does not voice: intro banner ui.cutin + each calling card ui.slash, place callouts ui.confirm / ui.back (when
    the callout actually plays), FINAL STRETCH ui.cutin when it slams in, BUSTED stamp ui.stamp at +0.2 s, ticket
    罚停 3·2·1 ui.count, 成就解锁 chip ui.unlock (when it shows, not under a cinematic), KO splash ui.slash on the
    no-cinematic path (audio plays it at cine:ko peak); place ticks ≥ 0.4 s apart (places flicker in a pack).
    Sandbox spy window.__hudSfx: `--only sfx,ticket` PASS.
  - [x] player quip (content req 8) → quip.ts + css/quip.css: a jagged bubble from the cluster portrait (bottom right,
    off the road) with the player character's own lines: koLines on combat:ko by the player (red), skillLines[slot-1]
    on the player's skill:cast (white, ≥ 9 s apart), hurtLines on rider:respawn (ink); lines cycle in order, 2.2 s,
    higher priority (ko > hurt > skill) replaces, lifetime frozen while the HUD is hidden, so the KO line plays after
    the KNOCK OUT cinematic. Sandbox `--only quip,quipKo,quipHurt` PASS (crop-quip*.png); real race fix1b/t14-quip.mjs:
    wing → 借过！翅膀比路宽！, __br.ko → 一口一个！ held at HUD alpha 0 and shown after the cinematic, wall crash →
    我的嘴…… on respawn (t14-*-ko.png).

## Fix round 2
Plan (critics reviews/ui-hud-r2-art.json A1–A10 + ui-hud-r2-correctness.json C1–C7 + fx note "KO splash close on
cine:ko end"). [x] = done + verified. Resume: skip [x] items.
- [x] C1 quip vs docked bubbles (major) → quip.rect() (measured when the line is set) goes to the bubble pass: the right
  dock stack starts above it (never eased below its slot), floating bubbles treat it as an obstacle. Sandbox `--only
  quipDock` PASS (quip/bubble overlaps=0); real race audit (shots/ui-hud/fix2/t/audit.mjs, coast s2 720p, 340 samples):
  bubble/quip 0 after the dock fix (was 19 in the critic's t3).
- [x] C4 player taunts → events.ts routes `taunt` of the player to quip.line() (kind 'taunt', priority = skill); world
  bubbles are rivals only. Sandbox `pack`: 叮叮叮！ shows in the quip, no world bubble.
- [x] C6 static modules → world/zones.ts (HudZones: place/progress/counters/speedo/cluster rects from the 1080p layout
  constants × k, recomputed on resize) + the quip + the chip column (chips.rect()) are bubble obstacles; a bubble that
  cannot settle clear of them docks at its side instead.
- [x] C5 layout reads → bubbles measure in show() (bus handler), the quip in show(), chips in add(); tags measure once
  per race / font load at the start of the HUD frame (world.measure() before any write); no offsetWidth in update().
- [x] A1 tag column (major) → world/taglayout.ts: ≤ 3 full plates (casting > angry > melee target > nearest ≤ 12 m,
  14 m hysteresis, 0.5 s form hold), everyone else a compact place pip (species dot + place, idle form display:none);
  the keep-clear zone above the vanishing point (x 38–62 %, y 25–50 %) is a wall: plates stop at its edge (side
  hysteresis) with a leader line + anchor dot back to the rider, then stack above a blocking plate (details in the
  follow-ups item below). Speakers inside the zone dock their bubble at their side. Audit coast s2 720p: plates/bubbles in the zone 0/340 samples, plate/plate overlaps 2 (form
  transitions), max 3 plates; sandbox `--only tagLod` PASS (full≤3, inZone=0, plate overlaps 0). sheet-race1.jpg.
- [x] C2 chips → chips.ts steps the stack by each card's measured height + 16 px (fallback 100/112). `--only chipStack`
  PASS (3 chips, 0 overlaps).
- [x] A2 progress strip (major) → progress.ts: the player's marker stays at its true share; rival badges fan out in race
  order from it (ahead → right, behind → left, 28 px apart, first one 15 px off the marker, damped, nearest rival on
  top) and red/ink chips beside the marker give the gap to the rider just ahead / behind in metres (+12M / −8M).
  Critic spread metric (shots/ui-hud/fix2/t/spread.mjs, groups > 26 px): coast s4 5–6/7, city s2 7/7 in most samples
  (was 1/7 in 35/37).
- [x] C3 rear chevrons → edges.ts: visible rear chevrons sorted by wanted x and spread ≥ 110 px·k inside the free band
  from the speedometer's tag column to the cluster gauges' left edge (squeezed evenly when needed); side chevrons
  stack per edge. Critic scene t15-chev (5 angry rivals, 720p): 0 chevron overlaps, row 403–801 px vs bars at 801.
- [x] A3 police glow → the siren is now drawn in the world layer under the static HUD (no tint on place/speedo/cluster):
  jagged hazard-tape light bars on the left (red) / right (blue) edges between the corner modules, flashing in turn at
  4 Hz (steady under reduced motion); the POLICE chip stays the label.
- [x] A4 place flash → no blend modes: a white diagonal slash (.pl-slash) wipes across the shard in 0.16 s, clipped to
  the shard polygon (place.ts / place.css).
- [x] A8 1ST star → white star with an ink rim, above the shard and under the text, poking out past the shard's right
  edge, slow spin (sheet-cuts.jpg 'finish').
- [x] A9 yellow → SLIPSTREAM/SLINGSHOT callouts white plate + ink speed stripes; boost arc hot red, BOOST tag
  white/hot stripes; slipstream-ready tag ink/white; achievement chips white on red (gold icon only); weapon-pick
  flash white; NEAR MISS / FINAL STRETCH Chinese lines white / hot. Yellow left: SP bar, SHOWTIME READY, ult diamond,
  hazards (INCOMING, stun, cast flash, ticket digits, crit numbers).
- [x] A7 KO splash (+ fx note) → (a) KNOCK OUT! at 140 px fits between the cards (sandbox ko/ko2/koFallback assert
  title/cards overlaps=0); over a KO cinematic KO/WRECKED use a flatter band (−5°) in the lower 40 % of the frame
  (.ci-cine) so the tumbling victim keeps the centre; without a cinematic the centred layout stays (HUD visible).
  (b) cine:ko end → director.hurry(['ko','wrecked']): the splash skips to its exit and is gone within 0.15 s (sandbox
  koEnd: ko-on-stage=0).
- [x] A5 calling card → intro.ts sideFor(): each card takes the lower corner (right, or left via .ic.is-left) that
  covers less of its rider's projected box, and the half the rider is not on while neither covers it yet; slam-in
  and drop-out directions follow the side. Critic tool (fix2/t/intro.mjs): card covers > 30 % of the focus rider in
  0 samples on coast s4 / s2 / s7 and city s2 (was 3 on coast s4); cards still match introFocus (24–29 shown).
- [x] A6 cluster occlusion → world/occlusion.ts: a rival within 4 m whose projected box is > 20 % inside the gauges
  rect (bars + diamonds + weapon slot, zones.gauges) sets world.gaugesCovered; cluster.occlude() dims those (CSS var
  --gauge-op, not the portrait) to 0.4 at once and restores over ~0.3 s. Critic occl tool + opacity readout
  (fix2/t/occl.mjs): dimmed in 13/13 (coast s4) and 14/17 (city s2; the misses are their behind-camera artefacts
  at −50 m) samples with a rival > 25 % behind the gauges.
- [x] A10/C7 toast lane (cross-unit) → HUD side: chips.ts counts ui-screens' `.br-toast` strips (live
  getElementsByClassName, no layout) and starts the chip column below their lane (src/ui/toast.ts stage top 136,
  ≤ 2 × 84 px) while any is up; chips.rect() follows. Critic scene fix2/t/t16-toast.mjs: toast/chip overlaps [] at
  1280×720 (toast bottom 133, chip top 150) and 1920×1200. Not HUD-owned (cross-unit note below): the corgi lines
  are still ui-screens toasts during cine:ko — race could emit them as `taunt` events from the police rider (the HUD
  bubbles dock them and hide during cinematics), or ui-screens could hide in-race toasts while the HUD is quiet.
- [x] follow-ups found by the real-race audit (fix2/t/audit.mjs): the callout stack is an obstacle for plates (they
  stack above it) and bubbles; docked bubbles climb past name tags at their edge; plates stack deterministically at
  the zone sides (sideways only without room above), side hysteresis 12 % of the zone; a real layout jump (not
  riding with the anchor, not held at the zone edge) re-slams the label in place (1.12, 0.1 s) instead of sliding
  across others; slid plates ride up on a ramp (no toggle); holds never let a 4th plate up; chips enter sideways at
  their slot (no drop across the counters) and older ones slide down at 1600 px/s; side chevrons stack upward (the
  quip is below); slipstream stripes sit in a band left of the lettering; plate HP/place stay current in pip form.
- Side chevrons now sit at 48 % height (clear of the quip) and are obstacles for docked/floating bubbles; rear-chevron
  clearance HALF 74 px·k (t15-chev: 0 overlaps, row 412–796 px vs bars at 801).
- Verification (final tree): tsc 0 errors. Sandbox `node sandbox/hud.shots.mjs` 36/36 PASS (stub); `--live` all PASS,
  sfx/ticket SKIP (the sound spy hears the game's own HUD + real audio there). Real-race audit, 339 samples each:
  coast s2 720p — plates/bubbles in the keep-clear zone 2, no plate/plate, bubble/quip, chip or chevron/chevron
  overlaps (left: callout/callout 12 = the callout stack's own slide, chevron/bars 4 = skewed-bbox corners); city s2
  1080p — zone 6, plate/plate 0, callout/plate 5, bubble/plate 7, chevron/chevron 3 (all transitions, ≤ 2 % of
  samples; critic r2 measured 14/60 and 29/60 samples with a 3+ label column). Critic t14 tag values vs sim:
  185 samples, 0 mismatches. Critic t9 perf (4200 frames, 1080p): ui.update avg 0.19 ms, p99 0.40, max 0.8, 5 frames
  > 0.5 ms, 0 > 1 ms (was 16 / 10 / 2.9 ms). Images: fix2/sheet-race1.jpg, sheet-race2.jpg, sheet-cuts.jpg, tagLod.jpg.
- [x] harness: sandbox/hud.shots.mjs queries only #hud ($h helper), so --live no longer counts the game's own HUD;
  new asserting scenes quipDock, chipStack, tagLod; pack/packLater assert float≤2 (docked bubbles are extra).
