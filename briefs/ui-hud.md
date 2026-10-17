# Unit: ui-hud (ui/hud/) — wave 1 — in-race HUD and every in-race cut-in
Read SPEC.md first (§0–2, §5 UI, §7–§10). You own `src/ui/hud/**` except the core-owned contract.ts
and stub.ts; `sandbox/hud.*`. Contract: `createHud(app, layer) → Hud` (attach/setVisible/update/dispose).
ui-screens builds the shared P5 kit in `src/ui/p5/` concurrently — you may import from it once it
exists, but don't block on it: keep your own CSS in `ui/hud/` (same palette/fonts/rules, SPEC §5).

## Deliverables
1. HUD layout per SPEC §10 (DOM/CSS/SVG, transforms only, no layout thrash; update ≤ 0.5 ms/frame;
   write DOM only when values change): place block, progress strip with rival head icons (portrait
   crops or coloured species badges) + finish flag, timer, jagged speedometer + drift charge colour,
   P5 battle-style cluster (tilted portrait, HP, SP with SHOWTIME READY state, U/I/O skill diamonds
   with glyphs + cooldown sweeps + denied shake, weapon slot with uses), boost/slipstream indicators.
2. World-anchored overlays (project with app.camera): rival name tags + HP bars (≤ 25 m ahead, fade by
   distance, hidden when invisible/behind camera), taunt speech bubbles (P5 jagged, `taunt` events),
   damage numbers, incoming projectile / police warnings (edge chevrons).
3. Cut-ins driven by events: countdown (race:countdown), skill (skill:cast — big diagonal band with
   eyes close-up for the player, small chip for rivals within 30 m), SHOWTIME (ult:start / cine:ult),
   KNOCK OUT + chain variants (cine:ko peak; attacker & victim portraits), WRECKED (player KO'd),
   BUSTED (police:busted), FINISH + place (race:finishLine for the player), PERFECT (rider:land perfect),
   DRIFT L1–3, NEAR MISS, SLIPSTREAM, ONE MORE! (combat:combo ≥ 3), place change flash
   (race:placeChange for the player), FINAL STRETCH. Queue/merge so they never pile up unreadably.
4. Hide during intro flyover except rival intro name cards (P5 "calling card" style per rival as the
   camera passes, using roster title + tagline) — race unit drives the camera; listen for race:intro /
   session.phase === 'intro'.
5. `sandbox/hud.html`: fake session data driver to screenshot every HUD state and cut-in without a race;
   also verify in a real race (`/?race=coast&seed=4`).

## Quality bar (aesthetic + correctness critics)
Readable at a glance while riding, bold P5 personality, never covers the road ahead centre, scales from
1280×720 to 2560×1440 (16:9 and 16:10), cut-ins are punchy (< 1 s, interruptible), values always match
the sim state, no console errors, 60 fps maintained.
