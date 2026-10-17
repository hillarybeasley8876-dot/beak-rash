// Every handling constant (SPEC §6) in one mutable table so critics can tweak live via
// window.__br.sim.tuning, plus per-bike / per-character derived parameters.
import { BIKES } from '../data/bikes';
import { ROSTER } from '../data/roster';
import { DEG } from '../core/math';
import type { BikeId, CharacterId } from '../core/types';

export const TUNING = {
  // ---- longitudinal
  gravity: 9.8,
  accelScale: 0.875,      // bike.accel × this = pedal accel at v=0 (roadbike 0→60 km/h ≈ 4.4 s)
  coastDrag: 0.6,         // m/s² while not pedalling
  overspeedDecay: 0.8,    // 1/s pull back toward the slope's settle speed (boost wearing off)
  overspeedDrag: 0.005,   // 1/m quadratic drag above top: a −= k·(v² − top²), so descents settle faster
                          // (−13 % ≈ 23 m/s, −5.5 % ≈ 21.4 m/s) instead of being clipped back to top
  slopeK: 0.55,           // a −= g·slope·slopeK
  boostAccel: 16,         // m/s² extra push while a boost is active and below the boosted top
  airDrag: 0.15,          // m/s² forward drag while airborne
  finishBrake: 2.5,       // m/s² auto-brake after crossing the finish line
  // ---- steering
  steerAuthLow: 4.5,      // m/s lateral authority at standstill-ish speed …
  steerAuthHigh: 7.5,     // … and at top speed
  steerFullSpeed: 4,      // below this speed lateral authority fades to 0 (a stopped bike cannot strafe)
  maxSlipRatio: 0.7,      // |vx| ≤ v·this (≈35° heading)
  gripTau: 0.07,          // s, time constant toward the lateral target on asphalt (÷ grip)
  curvePush: 0.8,         // s; outward lateral-velocity bias = curvature·v²·curvePush
  airControl: 0.35,       // steering authority in the air
  airTauMul: 3,           // lateral time constant multiplier in the air
  knockTime: 0.22,        // s carry window after a lateral impulse / hard bump: the shove reads on screen …
  knockSteer: 0.3,        // … steering ×this …
  knockTau: 0.3,          // … and the grip lag is at least this (≈ 0.19 s × knock m/s of travel: 9 → 1.7 m)
  knockMin: 0.5,          // m/s lateral impulse below which no carry window opens
  leanLambda: 12,         // 1/s smoothing of the visual lean
  leanMax: 38 * DEG,
  yawMax: 50 * DEG,       // heading cap (velocity angle + drift slip): full-lock drifts stay readable, yet a
                          // slow full-lock drift into a jump can still exceed crashLandYaw
  leanCarve: 0.035,       // lean demand from lateral motion: a = v²·κ + leanCarve·v·vx
  pitchLambda: 9,         // 1/s smoothing of the visual pitch (air / ramps)
  // ---- drift
  driftMinSpeed: 8,
  driftEndSpeed: 6,
  driftSteerMin: 0.3,     // |steer| needed to start a drift
  driftSlip: 27 * DEG,    // visual slip angle at full build
  driftSlipLambda: 7,
  driftLean: 9 * DEG,     // extra lean into the drift
  // Road-relative drift: the bike follows the bend (no curve push) and steering only sets how fast it moves
  // across the road (at top speed): full into the drift → driftLatIn inward, full counter → driftLatOut.
  driftLatIn: 3.2,        // m/s (≈ 2.7 s from the centre to a wall: time to reach L3 holding into it)
  driftLatOut: -1.0,      // m/s (negative = running wide)
  driftMaxAngle: 20 * DEG, // |vx| ≤ v·tan(this) while drifting: below wallCrashAngle, so a drift bounces off walls
  driftBleed: 0.04,       // 1/s speed bleed while drifting
  // Charge by commitment: rate lerp(low, high, u) × (straight … 1 as the bend into the drift tightens to
  // 1/80 m⁻¹). Holding into a tight bend reaches L3 in 1.5 s, an R150 sweeper in 2.4 s; snaking on a
  // straight nets ≤ +3 % (measured over 20 s), counter-steered wiggles lose speed.
  driftChargeLow: 0.35,   // full counter-steer
  driftChargeHigh: 1.3,   // full steer into the drift
  driftChargeStraight: 0.25,
  driftChargeKappa: 80,
  driftLockout: 0.3,      // s after a release before the next drift can start (no snake-farming)
  driftPedalMul: 0.45,    // pedalling effectiveness while drifting
  driftLevels: [0.55, 1.2, 2.0],
  driftBoostTime: [0.3, 0.85, 1.3],
  driftBoostPower: [0.22, 0.28, 0.35],
  // ---- air
  hopVy: 4.6,
  hopGravity: 24,
  airGravity: 17,         // launched air (ramps, crests, external) — floatier than a hop
  crestMinSpeed: 9,       // jumpCrest features only kick above this speed
  crestKick: 1.0,         // × v·Δslope at a jumpCrest top
  crestSpan: 6,           // m either side of the peak used to measure Δslope
  crestMinKick: 0.12,     // jumpCrest always kicks at least v·this (m/s)
  padPower: 0.3,          // boostPad defaults (feature data.power / data.time override)
  padTime: 1.0,
  rampHeight: 1.2,        // default ramp lip height (m) when the feature has no data.height
  perfectMinAir: 0.35,
  perfectMinAirHop: 0.55, // a plain 0.38 s hop on flat road must not farm PERFECT boosts
  landEventMinAir: 0.12,  // micro crest hops below this air time …
  landEventMinPeak: 0.12, // … or this height stay silent (no rider:land)
  perfectMaxYaw: 12 * DEG,
  perfectPower: 0.2,
  perfectTime: 0.6,
  hardLandAir: 0.7,       // non-perfect landings after this much air lose speed
  hardLandLoss: 0.06,
  crashLandYaw: 45 * DEG,
  crashLandHeight: 2.5,
  // ---- slipstream
  draftRange: 12,
  draftMinGap: 0.8,
  draftHalfWidth: 1.6,
  draftRise: 1 / 0.6,     // per second
  draftFall: 2,
  draftTop: 0.1,
  draftAccel: 0.15,
  slingshotMin: 0.8,
  slingshotPower: 0.15,
  slingshotTime: 0.8,
  // ---- surfaces
  grassTopBase: 0.55,
  grassTopOffroad: 0.45,
  sandTop: 0.45,
  dirtTop: 0.8,
  offroadGrip: 0.75,
  offroadWobble: 0.9,     // m/s lateral sway amplitude on grass/sand (× (1 − offroad))
  curbTop: 0.97,
  puddleGrip: 0.6,
  wetTime: 0.6,
  oilGrip: 0.25,
  oilTime: 1.2,
  oilScrub: 0.06,         // speed lost on entering oil …
  puddleScrub: 0.02,      // … or a puddle
  slideSway: 2.6,         // m/s fishtail target amplitude on oil (≈ 1.3 m/s after the slow oily grip lag)
  slideFreq: 6,           // rad/s
  slideYaw: 12 * DEG,     // visual fishtail yaw
  slideLean: 0.12,        // rad visual lean wobble
  puddleSlide: 0.35,      // puddle fishtail strength (× oil) …
  puddleSlideTime: 0.3,   // … for the first this-many seconds of the wet timer
  // ---- walls & world edge
  wallRestitution: 0.35,
  wallSpeedLoss: 0.25,    // × impact (0..1)
  wallCrashSpeed: 18,
  wallCrashAngle: 24 * DEG, // impact angle atan(vx/v) needed (with speed > wallCrashSpeed) to crash
  softEdgeRestitution: 0.2,
  wallBounceMin: 1.2,     // m/s into the wall: above → bounce/impact, below → scrape (vx = 0)
  wallPressureFull: 4,    // m/s of lateral target into the wall = full scrape pressure
  wallScrapeDecel: 3.5,   // m/s² friction at full pressure
  wallScrapeEvery: 0.16,  // s between scrape events (sparks, sound)
  wallHitEvery: 0.3,      // s: one 'wall' impact event per approach (re-hits inside merge silently)
  wallCarryTime: 0.3,     // s the bounce carries the rider off the wall (no steering, slow grip) …
  wallCarryTau: 0.4,      // … grip lag during it (≈ 0.5 m of visible bounce from a full-lock hit)
  riderHalfWidth: 0.35,
  // ---- rider contacts
  contactDs: 1.7,
  contactDx: 0.75,
  contactRestitution: 0.8, // side impacts above bumpBounceMin (1 = full lateral velocity swap)
  bumpBounceMin: 1.5,     // m/s closing; gentler side contact is an inelastic shove (no jitter)
  rearRestitution: 0.3,
  contactMaxFix: 0.04,    // m positional correction per substep (≈ 4.8 m/s): push, never teleport
  bumpMin: 1.0,           // m/s strength before rider:bump fires (gentle shoulder pressing stays quiet)
  bumpEndDrift: 1.5,      // m/s strength that knocks a rider out of a drift
  bumpHard: 3,            // Δvx for a damaging bump
  bumpDmgMin: 2,
  bumpDmgMax: 5,
  wobbleTime: 0.4,
  wobbleAmp: 1.6,         // m/s lateral sway at wobble strength 1
  wobbleFreq: 11,         // rad/s
  // ---- obstacles
  riderHalfLength: 0.9,
  trafficCrashRel: 8,
  propCrashRel: 16,
  propSpeedLoss: 0.15,
  sideSwipeLoss: 0.1,
  nearMissGap: 1.0,
  nearMissRel: 6,
  nearPassGap: 0.6,       // rider near miss: lateral gap beyond contact …
  nearPassRel: 4,         // … at this relative speed (m/s)
  // ---- crash & respawn
  crashForward: 0.7,
  crashUp: [4, 7],
  crashSpin: [4, 9],
  crashSlideDecel: 7,
  crashedTime: 2.6,
  respawnTime: 0.6,
  invulnTime: 2,
  respawnHp: 0.7,
  respawnSpeed: 6,
};

export type Tuning = typeof TUNING;

export interface BikeTune {
  top: number;      // m/s flat-road top speed (bike × character)
  accel: number;    // m/s² pedal accel at v=0
  brake: number;
  handling: number; // steering authority multiplier
  mass: number;     // contact mass factor
  offroad: number;  // 0..1
}

/** Character stats are 1..5 ratings relative to the pelican (speed 4, handling 4, weight 3). */
export function bikeTune(bike: BikeId, character: CharacterId): BikeTune {
  const b = BIKES[bike];
  const st = ROSTER[character].stats;
  const scale = ROSTER[character].scale;
  return {
    top: b.topSpeed * (1 + 0.025 * (st.speed - 4)),
    accel: b.accel * TUNING.accelScale * (1 + 0.02 * (st.speed - 4)),
    brake: b.brake,
    handling: b.handling * (1 + 0.04 * (st.handling - 4)),
    mass: b.weight * (0.7 + 0.1 * st.weight) * (0.8 + 0.2 * scale),
    offroad: b.offroad,
  };
}
