# 暴力鹈鹕 BEAK RASH — game bible

> **DESIGN DECISION (integrator, 10-19): the player always rides the pelican 阿鹕. There is no character select; the other seven species are rivals.** SPEC §10 lists no character-select screen, and the menu/HUD/results are built around the pelican. Critics: don't report the missing character select as a defect. Fixers: skip such issues.
>
> **IMAGE BUDGET (applies to everyone).** Six critics died today with "Request timed out" after they had Read 30–45 full-size screenshots, because the request grows with every image. Before you Read a screenshot, convert it (`python tools/thumb.py in.png` → in.jpg, 1280 px; several files → `-o sheet.jpg` contact sheet; on macOS `sips -Z 1280` also works). Read at most ~15 images in total for your whole task.
>
> **WINDOWS (since 2026-10-25).** The working copy is `H:/dev/beak-rash` on Windows 11 (Git Bash). `python` not `python3`; no `sips`/`open`; Chromium renders through ANGLE D3D11 on an RTX 3090 (tools/lib.mjs picks the backend per OS); never write to the C: drive (scratch → `shots/` or `F:/dev/beak-rash-out/`).

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
- Stack: Vite 8 + TypeScript (strict, no `any`) + three 0.186. Project root `H:/dev/beak-rash` (was `~/m/beak-rash` on the Mac).
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
  bike heading; distance 4.3→5.1 m and height 1.9→2.2 m with speed; look 5→9 m ahead at 1 m; FOV
  60→70 with speed, boost kick counter-dollied so the rider never shrinks (hero ≥ 24 % of screen height); roll = lean·0.18; never below 1.2 m above road. Trauma shake
  (hits .25, heavy .45, crash .6, landing .15·air, curb .05). C = look back. Cinematic override blends
  back in ≤ 0.35 s with no pops. Listens to `cam:shake` / `cam:kick` / `hitstop` bus events.

## 7. Combat, weapons, skills (combat unit)
- Keys: J swing left, L swing right, K heavy (auto side), U/I/O skills, P ult, B bell (taunt).
- Swing: windup .06 s (heavy .16) → active .10 (.12) → recover .16 (.24). Hits the first rival on that
  side within lateral 0.4…weapon.reach and |ds| < 1.6 m (not intangible). Damage by weapon (data/weapons.ts)
  scaled by power stat; 10 % crit ×1.6; hitting a rival mid-windup = counter crit.
- Reaction: victim lateral impulse = knock (heavy ×1.5), speed −5…10 %, 'hit' action cancels their swing,
  'wobble' 0.4 s. Hit-stop .045 / .08 heavy / .1 crit (`clock.hitStop`). Combo ≥3 within 1.5 s gaps →
  "ONE MORE!" (+2 SP, next hit crits).
- SP gain (r3): swing hit +2.5 (once per 4 s per rival, +0.5 for the swings in between), skill hit +1, hurt +1.5, KO +10,
  ONE MORE +2, drafting +1/s, near miss +4, perfect landing +8, drift L3 +5, bell +3, energy can +20. SHOWTIME's own
  hits/KOs pay nothing, and the caster's fighting pays no SP for 12 s after a cast (target: 1–2 SHOWTIMEs per race).
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
  ahead / 20 m behind: 45 dmg + knock + 1 s stun (usually a chain KO); the leap only homes forward, never costing places.
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

---

# r4 — DEEPER GAME (2026-10-25, owner's requests)
The owner asked for: police that fight, more easter eggs, more complex mechanics (air tricks + STYLE
chains, throwable weapons + weapon traits, persistent rivals + alliances, random track events) and more
varied maps (2 new tracks, weather/time variants, reverse direction, seeded routes). §14–§21 are the design;
§22 lists every contract the integrator added in core. Numbers live in each unit's tuning table; the values
below are the starting point. Everything stays kind and cartoonish (pillar 5): nobody bleeds, cops are corgis.

