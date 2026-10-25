// Frame pieces: lugged tubes, head tube, forks (rigid / suspension), seatpost and saddles.
import { Euler, SphereGeometry, Vector3 } from 'three';
import { box, cyl, ellip, roundRing, sph, tube, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import type { Layout } from './layout';

export interface Look { color: string; paint?: number }

/** Hull widths (m at 6 m): frame/fork silhouette, and the smaller fittings on it. */
const FRAME_OUTLINE = 0.02, FIT_OUTLINE = 0.01;

/** Frame tube a → b with optional ball lugs at both ends (smooth toy joints). */
export function frameTube(ps: PartSet, a: V3, b: V3, r: number, look: Look, seg: Seg, lugs = false, r1 = r): void {
  ps.add(cyl(a, b, r, r1, seg(12, 8)), { color: look.color, paint: look.paint, outline: FRAME_OUTLINE });
  if (lugs) for (const [p, rr] of [[a, r], [b, r1]] as const) lug(ps, p, rr * 1.12, look, seg);
}

export function lug(ps: PartSet, at: V3, r: number, look: Look, seg: Seg): void {
  ps.detail.add(sph(at, r, seg(12, 8), seg(8, 5)), { color: look.color, paint: look.paint, outline: FRAME_OUTLINE });
}

/** Curved frame tube through points (bent top tubes, step-through frames, stays). */
export function bentTube(ps: PartSet, pts: V3[], r: number, look: Look, seg: Seg, tubular = 10): void {
  ps.add(tube(pts, r, seg(tubular, 6), seg(12, 8)), { color: look.color, paint: look.paint, outline: FRAME_OUTLINE });
}

export function headTube(ps: PartSet, L: Layout, r: number, look: Look, seg: Seg, cupColor = '#2b2d33'): void {
  const a = L.headBot.clone().addScaledVector(L.axis, -0.012), b = L.headTop.clone().addScaledVector(L.axis, 0.012);
  ps.add(cyl(a, b, r, r, seg(14, 8)), { color: look.color, paint: look.paint, outline: FRAME_OUTLINE });
  for (const [p, d] of [[a, -1], [b, 1]] as const) {
    ps.detail.add(roundRing(p.clone().addScaledVector(L.axis, d * 0.007), L.axis, r * 0.6, r * 1.08, 0.016, seg(12, 8)), { color: cupColor, outline: FIT_OUTLINE });
  }
}

export interface ForkSpec {
  halfW: number;
  r: number;
  look: Look;
  kind: 'rigid' | 'susp';
  /** Crown look (default: the blades' look). Pass the frame paint to make the crown follow tints. */
  crown?: Look;
  stanchion?: string;
}

/** Fork (steer group): crown under the head tube, blades to the front hub, steerer up to `steererTop`. */
export function fork(ps: PartSet, L: Layout, f: ForkSpec, steererTop: V3, seg: Seg): void {
  const crown = L.headBot.clone().addScaledVector(L.axis, -0.03);
  ps.detail.add(cyl(crown, steererTop, 0.017, 0.017, seg(12, 8)), { color: '#3a3d44', outline: FIT_OUTLINE });
  const crownLook = f.crown ?? f.look;
  // Rounded crown flush with the blades' outer faces (no bar sticking out past them).
  const shoulders = ellip(crown.clone().addScaledVector(L.axis, 0.004), f.halfW + f.r * 0.95, f.r * 1.35, f.r * 1.7, seg(12, 8), seg(8, 5), new Euler(L.rake, 0, 0));
  ps.add(shoulders, { color: crownLook.color, paint: crownLook.paint, outline: FRAME_OUTLINE });
  for (const s of [-1, 1]) {
    const top = crown.clone().setX(s * f.halfW);
    const hub = L.hubF.clone().setX(s * f.halfW);
    if (f.kind === 'rigid') {
      const mid = top.clone().lerp(hub, 0.55).add(new Vector3(0, 0, -0.012));
      ps.add(tube([top, mid, hub], f.r, seg(6, 4), seg(12, 8)), { color: f.look.color, paint: f.look.paint, outline: FRAME_OUTLINE });
    } else {
      const knee = top.clone().lerp(hub, 0.42);
      ps.add(cyl(top, knee, f.r * 0.8, f.r * 0.8, seg(12, 8)), { color: f.stanchion ?? '#d9b44a', outline: 0.012 });
      ps.add(cyl(knee.clone().lerp(top, 0.12), hub, f.r * 1.25, f.r * 1.05, seg(12, 8), true), { color: f.look.color, paint: f.look.paint, outline: FRAME_OUTLINE });
    }
    ps.detail.add(sph(hub, f.r * 1.1, seg(6, 5), seg(4, 3)), { color: '#3a3d44', outline: 0.008 });
  }
  ps.detail.add(cyl(L.hubF.clone().setX(-f.halfW), L.hubF.clone().setX(f.halfW), 0.0075, 0.0075, seg(6, 5)), { color: '#8d939c' });
  if (f.kind === 'susp') {
    const k = (t: number, s: number): V3 => crown.clone().setX(s * f.halfW).lerp(L.hubF.clone().setX(s * f.halfW), t);
    ps.add(tube([k(0.5, -1).add(v(0, 0, -0.02)), k(0.47, 0).setX(0).add(v(0, 0.025, -0.045)), k(0.5, 1).add(v(0, 0, -0.02))], f.r * 0.8, seg(8, 4), seg(10, 6)), { color: f.look.color, paint: f.look.paint, outline: 0.012 });
  }
}

/** Seatpost along the seat line from the seat cluster up to just under the saddle top. */
export function seatpost(ps: PartSet, L: Layout, fromY: number, r: number, color: string, seg: Seg): void {
  ps.add(cyl(L.seat(fromY), L.seat(L.saddle.y - 0.035), r, r, seg(12, 8)), { color, outline: 0.012 });
}

export type SaddleKind = 'road' | 'wide' | 'kid';

const SADDLES: Record<SaddleKind, { rx: number; ry: number; rz: number; taper: number; kick: number }> = {
  road: { rx: 0.068, ry: 0.036, rz: 0.135, taper: 0.3, kick: 0.016 },
  wide: { rx: 0.104, ry: 0.048, rz: 0.118, taper: 0.52, kick: 0.01 },
  kid: { rx: 0.072, ry: 0.042, rz: 0.09, taper: 0.58, kick: 0.006 },
};

/** Saddle shell (deformed sphere: tapering nose, kicked-up tail, flat underside) with a clamp block;
 *  `top` = where the rider's pelvis sits. */
export function saddle(ps: PartSet, top: V3, kind: SaddleKind, color: string, seg: Seg): void {
  const k = SADDLES[kind];
  const g = new SphereGeometry(1, seg(14, 9), seg(8, 6));
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = Math.max(0, -z);
    const sx = 1 - (1 - k.taper) * Math.pow(t, 1.3);
    // Puffy cushion: domed top, softly rounded underside, nose dips a little, tail kicks up.
    const yy = (y > 0 ? Math.pow(y, 0.8) : y * 0.62) * k.ry + k.kick * Math.max(0, z) ** 2 - 0.006 * t;
    p.setXYZ(i, x * k.rx * sx, yy, z * k.rz);
  }
  g.computeVertexNormals();
  g.translate(top.x, top.y - k.ry, top.z + k.rz * 0.2);
  ps.add(g, { color, outline: 0.014 });
  ps.detail.add(box(v(top.x, top.y - k.ry * 1.62 - 0.004, top.z + 0.01), 0.03, 0.018, 0.052), { color: '#3a3d44', outline: 0.006 });
}
