# r6 — unstick (race AI: a pinned rival finds the gap)

## Plan
1. Reproduce: `node tools/race-soak.mjs --track watertown --seeds 3` → `FAIL … rider 7 (capybara) stuck at s=646`.
2. `sense.ts`: `freeLanes(blips, lo, hi, near, far, margin, minWidth)` — the lateral spans of the road left clear
   by every blocking blip (`solid`/`traffic`/`police`) in an s-band ahead of the scanned rider, and
   `freeLaneNear()` on top of it (the way out of a pin). Proof: `npx tsc --noEmit -p tsconfig.json` → 0 errors.
3. `plan.ts`: `blockGap(blips, lo, hi)` — the single gap of the nearest barrier row ahead (≥2 static blocking
   blips within 1.4 m of s, total free width ≤ 6 m), else null. Proof: tsc 0 errors; `shots/r6-unstick/probe-gap.mjs`
   prints the gap of the watertown row (`ds=40 → {x:-2.085, half:0.875}`) and `null` for moving traffic.
4. `brain.ts` + `plan.ts`: the gap is a lane constraint — `desiredX` rides it (`gapLane`), `planLateral` charges
   `WALL` for every other lane, the `crossing` rule no longer blocks crossing the row's own barriers, and a
   rider/car standing *in* the gap is followed (`inGap`). Proof: `probe-trace.mjs` shows rider 7 leaving x=1.57
   at barDs 57 and reaching x=-2.3 (the gap) before the wall; soak seed 3 maxStuck 5.5 s → 0.5 s.
5. `brain.ts`: `unstick()` steers to `escapeX` — the nearest free lane (≥1.2 m wide) of the next ~4 m, computed
   in `think()` (the shared `Senses` blips belong to the last scanned rider, so they may only be read there);
   it rolls off the throttle while pressed against something but never stops (a stopped bike cannot steer).
   Proof: `node tools/race-soak.mjs --track watertown` → SOAK OK.
6. Acceptance: soaks watertown/city/coast, `race-scenarios`, `w2-police`, `net-det`, `core-check`, `tsc-own`.

## Done
- All six steps. Every acceptance command passes (see Evidence).
- The police roadblock is ridden through its gap by the whole field (probe-trace), and a rider pinned against a
  barrier or a stopped car steers for the nearest clear lane instead of the centre line (probe-stuck/seed1).
- `gapCost`/`inGap` in the planner were needed for more than the aim: without the wall cost the planner keeps a
  lane inside the barrier (the `crossing` rule prices crossing a slow car's nose as high as the wall itself, and
  the row only enters its ~1.7 s horizon when it is far too late to cross the road).

## In progress / next
- Nothing open in this unit.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/race/ai/` · `node tools/core-check.mjs`
- `node tools/race-soak.mjs --track watertown` (also `--track city`, `--track coast`)
- `node tools/race-scenarios.mjs` · `node tools/r4/w2-police.mjs` · `node tools/r6/net-det.mjs`
- Probes (browser): `node shots/r6-unstick/probe-trace.mjs` (the approach to the roadblock),
  `probe-stuck.mjs` (the pin), `probe-seed1.mjs` (the traffic jam), `probe-outrun.mjs` (the police scenario).
- Probe (unit, no browser): `node --experimental-transform-types --import ./shots/r6-unstick/register.mjs shots/r6-unstick/probe-gap.mjs`

## Evidence (key output lines)
- Before: `FAIL [seed 3] rider 7 (capybara) stuck at s=646` … `maxStuck=5.5s`.
- After: `seed 3: ended t=195.7s frames=6180 player=8 (195.7) maxStuck=0.5s` … `SOAK OK` (watertown),
  `SOAK OK` (city, maxStuck 1.0–2.0 s), `SOAK OK` (coast, maxStuck 0.5–2.0 s).
- `62/62 checks passed` (race-scenarios), `w2-police OK`, `r6-net-det OK`, `core-check OK`, `TSC-OWN OK`.
- Trace, watertown seed 3 (rider 7): `barDs 57.7 x=1.57 → barDs 24 x=-2.2` (the gap is at x=-2.09), it rides
  through at 16 m/s instead of stopping at x=3.16 against barrier 8003.
- Traffic jam (watertown seed 1, s≈2785): `x=3.32 v=1.55 escape=-1.64 steer=-1` → out in 4.5 s (under the
  soak's 5 s rule, was a wall-grind before).
- Unit probe: `gap ds=40 {"x":-2.085,"half":0.875}`, `cars` (two stopped cars, 12 m of free road) → a gap is
  still offered but the planner is not forced into it unless the row really closes the road; `moving → null`.

## Known issues
- watertown seed 1 still shows `maxStuck=4.5s`: two rivals queue behind a stopped van/car/truck at s≈2785 and
  need ~4 s to cross to the free lane at x≈-1.7. It is under the soak's 5 s rule but it is the slowest case left.
- A rider that is *inside* the wall (wedged in the seam between two barrier segments) cannot be freed by steering
  alone: the sim's contact kicks from both barriers cancel. Prevention (the gap aim) is what fixes that case;
  `unstick` only gets out of the cases where a free lane exists within the next 4 m.
- `summary()` gained `escape` and `gap` fields (debug only).
- No screenshot: the roadblock needs ★3 heat and the autopilot player gets ticketed before it goes up in a
  plain shot run (`shots/r6-unstick/shot-gap.mjs` finds no barriers); the traces above are the evidence.

## Requests
- (none)