## 14. Police 2.0 — wanted stars (race unit, `gameplay/race/police*`)
- Wanted level W 0..3 on the player (race-owned, emitted as `police:wanted`). Hysteresis on heat:
  W1 heat ≥ 0.50 (spawn, today's behaviour) · W2 heat ≥ 0.75, or the player knocked the corgi twice this chase,
  or KO'd a rival within 30 m of it · W3 heat ≥ 0.95, or a corgi went down (§14 fight back), or a bribe was refused
  twice. Escape ('lost'), let-go and bust reset W to 0 (heat as today). Extra heat: a thrown weapon hits a corgi
  +0.10, a rival KO within 30 m of a corgi +0.15, hitting traffic within 40 m of a corgi +0.05.
- W1: whistle + ticket exactly as today.
- W2 baton (警棍, WeaponId `baton`, police only): when |ds| ≤ 1.5 m and the lateral gap is 0.5–1.8 m and the corgi is
  not tired/knocked, it winds up for 0.45 s (W3 0.35 s): emit `police:windup` (HUD red "!" over the corgi + baton
  icon, audio rising whistle). At the end, if the player is still within |ds| ≤ 1.6 m, lateral ≤ 1.9 m, not airborne
  (y < 0.5 m), not intangible/invuln/crashed → emit `npc:strike` (damage W2 10 / W3 14, knock 4.2 m/s, heavy at W3).
  Always emit `police:swing {hit}` at the strike moment (pose/whoosh). Cooldown 2.2 s (W3 1.6 s); two corgis never wind
  up within 0.6 s of each other. Dodge = brake/swerve out of reach or hop over it; block/parry = combat rules (§15).
- combat resolves `npc:strike` like a melee hit from nobody: block chance of the held weapon, pan PARRY, shield,
  intangible, invuln; damage, knock (physics.applyImpulse), 0.4 s wobble, hit-stop .06, view cue 'hit'; emits `npc:hit`.
  A police strike that empties HP crashes the player with cause 'police' (attacker null) → race busts the player at
  once when it respawns (fine 100, 4 s ticket stop, BUSTED splash).
- W3 backup + roadblock: a second corgi (obstacle id 901) sprints in from behind ~4 s later (same chase AI, both can
  strike, both can be bribed/knocked). Once per W3 chase a roadblock appears 220–300 m ahead of the player (never in a
  tunnel, on a bridge or within 150 m of the finish): red/white sawhorse barriers (ObstacleKind `barrier`, solid)
  across the whole drivable width except one 3.2 m gap at a seeded lane, cones in front, a "柯基执勤 POLICE" sign.
  Hitting a barrier faster than 8 m/s = crash cause 'police' → bust; slower = bounce like a wall. Removed 20 s after the
  player passes it or when the chase ends. Threading the gap = STYLE action `roadblock` (§17). Emit `police:roadblock`.
- Fight back: each corgi has 60 HP. Player swings that reach it (today's knock check) deal the weapon damage (heavy
  ×1.5); thrown weapons (`combat:obstacleHit` on id 900/901) deal their thrown damage. Every hit knocks it back and
  emits `police:hurt {hp}` (HUD damage number). At 0 HP the corgi goes down: race poses a tumble (corgi state mode
  'crashed' + crash info → the actors view tumbles), emits `police:down`, sets W3; if no backup is out, one arrives in
  6 s. The downed corgi sits up, shakes its head ("柯基下班了！") and leaves after 3 s. Achievement `police_down`.
- Bribe 「V我50」: the player rings the bell (`combat:bell`) with a corgi within 6 m and ≥ 50 race coins
  (rider.coins) at W1–W2 → `police:bribe {accepted:true}`, coins −50, the corgi says "……下不为例。" and lets go (no
  'lost' credit), heat → 0.15, no new chase for 30 s. Refused at W3, with < 50 coins or after 2 bribes this race
  (line "事不过三！" / "小鱼干不够还想贿赂？") → `police:bribe {accepted:false}`, heat +0.1. Achievement `bribe`.
- Tunnels: while the player is inside a 'tunnel' feature and every corgi is > 15 m behind, heat decays 2× faster.
- Corgi lines (npc:say, content): wind-up "站住！", strike "警棍警告！", backup "呼叫增援！", roadblock "前方设卡，看你往哪跑！",
  down "柯基下班了！", bribe yes/no as above. The corgi holds the baton (actors weapon mesh `baton`); its swing is the
  actors attack pose driven by the corgi's RiderState.action like any rider.

## 15. Weapons 2.0 — throwing, traits, parry (combat unit; poses = actors; trails = fx)
- Throw: `Controls.heavyHeld` mirrors the heavy key/button. Pressing heavy starts the heavy swing (windup .16 s) as
  today. If heavyHeld is still true when that windup ends and the rider holds a weapon (not 'none'), the swing becomes
  a throw aim (RiderAction kind 'throw', the weapon cocked back) for as long as it is held (max 1.5 s, then auto
  release); releasing throws. A tap (released before the windup ends) stays a normal heavy swing — no added latency.
  lookBack held at release = throw backwards. AI throws by holding heavyHeld for 0.3–0.6 s.
- Projectile (`projectile:spawn` kind `weapon:<id>`): forward = rider speed + 16 m/s (backward = rider speed − 14 m/s),
  launch vy 3 m/s, gravity 12 m/s², lifetime ≤ 1.6 s or until it touches the road; soft homing to the nearest valid
  target in a ±18° cone within 35 m (backward 25 m), turn rate 1.2 rad/s. Hits a rider within 1.0 m: damage =
  heavyDamage × 1.2 (10 % crit ×1.6), knock, 0.4 s wobble, SP +6 for the thrower, counts as the thrower's hit (KO
  credit). Hits an obstacle (traffic, corgi, event props) → `combat:obstacleHit`. The weapon leaves the hand (weapon
  'none'); where the projectile ends it drops as a road pickup with uses − 1 (breaks at 0). Emit `combat:throw`.
