// The LLM edition's handlebar (SPEC §21 #2): a drop bar mounted backwards — the ends hook back towards
// the rider instead of forward — and far too wide, so it reaches out past the body and past the paws.
// The grip markers sit in the middle of the long grip sleeves, so the paws still hold the bar and the
// sleeves still poke out past them.
import { Vector3 } from 'three';
import { ellip, pill, sph, tube, v, type Seg, type V3 } from '../../build/geo';
import type { PartSet } from '../../build/partset';

const OUTLINE = 0.014;
const mirror = (p: V3): V3 => new Vector3(-p.x, p.y, p.z);

export interface LlmBar {
  gripL: V3;
  gripR: V3;
  bell: V3;
}

/** The right half of the bar: out to the side, then hooked back towards the rider and up. */
function half(halfW: number): V3[] {
  return [
    v(0, 0, 0),
    v(0.12, 0, 0.004),
    v(0.28, 0.002, 0.012),
    v(halfW - 0.06, 0.004, 0.022),
    v(halfW, 0.006, 0.055),
    v(halfW, 0.012, 0.105),
    v(halfW * 0.96, 0.022, 0.145),
  ];
}

/** A backwards, much too wide bar. `c` is the bar's centre (the stem's clamp); `gripW` is where the paws
 *  hold it, `halfW` how far the bar itself reaches. */
export function llmBar(ps: PartSet, c: V3, halfW: number, gripW: number, color: string, gripColor: string, seg: Seg): LlmBar {
  const right = half(halfW);
  const pts = [...right.slice(1).reverse().map(mirror), ...right].map((p) => p.clone().add(c));
  ps.add(tube(pts, 0.022, seg(40, 16), seg(7, 5)), { color, outline: OUTLINE });
  for (const s of [-1, 1]) {
    // A long grip sleeve along the bar: the paw holds it in the middle and its end sticks out past the paw.
    const a = c.clone().add(v(s * (gripW - 0.14), 0.002, 0.006));
    const b = c.clone().add(v(s * (halfW - 0.015), 0.005, 0.026));
    ps.add(pill(a, b, 0.023, seg(10, 6)), { color: gripColor, outline: OUTLINE });
    // A brake lever pointing the wrong way (backwards) and a hood on the wrong end of it.
    const g = c.clone().add(v(s * gripW, 0.012, 0.012));
    ps.detail.add(ellip(g.clone().add(v(0, 0.022, -0.012)), 0.02, 0.026, 0.038, seg(10, 8), seg(6, 4)), { color: '#2b2d33', outline: 0.01 });
    ps.detail.add(tube([g.clone().add(v(0, 0.014, 0.02)), g.clone().add(v(s * 0.05, 0.016, 0.055)), g.clone().add(v(s * 0.09, 0.014, 0.07))], 0.006, seg(6, 4), seg(6, 4)), { color: '#c3c8d0', outline: 0.005 });
    // A bar-end plug: the tube's open end would show as a hole.
    const tip = c.clone().add(v(s * halfW * 0.96, 0.022, 0.145));
    ps.add(sph(tip, 0.024, seg(10, 8), seg(6, 4)), { color, outline: OUTLINE });
  }
  return {
    gripL: c.clone().add(v(-gripW, 0.014, 0.012)),
    gripR: c.clone().add(v(gripW, 0.014, 0.012)),
    bell: c.clone().add(v(-0.07, 0.016, 0.01)),
  };
}
