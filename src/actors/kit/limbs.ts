// Limb kit: leg/arm tubes along the bone chains (smooth knee/elbow bends), webbed bird feet and
// round mammal paws. All functions take the LEFT-side joints and mirror for side = +1.
import { CapsuleGeometry, Matrix4, Quaternion, Shape, SphereGeometry, Vector3 } from 'three';
import type { CharacterBuilder, Influences } from './builder';
import { extrudeSmooth } from './shapes';
import { addTube } from './tube';
import type { V3 } from './sdf';
import { vec } from './face';
import { B, mirror, type Joints } from '../rig/skeleton';

const sideBones = (side: -1 | 1) => side === -1
  ? { thigh: B.thighL, shin: B.shinL, foot: B.footL, arm: B.armL, fore: B.foreL, hand: B.handL }
  : { thigh: B.thighR, shin: B.shinR, foot: B.footR, arm: B.armR, fore: B.foreR, hand: B.handR };
const at = (p: V3, side: -1 | 1): V3 => (side === -1 ? p : mirror(p));
const mid = (a: V3, b: V3, t = 0.5): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export interface LegOpts {
  r: readonly [number, number, number, number]; // radius at hip, knee, mid-shin, ankle
  thigh: number;   // colour of the thigh half
  shin: number;    // colour below the knee
  /** Where along the chain the colour switches (0..1, 0.5 = knee). */
  split?: number;
  sides?: number;
}

export function addLeg(b: CharacterBuilder, J: Joints, side: -1 | 1, o: LegOpts): void {
  const bn = sideBones(side);
  const hip = at(J.hip, side), knee = at(J.knee, side), ankle = at(J.ankle, side);
  const k: Influences = [[bn.thigh, 0.5], [bn.shin, 0.5]];
  addTube(b, [
    { p: hip, r: o.r[0], bone: bn.thigh },
    { p: mid(hip, knee), r: (o.r[0] + o.r[1]) / 2, bone: bn.thigh },
    { p: knee, r: o.r[1], bone: k },
    { p: mid(knee, ankle), r: o.r[2], bone: bn.shin },
    { p: ankle, r: o.r[3], bone: [[bn.shin, 0.6], [bn.foot, 0.4]] },
  ], { color: (u) => (u < (o.split ?? 0.5) ? o.thigh : o.shin), sides: o.sides ?? 8, seg: 3 });
}

export interface ArmOpts {
  r: readonly [number, number, number]; // shoulder, elbow, wrist
  color: number;
  sides?: number;
}

export function addArm(b: CharacterBuilder, J: Joints, side: -1 | 1, o: ArmOpts): void {
  const bn = sideBones(side);
  const sh = at(J.shoulder, side), el = at(J.elbow, side), wr = at(J.wrist, side);
  addTube(b, [
    { p: sh, r: o.r[0], bone: bn.arm },
    { p: mid(sh, el), r: (o.r[0] + o.r[1]) / 2, bone: bn.arm },
    { p: el, r: o.r[1], bone: [[bn.arm, 0.5], [bn.fore, 0.5]] },
    { p: mid(el, wr), r: (o.r[1] + o.r[2]) / 2, bone: bn.fore },
    { p: wr, r: o.r[2], bone: [[bn.fore, 0.4], [bn.hand, 0.6]] },
  ], { color: o.color, sides: o.sides ?? 8, seg: 3 });
}

export interface WebFootOpts { len: number; width: number; thick: number; drop: number; color: number; toes?: 3 | 4 }

/** Webbed foot: three toes with scalloped webbing, sole `drop` below the ankle, pointing −Z. */
export function addWebFoot(b: CharacterBuilder, J: Joints, side: -1 | 1, o: WebFootOpts): void {
  const s = new Shape();
  const w = o.width / 2, L = o.len;
  s.moveTo(-w * 0.28, -L * 0.12);
  s.quadraticCurveTo(-w * 0.5, L * 0.3, -w, L * 0.92);
  s.quadraticCurveTo(-w * 0.95, L * 1.04, -w * 0.8, L * 0.96);
  s.quadraticCurveTo(-w * 0.45, L * 0.78, -w * 0.12, L * 0.98);
  s.quadraticCurveTo(0, L * 1.1, w * 0.12, L * 0.98);
  s.quadraticCurveTo(w * 0.45, L * 0.78, w * 0.8, L * 0.96);
  s.quadraticCurveTo(w * 0.95, L * 1.04, w, L * 0.92);
  s.quadraticCurveTo(w * 0.5, L * 0.3, w * 0.28, L * -0.12);
  s.quadraticCurveTo(0, -L * 0.22, -w * 0.28, -L * 0.12);
  const geo = extrudeSmooth(s, { depth: o.thick, bevel: 0.4, curveSegments: 3, bevelSegments: 1 });
  const a = vec(at(J.ankle, side));
  const m = new Matrix4().compose(
    new Vector3(a.x, a.y - o.drop, a.z),
    new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2),
    new Vector3(1, 1, 1),
  );
  b.part({ geometry: geo, matrix: m, color: o.color, bone: sideBones(side).foot, outline: 0.8 });
  geo.dispose();
}

export interface PawOpts { r: V3; color: number; pad?: number; offset?: V3 }

/** Round paw/hand blob at the wrist (arms) or ankle (legs) with an optional darker pad underneath. */
export function addPaw(b: CharacterBuilder, J: Joints, side: -1 | 1, limb: 'hand' | 'foot', o: PawOpts): void {
  const bn = sideBones(side);
  const base = vec(at(limb === 'hand' ? J.wrist : J.ankle, side));
  const off = o.offset ? vec(at(o.offset, side)) : new Vector3();
  const c = base.add(off);
  const sphere = new SphereGeometry(1, 10, 8);
  const bone = limb === 'hand' ? bn.hand : bn.foot;
  b.part({ geometry: sphere, matrix: new Matrix4().compose(c, new Quaternion(), vec(o.r)), color: o.color, bone });
  if (o.pad !== undefined) {
    const pc = c.clone().add(new Vector3(0, -o.r[1] * 0.55, 0));
    b.part({ geometry: sphere, matrix: new Matrix4().compose(pc, new Quaternion(), new Vector3(o.r[0] * 0.7, o.r[1] * 0.5, o.r[2] * 0.75)), color: o.pad, bone, outline: 0.5 });
  }
  sphere.dispose();
}

export interface ToeFootOpts { len: number; color: number; drop?: number }

/** Perching foot: three toes forward, one back (pigeon). */
export function addToeFoot(b: CharacterBuilder, J: Joints, side: -1 | 1, o: ToeFootOpts): void {
  const a = vec(at(J.ankle, side));
  const geo = new CapsuleGeometry(o.len * 0.09, o.len * 0.8, 3, 6);
  const toes: Array<[number, number]> = [[-0.38, 1], [0, 1.1], [0.38, 1], [Math.PI, 0.6]];
  for (const [yaw, k] of toes) {
    const dir = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const c = new Vector3(a.x, a.y - (o.drop ?? 0.03), a.z).addScaledVector(dir, o.len * 0.45 * k);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
    b.part({ geometry: geo, matrix: new Matrix4().compose(c, q, new Vector3(1, k, 1)), color: o.color, bone: sideBones(side).foot, outline: 0.7 });
  }
  geo.dispose();
}
