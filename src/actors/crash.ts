// Crash / KO tumble: the rider leaves the bike as a flailing rigid body, the bike cartwheels on its own,
// the helmet pops off. Ground = plane under the live sim pose (the sim slides the crashed rider along
// the road). Integrated with sim time, so KO slow-mo (0.1×) plays it as a smooth money shot. Body, bike
// and helmet touch the ground through mesh support points (rig/support-points.ts): they roll and rest on
// their real extremities. The riding pose unfolds into the flail over 0.15 s (no first-frame snap).
import { Euler, Group, Matrix4, Quaternion, SkinnedMesh, Vector3, type Object3D } from 'three';
import { clamp01, damp, smoothstep } from '../core/math';
import type { RiderState } from '../core/types';
import type { BikeModel } from './bikes';
import type { CueOut } from './rig/cue-types';
import type { PoseState } from './rig/pose-state';
import { B } from './rig/skeleton';
import { boneSupports, modelSupports } from './rig/support-points';
import { TumbleBody, type Contact, type Ground } from './rig/tumble-body';

export interface CrashParts {
  root: Group;
  body: Group;
  mesh: SkinnedMesh;
  bike: BikeModel;
  bikeHome: Vector3;
  ps: PoseState;
  /** Species head scale (meta.headScale), kept while tumbling. */
  headScale: number;
}

const meshW = new Matrix4(), meshInv = new Matrix4(), rootInv = new Matrix4(), bikeInv = new Matrix4(), nodeM = new Matrix4();
const meshQ = new Quaternion(), rootQ = new Quaternion(), q3 = new Quaternion(), sc = new Vector3();
const v = new Vector3(), v2 = new Vector3(), q = new Quaternion(), q2 = new Quaternion(), e = new Euler();
const BIKE_COM = new Vector3(0, 0.45, 0);
/** Contact radius of a support point (half the outline width: the ink line may touch, not sink). */
const SUP_R = 0.012;

const pool = (pts: readonly Vector3[]): Contact[] => pts.map((p) => ({ p: p.clone(), r: SUP_R }));

export class CrashController {
  readonly bodyRB = new TumbleBody(0.26, 0.3, 0.55, 1);
  readonly bikeRB = new TumbleBody(0.42, 0.25, 0.5, 0.7);
  readonly hatRB = new TumbleBody(0.1, 0.45, 0.35, 0);
  active = false;
  /** Per-bone support offsets of this species' mesh; body contacts are re-posed from them every frame. */
  private readonly supports: Vector3[][];
  private readonly bodyMap: { b: number; o: Vector3 }[];
  private readonly startLq: Quaternion[] = [];
  private readonly startLs: number[] = [];
  /** Bike support points per node (bones: frame, wheels, bars, cranks…), so moving parts keep their contacts. */
  private readonly bikeMap: { node: Object3D; o: Vector3 }[];
  private flail = 0;
  private settle = 0;
  private crash: RiderState['crash'] = null;
  private t = 0;
  private phase = [0, 0, 0, 0, 0, 0];
  private readonly ground: Ground = { P: new Vector3(), N: new Vector3(0, 1, 0) };
  private wheelSpin = 0;
  private steerFlop = 0;
  private impact = 0;

  constructor(private readonly c: CrashParts, private readonly rand: () => number) {
    this.supports = boneSupports(c.mesh.geometry, c.ps.rig.rest);
    this.bodyMap = this.supports.flatMap((pts, b) => (b === B.hat ? [] : pts.map((o) => ({ b, o }))));
    this.bodyRB.contacts = pool(this.bodyMap.map((m) => m.o));
    this.bodyRB.inertia = 0.06;
    this.hatRB.contacts = pool(this.supports[B.hat] ?? []);
    if (!this.hatRB.contacts.length) this.hatRB.contacts = [{ p: new Vector3(), r: 0.1 }];
    this.bikeRB.inertia = 0.2;
    this.bikeRB.settleAxis = new Vector3(1, 0, 0);
    this.bikeMap = modelSupports(c.bike.root).flatMap(({ node, pts }) => pts.map((o) => ({ node, o })));
    this.bikeRB.contacts = pool(this.bikeMap.map((m) => m.o));
    for (const q of c.ps.lq) {
      this.startLq.push(q.clone());
      this.startLs.push(1);
    }
  }

