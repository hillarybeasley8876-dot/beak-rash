// Private per-rider simulation state (never shared with other units) and small shared helpers.
import { Vector3 } from 'three';
import { bikeTune, type BikeTune } from './tuning';
import type { Session } from '../core/contracts';
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
  slip: number;                      // visual slip angle (rad, signed)
  // air
  airKind: AirKind;
  airPeak: number;                   // max height this air episode (m)
  airOwn: boolean;                   // true while an air episode started by sim is running
  // lateral / visuals
  wobblePhase: number;
  pitch: number;                     // visual pitch (rad, + nose up)
  vxTarget: number;                  // lateral velocity the rider is pushing toward (walls use it as pressure)
  carryTime: number;                 // s left of a carry window (knock / bump / wall bounce): weak steer, slow grip
  carrySteer: number;                // steering multiplier during the carry window
  carryTau: number;                  // minimum grip time constant during the carry window (s)
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
  swipeCooldown: number;             // one side-swipe event / speed scrub per approach to a vehicle
  // crash
  respawnPending: boolean;
  prevS: number;
  accel: number;                     // last forward acceleration (m/s²), camera surge
}

export function createSimRider(r: RiderState): SimRider {
  return {
    r, tune: bikeTune(r.bike, r.character), frame: emptyFrame(),
    driftDir: 0, driftLevel: 0, driftLock: 0, slip: 0,
    airKind: 'hop', airPeak: 0, airOwn: false,
    wobblePhase: r.id * 1.7, pitch: 0, vxTarget: 0, carryTime: 0, carrySteer: 1, carryTau: 0, slidePhase: 0,
    oilTime: 0, wetTime: 0, wobbleTime: 0, wobbleStrength: 0, lastSurface: 'road', offroadCooldown: 0, onRamp: false, rampSlope: 0,
    inPad: false, inOil: false, inPuddle: false,
    draftLeader: -1,
    nearMiss: new Map(), nearMissCooldown: 0, touching: new Set(), wallCooldown: 0, wallHitCooldown: 0, swipeCooldown: 0,
    respawnPending: false, prevS: r.s, accel: 0,
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

/** Vertical curvature d(slope)/ds around s (central difference over ±h m, smooths 1 m sampling). */
export function verticalCurvature(ctx: SimCtx, s: number, h = 2): number {
  const tr = ctx.session.track;
  const a = tr.frameAt(Math.max(0, s - h), ctx.tmpFrame).slope;
  const b = tr.frameAt(Math.min(tr.length, s + h), ctx.tmpFrame).slope;
  return (b - a) / (2 * h);
}

const tmpV = new Vector3();

/** World position of a rider (new object — safe to hand to event listeners). */
export function worldPos(ctx: SimCtx, r: RiderState): Vec3Like {
  ctx.session.track.toWorld(Math.min(r.s, ctx.session.track.length), r.x, r.y, tmpV);
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
