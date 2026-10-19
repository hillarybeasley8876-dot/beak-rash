// Chase camera in track space: s is exact (dist world metres back along the line at the camera's lateral
// offset, with the same curve metric as the physics, so the inside or outside of a tight bend never zooms the
// rider in or out), lateral/height/look-at use critically damped springs, so the camera never lags behind at
// 20 m/s yet absorbs lateral moves and jumps. Distance, height, look-ahead and FOV grow with speed (FOV keeps
// widening above the bike's top speed, counter-dollied); roll follows the lean; heading blends 70/30
// tangent/bike. Follow springs run on sim time, so hit-stop freezes them and slow-mo slows them with the
// world. Crashed: a close, slowly orbiting shot of the tumbling body (out over the sea for a water crash,
// horizon kept in frame). The eye slides / lifts past riders hiding the player (occlude.ts) and rises over
// solid obstacles in its way (avoid.ts) instead of entering a vehicle.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { clamp, clamp01, damp, DEG, lerp, springStep } from '../core/math';
import { Poser } from '../sim/pose';
import { bikeTune } from '../sim/tuning';
import { emptyFrame, trackEnd } from '../sim/state';
import type { Session } from '../core/contracts';
import type { TrackFrame } from '../core/types';
import type { Anchor } from './blend';
import { ObstacleAvoid, type TrackPoint } from './avoid';
import { RiderOcclude } from './occlude';

// Ranges run from standstill to the bike's top speed. The eye sits higher and a little closer than the SPEC §6
// numbers (4.3→5.1 m back, 1.9→2.2 m up, look at 1 m; here 4.2→4.7, 2.3→2.8, look at 1.2→1.5 m), so the hero's
// head sits at ~59 % of the screen height instead of dead centre: a rival riding 7 m ahead in the slipstream
// window shows whole above the hero (was its top 9 px) and the hero stays ≥ 24 % of the height.
export const CHASE = {
  dist: [4.2, 4.7], height: [2.3, 2.8], ahead: [5, 9], fov: [60, 70], lookHeight: [1.2, 1.5],
  minHeight: 1.2, headingBlend: 0.3, rollK: 0.18,
  omegaX: 10, omegaY: 9, omegaLookX: 11, omegaLookY: 9.5,
  airFollow: 0.8, airLook: 0.65, surgeK: 0.04, surgeMax: 0.5,
  surgeDollyRamp: 2,                  // deg of FOV beyond the speed FOV over which the counter-dolly takes the surge out
  fovOver: 11, overMax: 0.4,          // +deg per 1.0 of speed above the bike's top (capped at +40 % speed)
  crashDist: 4.3, crashHeight: 1.6, crashFov: 58, crashOrbit: 12 * DEG, crashBodyLambda: 20, crashLambda: 4,
  crashZoomMin: 40, crashRise: 0.15, crashRiseMax: 1.5, // held back by the world edge: zoom (deg floor) + rise per m
  crashOverWater: 10, crashHorizon: 6, // crash cam: m it may hover past a water edge; deg the horizon keeps below the top
  dipOmega: 13, dipLook: 0.5,         // landing dip spring (1/s) and how much of it the look point shares
  edgeMargin: 1.0,                    // m the eye keeps inside bounds() (cliff faces sit a little inside them)
  riderMid: 0.8,                      // m: the rider point the sight line must reach (obstacle avoidance)
};

export interface CamPose { pos: Vector3; quat: Quaternion; fov: number }

/** A CHASE range at normalised speed vn (0 = standstill, 1 = the bike's top speed). */
const span = (range: readonly number[], vn: number): number => lerp(range[0] ?? 0, range[range.length - 1] ?? 0, vn);

const AX_Z = new Vector3(0, 0, 1);
const E = Math.E;