- Traits (data/weapons.ts `trait`; combat implements; sim implements the glide):
  saltfish 咸鱼 — 回旋镖: a thrown saltfish that hits nothing curves back to its thrower within 1.6 s (caught if it
  passes within 2 m, else drops). baguette 法棍 — 硬核: heavy hits knock the victim's weapon loose 100 % (not 60 %).
  pan 平底锅 — 完美格挡: any swing pressed ≤ 0.15 s before an incoming melee/baton hit lands = PARRY: no damage, the
  attacker is stunned 0.6 s and loses its swing, "当！" (`combat:parry`); passive block 0.35 stays. leek 大葱 — 甩葱三连:
  every 3rd consecutive hit within 1.2 s deals ×1.5 and +50 % knock. umbrella 雨伞 — 滑翔: airborne + drift held =
  glide (gravity ×0.45, air steering 60 %) until landing; no tricks while gliding; block 0.2 stays. selfie 自拍杆 — 闪光灯:
  hits blind the victim 0.6 s. slipper 妈妈的拖鞋 — 必中: thrown slippers home hard (6 rad/s, ±60°, 45 m). keyboard
  机械键盘 — 青轴: 25 % crit chance, keycap debris. none/wings: no trait, can't be thrown. baton: police only.
- HUD: the weapon slot shows the trait name (e.g. "回旋镖"); the first weapon pickup of a profile shows "按住 K 投掷" /
  pad "按住 Y 投掷".

## 16. Air tricks (sim unit; poses = actors; trails/landing burst = fx)
- A trick starts on a FRESH drift press while airborne (not a drift held from the ground), ≥ 0.25 s after take-off,
  not stunned and not gliding. Throttle never picks a trick (keyboard players hold W all race): drift + steer
  |s| > 0.6 → `spin` (360° yaw, dir = sign, 0.55 s); drift + brake > 0.5 → `backflip` ("pull back", −360° pitch, 0.65 s);
  drift + hop pressed → `frontflip` (+360° pitch, 0.65 s); drift alone held 0.2 s → `superman` (rider stretches off the
  bars; held while drift is held; counts after 0.3 s; must be released ≥ 0.15 s before landing). After a trick
  finishes, a new fresh drift press starts the next (RiderState.trickChain + 1).
- Visual only: the trick rotates the rider + bike view around its centre (actors reads RiderState.trick); physics yaw
  and the landing alignment are unaffected. A spin / flip starts only if the predicted air left covers 85 % of it (a
  late Shift + steer before touchdown is just a drift). Landing with a spin / flip < 85 % done (the road came up early)
  = crash cause 'trick'; ≥ 85 % snaps to done. Landing still in superman = a sloppy landing (fail, no points, −25 %
  speed, no PERFECT) — never a crash, because holding Shift into a landing to drift is common. Landing with ≥ 1 trick done: `rider:trick {phase:'land'}` → boost +20 % for
  0.6 s × (1 + 0.2 · (count − 1)), SP +8 per trick (combat), STYLE points (§17). Fails emit `rider:trick {phase:'fail'}`.
- AI show-offs (cat, shiba, seagull, pigeon) spin on airs ≥ 0.6 s 40 % of the time (race AI sets the controls).
- Inputs: keyboard Shift + A/D (spin), Shift + S (backflip), Shift + Space (frontflip), Shift alone (superman);
  pad RB + stick/d-pad, RB + LT, RB + A, RB alone.

## 17. STYLE chains (new module `gameplay/style`, player only)
- Actions (base points): drift boost L1/L2/L3 50/100/180 · slingshot 80 · near miss 60 · PERFECT landing 80 ·
  trick landed 120 per trick (+50 per extra trick in the same air) · hit 40 · heavy hit 60 · throw hit 90 ·
  parry 150 · KO 200 · weapon steal 80 · baton dodged (a police windup that ends in a miss) 100 · roadblock gap
  threaded 150 · event bonus (fruit stall smashed 100, goose flock threaded 120).
- Each action within 3.0 s of the previous extends the chain; multiplier = 1 + 0.25 × (distinct action kinds in the
  chain − 1), max ×4; the same kind twice in a row scores half. Breaks on: a hit taken (not blocked/parried), a crash,
  3 s without an action. On break/timeout the chain banks: total = Σ points × multiplier → SP + min(25, ⌊total/100⌋)
  and coins + ⌊total/250⌋ (combat applies both on `style:bank`). Best chain per race goes to RaceResult.styleBest.
