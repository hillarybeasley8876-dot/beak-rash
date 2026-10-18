# ui-hud status

## Done (all in src/ui/hud/, every file ≤ 235 lines; index.ts now exports the real createHud)
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
- Other units' bugs seen while testing (not touched): audio/events-race.ts + events-combat.ts throw
  "h.isPlayer is not a function" on rider:crash / cine:ko / combat:ko (bus isolates it; use ?stub=audio).
- Weapon uses are counted by the HUD from combat:hit/weaponPick (combat keeps the real count private), so a
  stolen/picked-up worn weapon shows full uses until it breaks. Needs the core request below.
- "Incoming projectile" warnings use rival skill:cast near the player (no projectile event exists).

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
- [ ] 13 requests: achievement chip; font warm-up lines; 'launch' callout; UI sfx; thin band while a projectile flies
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