export class ChaseCam {
  readonly pose: CamPose = { pos: new Vector3(), quat: new Quaternion(), fov: 60 };
  lookBack = false;
  private poser: Poser | null = null;
  private top = 20;
  private x = 0; private xv = 0; private y = 2; private yv = 0;
  private lx = 0; private lxv = 0; private ly = 1; private lyv = 0;
  private dipY = 0; private dipV = 0;
  private dist = 4.3; private height = 1.9; private ahead = 5; private fovBase = 60; private fovRef = 60; private fovOver = 0;
  private roll = 0; private surge = 0; private lastSpeed = 0; private lastS = 0;
  private crashBlend = 0; private orbit = 0; private orbitSide = 1;
  private bodyS = 0; private bodyX = 0; private followS = 0; private followX = 0; private offS = 0; private offX = 0;
  private eye = new Vector3(); private look = new Vector3(); private anchorV = new Vector3(); private fwd = new Vector3();
  private up = new Vector3(); private rt = new Vector3(); private tg = new Vector3();
  private m = new Matrix4(); private q = new Quaternion(); private fr: TrackFrame = emptyFrame();
  private avoid = new ObstacleAvoid();
  private occ = new RiderOcclude();
  private eyeT: TrackPoint = { s: 0, x: 0, y: 0 }; private riderT: TrackPoint = { s: 0, x: 0, y: 0 };

  /** Snap every spring to the current target (new session, respawn, teleport). */
  reset(session: Session): void {
    const r = session.player;
    this.poser = new Poser(session.track);
    this.top = bikeTune(r.bike, r.character).top;
    const vn = clamp01(r.speed / this.top);
    this.dist = span(CHASE.dist, vn);
    this.height = span(CHASE.height, vn);
    this.ahead = span(CHASE.ahead, vn);
    this.fovBase = this.fovRef = span(CHASE.fov, vn);
    this.fovOver = 0;
    this.x = this.lx = r.x;
    this.y = Math.max(CHASE.minHeight, this.height + r.y * CHASE.airFollow);
    this.ly = span(CHASE.lookHeight, vn) + r.y * CHASE.airLook;
    this.xv = this.yv = this.lxv = this.lyv = this.dipY = this.dipV = 0;
    this.roll = r.lean * CHASE.rollK;
    this.surge = 0;
    this.crashBlend = r.mode === 'crashed' ? 1 : 0;
    this.orbit = 0;
    this.bodyS = this.followS = r.s;
    this.bodyX = this.followX = r.x;
    this.lastSpeed = r.speed;
    this.lastS = r.s;
    this.avoid.reset();
    this.occ.reset();
  }

  /** Landing dip: the camera drops by about `depth` m (peak after ~1/ω s) and springs back. */
  dip(depth: number): void {
    this.dipV -= Math.max(0, depth) * CHASE.dipOmega * E;
  }

  get state(): Record<string, number> {
    return {
      dist: this.dist, height: this.y, ahead: this.ahead, fovBase: this.fovBase, roll: this.roll, surge: this.surge,
      offS: this.offS, offX: this.offX, dip: this.dipY, lift: this.avoid.lift,
      occSide: this.occ.side, occLift: this.occ.lift,
    };
  }

  /** The followed point and road frame there (blend-out anchor). */
  anchor(out: Anchor): Anchor {
    const fr = this.poser?.place(this.followS, this.followX, 0, out.pos);
    if (!fr) return out;
    this.tg.set(fr.tangent.x, fr.tangent.y, fr.tangent.z).normalize();
    this.rt.set(fr.right.x, fr.right.y, fr.right.z);
    this.rt.addScaledVector(this.tg, -this.rt.dot(this.tg)).normalize();
    this.up.crossVectors(this.rt, this.tg).normalize();
    this.m.makeBasis(this.rt, this.up, this.tg.negate());
    out.quat.setFromRotationMatrix(this.m);
    return out;
  }

