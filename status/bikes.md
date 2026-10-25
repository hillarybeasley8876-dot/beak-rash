# bikes — status

## Done (all milestones)
- Build kit `src/actors/bikes/build/`: geo.ts (bike-space prims + `smooth` weld), strip.ts (chains/ribbons),
  partset.ts (merges a whole bike into ONE rigidly skinned geometry: vertex colours, per-part outline width,
  crack-free hull normals, paint mask, gloss, bone index), atlas.ts + decals.ts + decals-wheel.ts (one 1024² canvas atlas:
  plate "01", cartoon QR, 扫码骑行, faded 鹈鹕 badge, 28·载重, NO BRAKES, 越野王, 车上有咸鱼, grid, fish face, spoke /
  speed-blur / spider cards, chain link, tail light), palette.ts (colour → finish), material.ts + shading-glsl.ts
  (toon body × atlas on the render/toon.ts ramp + gloss specular, chrome banding, cool rim; skinned hull; shadow
  depth material; all three honour the per-bone dissolve).
- Parts `parts/`: layout (geometry chart → points + head-tube axis), wheel, drive, cockpit (drop / bullhorn /
  flat / swept bars, stem, levers, bell), frame (lugged tubes, head tube, rigid & suspension forks, saddles),
  brakes (caliper, disc, rod), accessories (fenders, rack, decals), fittings (basket, lamp, kickstand,
  reflectors, chain case, number plate), diamond (diamond frame, drivetrain, rider markers).
- `template.ts` (BikeBuilder: bones/pivots/markers), `cache.ts` (template per id+quality, tint variants share
  every buffer but colour, ref-counted GPU release), `animate.ts`, `model.ts`, `index.ts` → real `createBike`.
- Seven bikes in `defs/` (+ `fish*.ts` passenger). Tris after fix round 2 (high / medium / low): see "Fix round 2"
  m4 (≈ 5.7–7.2k high, tandem 9.2k: critic asked for ≥ 12-sided parts + cables; 8 bikes ≈ 55k of the ~854k per
  frame, 202 draw calls, 60 fps). `node sandbox/bikes.tris.mjs` breaks them down.
- Perf: 2 draw calls per bike (skinned body + hull). In game (8 riders): 16 bike calls, 0 errors, 60 fps.
  All 7 templates build in ~47 ms (high) on first use; instances are ~0.2 ms.
- Verified: sandbox turntable/side/rear/close-ups, lineup, 6 m chase grid, tints (all rival colours),
  low/medium/high, in-game chase screenshots (shots/bikes/), automated animation checks (all pass).

## Contract notes for consumers (actors / ui garage)
- Bike faces −Z, origin = road contact midway between the wheels (per types.ts), +X right.
- `update(dt, speed, steerAngle)`: steerAngle > 0 turns the bars RIGHT, pivoting about the tilted head-tube
  axis (clamped ±0.8 rad). Wheels roll at speed/R. Cranks: crank rev = wheel rev / gear (roadbike 5, erba 3,
  shared 3.2, fixie 3.4, mtb 4.2, tandem 4.4); freewheel bikes stop pedalling under hard braking
  (accel < −1.2 m/s²), the fixie never stops.
- Wheels: once the per-frame wheel turn (speed·dtSim/R) nears the spoke spacing, spokes / mag arms dissolve into a
  turning speed-blur disc (wire ≈ 1–2 m/s at 60 fps, mag ≈ 3–8 m/s); in KO slow-mo the turn per frame drops and the
  real spokes return. MTB tread blocks turn at ≤ 0.3 block/frame (never strobe).
- `crankAngle`: 0 = right pedal at top dead centre, increasing = forward pedalling. Pedal markers are
  children of level pedal bones (world orientation = bike orientation).
- kidbike: no cranks. `crankAngle` = paddle phase; pedalL/pedalR markers (root children) paddle along the road
  while accelerating (> 0.6 m/s²), glide on the foot pegs at steady speed, stand on the ground when stopped.
