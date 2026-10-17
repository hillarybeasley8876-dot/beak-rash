# Unit: fx (fx/) — wave 1 — post-processing, particles, and the KO director
Read SPEC.md first (§0–2, §5 look, §8 is your KO spec, §7 events to react to). You own `src/fx/**`,
`sandbox/fx.*`. Contract: `createFx(app) → FxSystem` (attach, update, render, resize, burst) + optional preload.

## Deliverables
1. Render pipeline (`fx/post/`): EffectComposer-style chain from three/addons (or hand-rolled passes)
   with: colour grade from `track.look.grade` (saturation/contrast/tint), bloom (strong only at night),
   speed FX (radial blur at the screen edges + chromatic fringe scaling with speed/boost), vignette,
   KO/ult look (desaturate-except-red, halftone dots, radial zoom blur, grain, red/black comic tint),
   damage flash (red edge pulse when the player is hit), optional subtle screen-space ink edges. Quality
   presets (low: no post except grade+vignette). Correct output colour space; resize/DPR safe.
2. Particles (`fx/particles/`): one instanced GPU-friendly system (pooled, ≤ 3k particles, ≤ 6 draw calls)
   with emitters: hit spark star bursts (white/yellow/red, comic), dust/grass/sand kick-up from wheels
   (speed-linked), drift sparks coloured by level (blue/orange/pink), boost wind streaks + wing trails,
   landing dust ring, feathers (white/grey; species colour), fur tufts, water splash, oil smear, debris
   (bolts, spokes), confetti (finish), fish scales, coin sparkle, smoke puffs, dizzy stars. `burst(name,
   pos, opts)` API + automatic reactions to bus events (combat:hit, combat:ko, rider:crash, rider:land,
   rider:drift, rider:boost, rider:bump, pickup:take, skill:*, rider:offroad…).
3. Screen-space speed lines overlay (anime style) for boost/slipstream; impact frames (1–2 frame
   black/white inverted flash on heavy/crit hits — tasteful).
4. KO director (`fx/ko/`) per SPEC §8: timeline, `clock.setScale('ko', …)`, `clock.hitStop`, camera
   override via `app.rig.override` (orbit around `view.anchor('body')` of the victim), letterbox bars,
   post-FX ramps, `cine:ko` events with phases + chain count; player-wrecked variant; ult cinematic
   (`ult:start` → `cine:ult` start: slow-mo rise, camera low hero angle; `ult:impact` → shockwave ring,
   chain KOs). Robust restore on dispose/attach(null)/race end.
5. `sandbox/fx.html`: particle gallery + post toggles; a KO replay tester (`__br.fx.testKo()`).
6. Perf: post chain ≤ 3 ms at 1080p on M1; particles ≤ 1 ms.

## Quality bar (art critic + timing critic)
KO sequence frame strips (sample every 50 ms real time) read like an anime finishing blow: clear
subject, strong composition, motion, no visual garbage, clean return to gameplay. Particles are
stylised (toon/comic), never noisy confetti soup. Speed sensation clearly increases with speed.
