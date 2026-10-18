// Chunky toy hands and feet: smooth SDF mittens (palm + toe/finger bumps, optional claws and sole pads) on
// the hand/foot bones. Shaped in the limb's bind frame, so the grip/pedal IK re-aims them as a unit:
// hands continue the forearm with the palm toward `armUp`; feet point −Z with the sole down.
import { Euler, Matrix4, Vector3 } from 'three';
import type { CharacterBuilder } from './builder';
import type { Prim, V3 } from './sdf';
import { B, mirror, type Joints } from '../rig/skeleton';

export interface MittenOpts {
  /** Palm half-size: [across, thick, along]. */
  r: V3;
  color: number;
  /** Toe / finger bumps along the front edge (0 = plain mitten). */
  toes?: number;
  toeR?: number;
  /** Fingers that curl around the bar (bird feather fist) instead of round bumps. */
  curl?: boolean;
  toeColor?: number;
  /** Hooked claws (sloth) — colour; replaces round toes. */
  claw?: number;
  /** Sole pads (paint) — colour: one big pad + a bean per toe. */
  pad?: number;
  /** Palm centre: fraction of r[2] ahead of the joint, and offset toward the palm side (m). */
  reach?: number;
  drop?: number;
  budget?: number;
}

const toV3 = (v: Vector3): V3 => [v.x, v.y, v.z];

/** Euler (XYZ) whose rotation maps local X/Y/Z onto the given orthonormal axes. */
function eulerOf(x: Vector3, y: Vector3, z: Vector3): V3 {
  const e = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z), 'XYZ');
  return [e.x, e.y, e.z];
}

/** One mitten at `joint` along `along`, palm facing `palm` (both unit, bind space). */
function mitten(b: CharacterBuilder, joint: Vector3, along: Vector3, palm: Vector3, bone: number, o: MittenOpts): void {
  const f = along.clone().normalize();
  const n = palm.clone().addScaledVector(f, -palm.dot(f)).normalize();
  const across = new Vector3().crossVectors(f, n).normalize();
  const up = n.clone().negate();
  const [rw, rt, rl] = o.r;
  const c = joint.clone().addScaledVector(f, rl * (o.reach ?? 0.55)).addScaledVector(n, o.drop ?? 0);
  const rot = eulerOf(across, up, new Vector3().crossVectors(across, up));
  const prims: Prim[] = [{ shape: { kind: 'ellipsoid', c: toV3(c), r: [rw, rt, rl] }, rot, color: o.color, bone, k: 0.02 }];
  const toes = o.toes ?? 0, tr = o.toeR ?? rw * 0.36;
  for (let i = 0; i < toes; i++) {
    const u = toes === 1 ? 0 : (i / (toes - 1) - 0.5) * 2;
    const base = c.clone().addScaledVector(across, u * rw * 0.62).addScaledVector(f, rl * 0.55).addScaledVector(up, rt * 0.15);
    if (o.claw !== undefined) {
      const tip = base.clone().addScaledVector(f, rl * 1.1).addScaledVector(n, rt * 1.6);
      prims.push({ shape: { kind: 'capsule', a: toV3(base), b: toV3(tip), r: tr * 0.45, r2: tr * 0.12 }, color: o.claw, bone, k: 0.008, priority: 0.004 });
    } else if (o.curl) {
      const mid = base.clone().addScaledVector(f, rl * 0.55).addScaledVector(n, rt * 0.2);
      const tip = mid.clone().addScaledVector(f, rl * 0.25).addScaledVector(n, rt * 1.1);
      prims.push({ shape: { kind: 'capsule', a: toV3(base), b: toV3(mid), r: tr, r2: tr * 0.9 }, color: o.toeColor ?? o.color, bone, k: 0.015 });
      prims.push({ shape: { kind: 'capsule', a: toV3(mid), b: toV3(tip), r: tr * 0.9, r2: tr * 0.7 }, color: o.toeColor ?? o.color, bone, k: 0.012 });
    } else {
      const p = base.clone().addScaledVector(f, rl * 0.32);
      prims.push({ shape: { kind: 'ellipsoid', c: toV3(p), r: [tr, tr * 0.9, tr * 1.1] }, rot, color: o.toeColor ?? o.color, bone, k: 0.012 });
    }
  }
  if (o.pad !== undefined) {
    const sole = c.clone().addScaledVector(n, rt * 0.92);
    prims.push({ shape: { kind: 'ellipsoid', c: toV3(sole.clone().addScaledVector(f, -rl * 0.12)), r: [rw * 0.55, rt * 0.4, rl * 0.42] }, rot, op: 'paint', color: o.pad, bone });
    for (let i = 0; i < Math.max(toes, 3); i++) {
      const u = (i / (Math.max(toes, 3) - 1) - 0.5) * 2;
      const p = sole.clone().addScaledVector(f, rl * 0.62).addScaledVector(across, u * rw * 0.55);
      prims.push({ shape: { kind: 'ellipsoid', c: toV3(p), r: [rw * 0.2, rt * 0.5, rl * 0.18] }, rot, op: 'paint', color: o.pad, bone });
    }
  }
  b.sdf(prims, Math.max(0.0055, Math.min(rw, rt) * 0.22), o.budget ?? 220);
}

/** Hand mitten on the wrist, continuing the forearm (palm side = the species' `armUp`). */
export function addHandMitten(b: CharacterBuilder, J: Joints, side: -1 | 1, armUp: V3, o: MittenOpts): void {
  const m = (p: V3): Vector3 => { const q = side === -1 ? p : mirror(p); return new Vector3(q[0], q[1], q[2]); };
  const wr = m(J.wrist), el = m(J.elbow);
  const palm = new Vector3(-side * armUp[0], armUp[1], armUp[2]);
  mitten(b, wr, wr.clone().sub(el), palm, side === -1 ? B.handL : B.handR, o);
}

/** Foot mitten on the ankle, pointing −Z with the sole down. */
export function addFootMitten(b: CharacterBuilder, J: Joints, side: -1 | 1, o: MittenOpts): void {
  const a = side === -1 ? J.ankle : mirror(J.ankle);
  mitten(b, new Vector3(a[0], a[1], a[2]), new Vector3(0, 0, -1), new Vector3(0, -1, 0), side === -1 ? B.footL : B.footR, o);
}