- Rider fit (bike space, metres; saddle→pedal reach = TDC..BDC):
  | bike | R | wb | saddle (y,z) | gripR (x,y,z) | saddle→pedal | saddle→grip |
  |---|---|---|---|---|---|---|
  | roadbike | .27 | .84 | .67, .175 | .16, .71, −.36 | .37–.60 | .56 |
  | erba | .33 | 1.06 | .76, .271 | .231, .88, −.138 | .38–.65 | .485 |
  | shared | .29 | 1.00 | .72, .231 | .227, .858, −.171 | .39–.64 | .48 |
  | fixie | .28 | .84 | .68, .162 | .172, .715, −.408 | .37–.60 | .60 |
  | mtb | .30 | .94 | .70, .198 | .255, .778, −.265 | .36–.61 | .53 |
  | tandem | .28 | 1.60 | .68, −.134 | .206, .76, −.632 | .36–.60 | .545 |
  | kidbike | .16 | .60 | .42, .051 | .157, .542, −.167 | pegs/ground | .30 |
- Extra markers: basket (shared, steer child), rack (erba), stoker (tandem saddle top; the fish stands beside it on
  the right and sways), bell (all, steer child; `BikeMarkers.bell`).
- Meshes are `SkinnedMesh` named `bike:body` / `bike:hull`; body has `userData.noOutline`, hull
  `userData.isOutline` (generic outline passes skip them). Materials/atlas are shared singletons (never
  dispose them); `dispose()` releases the instance's lease (GPU buffers freed when the last user goes).
- Garage turntable can call `createBike` in its own renderer; `root.userData.tris/drawCalls` for stats.

## Known issues / possible polish
- Chains are static loops (no link scrolling); erba & shared hide chainring/chain inside their chain cases.
- MTB rear rotor edge grazes the left chainstay (toy-thick stays); only visible in close-ups from the left.

## Core requests
- render/toon.ts outline(): same bug actors reported (objectNormal undeclared on plain meshes); bikes use
  their own skinned hull material, so no change needed for bikes.
- render/toon.ts (critic r1 art): give `toon()` the same stepped cool rim the bikes now have (#9fd8ff, fresnel
  step .66, strength .3; GLSL in src/actors/bikes/build/shading-glsl.ts FINISH_FRAGMENT, last 3 lines) so the
  riders match the bikes.

## Requests to other units
- ui-screens (garage-turntable.ts): bike.update(dt, 3.2, …) spins the wheels at 3.2 m/s, which by design shows the
  speed-blur disc (wire spokes dissolve above ~1 m/s to avoid wagon-wheel strobing). Use ~0.6 m/s to show the
  spokes. Critic r1 m10 (yours, already your A-M2): swing ±60° around a 3/4 view and frame the bike at ~45 %.

## How to test
- `tools/devserver.sh`, then `/sandbox/bikes.html` (views: turntable, close, side, front, back, top, lineup,
  chase, grid; markers toggle; tint/quality; speed/steer sliders; LAUNCH 0→v for the balance-bike paddle).
  URL: `?bike=tandem&view=close&markers=1&speed=8&steer=0.3&focus=0,0.95,0.52&dist=0.9`.
- Shots: `node sandbox/bikes.shots.mjs --bikes roadbike,erba --views side,close,chase --markers 1 [--clean]`.
- Animation checks: `node sandbox/bikes.anim.mjs` (all fields true). Tri budget: `node sandbox/bikes.tris.mjs`.
- In game: `node sandbox/bikes.game.mjs --bike tandem --frames 640 --stub combat,ui`.
- Chase read at 1920×1080 with a rival placed ahead: `node sandbox/bikes.chase.mjs --bikes tandem,roadbike,fixie
  [--rival sloth] [--ahead 7] [--frames 760] [--track coast|city|mountain]` → shots/bikes/chase-<bike>[-tag].png.

