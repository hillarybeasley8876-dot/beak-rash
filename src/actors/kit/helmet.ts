// Cycling helmets as a smooth parametric shell (outside any SDF budget): domed ellipsoid with an aero tail
// (or round), a dark rolled rim band, a small visor lip over the eyes, crisp dark vent slots and a centre
// stripe laid on the shell as decal ribbons, and a dark inner liner so a popped-off helmet reads as a shell.
// Everything rides the `hat` bone. Chin straps stay in kit/gear.ts.
import { Color, Vector3 } from 'three';
import type { CharacterBuilder } from './builder';
import type { V3 } from './sdf';
import { B } from '../rig/skeleton';

export interface HelmetOpts {
  c: V3;            // shell centre
  r: V3;            // shell radii (domed helmets: r[1] ≈ 0.8·r[0])
  pitch: number;    // forward tilt (rad, + = front down; − lifts the front rim above the eyes)
  color: number;
  stripe?: number;  // centre stripe colour
  vent?: number;    // vent slot / rim / liner colour
  /** Round kids'/skate helmet (no aero tail). */
  round?: boolean;
  /** Citrus-peel shell (the capybara's yuzu helmet): no vents, stripe or visor; dimples in this colour instead. */
  peel?: number;
  /** Chin strap from both rim sides to a point under the chin. */
  strap?: { chin: V3; color?: number };
  /** Detail: 1 = hero (more segments). */
  detail?: number;
}

/** Local shell point for a unit direction d (ellipsoid + aero tail), before pitch/translation. */
function shellAt(o: HelmetOpts, d: Vector3, out: Vector3): Vector3 {
  const [rx, ry, rz] = o.r;
  let y = ry * d.y, z = rz * d.z;
  if (!o.round && d.z > 0) {
    const k = d.z * d.z;
    z *= 1 + 0.34 * k * (0.6 + 0.4 * Math.max(0, d.y));
    y -= ry * 0.2 * k * Math.max(0, 0.6 - d.y);
  }
  return out.set(rx * d.x, y, z);
}

const t1 = new Vector3(), t2 = new Vector3(), pa = new Vector3(), pb = new Vector3(), dd = new Vector3();

/** World point + outward normal of the shell at direction d, lifted `lift` metres along the normal. */
function surf(o: HelmetOpts, d: Vector3, lift: number, scale: number, pos: number[], nrm: number[]): void {
  const p = shellAt(o, d, new Vector3()).multiplyScalar(scale);
  t1.set(0, 1, 0).cross(d);
  if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
  t1.normalize();
  t2.crossVectors(d, t1);
  shellAt(o, dd.copy(d).addScaledVector(t1, 1e-3).normalize(), pa).multiplyScalar(scale).sub(p);
  shellAt(o, dd.copy(d).addScaledVector(t2, 1e-3).normalize(), pb).multiplyScalar(scale).sub(p);
  const n = pa.cross(pb).normalize();
  if (n.dot(p) < 0) n.negate();
  p.addScaledVector(n, lift);
  const ca = Math.cos(-o.pitch), sa = Math.sin(-o.pitch);
  const rot = (v: Vector3): Vector3 => v.set(v.x, v.y * ca - v.z * sa, v.y * sa + v.z * ca);
  rot(p).add(new Vector3(o.c[0], o.c[1], o.c[2]));
  rot(n);
  pos.push(p.x, p.y, p.z);
  nrm.push(n.x, n.y, n.z);
}

/** Grid of directions dir(i, j) → triangles (flip = inward winding); `scale` may vary per grid point. */
function grid(b: CharacterBuilder, o: HelmetOpts, ni: number, nj: number, dir: (i: number, j: number, out: Vector3) => Vector3,
  color: number, opts: { lift?: number; scale?: number | ((i: number, j: number) => number); flip?: boolean; outline?: number }): void {
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  const d = new Vector3(), sc = opts.scale ?? 1;
  for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) surf(o, dir(i, j, d), opts.lift ?? 0, typeof sc === 'number' ? sc : sc(i, j), pos, nrm);
  const at = (i: number, j: number): number => i * (nj + 1) + j;
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const a = at(i, j), bq = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1);
    if (opts.flip) idx.push(a, bq, c, a, c, e); else idx.push(a, e, c, a, c, bq);
  }
  if (opts.flip) for (let k = 0; k < nrm.length; k++) nrm[k] = -(nrm[k] ?? 0);
  b.raw(new Float32Array(pos), new Float32Array(nrm), new Uint32Array(idx), () => color, () => [[B.hat, 1]], opts.outline ?? 0);
}

const RIM_COS = -0.3;
type Sph = (th: number, ph: number, out: Vector3) => Vector3;

