// The salted fish's body, built around a planar spine (quadratic Bézier, u = 0 tail root → 1 snout): a lofted
// round body with elliptic sections and a belly-to-back colour ramp, forked tail fin, spiky dorsal fin and
// pectoral fins. The face lives in fish-face.ts.
import { BufferAttribute, BufferGeometry, Color, Matrix4, QuadraticBezierCurve3, Shape, Vector2, type Vector3 } from 'three';
import { extrude, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';

const BACK = new Color('#5d6c78'), SIDE = new Color('#b4c0c8'), BELLY = new Color('#eceee6');
const H = 0.072, W = 0.064, FULL = 0.58;

export interface Frame { c: V3; t: V3; d: V3 }

/** Spine frame: centre c, tangent t (toward the snout), dorsal d (outside of the bend); n = flank normal. */
export interface Spine { at(u: number): Frame; n: V3 }

export function spine(p0: V3, p1: V3, p2: V3, n: V3): Spine {
  const curve = new QuadraticBezierCurve3(p0, p1, p2);
  return {
    n,
    at(u) {
      const c = curve.getPointAt(u), t = curve.getTangentAt(u).normalize();
      return { c, t, d: n.clone().cross(t).normalize() };
    },
  };
}

/** Body envelope 0..1: slim tail root, fullest at 58 %, blunt round nose. */
function env(u: number): number {
  if (u >= FULL) return Math.sqrt(Math.max(0, 1 - ((u - FULL) / (1 - FULL)) ** 2));
  return 0.3 + 0.7 * Math.sin((Math.PI / 2) * (u / FULL));
}
export const halfH = (u: number): number => H * env(u);
/** Laterally slimmer toward the tail, ~13 cm thick at the belly. */
export const halfW = (u: number): number => W * env(u) * (0.55 + 0.45 * Math.min(1, u / 0.5));

/** Surface point at u and section angle a (0 = +n flank, π/2 = back, −π/2 = belly), pushed out by `out`. */
export function surf(s: Spine, u: number, a: number, out = 0): V3 {
  const f = s.at(u);
  return f.c.clone().addScaledVector(f.d, Math.sin(a) * (halfH(u) + out)).addScaledVector(s.n, Math.cos(a) * (halfW(u) + out));
}

/** Outward surface normal at (u, a) (ellipse normal in the section plane). */
export function surfNormal(s: Spine, u: number, a: number): V3 {
  const f = s.at(u);
  return f.d.clone().multiplyScalar(Math.sin(a) / halfH(u)).addScaledVector(s.n, Math.cos(a) / halfW(u)).normalize();
}

/** Body colour at section angle a (belly → flank → back). */
export function shadeAt(a: number): Color {
  const t = Math.sin(a);
  return t < 0 ? SIDE.clone().lerp(BELLY, -t) : SIDE.clone().lerp(BACK, t);
}

/** The lofted body: rings of elliptic sections, closed by a rounded tail cap and a pole at the snout. */
export function fishBody(s: Spine, seg: Seg): BufferGeometry {
  const nu = seg(16, 9), m = seg(14, 8);
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const push = (p: Vector3, c: Color): void => { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); };
  const f0 = s.at(0);
  push(f0.c.clone().addScaledVector(f0.t, -halfW(0) * 0.7), SIDE);
  for (let i = 0; i < nu; i++) {
    const u = Math.sin((Math.PI / 2) * (i / nu));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2;
      push(surf(s, u, a), shadeAt(a));
    }
  }
  push(s.at(1).c, SIDE);
  const ring = (i: number, j: number): number => 1 + i * m + (j % m);
  const tip = 1 + nu * m;
  for (let j = 0; j < m; j++) {
    idx.push(0, ring(0, j), ring(0, j + 1));
    idx.push(ring(nu - 1, j), tip, ring(nu - 1, j + 1));
    for (let i = 0; i < nu - 1; i++) {
      const a = ring(i, j), b = ring(i, j + 1), c = ring(i + 1, j), d = ring(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const p2 = (x: number, y: number): Vector2 => new Vector2(x, y);

/** Forked tail fin: x away from the body, y across (symmetric). */
function tailShape(): Shape {
  const s = new Shape();
  s.moveTo(-0.012, 0.021);
  s.splineThru([p2(0.05, 0.042), p2(0.118, 0.09)]);
  s.lineTo(0.134, 0.078);
  s.splineThru([p2(0.104, 0.034), p2(0.09, 0)]);
  s.splineThru([p2(0.104, -0.034), p2(0.134, -0.078)]);
  s.lineTo(0.118, -0.09);
  s.splineThru([p2(0.05, -0.042), p2(-0.012, -0.021)]);
  s.closePath();
  return s;
}

/** Ragged dorsal fin: x along the spine (spikes rake back toward −x), y up from an embedded base. */
function dorsalShape(): Shape {
  const s = new Shape();
  s.moveTo(-0.07, 0);
  [[-0.074, 0.05], [-0.04, 0.03], [-0.036, 0.066], [-0.006, 0.036], [0.0, 0.062], [0.026, 0.03], [0.03, 0.046], [0.062, 0]]
    .forEach(([x, y]) => s.lineTo(x as number, y as number));
  s.closePath();
  return s;
}

/** Thin flat fin from a 2D shape, its x/y axes laid along `ax`/`ay` (z = ax × ay) at `at`. */
function fin(shape: Shape, ax: V3, ay: V3, at: V3, thick: number, seg: Seg): BufferGeometry {
  const az = ax.clone().cross(ay).normalize();
  const g = extrude(shape, thick, 0, 1, seg(2, 1));
  return g.applyMatrix4(new Matrix4().makeBasis(ax, ay, az).setPosition(at));
}

/** Tail, dorsal and pectoral fins. */
export function fishFins(ps: PartSet, s: Spine, seg: Seg): void {
  const f0 = s.at(0), o = { outline: 0.008 };
  ps.add(fin(tailShape(), f0.t.clone().negate(), f0.d.clone().negate(), f0.c, 0.014, seg), { ...o, color: '#7d8b96' });
  const fd = s.at(0.46);
  ps.add(fin(dorsalShape(), fd.t, fd.d, surf(s, 0.46, Math.PI / 2, -0.014), 0.012, seg), { ...o, color: '#4d5a64' });
  const fp = s.at(0.64);
  for (const side of [1, -1]) {
    const a = side > 0 ? -0.45 : Math.PI + 0.45;
    const back = fp.t.clone().negate().addScaledVector(s.n, side * 0.55).addScaledVector(fp.d, -0.35).normalize();
    const across = surfNormal(s, 0.64, a).cross(back).normalize();
    ps.add(fin(petalShape(), back, across, surf(s, 0.64, a, -0.004), 0.009, seg), { ...o, color: '#9aa7b1' });
  }
}

/** Rounded paddle for the pectoral fins. */
function petalShape(): Shape {
  const s = new Shape();
  s.moveTo(0, -0.012);
  s.splineThru([p2(0.03, -0.018), p2(0.052, -0.004), p2(0.048, 0.014), p2(0.02, 0.014)]);
  s.lineTo(0, 0.012);
  s.closePath();
  return s;
}
