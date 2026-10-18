# Unit: env-mountain — wave 2 — 落日山道 SUNSET PASS
Read SPEC.md (§0, §2, §4, §5 environments, §9) and status/track.md (LayoutDef segments/sides/edges/
features/marks/bumps, dressing modules, looks, LOD, perf tools). Study `src/world/layouts/coast.ts` and
`src/world/dressing/coast/*` as the reference implementation.
You own NEW files: `src/world/layouts/mountain.ts`, `src/world/dressing/mountain/**`,
`src/world/env/mountain-*.ts`, `src/world/scenery/props/mountain-*.ts`, `sandbox/mountain.*`. Shared track
files belong to the track unit (and env-city edits them concurrently): only small ADDITIVE edits, re-read
right before editing, keep compiling, never change coast/city behaviour; log them in status/env-mountain.md.

## Goal
A golden-hour mountain pass: layered purple ridges against a pink-gold sky, long shadows, pine forests,
cliffs and guard rails, switchbacks that reward drifting, and plenty of gentle meme jokes.

## Layout (≈3.6 km, `id: 'mountain'`, big elevation: climb ~120 m then descend)
Start at a mountain village square (stands, lanterns) → climbing road through pines → **3 switchback
hairpins (R 20–35 m)** with banking and red/white chevron boards → cliff road (rock wall one side, guard rail
+ drop on the other: drop = 'water' or a void edge → crash 'water' semantics per bounds) → long curved
tunnel through the ridge (lit) → **gorge bridge** (suspension or stone arch, waterfall beside it) → summit
**crest jump** with a viewpoint pavilion/pagoda → fast descent with an **S-chicane (R 40–55 m)** and a
ramp → lakeside straight → finish gantry with paper lanterns. Corners must require braking or drifting at
top speed (sim curve push `κv²·0.8`).

## Dressing (instanced/merged; seeded)
Pine/fir forests (LOD clusters), birches, rocks/boulders, cliff strata, waterfall + mist, river in the
gorge, mountain lake reflecting the sky, terraced tea fields, a hot spring with capybaras soaking
(「卡皮巴拉温泉 情绪稳定 包月价」 sign — the meme from data/memes.ts), cows grazing near the road (behind
fences; never on the drivable road), a cable car crossing the valley, wind turbines on a far ridge,
hot-air balloons, prayer flags/lantern strings, a wooden viewpoint pagoda, road signs (连续弯道 弯弯有鹅,
注意落石 → harmless, 鹈鹕出没), chevron boards on hairpins, distance markers, billboards using
`BILLBOARDS.mountain` art, pickup rows (several, on the asphalt), boost pads (2), oil/puddle features.

## Look
`looks.ts` mountain entry: low warm sun (long shadows), sky gradient gold→pink→violet, 3–4 layered ridge
silhouettes with atmospheric fade, warm fog, sun disc + god-ray hint, sky-tinted lake; grade warm,
saturation up slightly, bloom low.

## Quality bar (art + tech critics)
From the chase cam: unmistakably "sunset mountain pass", dramatic depth, readable road in every hairpin
(the camera must never be blinded by a wall). Aerial: believable switchbacks hugging the terrain.
Perf: ≤ 250 draw calls, ≤ 800k tris per chase view incl. shadows, build ≤ 4 s. Track API checks pass for
'mountain' (bounds/surface/edges consistent, round trip, NaN scan). Races finish with autopilot.
