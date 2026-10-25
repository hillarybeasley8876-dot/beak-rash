// Private per-rider simulation state (never shared with other units) and small shared helpers.
import { Vector3 } from 'three';
import { bikeTune, type BikeTune } from './tuning';
import type { Session, Track } from '../core/contracts';
import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/events-map';
import type { Rng } from '../core/rng';
import type { RiderState, StatusId, TrackFrame, Vec3Like } from '../core/types';

/** hop = Space; launch = ramp/crest/impulse; external = another unit flies the rider (ult, gulp spit). */
export type AirKind = 'hop' | 'launch' | 'external';

export interface SimRider {
  readonly r: RiderState;
  readonly tune: BikeTune;
  readonly frame: TrackFrame;        // sampled at r.s each step (reused object)
  // drift
  driftDir: -1 | 0 | 1;
  driftLevel: number;
  driftLock: number;                 // s until another drift may start (after a release)
  driftExit: number;                 // s left of the release ramp (drift lateral speed → grip steering) …
  driftExitVx: number;               // … starting from this lateral speed
  carve: number;                     // exit carve strength 0..1 after a mini-turbo release (carve.ts) …
  carveDir: -1 | 0 | 1;              // … for the bend turning this way (0 = no carve) …
  carveTime: number;                 // … s since that release
  slip: number;                      // visual slip angle (rad, signed)
  // air
  airKind: AirKind;
  airPeak: number;                   // max height this air episode (m)
  airOwn: boolean;                   // true while an air episode started by sim is running
  // lateral / visuals
  wobblePhase: number;
  pitch: number;                     // visual pitch (rad, + nose up)
  landPitch: number;                 // landing compression offset of the pitch target (rad, decays)
  scrape: number;                    // wall scrape pressure this step, signed by the wall's side (−1 … 1)
  scrapePose: number;                // smoothed scrape pressure for the visual pose (nose and lean into the wall)
  vxTarget: number;                  // lateral velocity the grip is pulling toward this step (after carry clamps)
  vxWant: number;                    // the rider's own intent (no carry clamp): wall pressure, latch release
  carryTime: number;                 // s left of a carry window (knock / bump / wall bounce): weak steer, slow grip
  carrySteer: number;                // multiplier on steering that points toward the hazard during the carry
  carryTau: number;                  // minimum grip time constant while the grip pulls toward the hazard (s)
  carryDir: -1 | 0 | 1;              // side of the hazard (wall, vehicle, hitter); 0 = clamp every direction
  yawEase: number;                   // s left of yaw smoothing after a bounce / knock flipped vx in one step
  slidePhase: number;                // oil / puddle fishtail phase (rad)
  // surfaces
  oilTime: number;
  wetTime: number;
  wobbleTime: number;                // bump wobble (sim-owned 'wobble' status mirror)
  wobbleStrength: number;
  lastSurface: string;
  offroadCooldown: number;
  onRamp: boolean;
  rampSlope: number;
  inPad: boolean;
  inOil: boolean;
  inPuddle: boolean;
  // slipstream
  draftLeader: number;               // rider id being drafted, −1 none
  // obstacles
  nearMiss: Map<number, boolean>;    // obstacle id → still clean (true) / touched (false)
  nearMissCooldown: number;
  touching: Set<number>;             // obstacle ids overlapping last step
  wallCooldown: number;              // scrape event spacing
  wallHitCooldown: number;           // one 'wall' impact event per approach
  wallSide: -1 | 0 | 1;              // contact hysteresis: side of the last impact (re-contacts scrape) …
  wallFree: number;                  // … s since the rider last touched it
  swipeCooldown: number;             // one side-swipe event / speed scrub per approach to a vehicle
  swipeLatch: number;                // obstacle id of the last side swipe (re-contacts scrape), −1 none …
  swipeFree: number;                 // … s since the rider last touched it
  // air (landing judgement)
  airCalm: number;                   // s the steering has stayed below perfectSteerMax in this air episode
  hopPressAt: number;                // air time of the last hop press while airborne (−1 none)
  // crash
  crashBack: number;                 // m/s the crashed body slides back along the road (bounced off a vehicle)
  pushOff: number;                   // s left of the respawn push-off (eases from 0 up to respawnSpeed)
  prevS: number;
  accel: number;                     // last forward acceleration (m/s²), camera surge
}