## Fix round 1 (critic reviews/bikes-r1-art.json, score 6) — DONE
Plan (checkpoint after each; [x] = done):
- [x] M1 tyres/rims smooth (exempt from `detail`, floors), MTB tread blocks, spokes → alpha cards (atlas 1024²)
- [x] M2 wheel spin: spoke bone + blur-disc bone per wheel, dithered crossfade by ω (no wagon-wheel); tread on a capped-rate bone
- [x] M3 material: per-vertex gloss (palette), toon specular band, chrome env banding, stepped cool rim; erba blue-black
- [x] M4 toy proportions: fatter tubes + fillets, flush fork crown, capsule pedals, rounded saddles, fatter tyres, smooth drop bars
- [x] m5 drivetrain (ring outline/inner face/bolts, chain 8 mm + links + outline, rounded spider)
- [x] m6 fish grumpy (brow, half-lid, frown) + strap around fish & seatpost + buckle
- [x] m7 rear signatures (roadbike tail light, MTB orange mudguard, erba rack + reflector, kidbike fender)
- [x] m8 tint main tubes only; keep signature parts; lift dark tints
- [x] m9 kidbike streamers: 3 bones each, phase-lagged, two-tone
- [x] m10 garage framing → ui-screens request (not my files; listed under Requests to other units)
Tools: `node sandbox/bikes.tris.mjs [--bikes x] [--quality q]` = triangle breakdown per calling function.
  - M1 done: parts/tyre.ts (tyre = lathe of an open round section ending at the rim beads: 44×5 segs high on
    R≥.25, fat tyres 6 across; floors 32 on low; rims 36 lathe segs; `qseg` ignores per-bike `detail`), MTB = round
    32-gon + 24 zig-zag bevel-free tread blocks; wire spokes = one alpha-tested 16-spoke atlas card per side (4 tris
    per wheel instead of ~96).
  - M2 done: groups spokes{R,F} (child of wheel), blur{R,F} + tread{R,F} (siblings). animate.ts: smoothed per-frame
    wheel turn vs pattern period → spokes bone X-scale 1→0, blur bone 0→1 (shaders read X/Y scale ratio of the bone
    as a dither dissolve: body, hull and a new shadow depth material); blur disc turns ≤0.07 rad/frame forward;
    tread turns ≤0.3 block spacing/frame. In KO slow-mo the per-frame turn drops, so real spokes come back.
  - M3 done: build/palette.ts (named colours → finish; paint = 0.5), PartSet writes a `gloss` attribute,
    build/shading-glsl.ts FINISH: hard toon specular band (sun = directional light 0), chrome sky/ground banding,
    stepped cool rim #9fd8ff (fresnel step .66, .3). Erba frame #1d2433 (blue-black): tubes/joints read again.
  - M4 done (markers unchanged): diamond.ts TOY_MAIN 1.4 (top/down/seat/head) / TOY_STAYS 1.15 + ball fillets at
    seat cluster, top-tube & down-tube heads and BB; stays start wider (±.04 BB, ±.03 cluster) to clear fatter tyres
    (road/fixie .022, erba/tandem .024, shared .03, mtb .036, kid .032); custom frames (shared/tandem/kid) scaled the
    same; fork crown = rounded ellipsoid flush with the blades + front axle; forks ×1.2 and widened where needed
    (mtb .074 + hubW .04, kid .058 + hubW .05); rounded toy pedals with inset reflector; puffier saddles (domed top);
    drop bar r .0145 with 24 smooth segments + angled rounded hoods; fatter seatposts.
  - m5 done: chainring = toothed annulus (outline .008) + alpha-tested 'spider' card (dark inner band, 5 rounded
    arms, bolt circle, boss); chain = one-sided equal-pitch link strip (8.4 mm, 2.8 cm toy links) mapped to a one-link
    atlas tile whose black edges are its outline (build/strip.ts linkStrip).
  - m6 done: fishface decal redrawn at 256×128 (heavy slanted brow, droopy straight lid over a side-eye, frown +
    pouting lip); body extrude bevel 2 segments (rounder); red band hugging the body + yellow buckle, two straps down
    both saddle sides to a loop round the stoker seatpost (loop on the frame, straps sway with the fish).
  - m7 done: roadbike slim red race fender + tail light (atlas 'taillight') on its tip; MTB chunky orange mudguard;
    erba rack 20 cm wide + 7.5×4.6 cm red reflector; kidbike mint rear fender (all low behind the rider, where the
    chase camera still sees the bike).
  - m8 done: fenders / chain cases are no longer paint (shared stays yellow, erba stays blue-black whatever the tint);
    partset.ts liftTint(): tints with sRGB lightness < .3 are lifted to .3 (hue/sat kept).
  - m9 done: streamer{L,R}{,2,3} bone chains; ribbons split per link, candy-striped (colour/white); animate.ts droops
    them at rest (.75/.3/.15 rad) and runs a phase-lagged X/Y flutter down the chain at speed.

