// Riding pose: pelvis on the saddle (pedalling bob, hip rock, standing on the pedals), spine with
// counter-lean / tuck, stabilised head that looks at targets, wings/arms IK'd to the grips (or to cue
// targets) and legs IK'd to the pedals with ankling. Everything in character space (origin = saddle).
import { Euler, Quaternion, Vector3 } from 'three';
import { clamp, clamp01, damp, smoothstep } from '../../core/math';
import type { SpeciesDef } from '../species/types';
import type { ArmCue, CueOut } from './cue-types';
import { ARM, LEG, aimEnd, chainLengths, solveChain, type Chain } from './limb-ik';
import type { PoseState } from './pose-state';
import { B } from './skeleton';

export interface RideInput {
  gripL: Vector3; gripR: Vector3; pedalL: Vector3; pedalR: Vector3;
  speed: number;      // m/s
  lean: number;       // rad, + right
  accel: number;      // smoothed forward acceleration (m/s²)
  slope: number;      // rise per metre
  boost: number;      // 0..1
  draft: number;      // 0..1
  airborne: boolean;
  /** Look target in character space (null = straight ahead). */
  look: Vector3 | null;
  /** The bike's bell in character space (null = no bell marker): the right paw's target while ringing. */
  bell: Vector3 | null;
  /** Head carriage side −1..1 (+ = the head turns to the rider's left), smoothed by the view (meta.carry). */
  carry: number;
}

const e = new Euler(0, 0, 0, 'YXZ');
const q = new Quaternion(), q2 = new Quaternion();
const v = new Vector3(), w = new Vector3(), target = new Vector3(), pole = new Vector3(), bindPole = new Vector3();
const UP = new Vector3(0, 1, 0);
/** The wrist rides this far behind the grip marker (the mitten then covers the grip and its end). */
export const GRIP_BACK = 0.012;

function rot(out: Quaternion, x: number, y: number, z: number): Quaternion {
  return out.setFromEuler(e.set(x, y, z, 'YXZ'));
}

export class RidePose {
  stand = 0;
  tuck = 0;
  legScale = 1;
  armScale = 1;
  private t = 0;
  /** 1 / mesh squash scale: grip/pedal targets are solved in squashed mesh space so they land after the scale. */
  private readonly unsquash = new Vector3(1, 1, 1);
  private headYaw = 0;
  private headPitch = 0;
  /** Pouch spring (meta.pouchJiggle): bulge offset and velocity, kicked by the pedalling bounce and speed changes. */
  private jig = 0;
  private jigV = 0;
  /** Bind-space wing normals (left, right): spread wings fan their primaries about them. */
  private readonly wingN: [Vector3, Vector3];

  constructor(private readonly ps: PoseState, private readonly def: SpeciesDef) {
    const J = def.joints, up = def.meta.armUp;
    const d = new Vector3(J.wrist[0] - J.elbow[0], J.wrist[1] - J.elbow[1], J.wrist[2] - J.elbow[2]).normalize();
    const t = new Vector3(up[0], up[1], up[2]);
    t.addScaledVector(d, -t.dot(d)).normalize();
    const nL = new Vector3().crossVectors(d, t);
    const dR = d.clone().setX(-d.x), tR = t.clone().setX(-t.x);
    this.wingN = [nL, new Vector3().crossVectors(dR, tR)];
  }

  /** Size limbs to the bike: legs reach the far pedal point, wings reach the grips. */
  fit(inp: RideInput): void {
    const ps = this.ps;
    const lift = this.def.meta.ankleLift;
    const c = v.addVectors(inp.pedalL, inp.pedalR).multiplyScalar(0.5);
    const R = Math.hypot(inp.pedalL.y - c.y, inp.pedalL.z - c.z);
    c.add(w.set(lift[0], lift[1], lift[2]));
    const hip = ps.rest(B.thighL);
    const reach = Math.hypot(hip.y - c.y, hip.z - c.z) + R;
    const [l1, l2] = chainLengths(ps, LEG.L);
    this.legScale = this.def.meta.shortLegs ? 1 : clamp(reach / (0.985 * (l1 + l2)), 1, 1.45);
    const [a1, a2] = chainLengths(ps, ARM.L);
    const sh = ps.rest(B.armL);
    const grip = inp.gripL;
    const d = Math.hypot(sh.x - grip.x, sh.y - (grip.y + this.def.meta.gripDrop), sh.z - grip.z - GRIP_BACK);
    this.armScale = clamp(d / (0.95 * (a1 + a2)), 1, 1.85);
  }

  /** The mesh is scaled (sx, sy, sx) about the saddle after the pose (view.ts squash/stretch). */
  squashTo(sx: number, sy: number): void {
    this.unsquash.set(1 / sx, 1 / sy, 1 / sx);
  }

