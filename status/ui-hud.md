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
1. RiderState.weaponUses: number (combat writes it; Infinity for 'none') — or add `uses` to combat:weaponPick.
2. Optional: 'projectile:spawn' { id, owner, target: RiderId | null, kind, pos } so edges.ts can warn precisely.

## How to test
- Sandbox (stub units): http://127.0.0.1:5300/sandbox/hud.html (?live=1 = real units). Driver: window.__hud
  (pose(name), fire(cut, opts), place(id, ds, x), reset(), freezeSim(on), dispose(), names()).
- Screenshot tour: node sandbox/hud.shots.mjs [--only a,b] [--size 1280x720] [--live] → shots/ui-hud/*.png
- Real race: node tools/shot.mjs --url "/?race=coast&seed=4" --step 600 --controls '{"throttle":1}' --out shots/ui-hud/x.png

## Fix round 1
Plan (critic reviews/ui-hud-r1-correctness.json + requests from core/content/race/combat). [x] = done + verified.
Resume: skip [x] items.
- [ ] 1 weapon uses (major): rider.weaponUses when finite, else per-rider event tracker; '?' when unknown
- [ ] 2 merged callouts keep stale cn/mod (major): rebuild text/class on merge + sandbox assert scene
- [ ] 3 taunt bubbles pile up (major): one layout pass with tags, de-overlap bubbles, dock stacking, cap 2
- [ ] 4 BUSTED +4S invented (major): drop penalty; ticket hold countdown while mode 'busted'; splash sub
- [ ] 5 POLICE false alarm (major): glow/chip from police:alert only
- [ ] 6 intro cards vs camera (major): card the rival at the camera's look point; core request race:introFocus
- [ ] 7 skill band under WRECKED/BUSTED (minor)
- [ ] 8 km readout under the player badge (minor)
- [ ] 9 side chevron for on-screen casters (minor): edge only when off-screen; flash the tag instead
- [ ] 10 callouts swallowed by cinematics (minor): freeze lifetimes while calm < 1
- [ ] 11 progress strip says KO for every down rider (minor)
- [ ] 12 projectile:spawn/end warning (minor)
- [ ] 13 requests: achievement chip; font warm-up lines; 'launch' callout; UI sfx; portrait preload; thin band while a projectile flies
