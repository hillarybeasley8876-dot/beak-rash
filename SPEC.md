# 暴力鹈鹕 BEAK RASH — game bible

A 3D arcade combat racer in the spirit of Road Rash (暴力摩托): a pelican on a bicycle races seven
other animals down open roads, fighting with wings, salted fish and signature skills. Knocking a
rival out triggers a slow-motion cinematic. The UI is a Persona 5–style red/black/white comic overlay.
The title riffs on the LLM benchmark "Generate an SVG of a pelican riding a bicycle" (now in 3D).

## 0. Pillars (what every review checks first)
1. **Handling feel**: responsive, weighty, readable at speed. Steering answers within 2 frames, no
   floatiness, satisfying drift + mini-turbo, hops, jumps, slipstream. 60 fps on an M1 at 1080p.
2. **Combat & skills**: every swing, hit and skill reads instantly: anticipation, impact (hit-stop,
   shake, flash, particles, sound), reaction (wobble, knockback, damage numbers).
3. **KO slow-mo (升格)**: wrecking a rival is the money shot: hit-stop → time ramps to ~0.1× →
   cinematic orbit camera → victim tumbles off the bike in slow motion with feathers/debris →
   P5 "KNOCK OUT" splash → whoosh back to full speed. 1.2–1.8 s real time, never boring on repeat.
4. **P5 UI**: aggressive diagonal layouts, ransom-note lettering, jagged red/black shapes,
   halftone, stars, constant subtle motion, snappy transitions. Every screen, HUD and cut-in.
5. **Memes everywhere**: taglines, taunts, billboards, signs, loading tips, achievements, weapons,
   bikes — Chinese internet humour, light and good-natured. No real people, no brands, no politics,
   nothing mean-spirited or crude.

## 1. Run, tools, testing
- Stack: Vite 8 + TypeScript (strict, no `any`) + three 0.186. Project root `~/m/beak-rash`.
- Dev server (shared, port 5300, **HMR off**: pages see changes on reload): `tools/devserver.sh` (idempotent).
  Never start your own Vite on another port; never kill the shared server unless it is wedged.
- Typecheck: `npx tsc --noEmit -p tsconfig.json` — fix errors in YOUR files; ignore other units' errors.
- Do NOT run `npm install`/`npm ci` (shared node_modules). Need a package? Write it in your status file.
- Screenshots: `node tools/shot.mjs --url "/?race=coast&seed=3" --out shots/<unit>/x.png --step 300 --controls '{"throttle":1}'`
  (`--step N` = N deterministic frames in manual mode; `--wait ms` = real time; `--browser webkit`).
- Custom Playwright scripts: `import { withPage } from '../tools/lib.mjs'` → `withPage(async (page, h) => { await h.goto('/?race=coast'); await h.step(120); await h.shot('shots/u/a.png'); })`.
  Helpers: goto, step(frames, dt), realtime(), controls({...}), press(action), snapshot(), errors(), eval(js), shot(file), key(code, ms).
  Browser slots are capped machine-wide (5); scripts wait their turn. Always let withPage close the browser.