## Fix round 2 (critic reviews/bikes-r2-art.json, score 7) — DONE
Plan (checkpoint after each; [x] = done):
- [x] M1 tandem fish: lofted round body (~13 cm thick), smaller/lower (head ≤ 0.40 m over the stoker saddle),
      leaning out to the side with a flank + grumpy face toward the chase camera
  - M1 done: defs/fish-body.ts (planar Bézier spine → lofted elliptic sections 12.8 cm thick × 14.4 cm tall, colour
    ramp, rounded tail cap + snout pole; forked tail, ragged dorsal and pectoral fins), defs/fish-face.ts (3D eyes:
    sclera + pupil + glint + heavy slanted lid, angry brows, frown meeting across the snout, both flanks), fish.ts
    (spine in the plane facing the chase camera: tail root at the stoker saddle's right edge, bows out to the right,
    head ~0.30 m over the saddle; band + buckle + straps over/under the saddle to the seatpost loop; sway pivot =
    strap point `fishPivot`). animate.ts: wind leans it back, bumps bob it, corners swing it. fishface decal removed.
    In game (1920×1080, `node sandbox/bikes.chase.mjs --bikes tandem`): the pelican's back is clear, the fish peeks out
    at hip height to the right; on the sloth 7 m ahead it reads as a fish. Tandem tris high 5152 (fish ≈ 1.6k).
- [x] m2 roadbike/fixie rear read: roadbike rear-facing "01" plate under the saddle + chunky self-lit LED tail light
      on its top edge (fittings.ts rearPlate/tailLight; the fender-tip light and side plate are gone); fixie neon-pink
      self-lit seatpost light; both rear tyres 14 % fatter (.025). Self-lit = PartOpts.glow → gloss 2 (palette GLOW):
      shading-glsl.ts draws those parts in their own colour whatever the light (erba/shared lamp lenses glow too).
- [x] m3 blur disc: decals-wheel.ts blur = sparse halftone ring (≤ 15 % cover, fading to 0 at rim and hub) + 4 thin
      tapered swooshes (~85 % of the disc see-through). (Only the near card renders: the far one is back-face culled.)
- [x] m4 segment counts: `detail` / `qseg` removed (every bike uses the quality-only `seg`); tubes 12, head tube 14,
      lugs 12×8, fork blades 12, grips = lathed 12-sided with a collar + domed end, pedals 12×6, bell lathe 14 + ball
      lever, drop bar 44 path segments (bullhorn 32, flat 20, swept 24), saddles 14×8, fenders 18 steps, lamp 16.
      New geo helpers roundRing (headset cups, stem collar, seat clamps) + pill (stem clamp, lever blades, pegs).
      Tris high / medium / low: roadbike 6864/5392/4138, erba 6156/4390/3618, shared 7248/5682/4332, fixie 5742/4022/3300,
      mtb 7134/5796/4456, tandem 9236/7338/5592, kidbike 6000/4702/3874 (8 bikes ≈ 55k of the ~850k per frame).
- [x] m5 kidbike front end: rounded headset cups / stem collar / pill clamp, capsule brake levers with ball ends, lathed
      bell, 12-sided tubes, fillet at the seat cluster, white round seat clamp, round front reflector, pill foot pegs.
- [x] m6 cable housings (parts/cables.ts: housing / frontLoop / rearRun with a head-tube cable guide): roadbike + tandem
      (front loop + rear run along the top tube(s)), MTB hoses (left lever down the fork leg, right lever over the top
      tube and down the left stay; discCaliper now returns its hose port), shared drum cables (sweptBar `levers`),
      kidbike lilac rear housing. Bars return `cableL/cableR` (LeverBar for drop / flat bars).
