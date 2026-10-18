// Chase camera in track space: s is exact (s − dist), lateral/height/look-at use critically damped
// springs, so the camera never lags behind at 20 m/s yet absorbs lateral moves and jumps. Distance,
// height, look-ahead and FOV grow with speed (FOV keeps widening above the bike's top speed); roll follows
// the lean; heading blends 70/30 tangent/bike. Follow springs run on sim time, so hit-stop freezes them
// and slow-mo slows them with the world. Crashed: a close, slowly orbiting shot of the tumbling body.
// The eye rises over solid obstacles in its way (avoid.ts) instead of entering a vehicle.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { clamp, clamp01, damp, DEG, lerp, springStep } from '../core/math';
import { Poser } from '../sim/pose';
import { bikeTune } from '../sim/tuning';
import type { Session } from '../core/contracts';
import type { Anchor } from './blend';
import { ObstacleAvoid, type TrackPoint } from './avoid';

export const CHASE = {
  dist: [4.6, 5.6], height: [1.9, 2.2], ahead: [5, 9], fov: [62, 74],
  lookHeight: 1.0, minHeight: 1.2, headingBlend: 0.3, rollK: 0.18,
  omegaX: 10, omegaY: 9, omegaLookX: 11, omegaLookY: 9.5,
  airFollow: 0.8, airLook: 0.65, surgeK: 0.04, surgeMax: 0.5,
  fovOver: 11, overMax: 0.4,          // +deg per 1.0 of speed above the bike's top (capped at +40 % speed)
  crashDist: 4.3, crashHeight: 1.6, crashFov: 58, crashOrbit: 12 * DEG, crashBodyLambda: 20, crashLambda: 4,
  dipOmega: 13, dipLook: 0.5,         // landing dip spring (1/s) and how much of it the look point shares
  edgeMargin: 1.0,                    // m the eye keeps inside bounds() (cliff faces sit a little inside them)
  riderMid: 0.8,                      // m: the rider point the sight line must reach (obstacle avoidance)
};

export interface CamPose { pos: Vector3; quat: Quaternion; fov: number }

const AX_Z = new Vector3(0, 0, 1);
const E = Math.E;

export class ChaseCam {
  readonly pose: CamPose = { pos: new Vector3(), quat: new Quaternion(), fov: 62 };
  lookBack = false;
  private poser: Poser | null = null;
  private top = 20;
  private x = 0; private xv = 0; private y = 2; private yv = 0;
  private lx = 0; private lxv = 0; private ly = 1; private lyv = 0;
  private dipY = 0; private dipV = 0;
  private dist = 4.6; private height = 1.9; private ahead = 5; private fovBase = 62; private fovRef = 62; private fovOver = 0;
  private roll = 0; private surge = 0; private lastSpeed = 0; private lastS = 0;
  private crashBlend = 0; private orbit = 0; private orbitSide = 1;
  private bodyS = 0; private bodyX = 0; private followS = 0; private followX = 0; private offS = 0; private offX = 0;
  private eye = new Vector3(); private look = new Vector3(); private anchorV = new Vector3(); private fwd = new Vector3();
  private up = new Vector3(); private rt = new Vector3(); private tg = new Vector3();
  private m = new Matrix4(); private q = new Quaternion();
  private avoid = new ObstacleAvoid();
  private eyeT: TrackPoint = { s: 0, x: 0, y: 0 }; private riderT: TrackPoint = { s: 0, x: 0, y: 0 };

  /** Snap every spring to the current target (new session, respawn, teleport). */
  reset(session: Session): void {
    const r = session.player;
    this.poser = new Poser(session.track);
    this.top = bikeTune(r.bike, r.character).top;
    const vn = clamp01(r.speed / this.top);
    this.dist = lerp(CHASE.dist[0] ?? 4.6, CHASE.dist[1] ?? 5.6, vn);
    this.height = lerp(CHASE.height[0] ?? 1.9, CHASE.height[1] ?? 2.2, vn);
    this.ahead = lerp(CHASE.ahead[0] ?? 5, CHASE.ahead[1] ?? 9, vn);
    this.fovBase = this.fovRef = lerp(CHASE.fov[0] ?? 62, CHASE.fov[1] ?? 74, vn);
    this.fovOver = 0;
    this.x = this.lx = r.x;
    this.y = Math.max(CHASE.minHeight, this.height + r.y * CHASE.airFollow);
    this.ly = CHASE.lookHeight + r.y * CHASE.airLook;
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
  }