/** Visor lip: a short peak over the eyes flaring out of the front rim (shell colour on top, dark underneath). */
function addVisor(b: CharacterBuilder, o: HelmetOpts, thBand: number, dark: number, sph: Sph): void {
  const lipDir = (i: number, j: number, out: Vector3): Vector3 => sph(thBand - 0.03 + i * 0.06, (j / 8 - 0.5) * 1.9, out);
  const lipOut = (i: number, j: number): number => 1.01 + i * 0.17 * Math.sqrt(Math.max(0, Math.cos((j / 8 - 0.5) * Math.PI)));
  grid(b, o, 1, 8, lipDir, o.color, { outline: 0.6, scale: lipOut });
  grid(b, o, 1, 8, lipDir, dark, { scale: (i, j) => lipOut(i, j) - 0.012, flip: true });
}

/** Citrus peel: small darker dimples spread evenly (golden-angle spiral) over the dome. */
function addPeel(b: CharacterBuilder, o: HelmetOpts, sph: Sph, thMax: number): void {
  const n = 22, ga = Math.PI * (3 - Math.sqrt(5)), c = new Vector3(), t1 = new Vector3(), t2 = new Vector3();
  for (let k = 0; k < n; k++) {
    const th = Math.acos(1 - (k + 0.5) / n * (1 - Math.cos(thMax))), ph = k * ga;
    sph(th, ph, c);
    t1.set(0, 1, 0).cross(c);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    t2.crossVectors(c, t1);
    const r = 0.045 + 0.02 * ((k * 7) % 3) / 2;
    grid(b, o, 1, 6, (i, j, out) => {
      const a = (j / 6) * Math.PI * 2;
      return out.copy(c).addScaledVector(t1, Math.cos(a) * r * i).addScaledVector(t2, Math.sin(a) * r * i).normalize();
    }, o.peel ?? o.color, { lift: 0.0015 });
  }
}

export function addShellHelmet(b: CharacterBuilder, o: HelmetOpts): void {
  const hi = (o.detail ?? 0) >= 1, nt = hi ? 9 : 7, np = hi ? 24 : 20;
  // Vents/rim/liner default to a deep shade of the shell colour (black slots on yellow read as tiger stripes).
  const dark = o.vent ?? new Color(o.color).lerp(new Color(0x16161c), 0.72).getHex(), thRim = Math.acos(RIM_COS), thBand = thRim - 0.16;
  const sph = (th: number, ph: number, out: Vector3): Vector3 => out.set(Math.sin(th) * Math.sin(ph), Math.cos(th), -Math.sin(th) * Math.cos(ph));
  // Shell, rim band (dark rolled edge) and inner liner.
  grid(b, o, nt, np, (i, j, out) => sph((i / nt) * thBand, (j / np) * Math.PI * 2, out), o.color, { outline: 1 });
  grid(b, o, 1, np, (i, j, out) => sph(thBand + i * (thRim - thBand), (j / np) * Math.PI * 2, out), dark, { outline: 1, scale: 1.004 });
  grid(b, o, 3, 10, (i, j, out) => sph((i / 3) * thRim, (j / 10) * Math.PI * 2, out), dark, { scale: 0.9, flip: true });
  if (o.peel === undefined) addVisor(b, o, thBand, dark, sph);
  // Vent slots and the centre stripe: constant-width decal ribbons with rounded ends, front → back over the dome.
  const ribbon = (x: number, w: number, b0: number, b1: number, color: number): void => {
    const end = Math.min(0.5, w / Math.abs(b1 - b0));
    grid(b, o, 1, 12, (i, j, out) => {
      const t = j / 12, beta = b0 + (b1 - b0) * t, k = Math.max(0, Math.abs(2 * t - 1) - (1 - 2 * end)) / (2 * end);
      const half = w * Math.sqrt(Math.max(0, 1 - k * k)) * (i ? 1 : -1);
      const dx = x + half, r = Math.sqrt(Math.max(0, 1 - dx * dx));
      return out.set(dx, r * Math.cos(beta), r * Math.sin(beta));
    }, color, { lift: 0.0018 });
  };
  if (o.peel !== undefined) {
    addPeel(b, o, sph, thBand - 0.15);
    return;
  }
  const slots = o.round ? [-0.3, 0.3] : [-0.58, -0.25, 0.25, 0.58];
  for (const x of slots) ribbon(x, o.round ? 0.065 : 0.05, o.round ? -0.45 : -0.75, o.round ? 0.3 : 0.25, dark);
  if (o.stripe !== undefined) ribbon(0, 0.05, -1.2, 1.2, o.stripe);
}