  update(inp: RideInput, cue: CueOut, dt: number): void {
    const ps = this.ps;
    this.t += dt;
    ps.reset();
    const slow = clamp01(1 - inp.speed / 13);
    const standTarget = inp.airborne ? 0.35 : clamp01(Math.max((inp.accel - 1.2) / 2.4 * slow * 1.4, inp.slope > 0.05 ? slow * 1.2 : 0));
    this.stand = damp(this.stand, standTarget, 4, dt);
    this.tuck = damp(this.tuck, clamp01(Math.max(inp.boost, inp.draft * 0.6, (inp.speed - 15) / 8)), 5, dt);
    const stand = this.stand * (1 - cue.lie), tuck = this.tuck * (1 - cue.lie);
    const crank = Math.atan2(inp.pedalR.y - inp.pedalL.y, inp.pedalL.z - inp.pedalR.z);
    const pedalling = clamp01(inp.speed / 3);
    // Pelvis: bob twice per crank turn, rock side to side (a lot when standing).
    const pel = ps.lp[B.pelvis] as Vector3;
    pel.y += stand * 0.11 + Math.sin(crank * 2) * 0.006 * pedalling * (1 + stand) + cue.lift - cue.lie * 0.04;
    pel.z += -stand * 0.07 - cue.lie * 0.06;
    const rock = Math.sin(crank) * (0.025 + 0.1 * stand) * pedalling;
    rot(ps.lq[B.pelvis] as Quaternion, -stand * 0.22 - cue.lie * 0.5, cue.spin, rock);
    ps.ls[B.thighL] = ps.ls[B.thighR] = this.legScale;
    this.keepReach(inp);
    ps.ls[B.footL] = ps.ls[B.footR] = 1 / this.legScale;
    ps.ls[B.armL] = ps.ls[B.armR] = this.armScale;
    ps.ls[B.handL] = ps.ls[B.handR] = 1 / this.armScale;
    ps.ls[B.head] = this.def.meta.headScale ?? 1;
    // Spine: tuck folds forward, counter-lean keeps the torso a bit more upright than the bike.
    const pitch = -(tuck * 0.32 + stand * 0.12 + cue.spinePitch + cue.lie * 0.6);
    const roll = -inp.lean * 0.28 - rock * 0.6 + cue.spineRoll;
    const yaw = -Math.sin(crank) * 0.035 * pedalling + cue.spineYaw;
    rot(ps.lq[B.spine] as Quaternion, pitch * 0.5, yaw * 0.5, roll * 0.5);
    rot(ps.lq[B.chest] as Quaternion, pitch * 0.5, yaw * 0.5, roll * 0.5);
    ps.fkChain([B.pelvis, B.spine, B.chest]);
    this.neckAndHead(inp, cue, crank, pedalling, dt);
    ps.fkChain([B.clavL, B.clavR]);
    this.arm(ARM.L, inp.gripL, cue.armL, cue, tuck, null);
    this.arm(ARM.R, inp.gripR, cue.armR, cue, tuck, inp.bell);
    this.leg(LEG.L, inp.pedalL, inp.pedalL.z - inp.pedalR.z, crank, cue);
    this.leg(LEG.R, inp.pedalR, inp.pedalR.z - inp.pedalL.z, crank + Math.PI, cue);
  }

