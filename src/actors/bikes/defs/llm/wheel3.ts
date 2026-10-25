// The LLM edition's third wheel (SPEC §21 #2): a small wheel bolted to the top tube, out to the side
// where no wheel belongs, spinning in mid-air. Its axle points forward, so the chase camera sees the
// whole disc. It lives in the 'crank2' group, whose pivot is the wheel's own hub: the animator's turn
// spins it about its axle.
import { Matrix4 } from 'three';
import { cyl, v, type Seg, type V3 } from '../../build/geo';
import type { PartSet } from '../../build/partset';
import { rimGeos, tyreGeo } from '../../parts/tyre';

/** A small wheel: tyre, rim, hub and five fat spokes, all in loud colours. The wheel is built around the
 *  origin with its axle along X, then turned so the axle points along Z (the bike's forward axis). */
export function thirdWheel(ps: PartSet, hub: V3, R: number, tyre: string, rim: string, spoke: string, seg: Seg): void {
  const t = R * 0.18;
  const rOut = R - t * 1.55, rIn = rOut - R * 0.18;
  const parts = [
    { geo: tyreGeo(v(0, 0, 0), R, t, seg(20, 10), seg(6, 4)), color: tyre, outline: 0.012 },
    ...rimGeos(v(0, 0, 0), rOut, rIn, t * 0.72, 'box', seg(20, 10), false).map((g) => ({ geo: g, color: rim, outline: 0.008 })),
    { geo: cyl(v(0, 0, -0.026), v(0, 0, 0.026), 0.013, 0.013, seg(10, 6)), color: '#c3c8d0', outline: 0.006 },
  ];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.4;
    const dir = v(0, Math.sin(a), Math.cos(a));
    parts.push({
      geo: cyl(dir.clone().multiplyScalar(0.016), dir.clone().multiplyScalar(rIn + 0.004), 0.008, 0.008, seg(6, 4)),
      color: spoke, outline: 0.006,
    });
  }
  // Turn the wheel so its axle lies along Z, then move it onto the top tube.
  const turn = new Matrix4().makeRotationY(Math.PI / 2);
  for (const p of parts) {
    p.geo.applyMatrix4(turn);
    p.geo.translate(hub.x, hub.y, hub.z);
    ps.add(p.geo, { color: p.color, outline: p.outline });
  }
}