  /** Bike contacts in the bike body frame (bike root space minus the centre of mass), from the posed nodes. */
  private updateBikeContacts(): void {
    const root = this.c.bike.root;
    root.updateMatrixWorld(true);
    bikeInv.copy(root.matrixWorld).invert();
    let last: Object3D | null = null;
    this.bikeMap.forEach((m, i) => {
      if (m.node !== last) {
        nodeM.multiplyMatrices(bikeInv, m.node.matrixWorld);
        last = m.node;
      }
      (this.bikeRB.contacts[i] as Contact).p.copy(m.o).applyMatrix4(nodeM).sub(BIKE_COM);
    });
  }

  /** Mesh world matrix (root × body × mesh) and its inverse. */
  private meshMatrices(): void {
    const { root, body, mesh } = this.c;
    root.updateMatrix();
    if (root.parent) root.matrixWorld.multiplyMatrices(root.parent.matrixWorld, root.matrix); else root.matrixWorld.copy(root.matrix);
    body.updateMatrix();
    body.matrixWorld.multiplyMatrices(root.matrixWorld, body.matrix);
    mesh.updateMatrix();
    meshW.multiplyMatrices(body.matrixWorld, mesh.matrix);
    meshInv.copy(meshW).invert();
    rootInv.copy(root.matrixWorld).invert();
  }

  /** World transform of bone i from the current pose state. */
  private boneWorld(i: number, p: Vector3, out: Quaternion): void {
    p.copy(this.c.ps.mp[i] as Vector3).applyMatrix4(meshW);
    meshW.decompose(v2, meshQ, v);
    out.copy(meshQ).multiply(this.c.ps.mq[i] as Quaternion);
  }

  start(state: RiderState): void {
    const cr = state.crash;
    if (!cr) return;
    this.meshMatrices();
    this.crash = cr;
    this.active = true;
    this.t = 0;
    this.impact = 0;
    this.flail = 0;
    this.settle = 0;
    this.steerFlop = 0;
    const ps = this.c.ps;
    ps.lq.forEach((lq, i) => {
      (this.startLq[i] as Quaternion).copy(lq);
      this.startLs[i] = ps.ls[i] ?? 1;
    });
    this.phase = this.phase.map(() => this.rand() * Math.PI * 2);
    const vel = new Vector3(cr.vel.x, cr.vel.y, cr.vel.z), spin = new Vector3(cr.spin.x, cr.spin.y, cr.spin.z);
    const p = new Vector3(), bq = new Quaternion();
    this.boneWorld(B.spine, p, bq);
    this.bodyRB.set(p, vel, bq, spin);
    this.updateBodyContacts();
    this.boneWorld(B.hat, p, bq);
    const side = new Vector3(1, 0, 0).applyQuaternion(this.c.root.quaternion).multiplyScalar((this.rand() - 0.5) * 3);
    this.hatRB.set(p, v.copy(vel).multiplyScalar(0.8).add(side).add(v2.set(0, 3.5 + this.rand() * 2, 0)), bq,
      new Vector3(this.rand() * 14 - 7, this.rand() * 10 - 5, this.rand() * 14 - 7));
    const bike = this.c.bike.root;
    bike.updateMatrixWorld(true);
    const com = BIKE_COM.clone().applyMatrix4(bike.matrixWorld);
    bike.getWorldQuaternion(bq);
    const right = new Vector3(1, 0, 0).applyQuaternion(bq), fwd = new Vector3(0, 0, -1).applyQuaternion(bq);
    const flat = new Vector3(vel.x, 0, vel.z);
    this.bikeRB.set(com, flat.multiplyScalar(0.55).add(side.clone().multiplyScalar(-0.6)).add(v.set(0, 2.4 + this.rand() * 1.5, 0)), bq,
      right.multiplyScalar(-(5 + this.rand() * 4)).addScaledVector(fwd, (this.rand() - 0.5) * 6));
    this.wheelSpin = Math.max(4, vel.length());
    this.updateBikeContacts();
  }