  private neckAndHead(inp: RideInput, cue: CueOut, crank: number, pedalling: number, dt: number): void {
    const ps = this.ps, m = this.def.meta;
    const n = cue.neck, tuck = this.tuck, bend = (m.carry?.shift ?? 0) * inp.carry;
    rot(ps.lq[B.neck1] as Quaternion, -0.42 * n - tuck * 0.18, 0, bend * 0.6);
    rot(ps.lq[B.neck2] as Quaternion, 0.18 * n + tuck * 0.06, 0, bend * 0.4);
    rot(ps.lq[B.neck3] as Quaternion, 0.16 * n, 0, 0);
    if (m.headBob) (ps.lp[B.neck3] as Vector3).z += Math.sin(crank * 2) * 0.028 * pedalling;
    ps.fkChain([B.neck1, B.neck2, B.neck3]);
    // Look: absolute (character-space) head orientation, so the head stays level over a leaning body.
    const carry = Math.abs(inp.carry);
    let yaw = (m.carry?.yaw ?? 0) * inp.carry, pitch = (m.carry?.pitch ?? 0) * carry;
    if (inp.look) {
      v.subVectors(inp.look, ps.mp[B.head] as Vector3);
      yaw = clamp(Math.atan2(-v.x, -v.z), -1.0, 1.0);
      pitch = clamp(Math.atan2(v.y, Math.hypot(v.x, v.z)), -0.45, 0.45);
      // The hero keeps its bill clear of the helmet: a look (nearly) straight ahead still turns the head at least
      // carry.yaw toward the look's side (the eyes do the rest), with half the chin-up.
      const minYaw = (m.carry?.yaw ?? 0) * carry;
      if (Math.abs(yaw) < minYaw) yaw = (Math.abs(yaw) > 0.05 ? Math.sign(yaw) : Math.sign(inp.carry)) * minYaw;
      pitch = Math.max(pitch, (m.carry?.pitch ?? 0) * carry * 0.5);
    }
    this.headYaw = damp(this.headYaw, yaw, 7, dt);
    this.headPitch = damp(this.headPitch, pitch, 7, dt);
    const sway = Math.sin(crank) * (m.headSway ?? 0) * pedalling;
    rot(q, this.headPitch + cue.headPitch - this.stand * 0.05, this.headYaw + cue.headYaw + cue.spin + sway, -inp.lean * 0.45 + cue.headRoll);
    q2.copy(ps.mq[B.neck3] as Quaternion).slerp(q, 0.88);
    ps.setModelRot(B.head, q2);
    rot(ps.lq[B.jaw] as Quaternion, -0.75 * cue.jaw, 0, 0);
    const p = cue.pouch; // the pouch balloons sideways first, so a gulp shows on both sides of the neck from behind
    const j = this.pouchJiggle(inp, crank, pedalling, dt);
    (ps.lsv[B.pouch] as Vector3).set(1 + p * 1.05 + j, 1 + p * 0.5 - j * 0.6, 1 + p * 0.35);
    ps.fkChain([B.jaw, B.pouch, B.hat]);
  }

  /** Pouch bulge: sloshes once per crank turn at speed (with the hip rock), plus a damped spring kicked by speed
   *  changes and air time (reads from behind as the pink lobes breathing beside the neck). */
  private pouchJiggle(inp: RideInput, crank: number, pedalling: number, dt: number): number {
    const amp = this.def.meta.pouchJiggle ?? 0;
    if (amp <= 0 || dt <= 0) return 0;
    const kick = inp.accel * 0.6 + (inp.airborne ? -6 : 0);
    this.jigV += (-this.jig * 120 - this.jigV * 6 + kick) * dt;
    this.jig = clamp(this.jig + this.jigV * dt, -0.6, 0.6);
    const slosh = Math.sin(crank + 0.6) * 0.55 * pedalling * clamp01(inp.speed / 10);
    return (slosh + this.jig) * amp;
  }

  private arm(c: Chain, grip: Vector3, ac: ArmCue, cue: CueOut, tuck: number, bell: Vector3 | null): void {
    const ps = this.ps, m = this.def.meta, s = c.side;
    // Grip pose: wrist just above/behind the grip, elbows out (more when tucked), feathers trailing down-back.
    target.set(grip.x, grip.y + m.gripDrop, grip.z + GRIP_BACK);
    if (bell && cue.bellReach > 0) target.lerp(v.set(bell.x, bell.y + m.gripDrop, bell.z + GRIP_BACK), clamp01(cue.bellReach));
    target.multiply(this.unsquash);
    pole.set(s * (0.9 + tuck * 0.5), 0.05, 0.45);
    w.set(0, -0.8, 0.6);
    const spread = cue.wings;
    if (spread > 0) {
      // Spread wing: out to the side, swept back ~25°, flapping (turning with the body in the OIIA spin).
      const sh = ps.mp[c.root] as Vector3;
      target.lerp(v.set(s * 0.58, 0.16 + 0.09 * cue.flap, 0.26).applyAxisAngle(UP, cue.spin).add(sh), spread);
      pole.lerp(v.set(0, 0.15, 1).applyAxisAngle(UP, cue.spin), spread);
      w.lerp(v.set(0, 0.05, 1).applyAxisAngle(UP, cue.spin), spread);
    }
    if (ac.blend > 0) {
      target.lerp(ac.target, ac.blend);
      pole.lerp(ac.pole, ac.blend);
    }
    bindPole.set(-s * m.armUp[0], m.armUp[1], m.armUp[2]);
    this.stretchArm(c, target);
    solveChain(ps, c, target, pole, bindPole, w);
    // Hand: wrap forward-down over the bar; free hands continue the forearm (+ cue wrist flick).
    const fore = v.subVectors(ps.mp[c.end] as Vector3, ps.mp[c.mid] as Vector3).normalize();
    const wrap = clamp01(1 - ac.blend - spread);
    const dir = target.set(0, -0.75, -0.7).normalize().multiplyScalar(wrap).addScaledVector(fore, 1 - wrap).normalize();
    if (ac.wrist !== 0) dir.applyAxisAngle(pole.clone().cross(dir).normalize(), ac.wrist);
    if (spread > 0) dir.setY(dir.y - 0.4 * spread).normalize(); // spread wing: raised arm (dihedral), hand droops ~20°
    const bindFore = pole.subVectors(ps.rest(c.end), ps.rest(c.mid));
    aimEnd(ps, c, bindFore, bindPole, dir, w);
    if (m.wings) this.fan(c, spread);
  }