export function createSimRider(r: RiderState): SimRider {
  return {
    r, tune: bikeTune(r.bike, r.character), frame: emptyFrame(),
    driftDir: 0, driftLevel: 0, driftLock: 0, driftExit: 0, driftExitVx: 0, carve: 0, carveDir: 0, carveTime: 0, slip: 0,
    airKind: 'hop', airPeak: 0, airOwn: false,
    wobblePhase: r.id * 1.7, pitch: 0, landPitch: 0, scrape: 0, scrapePose: 0, vxTarget: 0, vxWant: 0,
    carryTime: 0, carrySteer: 1, carryTau: 0, carryDir: 0, yawEase: 0, slidePhase: 0,
    oilTime: 0, wetTime: 0, wobbleTime: 0, wobbleStrength: 0, lastSurface: 'road', offroadCooldown: 0, onRamp: false, rampSlope: 0,
    inPad: false, inOil: false, inPuddle: false,
    draftLeader: -1,
    nearMiss: new Map(), nearMissCooldown: 0, touching: new Set(), wallCooldown: 0, wallHitCooldown: 0,
    wallSide: 0, wallFree: 0, swipeCooldown: 0, swipeLatch: -1, swipeFree: 0, airCalm: 0, hopPressAt: -1,
    crashBack: 0, pushOff: 0, prevS: r.s, accel: 0,
  };
}

export function emptyFrame(): TrackFrame {
  return {
    s: 0, pos: { x: 0, y: 0, z: 0 }, tangent: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 }, curvature: 0, slope: 0, bank: 0, halfWidth: 7,
  };
}

/** Everything a sub-module needs for one step. */
export interface SimCtx {
  readonly session: Session;
  readonly bus: EventBus<GameEvents>;
  readonly rng: Rng;
  readonly riders: SimRider[];
  readonly tmpFrame: TrackFrame;
}

export function statusStrength(r: RiderState, id: StatusId): number {
  let best = 0;
  for (const st of r.statuses) if (st.id === id && st.time > 0) best = Math.max(best, st.strength || 1);
  return best;
}

export function hasStatus(r: RiderState, id: StatusId): boolean {
  return r.statuses.some((st) => st.id === id && st.time > 0);
}

/** Add or update a status this unit manages (source null); time mirrors our own timer exactly. */
export function setStatus(r: RiderState, id: StatusId, time: number, strength: number): void {
  const st = r.statuses.find((x) => x.id === id && x.source === null);
  if (st) {
    st.time = time;
    st.strength = strength;
  } else {
    r.statuses.push({ id, time, strength, source: null });
  }
}

/** Remove a sim-managed status (source null) once our own timer has run out. */
export function dropStatus(r: RiderState, id: StatusId): void {
  const i = r.statuses.findIndex((x) => x.id === id && x.source === null);
  if (i >= 0) r.statuses.splice(i, 1);
}

/** Last s with real road: the finish line plus the track's drivable run-off (frames are valid up to here). */
export function trackEnd(track: Track): number {
  return track.length + Math.max(0, track.runoff ?? 0);
}

/** Vertical curvature d(slope)/ds around s (central difference over ±h m, smooths 1 m sampling). */
export function verticalCurvature(ctx: SimCtx, s: number, h = 2): number {
  const tr = ctx.session.track;
  const a = tr.frameAt(Math.max(0, s - h), ctx.tmpFrame).slope;
  const b = tr.frameAt(Math.min(trackEnd(tr), s + h), ctx.tmpFrame).slope;
  return (b - a) / (2 * h);
}

const tmpV = new Vector3();

/** World position of a rider (new object — safe to hand to event listeners). */
export function worldPos(ctx: SimCtx, r: RiderState): Vec3Like {
  ctx.session.track.toWorld(Math.min(r.s, trackEnd(ctx.session.track)), r.x, r.y, tmpV);
  return { x: tmpV.x, y: tmpV.y, z: tmpV.z };
}

/** True when the rider is simulated as a moving body this step. */
export function isRiding(r: RiderState): boolean {
  return r.mode === 'racing' || r.mode === 'finished';
}

/** Riders that collide with others / traffic this step. */
export function isSolid(r: RiderState): boolean {
  return isRiding(r) && !r.mods.intangible && r.invuln <= 0 && !hasStatus(r, 'gulped');
}