- Events `style:chain` (every extension) and `style:bank`. HUD: a meter under the place badge "STYLE ×2.25 · 1,240"
  with P5 action labels flying in; bank pop "+12 SP +4 小鱼干".

## 18. Rivals — nemesis & alliances (race unit; career/results UI = ui-screens)
- SaveData.rivalry[character] 0..100 (rivals only), updated at race end by the race unit's rivalry tracker:
  the player KOs X +25 · steals X's weapon +10 · lands a thrown hit on X +5 · finishes ahead of X by < 1 s +5 ·
  X KOs the player −20 · per race −3 for riders in the race, −8 for those not in it (floor 0).
- Nemesis: core puts the rival with the highest rivalry ≥ 50 among this race's rivals into RaceConfig.nemesis.
  It gets aggression +50 %, payback catch-up always armed against the player (2× window), skills aimed at the player
  first, +3 % top speed while behind the player and within 80 m ("复仇之心"), nemesis taunts. Intro flyover: red
  "宿敌 NEMESIS" card + a grudge line. KO'ing the nemesis → `race:nemesisDown`, +150 小鱼干 in results, rivalry → 20,
  achievement `nemesis`. The nemesis KOs the player → line "这只是开始。".
- Alliance 围剿: when the player leads by > 5 s, or has KO'd ≥ 3 riders this race (at most once per 60 s), the 2–3
  rivals nearest behind the player within 120 m ally for 20 s: they never attack each other, all hunt the player,
  draft each other. Breaks on friendly fire (an ally hits an ally → "塑料友谊!", those two fight for 5 s), when the
  player KOs a member, or after 20 s. `race:alliance {phase, members, reason}`. HUD banner "围剿！" with linked
  portraits; allies' name tags get a chain icon; the nemesis tag is red "宿敌".
