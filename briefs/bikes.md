# Unit: bikes — wave 1
Read SPEC.md (§2, §5) and `src/actors/bikes/types.ts` (your contract: `createBike(id, opts) → BikeModel`
with markers saddle/gripL/gripR/pedalL/pedalR, `steer` pivot, `crankAngle`, `update`). You own
`src/actors/bikes/**` except stub.ts and types.ts; `sandbox/bikes.*`.

## Goal
Seven chunky, characterful toy-style bicycles (toon + outlines from src/render/toon.ts), mechanically
plausible so the riders' IK reads right: wheels with spokes/rims/tyres, fork, frame tubes, headset,
handlebars + grips, stem, saddle + seatpost, cranks + chainring + chain + rear cog, pedals that stay
level, brakes (except fixie), reflectors, bell (all — the taunt button rings it).

## The seven (data/bikes.ts)
- roadbike 风之翼: red/white carbon road bike, drop bars, deep rims, number plate "01".
- erba 二八大杠: classic heavy black Chinese roadster (28-inch, top tube, rod brakes, chain guard, rear
  rack, front lamp, bell, a little faded "永久"-free generic badge — no real brands).
- shared 共享单车: chunky bright yellow shared bike: solid tyres, front basket, QR-code plate on the
  rear (canvas texture, a cartoon QR), a "扫码骑行" sticker, kickstand.
- fixie 死飞: neon fixie, deep-V rims (one pink, one mint), bullhorn bars, NO brakes.
- mtb 山地车: orange MTB, fat knobbly tyres, front suspension fork, flat bars, disc brakes.
- tandem 双人协力车: long two-seat frame, second saddle/bars (stoker) with a grumpy salted fish
  passenger strapped on (marker `stoker`), two crank sets in sync.
- kidbike 儿童滑步车: tiny pastel balance bike with no pedals (pedal markers sit on foot pegs; the
  rider's feet paddle — set crank to a "paddling" motion), streamers on the grips, a bell.
Same marker semantics for all; wheelbase/radius per bike; saddle heights sensible for a ~1.3 m rider.
`opts.tint` recolours the main frame (rival accent colours).

## Deliverables
`src/actors/bikes/index.ts` exports `createBike` (+ re-exports types), small files per bike, shared
parts library (wheel, crankset, bars), cached geometry (build once per id, clone per instance),
≤ 3k tris per bike, `sandbox/bikes.html` turntable gallery with markers toggle (small spheres).

## Quality bar
Close-up turntable looks great and instantly identifiable; at 6 m behind the bike reads; markers are
exactly where hands/feet should go; wheels/cranks spin correctly with speed; steering pivots about the
head tube.