- [x] m7 outline weights: frame/fork/head tube .02, tyres .024, bars/grips/stem/seatpost/fenders/basket/lamp/chain
      case .012, saddles .014, BB .016, rims/hubs .008, pedals/cranks .01; spokes, chain and decals stay thin/none.
- [x] cleanup: BikeMarkersEx removed (types.ts has `bell`); fishface decal removed.
Verification (fix round 2): tsc clean for bikes files; `bikes.anim.mjs` all true; in game coast/city/mountain 0 errors,
  16 bike draw calls, 202 total, 854k tris, 60 fps; garage turntable 0 errors (tandem fish + fixie light visible).
  Shots: shots/bikes/fix2/ (s2 tandem chase, s3 fish close-ups, s4–s6 close-ups, s7–s10 chase crops, s11 garage).
Known limits: the roadbike's tail light + "01" plate sit between the pelican's legs, ~10–12 px wide at 1080p in the
  chase view (the bike itself is narrow from behind); fish head ~0.30 m over the stoker saddle, on the right side.

## r3 polish (2026-10-25)
Slice r3-perf (integrator's polish round; probes + sheets in shots/r3-perf/).
- [x] game-r2-perf#5 far bikes had no LOD (7 rivals at 70 m: 21 calls / 146k tris of bikes alone) -> distance LOD:
      - build: BikeBuilder(quality, far) runs the same def with build/geo.ts farSeg (~1/3 of the high segments, quality minimums
        ignored) and PartSets whose `detail` view drops full-detail-only parts (cables, cranks + chainrings + pedals, chain,
        BB shell, lugs, headset cups, steerer, hubs/axles, brakes, bell, levers, cog/rotor/drum, tread blocks, clamps, struts,
        kickstand, erba springs/rods/rings, fish face/band/straps). Wheels: 16-sided tyre (4 across) + rim; spoke and blur cards
        stay (2 tris each, same dissolve), so the wheel interior does not change. Same groups -> cache.ts matchBones() maps the
        far skin indices onto the full build's bones (identity today, guarded).
      - far tris (bikes.tris.mjs --far): roadbike 884, erba 1146, shared 1194, fixie 864, mtb 856, tandem 1102 (fish body +
        fins kept), kidbike 1216 (streamers kept) vs 5742-9236 high. One far template per bike id (quality-independent) +
        tint variants, ref-counted like the full ones; built with the full template (loading screen).
      - model.ts: far body + hull ride the same skeleton (hidden); BikeModel.setLod?(far, outline) (types.ts, optional)
        swaps; outline false also drops hull + shadow. actors/lod.ts (additive): RiderLod gets the bike, BIKE_FAR 40 / NEAR 35 m
        hysteresis, and passes the rider's own hull/shadow band (60 / 52 m) as `outline`; view.ts passes this.bike.
      - in game (far-bikes.mjs, 7 rivals pinned ahead): bikes at 70 m 21 calls / 145.6k -> 2-8 calls / 5.9-7.1k tris; at
        40-45 m (far + hull + shadow) 145.6k -> 14-23k; the whole rival group at 70 m coast 200k -> 64k, city 149k -> 67k,
        mountain 198k -> 62k tris.
      - pop (lod-pop.mjs + .py, 1080p chase, all 7 models at 35/40/45 m from the camera, the same frame rendered full vs far):
        mean channel diff 0.82 / 0.74 / 0.70 of 255 over the group crop, p99 24-26; pop-sheet.jpg shows no visible change.
        Structure: lineup-sheet.jpg (all 7 far models up close in the sandbox, ?lod=far): every part on its bone, colours,
        fish, basket, rack, streamers.
- Tools: sandbox/bikes.ts ?lod=far; bikes.tris.mjs --far; bikes.chase.mjs --out <dir>.
- Checks: bikes.anim.mjs all true; bikes.tris (full counts unchanged); bikes.chase tandem/kidbike/erba 0 errors; race-soak x3
  OK; tsc 0 errors in src/actors.
- Known: actors' crash support points (rig/support-points.ts modelSupports) also collect the hidden far mesh's points (a
  subset of the full hull's; harmless, ~+50 % contacts while a bike tumbles) -> optional request to actors: skip meshes
  with userData.lod === 'far' there (the far body / hull carry that tag).