  /** `kick` = FOV kicks (deg) from the rig; widening beyond the speed FOV counter-dollies (see finish). */
  update(session: Session, dtReal: number, dtSim: number, kick = 0): CamPose {
    const r = session.player;
    if (!this.poser || Math.abs(r.s - this.lastS) > 40) this.reset(session);
    this.lastS = r.s;
    const dt = Math.max(0, dtSim);
    const ratio = r.speed / this.top;
    const vn = clamp01(ratio);
    if (dt > 1e-5) {
      const accel = (r.speed - this.lastSpeed) / dt;
      this.surge = damp(this.surge, clamp(accel * CHASE.surgeK, -0.25, CHASE.surgeMax), 4, dt);
    }
    this.lastSpeed = r.speed;
    const crashed = r.mode === 'crashed';
    const baseDist = span(CHASE.dist, vn);
    const baseHeight = span(CHASE.height, vn);
    const lookH = span(CHASE.lookHeight, vn);
    this.crashBlend = damp(this.crashBlend, crashed ? 1 : 0, crashed ? 5 : 8, dt);
    const lam = crashed ? CHASE.crashLambda : 3;
    this.dist = damp(this.dist, crashed ? CHASE.crashDist : baseDist, lam, dt);
    this.height = damp(this.height, crashed ? CHASE.crashHeight : baseHeight, lam, dt);
    this.ahead = damp(this.ahead, span(CHASE.ahead, vn), 3, dt);
    this.fovRef = damp(this.fovRef, crashed ? CHASE.crashFov : span(CHASE.fov, vn), 4, dt);
    const over = crashed ? 0 : CHASE.fovOver * clamp(ratio - 1, 0, CHASE.overMax);
    this.fovOver = damp(this.fovOver, over, 4, dt);
    this.fovBase = this.fovRef + this.fovOver;
    if (crashed) this.orbit += CHASE.crashOrbit * this.orbitSide * dt;
    else {
      this.orbit = 0;
      // Swing toward the road centre, away from the nearer edge, unless that edge is the sea: then swing out over
      // it, so a body that falls in is seen against the beach and the road instead of open water.
      const side = r.x >= 0 ? 1 : -1;
      const rb = session.track.bounds(clamp(r.s, 0, trackEnd(session.track)));
      this.orbitSide = (side > 0 ? rb.rightKind : rb.leftKind) === 'water' ? -side : side;
    }
    this.roll = damp(this.roll, crashed ? 0 : r.lean * CHASE.rollK, 10, dt);
    const hy = CHASE.headingBlend * r.yaw * (1 - this.crashBlend) + this.orbit * this.crashBlend;
    // Crashed: follow the tumbling body (actors view) instead of the sliding sim body.
    const view = this.crashBlend > 0.001 ? session.views.get(r.id) : undefined;
    if (view && crashed) {
      const p = session.track.project(view.anchor('body', this.anchorV), r.s);
      this.bodyS = damp(this.bodyS, p.s, CHASE.crashBodyLambda, dt);
      this.bodyX = damp(this.bodyX, p.x, CHASE.crashBodyLambda, dt);
    } else if (!crashed) {
      this.bodyS = r.s;
      this.bodyX = r.x;
    }
    this.followS = lerp(r.s, this.bodyS, this.crashBlend);
    this.followX = lerp(r.x, this.bodyX, this.crashBlend);
    [this.x, this.xv] = springStep(this.x, this.xv, this.followX - this.dist * Math.sin(hy), CHASE.omegaX, dt);
    [this.y, this.yv] = springStep(this.y, this.yv, this.height + r.y * CHASE.airFollow, CHASE.omegaY, dt);
    [this.lx, this.lxv] = springStep(this.lx, this.lxv, this.followX + this.ahead * Math.sin(hy) * 0.5, CHASE.omegaLookX, dt);
    [this.ly, this.lyv] = springStep(this.ly, this.lyv, lookH + r.y * CHASE.airLook, CHASE.omegaLookY, dt);
    [this.dipY, this.dipV] = springStep(this.dipY, this.dipV, 0, CHASE.dipOmega, dt);
    if (this.lookBack && !crashed) return this.lookBackPose(session, kick);
    const camS = this.alongS(session, this.followS, -(this.dist * Math.cos(hy) + this.surge), (this.x + this.followX) / 2);
    const b = session.track.bounds(clamp(camS, 0, trackEnd(session.track)));
    // The crash cam may hover over the sea past a water edge (nothing solid there), closer to a body that fell in.
    const sea = lerp(CHASE.edgeMargin, -CHASE.crashOverWater, this.crashBlend);
    const xMin = -b.left + (b.leftKind === 'water' ? sea : CHASE.edgeMargin);
    const xMax = b.right - (b.rightKind === 'water' ? sea : CHASE.edgeMargin);
    this.y = Math.max(this.y, CHASE.minHeight);
    const eyeY = Math.max(CHASE.minHeight, this.y + this.dipY);
    // Riders in the camera gap: slide / lift the eye so the hero stays in view (judged from the natural eye).
    Object.assign(this.eyeT, { s: camS, x: clamp(this.x, xMin, xMax), y: eyeY });
    Object.assign(this.riderT, { s: this.followS, x: this.followX, y: r.y });
    this.occ.update(session, this.eyeT, this.riderT, dt, this.eyeT.x - xMin, xMax - this.eyeT.x, !crashed);
    const camX = clamp(this.x + this.occ.side, xMin, xMax);
    this.offS = camS - r.s;
    this.offX = camX - r.x;
    const rise = crashed ? Math.min(CHASE.crashRiseMax, CHASE.crashRise * Math.abs(this.x - camX)) * this.crashBlend : 0;
    Object.assign(this.eyeT, { s: camS, x: camX, y: eyeY + rise + this.occ.lift });
    this.riderT.y = CHASE.riderMid + r.y;
    this.poser?.place(camS, camX, this.avoid.update(session, this.eyeT, this.riderT, dt), this.eye);
    const lookS = this.alongS(session, this.followS, this.ahead, (this.lx + this.followX) / 2);
    this.poser?.place(lookS, this.lx, this.ly + this.dipY * CHASE.dipLook, this.look);
    if (view) this.look.lerp(view.anchor('body', this.anchorV), this.crashBlend);
    const dist = Math.hypot(this.dist, this.y - lookH);
    const fov = this.crashZoom(this.fovBase) + kick;
    if (this.crashBlend > 0.001) this.keepHorizon(fov);
    return this.finish(fov, this.crashZoom(this.fovRef), dist, this.surge);
  }