  /** Spread wings grow their primaries fan out of the wrist and swing it out past the hand, swept back (folded,
   *  the fan is scaled away inside the feather fist); the fist shrinks as it opens into the fan. */
  private fan(c: Chain, spread: number): void {
    const ps = this.ps, prim = c.side === -1 ? B.primL : B.primR;
    (ps.lq[prim] as Quaternion).setFromAxisAngle(this.wingN[c.side === -1 ? 0 : 1], -2.45 * spread);
    ps.ls[prim] = smoothstep(0.05, 0.45, spread);
    ps.ls[c.end] = (ps.ls[c.end] ?? 1) * (1 - 0.45 * spread);
    ps.fk(prim);
  }

  /** Stretchy arm: a lean or squash/stretch that pulls the target out of reach lengthens the limb (≤ +15 %). */
  private stretchArm(c: Chain, tgt: Vector3): void {
    const ps = this.ps;
    ps.ls[c.root] = this.armScale;
    ps.fk(c.root);
    const [a1, a2] = chainLengths(ps, c);
    const k = clamp(tgt.distanceTo(ps.mp[c.root] as Vector3) / ((a1 + a2) * (ps.msc[c.root] ?? 1) * 0.985), 1, 1.15);
    ps.ls[c.root] = this.armScale * k;
    ps.ls[c.end] = 1 / (this.armScale * k);
  }

  /** Ankle target for a pedal (feet ride slightly above/behind the pedal axle). */
  private pedalTarget(c: Chain, pedal: Vector3, out: Vector3): Vector3 {
    const l = this.def.meta.ankleLift;
    return out.set(pedal.x + c.side * l[0], pedal.y + l[1], pedal.z + l[2]).multiply(this.unsquash);
  }

  /** Pull the pelvis back toward the pedals when standing/bobbing would overstretch a leg. */
  private keepReach(inp: RideInput): void {
    const ps = this.ps;
    if (this.def.meta.shortLegs) return;
    const pel = ps.lp[B.pelvis] as Vector3;
    for (let iter = 0; iter < 2; iter++) {
      ps.fk(B.pelvis);
      let worst = 0;
      for (const [c, pedal] of [[LEG.L, inp.pedalL], [LEG.R, inp.pedalR]] as const) {
        ps.fk(c.root);
        const [l1, l2] = chainLengths(ps, c);
        const max = (l1 + l2) * (ps.msc[c.root] ?? 1) * 0.985;
        const hip = ps.mp[c.root] as Vector3;
        const d = this.pedalTarget(c, pedal, w).distanceTo(hip);
        if (d - max > worst) {
          worst = d - max;
          v.subVectors(w, hip).normalize();
        }
      }
      if (worst <= 0) return;
      pel.addScaledVector(v, worst);
    }
  }

  private leg(c: Chain, pedal: Vector3, dz: number, phase: number, cue: CueOut): void {
    const ps = this.ps, m = this.def.meta, s = c.side;
    this.pedalTarget(c, pedal, target);
    const tuck = cue.legTuck;
    if (m.shortLegs) {
      // Legs too short for the pedals: little feet paddle the air in time with the crank.
      const hip = ps.rest(c.root), [l1, l2] = chainLengths(ps, c);
      const r = (l1 + l2) * 0.16;
      target.set(hip.x + s * 0.02, hip.y - (l1 + l2) * 0.72 + Math.sin(phase) * r, hip.z - (l1 + l2) * 0.25 - Math.cos(phase) * r);
    }
    pole.set(s * 0.2, 0.15, -1);
    if (tuck > 0) {
      // OIIA spin: feet leave the pedals and tuck under the body, knees turning with the pelvis.
      const [l1, l2] = chainLengths(ps, c);
      ps.fk(c.root);
      w.set(s * 0.05, -(l1 + l2) * 0.55, -(l1 + l2) * 0.35).applyAxisAngle(UP, cue.spin).add(ps.mp[c.root] as Vector3);
      target.lerp(w, tuck);
      pole.lerp(v.set(s * 0.2, 0.15, -1).applyAxisAngle(UP, cue.spin), tuck);
    }
    bindPole.set(s * 0.12, 0.25, -1);
    solveChain(ps, c, target, pole, bindPole, pole);
    // Ankling: toes dip through the bottom of the stroke.
    const ank = -0.08 + 0.2 * Math.sin(phase) + (dz > 0 ? 0.05 : 0);
    aimEnd(ps, c, v.set(0, 0, -1), UP, w.set(0, Math.sin(ank), -Math.cos(ank)), UP);
  }
}