- Results: a nemesis line under the podium (content: per species, outcome won/lost/KO'd). Career ladder: the current
  nemesis portrait + grudge bar.

## 19. Track events (race unit, new folder `gameplay/race/events/`)
- 1–2 events per race, seeded at 25–80 % of the track, armed when the player is 180–260 m before the spot; never two
  within 600 m, never in tunnels/on bridges, never within 150 m of the finish. `race:event {kind, phase, s, pos}`
  with phase 'warn' (HUD banner + audio stinger), 'start', 'end'.
- 鱼车侧翻 `fishSpill`: a traffic truck in the player's or an adjacent lane brakes and tips onto its side (0.6 s roll),
  blocking that lane (solid). Behind it, 60 m across two lanes: 18–26 小鱼干 + 3 fish (`pickup:spawn`) and 3 slick
  patches (grip ×0.4, 0.8 s, like oil). Warn "前方鱼车侧翻！".
- 大鹅过马路 `geese`: a column of 7 geese (ObstacleKind `goose`, not solid) waddles across at 1.2 m/s (~6 s). Touching
  one: wobble 0.5 s, speed −20 %, honk, it flaps away. Threading the whole flock untouched = STYLE `event`. Warn
  "前方鹅群过马路！".
- 施工改道 `roadworks`: a 140 m zone: barriers close all but one lane, switching sides halfway (a chicane), cones,
  a "前方施工 请绕行" sign, two capybara workers in hard hats waving (static props). Barriers as §14. Warn "前方施工！".
- 水果摊 `stalls` (coast, city, watertown): 3–4 market stalls (ObstacleKind `stall`) on the road edge; riding into one
  above 6 m/s smashes it (speed −15 %, no crash, fruit debris, 2–4 coins, 25 % a weapon crate) and the stall owner (a
  sloth) shouts "我的西瓜！". No warning.

## 20. Maps (track unit + env units)
- RaceConfig `weather` ('clear' | 'rain' | 'snow' | 'fog' | 'dusk'), `reverse`, `route` (0 = authored layout, else a
  seed). createTrack(app, id, rng, opts) builds accordingly; Track exposes `weather`, `reverse`, `route`, `grip`
  (weather grip multiplier, sim multiplies the road grip with it).
- Weather: per (track, weather) EnvLook overrides (world table). rain: grip 0.85, puddle features ×3, wet road sheen,
  rain streaks (fx), rain ambience (audio). snow: grip 0.75, snowy shoulders/props, falling snow, colder grade. fog:
  fog near/far × 0.35, headlights on traffic. dusk: low warm sun. Allowed: coast {clear, rain, dusk, fog},
  city {clear(night), rain, fog}, mountain {clear(sunset), snow, fog, rain}, watertown {rain(default), fog, clear},
  gobi {clear, dusk, fog(sandstorm look)}. Quick race: a weather picker (随机 + the allowed list).
- Reverse: the LayoutDef is mirrored before the build (segment order reversed, radius and rise negated, bank
  negated, left/right side profiles swapped, features and marks re-anchored and x mirrored, directional features
  (ramps, jump crests) re-oriented so they still launch). Start/finish set pieces are rebuilt at the new ends.
- Seeded routes: per track a segment pool (curves of several radii, S-chicanes, hairpins (mountain), straights with
  features); the generator keeps the authored opening and closing set pieces and draws the middle from the pool:
  total length within ±10 % of the authored track, R ≥ 25 m, no self-intersection (non-adjacent centre-line points
  ≥ 40 m apart), terrain fit; dressing runs on any layout (landmark marks re-placed by rules).
- New tracks: `watertown` 江南水乡 (古镇: canals, arched stone bridges as jump ramps, white walls + black tiles, willows,
  red lanterns, boats, tea houses; narrow lanes and tight corners → drift-heavy; default drizzle) and `gobi` 戈壁公路
  (desert highway: long straights, dune jumps, wind turbines, oil pumps, camels, a sandstorm finale; fast, wide).
  Each: layout + dressing + env look + billboards + a race song + track card still + career slot.
- Career: 3 cups × 5 tracks; cup 2 uses weather variants, cup 3 reverse or seeded routes (ui-screens' progress table).

## 21. Easter eggs 彩蛋 (new module `gameplay/secrets`; SaveData.secrets; records sheet "彩蛋 n/9")
1. 小黄鸭 (×5, one per track, `duck_<track>`): a rubber duck on a reachable shoulder spot off the racing line (track
   feature `secret` with data.id). Ride within 1.2 m → quack, toast "找到小黄鸭！(n/5)". All five → achievement
   `ducks` "这是鸭子不是鹈鹕" + a garage toggle for a rubber duck riding on the player's handlebar.
2. Konami code on title/menu (keyboard ↑↑↓↓←→←→ B A, pad ✚↑↑↓↓←→←→ B A) → bike `llm` 大模型限定款: chain to the rider's
   neck, a floating extra pedal, the saddle on the handlebar, 7 spokes pointing anywhere ("LLM drew this bike");
   roadbike stats, +4 % top speed (幻觉加速), −10 % handling; free. Toast "大模型限定款已解锁：链条接在脖子上，这很合理。"
3. 「V我50」 bribe (§14).
4. SVG 画架 (`svg_<track>`): an easel at a scenic spot showing a deliberately wrong flat SVG pelican-on-a-bicycle with
   the caption "Generate an SVG of a pelican riding a bicycle". Hitting it with a THROWN weapon → it spins,
   "致敬原作！" +50 小鱼干. Achievement `svg`.
5. 鹅鹅鹅: ring the bell 3× within 5 s with the goose within 8 m → the goose goes berserk 8 s (angry, +15 % speed, honk
   ready) and recites "鹅鹅鹅，曲项向天歌——". Achievement `goose_poem`.
6. 比树懒还慢: no pedalling for 8 s after GO → the sloth (if racing) stops too: "你也不急？", then floors it with 闪电.
   Achievement `sloth`.
7. 鹈鹕神显灵: seeded 1 race in 15 (coast or mountain), a giant cloud pelican crosses the sky for 12 s; ringing the
   bell while it is on screen → "心诚则灵" +50 小鱼干, achievement `pelican_god`.
8. Title: typing P-E-L-I-C-A-N on the title screen → the title pelican's pouch inflates + "嘴大吃四方！".
9. Credits: idle 30 s → a hidden line "特别鸣谢：每一只被画歪的鹈鹕。".

## 22. r4 contracts (core, applied by the integrator — units never edit core)
- types.ts: TrackId + 'watertown' | 'gobi' · BikeId + 'llm' · WeaponId + 'baton' · CrashCause + 'trick' ·
  ObstacleKind + 'barrier' | 'goose' | 'stall' · FeatureKind + 'secret' · Weather · TrickKind / TrickState ·
  Controls.heavyHeld · RiderState.trick, RiderState.trickChain (sim-owned).
- contracts.ts: RaceConfig.weather / reverse / route / nemesis · Track.weather / reverse / route / grip ·
  TrackOptions · RaceResult.styleBest · Modules.createTrack(app, id, rng, opts?).
- events-map.ts: police:wanted / windup / swing / roadblock / hurt / down / bribe · npc:strike · npc:hit ·
  combat:throw · combat:parry · combat:obstacleHit · pickup:spawn · rider:trick · style:chain · style:bank ·
  race:nemesis · race:nemesisDown · race:alliance · race:event · secret:found.
- save.ts: SaveData.rivalry, secrets, unlocks, settings.duckRider, stats.bestStyle / tricks / bribes (sanitized).
- New per-session modules (loaded like achievements, stub fallback): `gameplay/style`, `gameplay/secrets`.

## 23. r6 — Everyone is playable + the meme roster (actors / ui-screens / content / race)
- Every racer is playable (`ROSTER[c].racer`, not the police corgi). The player picks a character on the new
  **roster screen** (`ScreenId 'roster'`, menu entry 「角色」): a grid of every racer (portrait, name, title, the five
  stat bars, the signature skill) and, for the focused character, its loadout (§24). The pick is saved
  (`SaveData.character`) and used by every race (`RaceConfig.playerCharacter`; tests: `?character=<id>`). The field is
  drawn from every other racer, so the pelican rides as a rival when the player picks someone else.
- Six new racers (procedural species, kind tone, no real people): 香蕉猫 `bananacat` (a crying cat in a banana
  costume), 泪眼猫猫 `cryingcat` (teary eyes, thumbs-up), 新鲜哥 `xinxian` (the orange stray who only eats food within
  5 s of it dropping; never name the streamer), 弹跳猪 `moodeng` (the pygmy hippo calf, glossy grey-pink, bites),
  佩德罗 `pedro` (the dancing raccoon: masked face, ringed tail), 悲伤仓鼠 `hamster` (huge glossy eyes, sad violin).
  Each has a species file (`actors/species/<id>.ts`, ≤ 2600 budget, ink outline, face readable from the chase cam),
  a signature skill (§24), 12 taunts + KO/hurt/victory/defeat/skill lines (data/roster.ts), a temperament
  (ai/personality.ts), fallback stickers (ui/hud/heads.ts, ui/p5/art.ts). New racers ship with `racer: false` until
  their species model passes actors-check; the lead flips them on. No voice clips for them (bubbles only).
- Portraits for the new racers are drawn like the rest of the cast's (`tools/gen-image.mjs`, prompts in
  `public/assets/PROMPTS.md` that describe each in-game model: colours, helmet, bike → `public/assets/portraits/
  <id>_{main,smug,hurt,eyes}.webp`), so the roster reads as one set.
- Pelican-only code is generalised: the player HUD kit, HOW TO skill cards, achievements ("亲手" = the player's own
  hands whatever the species), results / menu hero use the player's character.

## 24. r6 — Skills 2.0 (combat; poses = actors; visuals = combat/fx; sounds = audio)
- Catalogue: data/skills.ts — 13 old + 6 new signature skills + 17 pool skills (anyone may equip) + 3 shared ults
  (SP 100). Categories 攻击/控制/位移/防御/召唤/陷阱/整活; elements 火/冰/雷/水/风.
- Loadout: `RiderState.loadout = { slots: [U, I, O], ult: P }`, filled by core at spawn from `RaceConfig.loadout`
  (player) / `rivalLoadouts` (rivals: signature + one pool skill; the nemesis also brings an ult, never the time stop).
  The player edits it per character on the roster screen (`SaveData.loadouts[c]`, validated by data/loadouts.ts
  validLoadout); 「盲盒」 (`SaveData.blindBox`, `?blindbox=1`) rolls a random kit every race. The skill runner casts
  from the loadout (combat/skills/runner.ts skillIn). AI (race/ai/skills.ts) uses slots 1 and 2 (and the ult) with a
  rule per skill id; skills without a rule fall back to a generic rule by category.
- New statuses → mods (combat/statuses.ts): burn (DoT), cold (stacks, −6 % speed each; 3 stacks → frozen), frozen
  (no steer/attack, slides at 55 %), charged (thunder mark), confused (sim mirrors steering), rooted (eats the pie:
  12 % speed), silenced (no skill casts), halted (time stop: sim skips the rider entirely).
- Elements & reactions (combat/elements.ts, tuning ELEMENTS / REACT): fire+water 蒸发, fire+ice 融化 (burst
  damage), water+ice 冻结, thunder+water 感电 (chains through every wet rider; rain keeps everyone wet), thunder+ice
  超导 (shield breaks, big slow), thunder+fire 超载 (explosion), wind+aura 扩散. Events `combat:element`,
  `combat:reaction`; fx shows an element glyph over the victim and a reaction burst; the HUD calls the reaction
  name (蒸发！/感电！…) near the victim; audio has a sting per reaction.
- Every skill can hit the police (§25): skills query `obstaclesIn()` and emit `combat:obstacleHit` with `skillId`
  (helper `skillObstacleHit`).
- Each skill: an implementation (combat/skills/<name>.ts, registry), a pose (actors/rig/cues.ts POSES; a generic
  pose by category is fine for pool skills), visuals (combat/visuals; reuse waves/auras/bolts/trails), fx flair
  (fx/react/skills.ts TABLE), a cast + hit sound (audio/sfx/skills.ts), a HUD glyph (the catalogue's).

## 25. r6 — 薄纱警察: the police can be beaten (race unit; HUD = ui-hud; fx/audio)
- Knocks keep the officer close: a hit pushes it ≤ 1.5 m aside for ≤ 0.4 s and it slows only a little (×0.85 for
  0.8 s), so it stays in reach of the next swing. Officer HP 60 → 40; a heavy swing with a weapon downs it in two or
  three hits, bare wings in five or six. Skills and thrown weapons hurt it (`combat:obstacleHit` with `skillId`);
  `ko: true` (SHOWTIME, the shared ults) downs every officer it reaches at once.
- An officer down: a 0.6 s slow-mo beat (clock layer `police`), the corgi tumbles off its bike, the line 「柯基下班了！」
  (HUD banner + bubble), its baton drops as a pickup (`pickup:spawn` kind 'weapon', weapon 'baton' — the player may
  use it: the only way to get one), and `police:bounty` pays the player 80 小鱼干 + refunds this race's fines.
- Three officers down in one race → the 特警 squad (obstacles 910–912): three corgis with riot shields
  (`police:squad` phase call/arrive/down/clear), 40 HP each, the shield blocks frontal swings (hit them from the
  side or with skills). All three down → 「警局下班」 (`police:offDuty`): no police for the rest of the race (heat
  frozen at 0), achievement `police_off`.
- Achievements: `police_down` (down an officer), `police_three` (three in one race), `police_off` (警局下班),
  `police_skill` (down one with a skill).

## 26. r6 — UI back to readable + achievements you can find (ui-screens / ui-hud / content)
- Main menu: a 「成就」 entry (`ScreenId 'records'`: the records sheet as a full screen with the egg column and the
  stats) and a 「角色」 entry (roster). The career screen's Tab chip stays as a shortcut.
- Loading: the menu never shows the drawn stand-in pelican: it waits (≤ 1.2 s) for the menu art behind the boot
  splash / wipe; race-only fonts are not fetched at boot (fonts.ts preloadHudFonts runs when a race starts loading,
  not in createHud); CJK fonts are subset to the glyphs the game uses (tools/fonts/subset.py, build-time).
- Density (compared with pre-r4 screenshots): career and quick race go back to big readable cards — 3 cards per row
  at 1280×720, cup names ≥ 32 px, card names ≥ 28 px, chips ≤ 2 per card (weather + one), the race options panel
  folds into the selected card. Race HUD: the STYLE meter and callouts move into one compact column, the air-trick
  key strip shows only while airborne, and nothing overlaps the speedometer, skill diamonds or progress bar.
- Phone landscape (844×390): every screen's interactive elements fit on screen.

## 27. r6 contracts (core, applied by the integrator — units never edit core)
- types.ts: CharacterId + bananacat | cryingcat | xinxian | moodeng | pedro | hamster · StatusId + burn | frozen | cold |
  charged | confused | rooted | silenced | halted · Element · Reaction · SkillLoadout · RiderMods.steerInvert / halted /
  silenced · RiderState.loadout.
- contracts.ts: RaceConfig.loadout / rivalLoadouts · ScreenId + roster | records.
- events-map.ts: combat:element · combat:reaction · combat:obstacleHit.skillId / ko · police:bounty · police:squad ·
  police:offDuty.
- save.ts: SaveData.character / loadouts / blindBox (sanitized; the police corgi is never playable).
- data/loadouts.ts (defaults, rival kits, validation, 盲盒) · data/skills.ts SkillDef.category / element, slot 'pool'.
- sim honours mods.steerInvert (mirrored steering) and mods.halted (rider frozen in place).

## 28. r6 — Online rooms (联机): 2–4 friends race through a relay (net unit + relay; core contracts §29)
- **Model: server-paced deterministic lockstep.** Every client runs the whole race (riders, AI, traffic, combat) from
  the same RaceConfig and the same per-tick inputs; only inputs travel. A relay (no game logic) owns the clock: at
  60 ticks/s it bundles the latest input of every human into one tick message and broadcasts it; each tick is two
  sim substeps of 1/120 s. A client advances only through ticks it received (a short jitter buffer, 2 ticks); its
  own input takes effect when its tick comes back (input delay = round trip + buffer; never predicted).
- **Rooms.** 「联机 ONLINE」 on the main menu → create a room (a 4-letter code, alphabet without I/O/0/1/L) or join
  one by code; 2–4 humans; AI fills the grid to 8. The lobby shows every member (name, character portrait, ready);
  members pick their racer and kit as on the roster screen; the host picks the track, weather and direction and
  starts when everyone is ready. The host's client builds the RaceConfig (seed, track, AI field, loadouts — never
  from anyone's save: no nemesis, no 盲盒 roll after start) and the relay forwards it. Everyone loads; the relay
  sends `go` when all have loaded (the grid waits, 「等待其他玩家…」, max 30 s, then late loaders are dropped).
- **Online race rules** (they keep every client's sim identical): no police, no secrets/eggs, no intro flyby (the
  countdown starts at tick 0), no pause (Esc opens a menu over the running race; 退出 leaves the room), no KO
  cinematics or slow-mo/hit-stop (presentation must not change sim time), no STYLE chains (they pay SP from local-only
  events), no nemesis/alliances. Remote humans are never AI-driven; a human who disconnects becomes an AI rider at the tick
  the relay marks (`left`). The race ends when every human has finished (or 45 s after the first human did); each
  client shows its own results (humans marked, the local one as YOU).
- **Sim rules for several humans.** `RiderState.human` marks a human rider (offline: the player). The sim never reads
  `isPlayer` or `session.player` (those are the LOCAL rider: camera, HUD, audio, achievements). Where the sim reasons
  about "the player" it uses the humans: the AI rubber band and fairness rules (calm start, one hunter per human,
  hit budget, grudges) work per human, each AI rider against its nearest human; traffic spawns around every human;
  a track event starts when the leading human approaches and lives until the last human has passed.
- **Determinism contract.** (1) Same inputs per tick → bit-identical state on Chromium, Firefox and WebKit, at any
  quality and frame rate. (2) `Math.sin/cos/tan/asin/acos/atan/atan2/exp/expm1/log/log1p/log2/log10/pow/sinh/cosh/tanh/
  cbrt/hypot` are replaced at boot by pure-JS ports of fdlibm (`src/net/detmath.ts`): only + − × ÷ and sqrt, which
  IEEE 754 makes identical everywhere. (3) No sim state lives in module scope across races; no sim decision reads
  wall-clock time, the camera, the frame rate, the local input outside the tick's controls, the local save or the
  render quality; presentation never consumes `session.rng`. (4) Every 60 ticks each client sends `session.hash()`;
  the relay compares and broadcasts `desync`, and clients end the race with 「联机不同步」.
- **Relay** (`relay/`, Deno, no dependencies): WebSocket `/ws`, JSON messages (protocol in `src/net/protocol.ts`, shared
  by relay and client). Per room a drift-corrected 60 Hz tick loop; per human the latest analog input (steer
  −127..127, throttle/brake 0..255, held bits) and the OR of the edge bits since the last tick (an edge is never lost
  or doubled: a late message lands in the next tick). Limits: 4 humans/room, 4 KB/message, 120 messages/s/client, idle
  timeout 20 s, rooms die with their last member. `GET /` answers `beak-rash relay ok`. Runs locally with
  `deno run --allow-net relay/main.ts --port 8790`; the client's relay URL is `?relay=ws://…` or the build's default.

## 29. r7 — Skill feel 技能手感: every cast is felt (combat skill groups + ui-hud; audit `tools/r7/feel.mjs`)
- The audit (2026-10-29, `tools/r7/feel.mjs`): two rides per skill from the same seed and formation (seven rivals
  around the player, their own skills off; three carry SP, one a pan; pickups ahead; the player at 70 % HP) — CONTROL
  and CAST; whatever differs after t0 is what the skill did: its world visuals (frames drawn from the CONTROL camera,
  no HUD), HUD words, sounds, and each rider's metres / HP / SP / statuses vs CONTROL (`summary.json`, sheets).
  Found: no control status (眩晕/减速/沉默/颠倒/定身/寒冷/淋湿…) showed anything on its victim; boost skills kicked the
  camera 8–10° but gained 2–3 m in 3.5 s (a raised top speed only — now `skillBoost` also kicks the bike, BOOST_KICK);
  steal / whistle / five-second rule / thermos did nothing in an ordinary race; the violin was 2 % of the screen; the
  peel lands behind the player, out of sight.
- **The contract** (`tools/r7/feel-check.mjs` RULES, per skill):
  1. 出手 cast — the P5 cut-in, the cast sound, the pose (r6).
  2. 过程 delivery — the skill's own visuals cover ≥ 3 % of the middle of the screen at +0.3 s (traps ≥ 1.5 %) and
     ≥ 6 % at their peak.
  3. 结果 result — every rider it affects pops a status word over its head the moment the status takes hold
     (`data/status-words.ts`; damage keeps its numbers); the caster reads 「命中 ×N」 / 「落空」 or the skill's own words
     (`skill:result`); move skills gain ≥ 8 m in 3.5 s (dash 10, blink / ghost / flash 15); no skill does nothing in an
     ordinary race — an effect that needs a condition (something to steal, an offender, an item, damage to heal) has
     a baseline without it.
  4. 余韵 duration — chips over riders while a status lasts; the player's own control status gets a banner with a
     countdown and a screen cue (颠倒/沉默/冻住/眩晕), silenced locks the skill slots; a trap that fires behind the
     player is called out (「身后 · 柴犬 踩中香蕉皮！」).
- Events: `skill:result { riderId, skillId, text, good }` (core); `skill:hit` per victim for every skill; `skill:end`.
  HUD debug surface `window.__br.hud.status()` (words, chips, banner, cue, slotsLocked, readouts, rear).