  /**
   * The s that lies `d` world metres from s0 along the road (negative = back) on the line at lateral offset x:
   * Δs = d / (1 − κ·x), the physics' curve metric, with κ sampled mid-span (one fixed-point refinement).
   */
  private alongS(session: Session, s0: number, d: number, x: number): number {
    const tr = session.track;
    const end = trackEnd(tr);
    const metric = (s: number): number => clamp(1 - tr.frameAt(clamp(s, 0, end), this.fr).curvature * x, 0.7, 1.3);
    const s1 = s0 + d / metric(s0 + d / 2);
    return s0 + d / metric((s0 + s1) / 2);
  }

  /**
   * Crash cam farther than crashDist + 1 m from the body (the edge clamp held it back while the body flew into
   * the sea or a void): narrow the FOV so the body keeps the size it has at that distance (floor 30°).
   */
  private crashZoom(fov: number): number {
    if (this.crashBlend < 0.001) return fov;
    const ref = CHASE.crashDist + 1;
    const d = this.eye.distanceTo(this.look);
    if (d <= ref) return fov;
    const zoom = (2 * Math.atan((Math.tan((fov * DEG) / 2) * ref) / d)) / DEG;
    return lerp(fov, Math.max(CHASE.crashZoomMin, zoom), this.crashBlend);
  }

  /** Crash cam: never pitch so far down that the horizon leaves the frame (a body in the sea, seen from the road). */
  private keepHorizon(fov: number): void {
    this.fwd.subVectors(this.look, this.eye);
    const flat = Math.hypot(this.fwd.x, this.fwd.z);
    const limit = -Math.max(0, fov / 2 - CHASE.crashHorizon) * DEG;
    const pitch = Math.atan2(this.fwd.y, flat);
    if (pitch >= limit || flat < 1e-3) return;
    this.look.y = this.eye.y + Math.tan(lerp(pitch, limit, this.crashBlend)) * flat;
  }

  private lookBackPose(session: Session, kick: number): CamPose {
    const r = session.player;
    this.poser?.place(r.s + 4.4, r.x, r.y + 1.75, this.eye);
    this.poser?.place(r.s - 14, r.x, 0.9, this.look);
    return this.finish((CHASE.fov[0] ?? 60) + kick, Infinity, 0);
  }

  /**
   * Counter-dolly: FOV beyond `ref` (kicks, over-top speed) moves the eye toward the rider (`dist` m away)
   * so it keeps its on-screen size while the world stretches; while it does, the acceleration surge (the eye
   * lagging back) is taken out too, so a boost never shrinks the rider. Negative kicks (punch-ins) stay zooms.
   */
  private finish(fov: number, ref: number, dist: number, surge = 0): CamPose {
    if (fov > ref + 1e-3 && dist > 0) {
      const lag = Math.max(0, surge) * clamp01((fov - ref) / CHASE.surgeDollyRamp);
      const d = lag + dist * (1 - Math.tan((ref * DEG) / 2) / Math.tan((fov * DEG) / 2));
      this.fwd.subVectors(this.look, this.eye).normalize();
      this.eye.addScaledVector(this.fwd, d);
    }
    this.up.set(0, 1, 0);
    this.m.lookAt(this.eye, this.look, this.up);
    this.pose.pos.copy(this.eye);
    this.pose.quat.setFromRotationMatrix(this.m).multiply(this.q.setFromAxisAngle(AX_Z, -this.roll));
    this.pose.fov = fov;
    return this.pose;
  }
}
