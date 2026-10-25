# w1-world-weather — weather variants on every track (world core)

## Plan
1. `src/world/weather/table.ts` — allowed weather per track, grip per weather, tuning table.
   Verify: `node tools/r4/tsc-own.mjs src/world/weather.ts src/world/weather/ ...` → TSC-OWN OK.
2. `src/world/weather/look.ts` — weather = modifier on the track's base EnvLook (rain/dusk/fog/snow);
   'clear' returns the base look object untouched.
3. `src/world/weather/puddles.ts` — seeded rain puddles on the drivable road (≥3, ×2 the clear count,
   >120 m from start/finish, off bridges/tunnels/ramps).
4. `src/world/weather/wet.ts` — wet asphalt (darker + fresnel sheen + sun specular) on the road material.
5. `src/world/weather/snow.ts` — snow on up-facing world surfaces (onBeforeCompile, world normal up),
   never the road, never riders/bikes.
6. `src/world/weather.ts` — resolveWeather (warn once + fall back to clear) and the build entry.
7. `src/world/track.ts` — createTrack(app,id,rng,opts?): weather look, puddles, visual passes; expose
   weather / reverse:false / route:0 / grip on the Track.
8. Acceptance: the five commands in "How to test".
9. Look at `shots/r4-accept-weather/sheet.jpg` (thumb) and tune until every variant reads as its weather.

## Done
- weather/table.ts: ALLOWED (coast clear/rain/dusk/fog, city clear/rain/fog, mountain clear/snow/fog/rain,
  watertown clear/rain/fog, gobi clear/dusk/fog), GRIP (rain 0.85, snow 0.75, else 1), TUNE (fog pull-in,
  rain grade/wet, puddles, snow cover, dusk sun).
- weather/look.ts: the weather look modifier (sRGB mixing): rain = greyer/darker sky, dimmer cooler sun,
  lower saturation, softer contrast; fog = near/far ×0.35 + a light grey of the sky; snow = cold tint,
  pale blue-grey sky, whiter fog; dusk = a low warm sun (same azimuth, dir.y −0.28) + warm horizon.
  'clear' returns the base look object as-is → the clear look is byte-identical to today.
- weather/puddles.ts: seeded puddles added to the built layout (so the decals and the sim both see them),
  never on bridges/tunnels/ramps, never within 120 m of the start/finish.
- weather/wet.ts: the road's toon material is patched (darker asphalt + a sky fresnel + a sun specular).
- weather/snow.ts: every up-facing surface of the track group gets a snow-white mix (world normal up);
  the road, its paint, the sky and the sea are excluded; materials are cloned so the shared toon
  materials (and the riders/bikes outside the track group) are untouched.
- weather.ts: resolveWeather (console.warn once per track+weather, then 'clear'), gripFor, addPuddles,
  applyWeatherMaterials. env/sky.ts: restoreLookSky puts the look's own dome + cloud tint back for a
  weather build (the mountain swaps the sky for its own golden hour).
- track.ts: createTrack takes TrackOptions, builds the weather look, adds the puddles, applies the
  weather materials and exposes weather / reverse:false / route:0 / grip on the Track.

## In progress / next
- Nothing outstanding for this job. The reverse / route jobs and the fx particles + audio ambience are
  other units' work (SPEC §20).

## How to test (exact commands)
```
node tools/r4/tsc-own.mjs src/world/weather.ts src/world/weather/ src/world/index.ts src/world/track.ts src/world/looks.ts src/world/env/sky.ts src/world/env/lights.ts src/world/road/ src/world/terrain/ src/world/features/
node tools/r4/w1-weather.mjs --tracks coast,city,mountain
node sandbox/track.audit.mjs --track coast --skip stall
node sandbox/track.test.mjs --track mountain
node tools/core-check.mjs
```

## Evidence (key output lines)
- `TSC-OWN OK` (own typecheck, 0 errors in my files).
- `w1-weather OK` — 34 PASS / 0 FAIL for coast, city, mountain (also OK for all five tracks with the
  default `--tracks`): weather + grip per variant, 0 console errors, coast rain puddles 3 → 7,
  city rain puddles 5 → 11, mountain rain puddles 3 → 7, coast fog far 350 ≤ 400 (clear 1000),
  mountain fog far 315 ≤ 360, city fog far 224 ≤ 256, mountain snow white share 1.0 % → 44.6 %,
  coast dusk sun dir.y −0.28 / #ff9640, every disallowed weather falls back to 'clear'.
- `AUDIT OK` (coast audit, --skip stall).
- `node sandbox/track.test.mjs --track mountain` → exit 0.
- `core-check OK` (8 PASS, 0 FAIL).
- Screens: `shots/r4-accept-weather/sheet.jpg` (15 variants, all five tracks). I read the thumb
  (`shots/r4-w1-world-weather/full-sheet.jpg`): every variant reads as its weather and stays readable.

## Known issues
- The sea (`src/world/env/sea.ts`, not my file) has hard-coded colours, so the coast's rain / fog /
  dusk keep a noon-turquoise sea while the sky and the road change. Not fixable from my files.
- The rain puddles are all further than 120 m from the start (per the brief), so the acceptance chase
  frames (≈40 m in) show no puddle pixels; the puddles are counted as track features instead.
- Rain streaks, snow flakes and dust are the fx unit's job and the rain ambience is audio's — not added
  here (SPEC §20).
- The mountain's own golden-hour sky (`env/mountain-sky.ts`, not my file) is replaced by the look's own
  sky in a weather build; `restoreLookSky` (env/sky.ts, my file) does that swap-back.

## Requests
- `src/world/env/sea.ts` (sea/env owner): tint the sea from the look (weather) — the coast's
  rain / fog / dusk variants keep a bright turquoise sea under a grey or orange sky.
