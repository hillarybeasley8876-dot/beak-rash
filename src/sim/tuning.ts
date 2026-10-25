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
  rubberMax: 1.5,         // cap on the race-owned top-speed factor rider.rubber (≤ 0 / NaN → neutral)
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
  knockSteer: 0.05,       // … steering back toward the hitter ×this (steering away keeps full authority) …
  knockTau: 0.3,          // … and the grip lag is at least this (≈ 0.19 s × knock m/s of travel: 9 → 1.7 m)
  knockMin: 0.5,          // m/s lateral impulse below which no carry window opens
  knockEaseTime: 0.3,     // s a knock eases the heading (yawEaseRate): the nose swings with the shove, never snaps
                          // (a 9 m/s knock at 20 m/s turns it ≈ 24° in ≈ 0.08 s; this covers swings up to 90°)
  leanLambda: 12,         // 1/s smoothing of the visual lean
  leanMax: 38 * DEG,
  yawMax: 50 * DEG,       // heading cap (velocity angle + drift slip): full-lock drifts stay readable, yet a
                          // slow full-lock drift into a jump can still exceed crashLandYaw
  leanCarve: 0.035,       // lean demand from lateral motion: a = v²·κ + leanCarve·v·vx
  pitchLambda: 9,         // 1/s smoothing of the visual pitch (air / ramps / weight)
  pitchBrake: 0.25 * DEG, // nose-down pitch per m/s² of deceleration (full brake ≈ −3°) …
  pitchSquat: 0.1 * DEG,  // … nose-up per m/s² of acceleration (boost squat) …
  pitchWeightMax: 4 * DEG, // … capped at this
  landPitchBase: 5 * DEG, // landing compression: nose-down target offset base + per s of air (peak ≈ 0.37× after ≈ 0.1 s) …
  landPitchAir: 8 * DEG,
  landPitchMax: 12 * DEG,
  landPitchLambda: 9,     // … decaying at this rate (1/s)
  scrapeYaw: 5 * DEG,     // scraping a wall at full pressure: nose into the wall …
  scrapeLean: 8 * DEG,    // … leaning on it …
  scrapeShimmy: 1.2 * DEG, // … with a grinding shimmy of this amplitude …
  scrapeShimmyK: 4.1,     // … at this many rad per metre ridden (≈ 13 Hz at 20 m/s)
  scrapeLambda: 12,       // 1/s smoothing of the scrape pose
  // ---- drift
  driftMinSpeed: 8,
  driftEndSpeed: 6,
  driftSteerMin: 0.3,     // |steer| needed to start a drift
  driftSlip: 27 * DEG,    // visual slip angle at full build
  driftSlipLambda: 7,
  driftLean: 9 * DEG,     // extra lean into the drift
  // Road-relative drift: the bike follows the bend (no curve push) and steering only sets how fast it moves
  // across the road (at top speed): full into the drift → driftLatIn inward, full counter → driftLatOut.
  driftLatIn: 4.5,        // m/s (a committed drift crosses the road like plain grip steering would)
  driftLatOut: -1.0,      // m/s (negative = running wide)
  driftMaxAngle: 20 * DEG, // |vx| ≤ v·tan(this) while drifting: below wallCrashAngle, so a drift bounces off walls
  driftCurveCancel: 1.35, // a drift cancels the curve push only up to this × steerAuthHigh × handling × v/top
                          // (turn authority ×1.35): beyond ≈ R32 at top speed a drift runs wide
  driftExitTime: 0.35,    // s after a release over which grip steering takes over from the drift's lateral speed …
  driftExitGuard: 1.0,    // … and |vx| ≤ v·tan(driftMaxAngle) for this long (a release mistake bounces, never wrecks)
  // Exit carve (carve.ts): after a mini-turbo release mid-bend the bike keeps the drift's bite for the rest of
  // that bend: the curve push beyond driftCarveHold × grip authority is cancelled (never more than the drift's own
  // cancel), so a hairpin needs ~70 % steer instead of running wide at full lock; |vx| stays ≤ v·tan(driftMaxAngle).
  driftCarveHold: 0.7,
  driftCarveEndKappa: 1 / 150, // m⁻¹: the carve fades once the bend turning the drift's way relaxes below this …
  driftCarveFade: 0.3,    // … over this many s …
  driftCarveMax: 4,       // … or this many s after the release at the latest
  driftBleed: 0.04,       // 1/s speed bleed while drifting
  // Charge by commitment: rate lerp(low, high, u) × (straight … 1 as the bend into the drift tightens to
  // 1/250 m⁻¹), where `low` rises to lowBend on that bend. Full commitment: R ≤ 250 → L3 in 1.74 s, R319
  // 2.07 s, R380 2.34 s; a drift holding its line on R ≤ 250 (≈ −0.64 counter-steer) → L3 in ≈ 2.3 s;
  // snaking on a straight nets ≤ +3 % (measured over 20 s), counter-steered wiggles lose speed.
  driftChargeLow: 0.35,   // full counter-steer on a straight …
  driftChargeLowBend: 0.8, // … and on a bend into the drift (R ≤ 250)
  driftChargeHigh: 1.15,  // full steer into the drift
  driftChargeStraight: 0.25,
  driftChargeKappa: 250,
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
  perfectMaxYaw: 12 * DEG, // hop-timed landings (hop pressed ≤ perfectHopWindow s before touchdown) …
  perfectCalmYaw: 6 * DEG, // … otherwise |yaw| below this and |steer| < perfectSteerMax for the last perfectCalmTime s
  perfectSteerMax: 0.3,
  perfectCalmTime: 0.15,
  perfectHopWindow: 0.2,
  perfectPower: 0.2,
  perfectTime: 0.6,
  hardLandAir: 0.7,       // non-perfect landings after this much air lose speed
  hardLandLoss: 0.06,
  crashLandYaw: 45 * DEG,
  crashLandHeight: 2.5,
  // ---- air tricks (SPEC §16)
  tricks: {
    minAir: 0.25,         // s of air before a trick can start
    spinDur: 0.55,        // s for a full spin
    flipDur: 0.65,        // s for a full flip (front or back)
    snap: 0.85,           // a trick below this progress at touchdown crashes the rider
    supermanHold: 0.2,    // s of drift before the superman starts
    supermanMin: 0.3,     // s the superman must last to count (shorter = cancelled, no points)
    predictMargin: 0.05,  // s: a trick starts only if the predicted air left covers it (snap point) plus this
    sloppyLoss: 0.25,     // speed lost landing still in superman (no crash: a drift held into a landing is common)
    steerMin: 0.6,        // |steer| that turns a drift press into a spin
    brakeMin: 0.5,        // brake that turns a drift press into a backflip
    pointsBase: 120,      // style points per trick in a chain
    pointsExtra: 50,      // extra points per extra trick in the same air
    boostPower: 0.2,      // the landing boost of a trick
    boostTime: 0.6,       // … and its duration
    boostStep: 0.2,       // +20 % boost time per extra trick in the chain
  },
  // ---- umbrella glide (SPEC §15)
  glideGravity: 0.45,     // ×gravity while the umbrella is open
  glideControl: 0.6,      // steering authority while gliding (the plain air gets airControl)
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
  draftMinSpeed: 8,       // no slipstream / slingshot below this speed …
  draftBrakeMax: 0.5,     // … or while braking harder than this (braking resets the draft)
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
  wallLatchGap: 0.4,      // contact hysteresis: after an impact, re-contacts on that side scrape (no bounce, no
  wallLatchTime: 0.8,     // event) until the rider steers > this m away from it or stays off it this many s …
  wallLatchFar: 1.0,      // … or is this far from it whatever the steering (a full-lock bounce carries ≈ 0.5 m)
  yawEaseTime: 0.15,      // s after a bounce flips the lateral velocity during which the heading turns at most …
  yawEaseRate: 300 * DEG, // … this fast (rad/s): a full-lock wall hit swings ≈ 28° over ≈ 0.09 s instead of one frame
  riderHalfWidth: 0.35,
  // ---- rider contacts
  contactDs: 1.7,
  contactDx: 0.75,
  contactRestitution: 0.8, // side impacts above bumpBounceMin (1 = full lateral velocity swap)
  bumpBounceMin: 1.5,     // m/s closing; gentler side contact is an inelastic shove (no jitter)
  bumpEaseMin: 0.5,       // m/s closing above which a side contact eases both headings (yawEaseRate)
  bumpSteer: 0.3,         // side bounce carry: steering back toward the other rider ×this (knocks use knockSteer)
  pairLatchGap: 0.4,      // side-contact latch: after a bounce, re-contacts of the pair are silent inelastic shoves
  pairLatchFar: 1.0,      // until they are > gap m apart with neither pressing in, > far m apart whatever the steering …
  pairLatchTime: 0.6,     // … or apart for this many s
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
  crashBodyHeight: 1.0,   // m: the tumbling body starts about here (actors' spine bone) …
  crashVaultGravity: 15,  // … and falls with the actors' tumble gravity, so a vehicle crash launches it at
  crashVaultMargin: 0.45, // ≥ √(2g·(roof + margin − start)) and it clears the roof instead of tunnelling …
  crashVaultMaxHeight: 1.9, // … only for obstacles up to this tall (cars, pickups, props) …
  crashVaultClear: 0.8,   // … flying forward fast enough to pass their far end (+ this m) before it drops to roof height
  crashBounceBack: 1.5,   // taller ones (vans, trucks, buses) bounce the body back off them at this m/s …
  crashBounceK: 0.05,     // … + this × the closing speed, never faster forward than the vehicle (it brakes ahead)
  crashSlideDecel: 7,
  crashedTime: 2.6,
  respawnTime: 0.6,
  invulnTime: 2,
  respawnHp: 0.7,
  respawnSpeed: 6,        // m/s the push-off eases up to after the respawn blink …
  respawnPush: 20,        // … at this acceleration (m/s², ≈ 0.3 s) …
  respawnPushTime: 0.4,   // … for at most this long
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
