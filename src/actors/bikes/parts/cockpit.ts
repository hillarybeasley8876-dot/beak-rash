// Cockpit (steer group, bike space): stems, the four handlebar styles, grips, levers and the bell.
// Every bar returns the exact grip centres (→ gripL/gripR markers), a bell mount point and where the brake
// housings leave the levers / hoods (→ parts/cables.ts).
import { Euler, Vector3 } from 'three';
import { cyl, ellip, lathe, pill, roundRing, sph, tube, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';

export interface BarResult {
  gripL: V3;
  gripR: V3;
  bell: V3;
  /** Outer grip ends (flat / swept bars): streamer and bar-end mounts. */
  endL?: V3;
  endR?: V3;
  /** Brake-housing exits at the left / right lever or hood (bars with levers only). */
  cableL?: V3;
  cableR?: V3;
}

/** Bars that always carry brake levers / hoods. */
export interface LeverBar extends BarResult { cableL: V3; cableR: V3 }

const BAR_OUTLINE = 0.012;
const mirror = (p: V3): V3 => new Vector3(-p.x, p.y, p.z);

/** One symmetric tube through the right-half points (centre → end), mirrored to the left. */
function symTube(ps: PartSet, c: V3, right: V3[], r: number, color: string, seg: Seg, tubular: number): void {
  const pts = [...right.slice(1).reverse().map(mirror), ...right].map((p) => p.clone().add(c));
  ps.add(tube(pts, r, seg(tubular, 16), seg(6, 5)), { color, outline: BAR_OUTLINE });
}

/** Rubber grip from a (inner, with a collar) to b (domed end), radius r. */
function grip(ps: PartSet, a: V3, b: V3, r: number, color: string, seg: Seg): void {
  const dir = b.clone().sub(a), len = dir.length();
  const prof: Array<[number, number]> = [[0, 0], [r * 1.14, 0.002], [r * 1.14, 0.01], [r, 0.014], [r, len - 0.012], [r * 0.75, len - 0.002], [0, len]];
  ps.add(lathe(prof, seg(12, 8), a, dir.normalize()), { color, outline: BAR_OUTLINE });
}

export function stem(ps: PartSet, from: V3, to: V3, color: string, seg: Seg): void {
  const o = { color, outline: BAR_OUTLINE };
  ps.add(cyl(from, to, 0.017, 0.016, seg(10, 6)), o);
  ps.add(pill(to.clone().setX(-0.03), to.clone().setX(0.03), 0.021, seg(10, 6)), o);
  ps.add(roundRing(from, v(0, 1, 0), 0.012, 0.021, 0.018, seg(10, 6)), o);
}

export function dropBar(ps: PartSet, c: V3, halfW: number, tape: string, seg: Seg): LeverBar {
  const w = halfW;
  symTube(ps, c, [v(0, 0, 0), v(w * 0.55, 0, 0), v(w, 0, -0.03), v(w, -0.012, -0.075), v(w, -0.07, -0.098), v(w, -0.122, -0.068), v(w, -0.132, -0.01), v(w, -0.126, 0.04)], 0.0145, tape, seg, 44);
  for (const s of [-1, 1]) {
    const hood = c.clone().add(v(s * w, 0.016, -0.06));
    ps.add(ellip(hood, 0.019, 0.024, 0.04, seg(10, 8), seg(6, 4), new Euler(-0.25, 0, 0)), { color: '#2b2d33', outline: 0.01 });
    ps.add(tube([c.clone().add(v(s * w, -0.004, -0.088)), c.clone().add(v(s * w, -0.06, -0.09)), c.clone().add(v(s * w, -0.1, -0.078))], 0.0068, seg(6, 4), seg(6, 4)), { color: '#c3c8d0', outline: 0.006 });
  }
  const exit = (s: number): V3 => c.clone().add(v(s * (w - 0.015), 0.022, -0.07));
  return { gripL: c.clone().add(v(-w, 0.016, -0.056)), gripR: c.clone().add(v(w, 0.016, -0.056)), bell: c.clone().add(v(-0.075, 0.016, 0)), cableL: exit(-1), cableR: exit(1) };
}

export function bullhorn(ps: PartSet, c: V3, halfW: number, color: string, gripColor: string, seg: Seg): BarResult {
  const w = halfW;
  symTube(ps, c, [v(0, 0, 0), v(w * 0.6, 0, 0), v(w, 0.002, -0.03), v(w + 0.004, 0.02, -0.085), v(w, 0.045, -0.135)], 0.0125, color, seg, 32);
  for (const s of [-1, 1]) grip(ps, c.clone().add(v(s * (w + 0.003), 0.012, -0.065)), c.clone().add(v(s * w, 0.047, -0.139)), 0.018, gripColor, seg);
  return { gripL: c.clone().add(v(-w - 0.002, 0.03, -0.1)), gripR: c.clone().add(v(w + 0.002, 0.03, -0.1)), bell: c.clone().add(v(-0.07, 0.016, 0)) };
}

/** Flat / riser bar; grips at the ends, a brake lever inboard of each grip. */
export function flatBar(ps: PartSet, c: V3, halfW: number, rise: number, color: string, gripColor: string, seg: Seg): LeverBar {
  const w = halfW;
  symTube(ps, c, [v(0, 0, 0), v(0.07, 0.004, 0.002), v(0.13, rise * 0.8, 0.012), v(w, rise, 0.03)], 0.0135, color, seg, 20);
  const dir = v(w - 0.13, rise * 0.2, 0.018).normalize();
  const end = v(w, rise, 0.03);
  const m = (s: number, k: number): V3 => c.clone().add(new Vector3(s * end.x, end.y, end.z)).addScaledVector(new Vector3(s * dir.x, dir.y, dir.z), k);
  const side = (s: 1 | -1): V3 => {
    grip(ps, m(s, -0.098), m(s, 0.014), 0.0205, gripColor, seg);
    return leverAt(ps, m(s, -0.104), s, seg);
  };
  const cableL = side(-1), cableR = side(1);
  return { gripL: m(-1, -0.045), gripR: m(1, -0.045), bell: c.clone().add(v(-0.085, 0.02, 0.004)), endL: m(-1, 0.012), endR: m(1, 0.012), cableL, cableR };
}

/** Swept-back roadster / city bar; grips point back toward the rider. `levers` adds brake levers. */
export function sweptBar(ps: PartSet, c: V3, halfW: number, back: number, rise: number, color: string, gripColor: string, seg: Seg, levers = false): BarResult {
  const w = halfW;
  const right = [v(0, 0, 0), v(0.09, rise * 0.25, -0.012), v(w * 0.78, rise * 0.85, back * 0.35), v(w, rise, back)];
  symTube(ps, c, right, 0.0125, color, seg, 24);
  const dir = (right[3] as V3).clone().sub(right[2] as V3).normalize();
  const grips: V3[] = [], exits: V3[] = [];
  for (const s of [-1, 1]) {
    const d = new Vector3(s * dir.x, dir.y, dir.z);
    const e = c.clone().add(new Vector3(s * w, rise, back)).addScaledVector(d, 0.015);
    const b0 = e.clone().addScaledVector(d, -0.11);
    grip(ps, b0, e, 0.021, gripColor, seg);
    grips.push(b0.clone().lerp(e, 0.5));
    if (levers) exits.push(leverAt(ps, b0.clone().addScaledVector(d, -0.006), s, seg));
  }
  return { gripL: grips[0] as V3, gripR: grips[1] as V3, bell: c.clone().add(v(-0.1, rise * 0.3 + 0.016, -0.01)), cableL: exits[0], cableR: exits[1] };
}

/** Brake lever: round clamp + a capsule blade reaching forward of the grip with a ball end. Returns the
 *  housing exit (front of the clamp). */
export function leverAt(ps: PartSet, at: V3, s: number, seg: Seg, color = '#2b2d33'): V3 {
  ps.add(cyl(at, at.clone().add(v(0, 0.018, -0.012)), 0.011, 0.011, seg(10, 6), true), { color, outline: 0.006 });
  const p0 = at.clone().add(v(0, 0.012, -0.022)), p1 = at.clone().add(v(s * 0.045, 0.012, -0.04)), p2 = at.clone().add(v(s * 0.088, 0.006, -0.042));
  ps.add(tube([p0, p1, p2], 0.0055, seg(6, 4), seg(6, 4)), { color: '#c3c8d0', outline: 0.005 });
  ps.add(sph(p2, 0.0085, seg(6, 5), seg(4, 3)), { color: '#c3c8d0', outline: 0.005 });
  return at.clone().add(v(-s * 0.004, 0.016, -0.02));
}

/** Classic thumb bell on top of the bar at `at`: lathed dome, post and a round-ended thumb lever. */
export function bell(ps: PartSet, at: V3, color: string, seg: Seg): void {
  ps.add(lathe([[0.028, 0.0], [0.026, 0.008], [0.022, 0.019], [0.014, 0.029], [0.006, 0.0335], [0.0, 0.034]], seg(14, 9), at.clone().add(v(0, 0.012, 0)), new Vector3(0, 1, 0)), { color, outline: 0.006 });
  ps.add(cyl(at.clone().add(v(0, -0.004, 0)), at.clone().add(v(0, 0.014, 0)), 0.008, 0.008, seg(8, 6)), { color: '#55585f' });
  const l0 = at.clone().add(v(0.012, 0.016, 0)), l1 = at.clone().add(v(0.034, 0.024, 0.004));
  ps.add(tube([l0, l0.clone().lerp(l1, 0.5).add(v(0, 0.002, 0)), l1], 0.0042, 4, seg(6, 4)), { color: '#55585f', outline: 0.003 });
  ps.add(sph(l1, 0.0062, seg(6, 5), seg(4, 3)), { color: '#55585f', outline: 0.003 });
}
