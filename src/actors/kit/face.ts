// Face kit: sclera + pupil (+ optional iris) + highlight, hinged upper lids and brows.
// Pupils/highlights ride the eye bones (placed at the pupil centre: look = move along the sclera,
// shrink = scale in place); lids ride lid bones at the sclera centre and hinge about `lidAxis`.
import { CapsuleGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { CharacterBuilder } from './builder';
import type { V3 } from './sdf';
import { B, mirror, type Joints } from '../rig/skeleton';

export const vec = (p: V3): Vector3 => new Vector3(p[0], p[1], p[2]);
const FWD = new Vector3(0, 0, -1);

/** Matrix placing a unit shape at `pos`, its −Z turned to `dir`, scaled by `s`. */
export function placed(pos: V3 | Vector3, dir: V3 | Vector3 = [0, 0, -1], s: V3 | number = 1): Matrix4 {
  const p = pos instanceof Vector3 ? pos : vec(pos);
  const d = (dir instanceof Vector3 ? dir.clone() : vec(dir)).normalize();
  const q = new Quaternion().setFromUnitVectors(FWD, d);
  const sc = typeof s === 'number' ? new Vector3(s, s, s) : vec(s);
  return new Matrix4().compose(p, q, sc);
}

/** Point on the sclera surface where the pupil sits (use for Joints.pupil). */
export function pupilPoint(eye: V3, dir: V3, r: number): V3 {
  const d = vec(dir).normalize();
  return [eye[0] + d.x * r * 0.94, eye[1] + d.y * r * 0.94, eye[2] + d.z * r * 0.94];
}

/** Hinge axis for the left upper lid: positive rotation closes the lid over the eye. */
export function lidAxis(dir: V3): Vector3 {
  return new Vector3(0, 1, 0).cross(vec(dir).normalize()).normalize();
}

export interface EyeOpts {
  r: number;
  dir: V3;                 // left eye look direction
  pupil: number;           // pupil radius
  pupilColor?: number;
  iris?: { r: number; color: number };
  sclera?: number;
  lid: number;             // lid colour
  /** Squash the sclera vertically (<1) or widen it (>1). */
  aspect?: number;
  brow?: { color: number; len: number; thick: number; tilt: number; lift: number };
}

/** Spherical cap (pole along −Z) of angular radius `ang`, unit radius. */
function cap(ang: number, seg: number): SphereGeometry {
  const g = new SphereGeometry(1, seg, Math.max(2, Math.round(seg / 5)), 0, Math.PI * 2, 0, ang);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Cap on the sclera sphere (centre `eye`, radius r·lift) around direction `d`. */
function capOn(b: CharacterBuilder, eye: Vector3, d: Vector3, r: number, a: number, ang: number, color: number, bone: number, seg = 12, lift = 1.02): void {
  const g = cap(ang, seg);
  b.part({ geometry: g, matrix: placed(eye, d, [r * lift, r * lift * a, r * lift]), color, bone, outline: 0 });
  g.dispose();
}

export function addEyes(b: CharacterBuilder, J: Joints, o: EyeOpts): void {
  const sphere = new SphereGeometry(1, 12, 8);
  const lidGeo = new SphereGeometry(1, 12, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const a = o.aspect ?? 1;
  for (const side of [-1, 1] as const) {
    const L = side === -1;
    const eye = vec(L ? J.eye : mirror(J.eye));
    const d = vec(L ? o.dir : mirror(o.dir)).normalize();
    const eyeBone = L ? B.eyeL : B.eyeR;
    b.part({ geometry: sphere, matrix: placed(eye, d, [o.r, o.r * a, o.r]), color: o.sclera ?? 0xffffff, bone: B.head, outline: 0.55 });
    if (o.iris) capOn(b, eye, d, o.r, a, Math.asin(Math.min(0.95, o.iris.r / o.r)), o.iris.color, eyeBone, 10, 1.015);
    capOn(b, eye, d, o.r, a, Math.asin(Math.min(0.9, o.pupil / o.r)), o.pupilColor ?? 0x101014, eyeBone, 10, 1.03);
    const hd = d.clone().applyAxisAngle(new Vector3(0, 1, 0).cross(d).normalize(), -0.32)
      .applyAxisAngle(new Vector3(0, 1, 0), side * 0.18).normalize();
    capOn(b, eye, hd, o.r, a, Math.asin(Math.min(0.5, (o.pupil * 0.36) / o.r)), 0xffffff, eyeBone, 6, 1.045);
    // Upper lid: a cap slightly larger than the sclera, pole up; the rig hinges it about lidAxis.
    b.part({ geometry: lidGeo, matrix: new Matrix4().compose(eye, new Quaternion(), new Vector3(o.r * 1.1, o.r * 1.1 * a, o.r * 1.1)), color: o.lid, bone: L ? B.lidL : B.lidR, outline: 0.35 });
    if (o.brow) {
      const br = o.brow;
      const c = vec(L ? J.brow : mirror(J.brow));
      const tilt = new Quaternion().setFromAxisAngle(d, -side * br.tilt); // + = angry (inner ends down)
      const along = new Vector3(side, 0, 0).applyQuaternion(tilt);
      const geo = new CapsuleGeometry(br.thick, br.len, 3, 6);
      const m = new Matrix4().compose(c, new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along), new Vector3(1, 1, 0.6));
      b.part({ geometry: geo, matrix: m, color: br.color, bone: L ? B.browL : B.browR, outline: 0.4 });
      geo.dispose();
    }
  }
  sphere.dispose();
  lidGeo.dispose();
}