  stop(): void {
    this.active = false;
    this.crash = null;
    const bike = this.c.bike.root;
    bike.position.copy(this.c.bikeHome);
    bike.quaternion.identity();
  }

  /** Same crash still running? (a new RiderState.crash object means a fresh crash) */
  isCurrent(state: RiderState): boolean {
    return this.active && state.crash === this.crash;
  }

  /** Advance the tumble and write the pose. `pos/quat` = live sim pose, `height` = the sim body's height above the
   *  road (state.y): the ground plane is the road under it — the pose's up without roll (a lean/bank tilt sinks or
   *  floats bodies that tumbled sideways of the sim point), dropped by the height while the sim body flies. */
  update(pos: Vector3, quat: Quaternion, height: number, cue: CueOut, dt: number): { resting: boolean } {
    this.t += dt;
    const g = this.ground;
    e.setFromQuaternion(quat, 'YXZ');
    g.N.set(0, 1, 0).applyQuaternion(q3.setFromEuler(e.set(e.x, e.y, 0, 'YXZ')));
    if (g.N.y < 0.6) g.N.set(0, 1, 0);
    g.P.copy(pos).addScaledVector(g.N, -Math.max(0, height));
    this.impact = Math.max(this.impact * Math.exp(-6 * dt), this.bodyRB.step(dt, g) / 8);
    this.hatRB.step(dt, g);
    this.bikeRB.step(dt, g);
    this.meshMatrices();
    meshW.decompose(v2, meshQ, sc);
    this.c.root.matrixWorld.decompose(v2, rootQ, sc);
    const resting = this.bodyRB.resting;
    this.poseBody(resting, dt);
    this.updateBodyContacts();
    if (this.bodyRB.depenetrate(g) > 0) {
      this.poseBody(resting, 0);
      this.updateBodyContacts();
    }
    this.placeBike(dt);
    const air = this.bodyRB.air > 0.05;
    cue.wide += air ? 1 : 0;
    cue.squint += clamp01(this.impact);
    cue.brow -= 0.8;
    cue.blink += resting ? 0.45 : 0;
    return { resting };
  }

  /** Re-pose the body's contact points from the skeleton (limbs flail, so they move every frame). */
  private updateBodyContacts(): void {
    const ps = this.c.ps, rb = this.bodyRB;
    q2.copy(rb.q).invert();
    this.bodyMap.forEach((m, i) => {
      const c = rb.contacts[i] as Contact;
      c.p.copy(m.o).multiplyScalar(ps.msc[m.b] ?? 1).applyQuaternion(ps.mq[m.b] as Quaternion).add(ps.mp[m.b] as Vector3)
        .applyMatrix4(meshW).sub(rb.p).applyQuaternion(q2);
    });
  }