- Put screenshots under `shots/<unit>/` (gitignored). View them with the Read tool — LOOK at your work.
- URL params: `race=<trackId>` jump into a race · `seed=` · `bike=` · `rivals=goose,cat` · `traffic=0` · `police=0`
  · `autopilot=1` (AI drives the player) · `quality=low|medium|high` · `manual=1` · `screen=<ScreenId>`
  · `stub=world,actors,…|all` (use core stubs for those units — isolate your unit from others' breakage).
- Debug API `window.__br` (src/core/debug.ts): start, show, setControls, press, manual, step, setScale,
  teleport, ko(victim, attacker), snapshot, errors. Extend debug features inside YOUR unit via
  `window.__br` sub-objects only if needed (e.g. `__br.fx = {...}`), never by editing core files.
- Sandboxes: each unit may add `sandbox/<unit>.html` + `sandbox/<unit>.ts` (served at /sandbox/<unit>.html)
  for isolated turntables, galleries, test benches. Production build ships index.html only.

## 2. Conventions
- Units: metres, seconds, radians, m/s. three.js Y-up. **Models face −Z**, +X right, +Y up.
- Track space: `s` metres along the centre line (0 = start, `track.length` = finish), `x` lateral
  (+ = right of travel), `y` height above the road surface. Riders/obstacles live in track space;
  `physics.pose()` and `track.toWorld()` convert.
- Two clocks (core/clock.ts): sim time (scaled by named layers + hit-stop) for gameplay and sim-driven
  animation; real time for cameras during cinematics, UI and audio. `clock.setScale(name, v, ramp)`,
  `clock.hitStop(s)`. Layer names in use: `pause` (game), `ko` (fx KO director), `ult` (fx), `skill:*`.
- Frame order (core/session.ts): per substep (≤1/120 s) controls → logic.preStep → combat.preStep →
  physics.step → combat.postStep → logic.postStep; per frame: views.update(pose) → track.update →
  rig.update → fx.update → fx.render → ui.update → audio.update.
- Cross-unit communication ONLY via core/contracts.ts interfaces, core/types.ts data, and bus events
  (core/events-map.ts). Need a new event or field? Add it in your status file under "core requests";
  the integrator (main session) applies it. Meanwhile keep your own extra data private to your unit.
- Shared look helpers: `src/render/toon.ts` (`toon(color)`, `outline(root, width)`). fx may tune ramp.
- Errors: no empty catch, no swallowed promise rejections; log with a `[unit]` prefix.
- Every module ≤ ~400 lines; split by responsibility (one file = one job). No dead code.

## 3. Units and file ownership (edit ONLY your files; read anything)
| unit | owns | contract |
|---|---|---|
| core (main session) | `src/core/**`, `src/render/**`, `src/main.ts`, `index.html`, `*/stub.ts`, `tools/lib.mjs`, `tools/shot.mjs`, `tools/devserver.sh`, `SPEC.md` | — |
| track | `src/world/**` (not stub.ts), `src/data/tracks.ts`, `sandbox/track.*` | `createTrack`, optional `preload` |
| sim | `src/sim/**`, `src/camera/**` (not stub.ts), `sandbox/sim.*`, `tools/feel-*.mjs` | `createPhysics`, `createCameraRig` |
| actors | `src/actors/**` except `src/actors/bikes/**`, `sandbox/actors.*` | `createRiderView`, optional `preload` |
| bikes | `src/actors/bikes/**` (not stub.ts/types.ts), `sandbox/bikes.*` | `createBike` (actors/bikes/types.ts) |
| combat | `src/gameplay/combat/**`, `src/data/skills.ts`, `src/data/weapons.ts`, `sandbox/combat.*` | `createCombat` |
| race | `src/gameplay/race/**`, `sandbox/race.*` | `createRaceLogic` |
| fx | `src/fx/**`, `sandbox/fx.*` | `createFx`, optional `preload` |
| ui-screens | `src/ui/**` except `src/ui/hud/**`, `sandbox/ui.*` | `createUi` |
| ui-hud | `src/ui/hud/**`, `sandbox/hud.*` | `mountHud(app, layer)` used by ui-screens (see §9) |
| audio | `src/audio/**`, `public/assets/voice/**`, `src/data/voice.ts`, `tools/gen-tts.mjs`, `sandbox/audio.*` | `createAudio`, optional `preload` |
| assets | `public/assets/{portraits,art,billboards}/**`, `src/data/assets.ts`, `tools/gen-image.mjs`, `tools/cutout.*` | manifest |
| content | `src/data/roster.ts`, `src/data/bikes.ts` (text only; numbers belong to sim/combat via status requests), `src/data/{tips,memes,achievements,strings}.ts` | data |

## 4. Rules for every agent (hard)
- **HARD API LIMIT: each Write/Edit ≤ 120 lines.** Build big files in parts (Write the first part,
  then Edit-append). Keep thinking steps short; put your plan in your status file, not in one giant reply.
- **Never break importers**: a file other units import must stay syntactically valid after every edit.
  Build large new modules as `*.wip.ts` (not imported anywhere), then `mv` into place when complete.
  Keep exported names/signatures stable; add, don't rename.
- Checkpoint in `status/<unit>.md` after each milestone: done / in progress / next / known issues /
  core requests / how to test. A resumed agent continues from it.
- Test in the browser and LOOK at screenshots before declaring anything done. Check `__br.errors`.
- Performance budget (whole game, high quality): ≤ 600 draw calls, ≤ 1.5 M triangles, 60 fps at 1080p
  on M1 Max. Instance or merge repeated geometry; share materials; dispose what you create.
- No network at runtime (assets are local files). No `Math.random()` in gameplay — use `session.rng`
  (or a forked Rng); cosmetic randomness may use any Rng.
- Clean up: close browsers, delete scratch files you made outside `shots/`.

## 5. Art bible
**3D look**: designer-vinyl toys / chunky cartoon. Cel shading (render/toon.ts 3-band ramp) + black
inverted-hull outlines (characters/bikes 0.02–0.03 m, vehicles/props 0.04 m) + a cool rim light.
Smooth organic forms (no visible faceting on characters: SDF/metaball blends or subdivided shapes),
saturated flat colours, readable silhouettes from 6 m behind at speed. Never stick figures (火柴人):
volumes, proper proportions, expressive eyes (sclera + pupil + highlight), species-defining features.

**Characters** (all wear a cycling helmet in their accent colour unless noted; head ≈ 1/3 height):
- Pelican 阿鹕 (hero): white body, grey-tinted wings with black primary tips, S-curved neck, small head
  with a tuft, HUGE orange-yellow beak with red hooked tip and a stretchy pink-orange gular pouch
  (inflatable — Big Gulp skill), red helmet + goggles, wings grip the bars, orange webbed feet on pedals.
- Goose 鹅霸: white, orange beak with black nail, long upright neck, ANGRY brows, no helmet (bandana).
- Capybara 卡皮: brown barrel body, boxy head, sleepy half-closed eyes, tiny round ears, a yuzu on its head.
- Cat 哈基米: orange tabby, round head, cheeky grin; OIIA skill = whole cat spins on the saddle.
- Shiba 神烦狗: tan with cream cheeks, curled tail, pixel "deal-with-it" sunglasses, doge side-eye.
- Pigeon 咕咕: grey, iridescent green/purple neck, orange eyes, head-bob while pedalling.
- Penguin 滑总: black/white, yellow beak & feet, round; belly-slide skill lies flat on the bike.
- Seagull 薯条大盗: white, grey wings, yellow beak with red spot, shifty eyes, a fry in the beak.
- Sloth 闪电: shaggy brown, dark eye patches, eternal smile, slow blinks (fast only in its skill).
- Corgi 柯基警官 (police): orange/white, huge ears, legs too short for the pedals, police cap + vest, whistle.

**Environments**: Coast (Pelican Bay, wave 1): noon sun, turquoise sea, cream sand, white villas with
terracotta roofs, palms, red/white lighthouse, pier, fish market, sailboats, gulls, meme billboards.
City (Neon Night, wave 2): navy/purple night, wet reflective road, neon in magenta/cyan/yellow, towers
with lit windows, P5-Tokyo vibe with red accents. Mountain (Sunset Pass, wave 2): gold-pink sunset,
layered purple ridges, pines, cliffs, guard rails, switchbacks, a tunnel, a pagoda viewpoint.

**UI (P5-inspired, original)**: palette red `#E5191C` (hot `#FF1E3C`), black `#0B0B0F`, white; yellow
`#FFE600` only for SP/warnings. Fonts (bundled @fontsource): EN display Anton / Bebas Neue / Bangers;
CN ZCOOL QingKe HuangYou (blocky), ZCOOL KuaiLe (playful), Ma Shan Zheng / Zhi Mang Xing (brush, for
splashes), Noto Sans SC 900 (heavy body). Ransom-note lettering: each glyph its own box, mixed fonts,
±8° rotation, black-on-white / white-on-black / white-on-red, ±20 % scale. Everything skewed −8…−14°,
jagged clip-path polygons, star bursts, halftone dot fields, torn edges, thick outlines. Motion: slams
(1.4→1 with overshoot), 120–200 ms diagonal slashes, 12 fps idle jitter of 1–2 px, screen transitions
≤ 450 ms; honour prefers-reduced-motion. Do NOT copy Persona assets, logos or catch-phrases (no
"Take Your Heart/Time", no "All-Out Attack"): ours are SHOWTIME!, KNOCK OUT!, ONE MORE!, FINISH!, BUSTED!.

## 6. Handling & camera targets (sim unit; feel critic measures these)
- Speed: roadbike top 20 m/s (72 km/h) on the flat; 0→60 km/h in 4.0–4.8 s; accel tapers ~(1−(v/top)²).
  Brake 12 m/s². Coasting drag ~0.6 m/s². Slopes: a −= 9.8·slope·0.55.
- Steering: lateral-velocity target `steer · handling · lerp(4.5, 7.5, v/top)` m/s, reached with time
  constant ≈ 0.07 s on asphalt (grip scales it). Visual yaw = atan2(vx, v). Lean = atan(a_lat/g) smoothed
  (λ≈12), max 38°. Input→visible response ≤ 2 frames. No oscillation/overshoot when releasing.
- Curves push outward: `ax −= curvature·v²·0.8`, so fast corners need ~60–80 % steer — readable, fair.
- Drift (Shift + steer, v > 8 m/s): slip angle builds to 25–30°, turn authority ×1.35, speed bleeds
  ~4 %/s. Charge: L1 0.55 s (blue sparks), L2 1.2 s (orange), L3 2.0 s (pink). Release → boost 0.45/0.85/1.3 s
  at +22/+28/+35 % top speed. Ends below 6 m/s or on collision. Emits rider:drift / rider:boost.
- Hop (Space): vy 4.6 m/s, stylised gravity 24 m/s² (snappy ~0.38 s hop). Crests launch naturally when
  v²·(vertical curvature) > g; ramps launch by angle. Air steering 35 %. Landing level & straight (|yaw| <
  12°) after ≥ 0.35 s air → PERFECT (+20 % for 0.6 s). Landing > 45° yaw from > 2.5 m → crash.
- Slipstream: within 12 m behind a rider and |dx| < 1.6 m → draft 0→1 over 0.6 s: +10 % top, +15 % accel;
  pulling out with draft > 0.8 → slingshot +15 % for 0.8 s.
- Surfaces: grass top ×(0.55+0.45·offroad) & wobble; sand ×0.45; dirt ×0.8; puddle grip ×0.6 + splash;
  oil → `oiled` status grip ×0.25 for 1.2 s; curb = rumble. Walls bounce (vx ×−0.35, speed −25 %·impact,
  sparks, shake); hard angle > 18 m/s → crash. Falling into water/void → crash 'water'.
- Rider contacts in track space (|ds| < 1.7, |dx| < 0.75): push apart by mass (bike weight × stats.weight),
  swap lateral velocity, hard bumps (Δvx > 3) deal 2–5 dmg + wobble. Traffic: relative speed > 8 m/s → crash.
- Crash: rider launched (forward 0.7 v, up 4–7 m/s, lateral, spin 4–9 rad/s) in `rider.crash`; out 2.6 s,
  then 'respawning' 0.6 s blink at a safe x near the crash point, invuln 2 s, HP refilled to 70 %.
- Boost API: anyone may set `boostTime = max(boostTime, t)` and `boostPower = max(...)`; physics applies it.
- Camera: spring-follow (critically damped, ω 9–12) behind along a blend of track tangent (70 %) and
  bike heading; distance 4.6→5.6 m and height 1.9→2.2 m with speed; look 5→9 m ahead at 1 m; FOV
  62→74 with speed, +8…12 kick on boost; roll = lean·0.18; never below 1.2 m above road. Trauma shake
  (hits .25, heavy .45, crash .6, landing .15·air, curb .05). C = look back. Cinematic override blends
  back in ≤ 0.35 s with no pops. Listens to `cam:shake` / `cam:kick` / `hitstop` bus events.

## 7. Combat, weapons, skills (combat unit)
- Keys: J swing left, L swing right, K heavy (auto side), U/I/O skills, P ult, B bell (taunt).
- Swing: windup .06 s (heavy .16) → active .10 (.12) → recover .16 (.24). Hits the first rival on that
  side within lateral 0.4…weapon.reach and |ds| < 1.6 m (not intangible). Damage by weapon (data/weapons.ts)
  scaled by power stat; 10 % crit ×1.6; hitting a rival mid-windup = counter crit.
- Reaction: victim lateral impulse = knock (heavy ×1.5), speed −5…10 %, 'hit' action cancels their swing,
  'wobble' 0.4 s. Hit-stop .045 / .08 heavy / .1 crit (`clock.hitStop`). Combo ≥3 within 1.5 s gaps →
  "ONE MORE!" (+10 SP, next hit crits).
- SP gain: hit +6, hurt +3, KO +20, drafting +1/s, near miss +4, perfect landing +8, drift L3 +5, bell +5.
- Weapons: rivals start armed by level; heavy hits knock weapons loose (30 % light / 60 % heavy):
  unarmed attacker steals it, else it drops as a road pickup. Weapons break after `uses`.
- Pickups (track 'pickupRow' features + drops): 小鱼干 coins, fish (+25 HP), weapon crate, 能量鱼罐头 (+25 SP).
- KO: hp ≤ 0 → `combat:ko` (credit lastHitBy within 3 s) → `physics.crash(victim,'ko')`; attacker +1 KO,
  +50 coins, +20 SP. Respawned riders return at 70 % HP.
- Bell: rivals within 15 m turn 'angry' (target you) and you gain +5 SP (cooldown 3 s). 叮叮叮!
- Skills (ids in data/skills.ts; AI fires its 'sig' skill via controls.skill1):
  pelican.torpedo — homing salted fish (nearest rival ahead ≤ 60 m, ±25°), +22 m/s, 14 dmg + 0.6 s stun.
  pelican.gulp — pouch inflates 1.2 s: swallows projectiles, vacuums pickups ≤ 4 m; a small rival
  (scale ≤ 0.85) within 2.5 m is gulped (vanishes .8 s) then spat 15 m backwards (25 dmg); bigger rivals
  get bitten (12 dmg + weapon stolen).
  pelican.wing — wings out 2.2 s: +40 % top speed, ramming knocks riders aside (8 dmg) without slowing you.
  pelican.ult SHOWTIME (SP 100) — cut-in, leap to 8 m in slow-mo, dive-bomb; shockwave hits riders 40 m
  ahead / 12 m behind: 45 dmg + knock + 1 s stun (usually a chain KO).
  goose.honk (cone 14 m ±30°: stun .8 s, −15 % speed) · capybara.chill (aura 10 m, 4 s: others ×0.85 speed,
  can't attack) · cat.spin (.8 s spin, 2.6 m radius, 10 dmg + knock) · shiba.doge (3 s shield reflects melee,
  +15 % speed) · pigeon.ghost (1.5 s invisible+intangible, reappear 25 m ahead) · penguin.slide (2.5 s
  melee-immune, +25 % speed) · seagull.steal (nearest ≤ 6 m: weapon or 20 SP) · sloth.flash (3 s +60 % top,
  instant accel) · corgi.whistle (offenders ahead ≤ 20 m: slow 1 s).

## 8. KO slow-mo cinematic (fx unit: `fx/ko/director`)
Trigger: `combat:ko` where the player is attacker or victim, or `ult:impact`. Timeline (real time):
- 0 ms: `clock.hitStop(0.09)`, white-red flash frame, chromatic punch; emit `cine:ko {phase:'start'}`.
- 90 ms: `clock.setScale('ko', 0.1, 0.12)`; camera override → low 3/4 angle on the victim (2.5–3.5 m),
  slow orbit 20–30°/s + gentle dolly-in; letterbox bars slide in; post: desaturate except reds, radial
  zoom blur + speed lines centred on the victim, halftone overlay, vignette, slight film grain.
- Victim (actors view, driven by `rider.crash`) leaves the bike: tumbling body, helmet pops off, bike
  cartwheels separately, feathers/fur/sparks/debris drift in slow motion. Emit `{phase:'peak'}` at ~450 ms
  (UI slams the KNOCK OUT splash; audio drops bass + muffles music).
- ~1300 ms: `setScale('ko', 1, 0.25)` whoosh, camera blends back to chase (≤ 0.35 s), post FX fade;
  `{phase:'end'}`.
- Chains: another KO within the window extends it once (chain = 2, 3…: "DOUBLE/TRIPLE KNOCK OUT").
  Repeated KOs within 10 s use a 60 % shorter variant; settings.slowmo 'short'/'off' respected.
- Player wrecked: shorter (0.9 s), camera from the side of the tumbling pelican, red tint, "WRECKED".
- Everything restores cleanly if the race ends or the session is disposed mid-cinematic.

## 9. Race, AI, traffic, police (race unit)
- Flow: intro (≈3 s grid flyover via `rig.override`, rival names) → countdown 3-2-1-GO (`race:countdown`;
  holding throttle on GO gives a launch boost) → racing → each rider crossing `track.length` finishes →
  player finishes (or 60 s after the winner) → `race:end` with results (DNF for unfinished).
- Standings by s (finished riders by time). `race:placeChange` events. `race:finalStretch` at 85 %.
- AI: racing line (curve apex, avoid walls), throttle/brake, drafting, overtaking, avoid traffic &
  obstacles, use drift on sharp curves, attack riders alongside (aggression per species/level), fire
  signature skills when useful, react to 'angry', taunt (`taunt` event, roster lines, ~1 per 8 s per rider
  near the player). Rubber band: gentle (±8 % top speed) so races stay close; never cheat visibly.
- Traffic (when config.traffic): cartoon cars/vans/trucks/buses in lanes, some oncoming in the left
  lanes; density by level; honk when you're close (`traffic:honk`); obstacles kept in `session.obstacles`
  (physics collides). Simple toon meshes with outlines owned by race unit.
- Police (config.police): Corgi officer on a bike spawns when player heat > 0.5 (heat from hitting
  rivals / crashing into traffic near the police); siren + whistle; if it stays alongside you for 2 s
  while you're slow or crashed → BUSTED: `police:busted` (fine 100 coins, 4 s time penalty, P5 splash),
  then race continues. Outrun it to lose heat.
- Results: coins = place bonus [500, 300, 200, 120, 80, 50, 30, 10] + 50/KO + pickups; saved by ui/game.

## 10. UI (ui-screens + ui-hud), DOM overlay in `#ui` (pointer-events on interactive parts only)
Navigation works with keyboard (↑↓←→ / WASD, Enter/Space confirm, Esc/Backspace back), gamepad (via
`input.onAction`) and mouse. Screens (ui-screens):
- boot: 1 s P5 splash → title. title: key art + ransom-note logo 暴力鹈鹕 / BEAK RASH, subtitle
  "Generate an SVG of a pelican riding a bicycle —— 这次是 3D 的。", pulsing "按任意键 PRESS ANY KEY",
  animated red/black halftone + rotating star. Any key unlocks audio (`audio.unlock()`).
- menu: skewed items 巡回赛 CAREER · 快速比赛 QUICK RACE · 车库 GARAGE · 设置 CONFIG · 操作 HOW TO · 致谢
  CREDITS; jagged red cursor; pelican portrait; 小鱼干 balance; hint bar.
- career: tiers 1–3 × tracks, locks, best place; trackSelect: 3 track cards (art, name, blurb, ★ difficulty,
  weather) → `flow:startRace`. garage: bike shop with a live 3D turntable (its own small WebGLRenderer
  using `createBike` from `src/actors/bikes`), stat bars, price, buy/equip (save), meme blurb.
- loading: P5 calendar-style date card (today + track weather line), meme tip, road-shaped progress bar
  with a running pelican icon. pause: 继续 / 重新开始 / 设置 / 退出比赛 + standings + controls sheet.
- results: "RESULTS" slam, podium portraits, table (place, time, KOs, coins), grade stamp S/A/B/C/D with a
  meme title, coins counting up (save), achievements, buttons 再来一局 / 下一站 / 车库 / 主菜单.
- settings (volumes, quality, shake, auto-pedal, slow-mo full/short/off, reset save), howto (keyboard +
  gamepad diagram, skills), credits (meme credits).
ui-hud (in race; `src/ui/hud/contract.ts`): place (giant skewed "3RD /8"), progress strip with rival head
icons + finish flag, timer; jagged speedometer + drift-charge sparks colour; P5 battle-style cluster
bottom-right: tilted pelican portrait, HP bar, SP bar (glows "SHOWTIME READY [P]"), U/I/O skill
diamonds with glyph + cooldown sweep, weapon slot (name + uses). World-anchored: rival name tags + HP
within 25 m, taunt speech bubbles, damage numbers, incoming-projectile warning, police edge glow.
Cut-ins: skill (diagonal band with an eyes close-up + nameEn + 中文名, ~0.6 s; small ones for rivals near
you), SHOWTIME (full-screen ult cut-in ~1 s), KNOCK OUT / DOUBLE… (at `cine:ko` peak), WRECKED, BUSTED,
FINISH (+place), countdown 3-2-1-GO, PERFECT, DRIFT L1–3, NEAR MISS, SLIPSTREAM, ONE MORE!, place change.
Quiet while cruising; loud on events. Portraits: `public/assets/portraits/<id>_{main,smug,hurt,eyes}.png`
(see `src/data/assets.ts`); fall back to a silhouette card if missing.

## 11. Audio (audio unit)
WebAudio graph: music / sfx / voice buses → compressor → master; `setMuffle` = low-pass + duck (slow-mo,
pause). Procedural ORIGINAL music in the acid-jazz/funk spirit (120–130 bpm, slap synth bass, FM Rhodes
7th/9th chords, swung drums, brass stabs, wah lead hooks): title, menu, race-coast, race-city,
race-mountain, results, adaptive final-stretch layer, stingers (ko, showtime, busted, finish, countdown).
Synth SFX: chain whirr + freewheel ticks + wind (speed-linked), surfaces, bell 叮, swings/hits per weapon
(fish slap, baguette thwack, pan BONG, slipper SLAP, keyboard clack), crit, block, KO boom, crash tumble,
splash, scrape, drift hiss, boost, hop/land/perfect, every skill, animal calls (honk, meow, bark, coo,
gull cry), traffic horns, police siren/whistle, UI tick/confirm/back/cut-in/coin. Rival SFX panned and
attenuated by position. Voices: Chinese TTS lines pre-generated to `public/assets/voice/*.mp3` with
`tools/gen-tts.mjs` (internal API `https://ys-api.xaminim.com/api/minimax_tts`, body `{text, voice_id?}`
→ mp3 URL; IOA VPN; never at runtime): announcer (三！二！一！冲！/ 击倒！/ 双杀！/ SHOWTIME！/ 完美落地！/
第一名！/ 被抓了！/ 最后冲刺！…) + a few barks per character. Missing files must not break anything.

## 12. Content & memes (content unit; seed list — expand, keep it kind)
Loading tips (鹈鹕喉囊能装 11 升水，装不下你的 KPI；咸鱼也能翻身，先把它扔出去；二八大杠载过三代人的梦想；
鸽子说下次一定，那就是不会；卡皮巴拉从不着急，因为急也没用；大模型画的鹈鹕骑车，链条总接在脖子上；
PERFECT 落地有加速，别问自行车为什么能飞；本游戏没有真实鹈鹕受伤…). Billboards & signs: 鹈鹕牌沙丁鱼罐头 ·
V我50小鱼干 · 前方大鹅出没 请绕行 · 禁止投喂鹈鹕 · 限速：随缘 · 内卷车道/躺平车道 · 珍爱生命 远离大鹅 ·
注意落鱼 · 今日宜：撞人. Grades: S 鹈鹕之神 · A 鱼塘霸主 · B 普通鹈鹕 · C 鸽了 · D 咸鱼. Achievements:
咸鱼翻身 (win from last), 一鱼两吃 (double KO), 和平从来不是选项 (KO the goose), 情绪稳定 (finish without
attacking), 下次一定 (get passed by an invisible pigeon), 腿短不是借口 (outrun the corgi)…

## 13. Assets (assets unit)
AI images via internal API (IOA VPN; `tools/gen-image.mjs`): `POST https://ys-api.xaminim.com/api/nano_banana_image`
`{model_name:"nano_banana", prompt, aspect_ratio:"3:4"|"16:9"|"1:1"}` → `{data:"{\"task_id\":…}"}`; poll
`POST …/nano_banana_image_query {task_id}` every 10 s until `data` is an https URL; download PNG.
Style: bold sticker comic, thick black ink outlines, flat cel shading, crimson red/black/white burst
backgrounds + the character's own colours, halftone, no text/letters/watermarks. Cut out the white
background (flood fill from edges → alpha, keep outlines). Outputs: per character `<id>_main` (3/4 riding
pose), `<id>_smug`, `<id>_hurt`, `<id>_eyes` (wide eyes close-up strip); title key art; menu/loading
backgrounds; 6–10 billboard posters per track (text-free; track unit overlays Chinese text). Write
`src/data/assets.ts` (manifest of files that exist). Keep originals' prompts in `public/assets/PROMPTS.md`.
