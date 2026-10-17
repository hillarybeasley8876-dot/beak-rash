// Bird wings: a scalloped feather vane (bevelled 2D silhouette) warped along the bind-pose arm polyline
// shoulder → elbow → wrist → tip, plus a leading-edge tube. Frames blend across the joints so the vane
// stays continuous; skin weights follow the span; primaries get dark tips.
import { Shape, Vector3 } from 'three';
import type { CharacterBuilder, Influences } from './builder';
import { extrudeSmooth, positionsOf, setPositions } from './shapes';
import { addTube } from './tube';
import type { V3 } from './sdf';
import { vec } from './face';
import { B, mirror, type Joints } from '../rig/skeleton';

export interface WingOpts {
  tip: V3;              // wing tip beyond the wrist (left side, bind pose)
  color: number;        // coverts / leading edge
  feather: number;      // flight feathers
  tipColor: number;     // primary tips
  tipFrac: number;      // fraction of each primary painted tipColor
  chord: number;        // max chord (m)
  thick: number;        // vane thickness (m)
  edgeR: readonly [number, number, number]; // leading-edge radius at shoulder / wrist / tip
  trail: V3;            // trailing direction hint (bind, left side)
  /** 'flipper' = smooth paddle (penguin) instead of scalloped flight feathers. */
  style?: 'feather' | 'flipper';
}

/** Smooth paddle silhouette (penguin flipper). */
function paddle(span: number, chord: number): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(span * 0.6, chord * 0.12, span, -chord * 0.25);
  s.quadraticCurveTo(span * 1.02, -chord * 0.6, span * 0.8, -chord * 0.62);
  s.quadraticCurveTo(span * 0.35, -chord * 1.05, 0, -chord * 0.7);
  s.quadraticCurveTo(-chord * 0.15, -chord * 0.35, 0, 0);
  return s;
}

/** Silhouette in (span x ≥ 0, chord y ≤ 0): rounded root, secondary scallops, primary fingers. */
function silhouette(span: number, chord: number, wristAt: number): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(span, 0);
  s.quadraticCurveTo(span + chord * 0.1, -chord * 0.12, span - chord * 0.03, -chord * 0.32);
  const fingers = 5;
  for (let i = 0; i < fingers; i++) {
    const x0 = wristAt + (span - wristAt) * (1 - i / fingers), x1 = wristAt + (span - wristAt) * (1 - (i + 1) / fingers);
    const depth = chord * (1 - i * 0.05);
    s.quadraticCurveTo(x0 - (x0 - x1) * 0.05, -depth, (x0 + x1) * 0.5, -depth);
    s.quadraticCurveTo(x1 + (x0 - x1) * 0.1, -depth * 0.97, x1, -depth * 0.74);
  }
  const sec = 4;
  for (let i = 0; i < sec; i++) {
    const x0 = wristAt * (1 - i / sec), x1 = wristAt * (1 - (i + 1) / sec);
    const depth = chord * (0.78 - i * 0.07);
    s.quadraticCurveTo((x0 + x1) * 0.5, -depth * 1.1, x1, -depth * 0.86);
  }
  s.quadraticCurveTo(-chord * 0.14, -chord * 0.28, 0, 0);
  return s;
}

export function addBirdWing(b: CharacterBuilder, J: Joints, side: -1 | 1, o: WingOpts): void {
  const m = (p: V3): Vector3 => vec(side === -1 ? p : mirror(p));
  const pts = [m(J.shoulder), m(J.elbow), m(J.wrist), m(o.tip)];
  const bones = side === -1 ? [B.armL, B.foreL, B.handL] : [B.armR, B.foreR, B.handR];
  const bone = (i: number): number => bones[Math.min(i, 2)] ?? B.armL;
  const lens = [0, 1, 2].map((i) => (pts[i + 1] as Vector3).distanceTo(pts[i] as Vector3));
  const cum = [0, lens[0] ?? 0, (lens[0] ?? 0) + (lens[1] ?? 0), lens.reduce((a, c) => a + c, 0)];
  const span = cum[3] ?? 1, wristAt = cum[2] ?? span * 0.6;
  const trailHint = m(o.trail).normalize();
  const frames = [0, 1, 2].map((i) => {
    const a = pts[i] as Vector3, d = (pts[i + 1] as Vector3).clone().sub(a).normalize();
    const t = trailHint.clone().addScaledVector(d, -trailHint.dot(d)).normalize();
    return { a, d, t, n: new Vector3().crossVectors(d, t).multiplyScalar(-side) };
  });
  const shape = o.style === 'flipper' ? paddle(span, o.chord) : silhouette(span, o.chord, wristAt);
  const geo = extrudeSmooth(shape, { depth: o.thick, bevel: 0.45, curveSegments: 3, bevelSegments: 1 });
  const src = positionsOf(geo);
  const out = new Float32Array(src.length);
  const weights: Influences[] = [];
  const colors: number[] = [];
  const t = new Vector3(), n = new Vector3(), p = new Vector3();
  const win = 0.07;
  for (let i = 0; i < src.length / 3; i++) {
    const sx = src[i * 3] ?? 0, sy = src[i * 3 + 1] ?? 0, sz = src[i * 3 + 2] ?? 0;
    const k = sx < (cum[1] ?? 0) ? 0 : sx < wristAt ? 1 : 2;
    const f = frames[k] as (typeof frames)[number];
    p.copy(f.a).addScaledVector(f.d, sx - (cum[k] ?? 0));
    t.copy(f.t); n.copy(f.n);
    let inf: Influences = [[bone(k), 1]];
    for (const j of [1, 2]) {
      const dj = sx - (cum[j] ?? 0);
      if (Math.abs(dj) >= win) continue;
      const w = (dj + win) / (2 * win);
      const fa = frames[j - 1] as (typeof frames)[number], fb = frames[j] as (typeof frames)[number];
      t.copy(fa.t).lerp(fb.t, w).normalize();
      n.copy(fa.n).lerp(fb.n, w).normalize();
      inf = [[bone(j - 1), 1 - w], [bone(j), w]];
    }
    p.addScaledVector(t, -sy).addScaledVector(n, sz);
    out.set([p.x, p.y, p.z], i * 3);
    weights.push(inf);
    const chordAt = sx > wristAt ? o.chord : o.chord * 0.78;
    const tip = o.style !== 'flipper' && ((sx > wristAt - 0.02 && -sy > chordAt * (1 - o.tipFrac)) || (sx > span - o.chord * 0.35 && -sy > o.chord * 0.2));
    colors.push(tip ? o.tipColor : -sy < o.chord * 0.32 ? o.color : o.feather);
  }
  setPositions(geo, out);
  b.part({ geometry: geo, color: (_x, _y, _z, _nx, _ny, _nz, i) => colors[i] ?? o.color, bone: (_x, _y, _z, i) => weights[i] ?? [[bone(0), 1]], outline: 0.8 });
  geo.dispose();
  const r = o.edgeR;
  const at = (i: number): V3 => { const v = pts[i] as Vector3; return [v.x, v.y, v.z]; };
  addTube(b, [
    { p: at(0), r: r[0], bone: bone(0) },
    { p: at(1), r: (r[0] + r[1]) / 2, bone: [[bone(0), 0.5], [bone(1), 0.5]] },
    { p: at(2), r: r[1], bone: [[bone(1), 0.5], [bone(2), 0.5]] },
    { p: at(3), r: r[2], bone: bone(2) },
  ], { color: o.color, sides: 7, seg: 3 });
}