  /** Landing dip: the camera drops by about `depth` m (peak after ~1/ω s) and springs back. */
  dip(depth: number): void {
    this.dipV -= Math.max(0, depth) * CHASE.dipOmega * E;
  }

  get state(): Record<string, number> {
    return {
      dist: this.dist, height: this.y, ahead: this.ahead, fovBase: this.fovBase, roll: this.roll, surge: this.surge,
      offS: this.offS, offX: this.offX, dip: this.dipY, lift: this.avoid.lift,
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
    const baseDist = lerp(CHASE.dist[0] ?? 4.6, CHASE.dist[1] ?? 5.6, vn);
    const baseHeight = lerp(CHASE.height[0] ?? 1.9, CHASE.height[1] ?? 2.2, vn);
    this.crashBlend = damp(this.crashBlend, crashed ? 1 : 0, crashed ? 5 : 8, dt);
    const lam = crashed ? CHASE.crashLambda : 3;
    this.dist = damp(this.dist, crashed ? CHASE.crashDist : baseDist, lam, dt);
    this.height = damp(this.height, crashed ? CHASE.crashHeight : baseHeight, lam, dt);
    this.ahead = damp(this.ahead, lerp(CHASE.ahead[0] ?? 5, CHASE.ahead[1] ?? 9, vn), 3, dt);
    this.fovRef = damp(this.fovRef, crashed ? CHASE.crashFov : lerp(CHASE.fov[0] ?? 62, CHASE.fov[1] ?? 74, vn), 4, dt);
    const over = crashed ? 0 : CHASE.fovOver * clamp(ratio - 1, 0, CHASE.overMax);
    this.fovOver = damp(this.fovOver, over, 4, dt);
    this.fovBase = this.fovRef + this.fovOver;
    if (crashed) this.orbit += CHASE.crashOrbit * this.orbitSide * dt;
    else {
      this.orbit = 0;
      this.orbitSide = r.x >= 0 ? 1 : -1; // swing toward the road centre, away from the nearer edge
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
    [this.ly, this.lyv] = springStep(this.ly, this.lyv, CHASE.lookHeight + r.y * CHASE.airLook, CHASE.omegaLookY, dt);
    [this.dipY, this.dipV] = springStep(this.dipY, this.dipV, 0, CHASE.dipOmega, dt);
    if (this.lookBack && !crashed) return this.lookBackPose(session, kick);
    const camS = this.followS - this.dist * Math.cos(hy) - this.surge;
    const b = session.track.bounds(clamp(camS, 0, session.track.length));
    const camX = clamp(this.x, -b.left + CHASE.edgeMargin, b.right - CHASE.edgeMargin);
    this.offS = camS - r.s;
    this.offX = camX - r.x;
    this.y = Math.max(this.y, CHASE.minHeight);
    Object.assign(this.eyeT, { s: camS, x: camX, y: Math.max(CHASE.minHeight, this.y + this.dipY) });
    Object.assign(this.riderT, { s: this.followS, x: this.followX, y: CHASE.riderMid + r.y });
    this.poser?.place(camS, camX, this.avoid.update(session, this.eyeT, this.riderT, dt), this.eye);
    this.poser?.place(this.followS + this.ahead, this.lx, this.ly + this.dipY * CHASE.dipLook, this.look);
    if (view) this.look.lerp(view.anchor('body', this.anchorV), this.crashBlend);
    return this.finish(this.fovBase + kick, this.fovRef, Math.hypot(this.dist, this.y - CHASE.lookHeight));
  }

  private lookBackPose(session: Session, kick: number): CamPose {
    const r = session.player;
    this.poser?.place(r.s + 4.4, r.x, r.y + 1.75, this.eye);
    this.poser?.place(r.s - 14, r.x, 0.9, this.look);
    return this.finish((CHASE.fov[0] ?? 62) + kick, Infinity, 0);
  }

  /**
   * Counter-dolly: FOV beyond `ref` (kicks, over-top speed) moves the eye toward the rider (`dist` m away)
   * so it keeps its on-screen size while the world stretches. Negative kicks (impact punch-ins) stay zooms.
   */
  private finish(fov: number, ref: number, dist: number): CamPose {
    if (fov > ref + 1e-3 && dist > 0) {
      const d = dist * (1 - Math.tan((ref * DEG) / 2) / Math.tan((fov * DEG) / 2));
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