  private poseBody(resting: boolean, dt: number): void {
    const ps = this.c.ps, rb = this.bodyRB, t = this.t, ph = this.phase;
    ps.reset();
    const qs = q.copy(meshQ).invert().multiply(rb.q);
    const sp = v.copy(rb.p).applyMatrix4(meshInv);
    const off = v2.subVectors(ps.rest(B.spine), ps.rest(B.pelvis)).applyQuaternion(qs);
    (ps.lp[B.pelvis] as Vector3).copy(sp).sub(off);
    (ps.lq[B.pelvis] as Quaternion).copy(qs);
    const spin = rb.w.length();
    this.flail = damp(this.flail, rb.air > 0.05 ? 1 : clamp01(spin / 5 + rb.v.length() / 6), 8, dt);
    this.settle = damp(this.settle, resting ? 1 : clamp01(1 - this.flail), 8, dt);
    const f = this.flail, s = this.settle;
    const set = (bone: number, x: number, y: number, z: number): void => {
      (ps.lq[bone] as Quaternion).setFromEuler(e.set(x, y, z));
    };
    for (const side of [-1, 1] as const) {
      const L = side === -1, k = L ? 0 : 1;
      set(L ? B.armL : B.armR, Math.sin(t * 13 + (ph[0] ?? 0) + k) * 1.0 * f - 0.4 * s, side * (Math.cos(t * 9 + (ph[1] ?? 0) + k) * 0.7 * f + 0.9 * s), side * (Math.sin(t * 11 + (ph[2] ?? 0)) * 0.8 * f - 0.6 * s));
      set(L ? B.foreL : B.foreR, Math.sin(t * 15 + (ph[3] ?? 0) + k * 2) * 0.8 * f, 0, side * 0.3 * s);
      set(L ? B.thighL : B.thighR, Math.sin(t * 12 + (ph[4] ?? 0) + k * 3) * 0.9 * f + 0.3 * s, 0, side * (Math.sin(t * 8 + k) * 0.5 * f + 0.45 * s));
      set(L ? B.shinL : B.shinR, (Math.sin(t * 14 + (ph[5] ?? 0) + k) * 0.5 + 0.5) * 1.2 * f + 0.4 * s, 0, 0);
    }
    set(B.neck1, Math.sin(t * 10) * 0.35 * f + 0.25 * s, Math.cos(t * 8) * 0.4 * f, 0);
    set(B.neck2, Math.sin(t * 10 + 1) * 0.3 * f, Math.cos(t * 8 + 1) * 0.3 * f, 0.2 * s);
    set(B.head, Math.sin(t * 9) * 0.3 * f, Math.cos(t * 7) * 0.3 * f, Math.sin(t * 6) * 0.2 * f + 0.35 * s);
    set(B.tail1, Math.sin(t * 20) * 0.4 * f, Math.cos(t * 17) * 0.4 * f, 0);
    set(B.jaw, -(0.55 * f + 0.2 * s), 0, 0);
    ps.ls[B.head] = this.c.headScale;
    const pw = 1 + Math.sin(t * 25) * 0.25 * f;
    (ps.lsv[B.pouch] as Vector3).set(pw, 2 - pw, 1);
    const unfold = smoothstep(0, 0.15, t);
    if (unfold < 1) {
      for (let i = 1; i < ps.lq.length; i++) {
        (ps.lq[i] as Quaternion).slerp(this.startLq[i] as Quaternion, 1 - unfold);
        ps.ls[i] = (this.startLs[i] ?? 1) + ((ps.ls[i] ?? 1) - (this.startLs[i] ?? 1)) * unfold;
      }
    }
    for (let i = 0; i < ps.lq.length; i++) ps.fk(i);
    // Helmet: flies on its own; re-expressed under the head bone each frame.
    const hp = v.copy(this.hatRB.p).applyMatrix4(meshInv);
    const hq = q2.copy(meshQ).invert().multiply(this.hatRB.q);
    const headQ = ps.mq[B.head] as Quaternion;
    q3.copy(headQ).invert();
    (ps.lq[B.hat] as Quaternion).copy(q3).multiply(hq);
    (ps.lp[B.hat] as Vector3).copy(hp).sub(ps.mp[B.head] as Vector3).applyQuaternion(q3).multiplyScalar(1 / (ps.msc[B.head] ?? 1));
    ps.fk(B.hat);
  }

  private placeBike(dt: number): void {
    const bike = this.c.bike;
    const rb = this.bikeRB;
    bike.root.position.copy(BIKE_COM).applyQuaternion(rb.q).negate().add(rb.p).applyMatrix4(rootInv);
    bike.root.quaternion.copy(rootQ).invert().multiply(rb.q);
    this.wheelSpin *= Math.exp(-0.7 * dt);
    // Bars flop while airborne and settle once the bike is down.
    const flop = Math.sin(this.t * 7) * 0.4 * clamp01(this.wheelSpin / 6) * clamp01(rb.air / 0.15);
    this.steerFlop = damp(this.steerFlop, flop, 10, dt);
    bike.update(dt, this.wheelSpin, this.steerFlop);
    this.updateBikeContacts();
  }

  /** World position of the tumbling body (for anchors). */
  bodyPos(out: Vector3): Vector3 {
    return out.copy(this.bodyRB.p);
  }
}
