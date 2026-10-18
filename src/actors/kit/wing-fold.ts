// Folded bird wings for riders: a chunky feathered arm (leading-edge tube shoulder → elbow → wrist), a
// scalloped secondaries panel hanging down-back from it, a fan of primaries trailing back along the
// forearm (dark tips read from the chase cam), an optional spread-only fan on the primaries bone, and a
// feather fist (kit/paws mitten) wrapped on the grip.
import { Shape, Vector3 } from 'three';
import type { CharacterBuilder, Influences } from './builder';
import { addHandMitten, type MittenOpts } from './paws';
import { extrudeSmooth, flipWinding, positionsOf, setPositions } from './shapes';
import { addTube } from './tube';
import type { V3 } from './sdf';
import { B, mirror, type Joints } from '../rig/skeleton';

export interface PrimaryOpts {
  n: number; len: number; w: number; color: number; tip: number; tipFrac: number; droop?: number;
  /** Angle step between blades (rad, default 0.2). */
  spread?: number;
  /** Outline curve segments per blade edge (default 3). */
  seg?: number;
}

export interface FoldWingOpts {
  arm: readonly [number, number, number];   // leading-edge radii at shoulder / elbow / wrist
  color: number;                            // arm + coverts
  feather: number;                          // secondaries
  edge: number;                             // trailing-edge tips of the secondaries
  chord: readonly [number, number, number]; // secondaries depth at shoulder / elbow / wrist
  primaries: PrimaryOpts;
  /** Primaries that only show on a spread wing (B.primL/R, scaled from 0 and fanned out by rig/ride.ts). */
  fan?: PrimaryOpts;
  fist: MittenOpts;
  armUp: V3;                                // species meta.armUp (palm side of the fist)
  /** Direction the secondaries hang from the arm (left side, bind); default armUp. */
  trail?: V3;
  thick?: number;
}

interface Frame { a: Vector3; d: Vector3; t: Vector3; n: Vector3 }

/** Scalloped secondaries outline: x along the arm (0..span), y = −depth. */
function secondaries(span: number, elbowAt: number, chord: readonly [number, number, number]): Shape {
  const depth = (x: number): number => (x < elbowAt
    ? chord[0] + (chord[1] - chord[0]) * (x / elbowAt)
    : chord[1] + (chord[2] - chord[1]) * ((x - elbowAt) / Math.max(1e-3, span - elbowAt)));
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(span, 0);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = span * (1 - i / n), x1 = span * (1 - (i + 1) / n), xm = (x0 + x1) / 2;
    s.quadraticCurveTo(x0, -depth(x0) * 0.92, xm, -depth(xm));
    s.quadraticCurveTo(x1 + (x0 - x1) * 0.15, -depth(x1) * 1.02, x1, -depth(x1) * 0.8);
  }
  s.quadraticCurveTo(-chord[0] * 0.2, -chord[0] * 0.3, 0, 0);
  return s;
}

/** Pointed feather blade: x along (0..len), y across (±w). */
function blade(len: number, w: number): Shape {
  const s = new Shape();
  s.moveTo(0, -w * 0.5);
  s.quadraticCurveTo(len * 0.45, -w * 1.05, len, -w * 0.15);
  s.quadraticCurveTo(len * 1.03, w * 0.2, len * 0.9, w * 0.45);
  s.quadraticCurveTo(len * 0.45, w * 1.05, 0, w * 0.5);
  s.quadraticCurveTo(-w * 0.3, 0, 0, -w * 0.5);
  return s;
}

