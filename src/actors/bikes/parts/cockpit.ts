// Cockpit (steer group, bike space): stems, the five handlebar styles, grips, levers and the bell.
// Every bar returns the exact grip centres (→ gripL/gripR markers) and a bell mount point.
import { Vector3 } from 'three';
import { bar, cyl, ellip, lathe, tube, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';

export interface BarResult {
  gripL: V3;
  gripR: V3;
  bell: V3;
  /** Outer grip ends (flat / swept bars): streamer and bar-end mounts. */
  endL?: V3;
  endR?: V3;
}

const mirror = (p: V3): V3 => new Vector3(-p.x, p.y, p.z);

/** One symmetric tube through the right-half points (centre → end), mirrored to the left. */
function symTube(ps: PartSet, c: V3, right: V3[], r: number, color: string, seg: Seg, tubular: number): void {
  const pts = [...right.slice(1).reverse().map(mirror), ...right].map((p) => p.clone().add(c));
  ps.add(tube(pts, r, seg(tubular, 10), seg(6, 4)), { color, outline: 0.007 });
}

export function stem(ps: PartSet, from: V3, to: V3, color: string, seg: Seg): void {
  ps.add(cyl(from, to, 0.017, 0.016, seg(8, 5)), { color, outline: 0.007 });
  ps.add(cyl(to.clone().setX(-0.028), to.clone().setX(0.028), 0.021, 0.021, seg(8, 5), true), { color, outline: 0.007 });
  ps.add(cyl(from.clone().setY(from.y - 0.008), from.clone().setY(from.y + 0.008), 0.02, 0.02, seg(8, 5), true), { color, outline: 0.007 });
}

export function dropBar(ps: PartSet, c: V3, halfW: number, tape: string, seg: Seg): BarResult {
  const w = halfW;
  symTube(ps, c, [v(0, 0, 0), v(w * 0.55, 0, 0), v(w, 0, -0.03), v(w, -0.012, -0.075), v(w, -0.07, -0.098), v(w, -0.122, -0.068), v(w, -0.132, -0.01), v(w, -0.126, 0.04)], 0.0125, tape, seg, 20);
  for (const s of [-1, 1]) {
    const hood = c.clone().add(v(s * w, 0.014, -0.058));
    ps.add(ellip(hood, 0.017, 0.022, 0.034, seg(6, 5), seg(4, 3)), { color: '#2b2d33', outline: 0.006 });
    ps.add(cyl(c.clone().add(v(s * w, -0.004, -0.088)), c.clone().add(v(s * w, -0.1, -0.078)), 0.0075, 0.006, seg(5, 4)), { color: '#c3c8d0', outline: 0.004 });
  }
  return { gripL: c.clone().add(v(-w, 0.016, -0.056)), gripR: c.clone().add(v(w, 0.016, -0.056)), bell: c.clone().add(v(-0.075, 0.016, 0)) };
}

export function bullhorn(ps: PartSet, c: V3, halfW: number, color: string, grip: string, seg: Seg): BarResult {
  const w = halfW;
  symTube(ps, c, [v(0, 0, 0), v(w * 0.6, 0, 0), v(w, 0.002, -0.03), v(w + 0.004, 0.02, -0.085), v(w, 0.045, -0.135)], 0.0125, color, seg, 22);
  for (const s of [-1, 1]) {
    ps.add(cyl(c.clone().add(v(s * (w + 0.003), 0.012, -0.065)), c.clone().add(v(s * w, 0.047, -0.137)), 0.019, 0.017, seg(8, 5), true), { color: grip, outline: 0.007 });
  }
  return { gripL: c.clone().add(v(-w - 0.002, 0.03, -0.1)), gripR: c.clone().add(v(w + 0.002, 0.03, -0.1)), bell: c.clone().add(v(-0.07, 0.016, 0)) };
}

/** Flat / riser bar; grips at the ends. */
export function flatBar(ps: PartSet, c: V3, halfW: number, rise: number, color: string, grip: string, seg: Seg): BarResult {
  const w = halfW;
  symTube(ps, c, [v(0, 0, 0), v(0.07, 0.004, 0.002), v(0.13, rise * 0.8, 0.012), v(w, rise, 0.03)], 0.0135, color, seg, 12);
  const dir = v(w - 0.13, rise * 0.2, 0.018).normalize();
  const end = v(w, rise, 0.03);
  for (const s of [-1, 1]) {
    const e = c.clone().add(new Vector3(s * end.x, end.y, end.z)).addScaledVector(new Vector3(s * dir.x, dir.y, dir.z), 0.012);
    const b0 = e.clone().addScaledVector(new Vector3(s * dir.x, dir.y, dir.z), -0.11);
    ps.add(cyl(b0, e, 0.02, 0.021, seg(8, 5), true), { color: grip, outline: 0.007 });
    leverAt(ps, b0.clone().addScaledVector(new Vector3(s * dir.x, dir.y, dir.z), -0.006), s, seg);
  }
  const m = (s: number, k: number): V3 => c.clone().add(new Vector3(s * end.x, end.y, end.z)).addScaledVector(new Vector3(s * dir.x, dir.y, dir.z), k);
  return { gripL: m(-1, -0.045), gripR: m(1, -0.045), bell: c.clone().add(v(-0.085, 0.02, 0.004)), endL: m(-1, 0.012), endR: m(1, 0.012) };
}

/** Swept-back roadster / city bar; grips point back toward the rider. */
export function sweptBar(ps: PartSet, c: V3, halfW: number, back: number, rise: number, color: string, grip: string, seg: Seg): BarResult {
  const w = halfW;
  const right = [v(0, 0, 0), v(0.09, rise * 0.25, -0.012), v(w * 0.78, rise * 0.85, back * 0.35), v(w, rise, back)];
  symTube(ps, c, right, 0.0125, color, seg, 14);
  const dir = (right[3] as V3).clone().sub(right[2] as V3).normalize();
  const grips: V3[] = [];
  for (const s of [-1, 1]) {
    const d = new Vector3(s * dir.x, dir.y, dir.z);
    const e = c.clone().add(new Vector3(s * w, rise, back)).addScaledVector(d, 0.015);
    const b0 = e.clone().addScaledVector(d, -0.11);
    ps.add(cyl(b0, e, 0.02, 0.022, seg(8, 5), true), { color: grip, outline: 0.007 });
    grips.push(b0.clone().lerp(e, 0.5));
  }
  return { gripL: grips[0] as V3, gripR: grips[1] as V3, bell: c.clone().add(v(-0.1, rise * 0.3 + 0.016, -0.01)) };
}

/** Flat-bar brake lever: clamp + blade reaching forward of the grip. */
export function leverAt(ps: PartSet, at: V3, s: number, seg: Seg, color = '#2b2d33'): void {
  ps.add(cyl(at.clone().add(v(0, 0, 0)), at.clone().add(v(0, 0.018, -0.012)), 0.011, 0.011, seg(6, 4), true), { color, outline: 0.005 });
  ps.add(bar(at.clone().add(v(0, 0.012, -0.02)), at.clone().add(v(s * 0.085, 0.004, -0.045)), 0.008, 0.016), { color: '#c3c8d0', outline: 0.004 });
}

/** Classic thumb bell on top of the bar at `at`. */
export function bell(ps: PartSet, at: V3, color: string, seg: Seg): void {
  ps.add(lathe([[0.028, 0.0], [0.024, 0.016], [0.014, 0.03], [0.001, 0.034]], seg(8, 6), at.clone().add(v(0, 0.012, 0)), new Vector3(0, 1, 0)), { color, outline: 0.006 });
  ps.add(cyl(at.clone().add(v(0, -0.004, 0)), at.clone().add(v(0, 0.014, 0)), 0.008, 0.008, 5), { color: '#55585f' });
  ps.add(bar(at.clone().add(v(0.012, 0.016, 0)), at.clone().add(v(0.034, 0.024, 0.004)), 0.006, 0.01), { color: '#55585f', outline: 0.003 });
}