export function addFoldedWing(b: CharacterBuilder, J: Joints, side: -1 | 1, o: FoldWingOpts): void {
  const m = (p: V3): Vector3 => { const q = side === -1 ? p : mirror(p); return new Vector3(q[0], q[1], q[2]); };
  const S = m(J.shoulder), E = m(J.elbow), W = m(J.wrist);
  const bones = side === -1 ? [B.armL, B.foreL, B.handL] : [B.armR, B.foreR, B.handR];
  const [bArm, bFore, bHand] = bones as [number, number, number];
  const tr = o.trail ?? o.armUp;
  const trailHint = new Vector3(-side * tr[0], tr[1], tr[2]).normalize();
  const frames: Frame[] = [[S, E], [E, W]].map(([a, c]) => {
    const pa = a as Vector3, d = (c as Vector3).clone().sub(pa).normalize();
    const t = trailHint.clone().addScaledVector(d, -trailHint.dot(d)).normalize();
    return { a: pa, d, t, n: new Vector3().crossVectors(d, t).multiplyScalar(-side) };
  });
  const l0 = S.distanceTo(E), span = l0 + E.distanceTo(W);
  // Secondaries panel warped along the two arm segments (frames blend across the elbow).
  const geo = extrudeSmooth(secondaries(span, l0, o.chord), { depth: o.thick ?? 0.022, bevel: 0.45, curveSegments: 2, bevelSegments: 1 });
  const src = positionsOf(geo), out = new Float32Array(src.length);
  const weights: Influences[] = [], colors: number[] = [];
  const p = new Vector3(), t = new Vector3(), n = new Vector3(), win = 0.06;
  for (let i = 0; i < src.length / 3; i++) {
    const sx = src[i * 3] ?? 0, sy = src[i * 3 + 1] ?? 0, sz = src[i * 3 + 2] ?? 0;
    const k = sx < l0 ? 0 : 1, f = frames[k] as Frame;
    p.copy(f.a).addScaledVector(f.d, sx - (k ? l0 : 0));
    t.copy(f.t); n.copy(f.n);
    let inf: Influences = [[k ? bFore : bArm, 1]];
    const dj = sx - l0;
    if (Math.abs(dj) < win) {
      const w = (dj + win) / (2 * win), fa = frames[0] as Frame, fb = frames[1] as Frame;
      t.copy(fa.t).lerp(fb.t, w).normalize();
      n.copy(fa.n).lerp(fb.n, w).normalize();
      inf = [[bArm, 1 - w], [bFore, w]];
    }
    p.addScaledVector(t, -sy).addScaledVector(n, sz);
    out.set([p.x, p.y, p.z], i * 3);
    weights.push(inf);
    const depthAt = sx < l0 ? o.chord[0] + (o.chord[1] - o.chord[0]) * (sx / l0) : o.chord[1] + (o.chord[2] - o.chord[1]) * ((sx - l0) / (span - l0));
    colors.push(-sy > depthAt * 0.66 ? o.edge : -sy < depthAt * 0.28 ? o.color : o.feather);
  }
  if (side === -1) flipWinding(geo);
  setPositions(geo, out);
  b.part({ geometry: geo, color: (_x, _y, _z, _a, _b, _c, i) => colors[i] ?? o.color, bone: (_x, _y, _z, i) => weights[i] ?? [[bArm, 1]], outline: 0.8 });
  geo.dispose();
  addPrimaries(b, W, E, frames[1] as Frame, side, bFore, o.primaries);
  if (o.fan) addPrimaries(b, W, E, frames[1] as Frame, side, side === -1 ? B.primL : B.primR, o.fan);
  // Leading edge: the feathered "arm".
  const at = (v: Vector3): V3 => [v.x, v.y, v.z];
  addTube(b, [
    { p: at(S), r: o.arm[0], bone: bArm },
    { p: at(S.clone().lerp(E, 0.5)), r: (o.arm[0] + o.arm[1]) / 2, bone: bArm },
    { p: at(E), r: o.arm[1], bone: [[bArm, 0.5], [bFore, 0.5]] },
    { p: at(E.clone().lerp(W, 0.5)), r: (o.arm[1] + o.arm[2]) / 2, bone: bFore },
    { p: at(W), r: o.arm[2], bone: [[bFore, 0.5], [bHand, 0.5]] },
  ], { color: o.color, sides: 8, seg: 3 });
  addHandMitten(b, J, side, o.armUp, o.fist);
}

/** Fan of primaries from the wrist, trailing back along the forearm and fanning downward. */
function addPrimaries(b: CharacterBuilder, W: Vector3, E: Vector3, f: Frame, side: -1 | 1, bone: number, o: PrimaryOpts): void {
  const back = E.clone().sub(W).normalize();
  const down = f.t.clone().addScaledVector(back, -f.t.dot(back)).normalize();
  for (let i = 0; i < o.n; i++) {
    const len = o.len * (1 - i * 0.09), w = o.w * (1 - i * 0.06);
    const dir = back.clone().addScaledVector(down, (o.droop ?? 0.25) + i * (o.spread ?? 0.2)).normalize();
    const across = down.clone().addScaledVector(dir, -down.dot(dir)).normalize();
    const nrm = new Vector3().crossVectors(dir, across).multiplyScalar(-side);
    const base = W.clone().addScaledVector(down, 0.02 + i * 0.012).addScaledVector(nrm, 0.012 + i * 0.006).addScaledVector(dir, -0.02);
    const geo = extrudeSmooth(blade(len, w), { depth: 0.014, bevel: 0.45, curveSegments: o.seg ?? 3, bevelSegments: 1 });
    const src = positionsOf(geo), out = new Float32Array(src.length), cols: number[] = [];
    for (let k = 0; k < src.length / 3; k++) {
      const x = src[k * 3] ?? 0, y = src[k * 3 + 1] ?? 0, z = src[k * 3 + 2] ?? 0;
      const q = base.clone().addScaledVector(dir, x).addScaledVector(across, y).addScaledVector(nrm, z);
      out.set([q.x, q.y, q.z], k * 3);
      cols.push(x > len * (1 - o.tipFrac) ? o.tip : o.color);
    }
    if (side === 1) flipWinding(geo);
    setPositions(geo, out);
    b.part({ geometry: geo, color: (_x, _y, _z, _a, _b, _c, k) => cols[k] ?? o.color, bone, outline: 0.7 });
    geo.dispose();
  }
}
