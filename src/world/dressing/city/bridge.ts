// Red-arch bridge after dark: a neon tube along the outer face of each arch rib, warm bulbs on the
// rib tops and a cyan line under the parapets (mirrors the rib curve of features/bridge.ts).
import { Matrix4, Vector3 } from 'three';
import { box, trs } from '../../kit/shapes';
import type { City } from './city';
import { quadToward } from './geo';
import { hdr } from './util';

const APEX = 19, PYLON_AT = 0.6, RIB_W = 0.8, RIB_D = 1.3;
const m = new Matrix4();
const A = new Vector3(), B = new Vector3(), C = new Vector3(), D = new Vector3();

export function bridgeLights(c: City): void {
  const { ctx, field, b } = c.d;
  const { q } = ctx;
  const tube = hdr('#22e8ff', 2.6), bulb = hdr('#ffe2a8', 2.8), line = hdr('#ff2d95', 2.4);
  for (const f of ctx.L.features.filter((ft) => ft.kind === 'bridge')) {
    const sA = f.s0 + PYLON_AT, sB = f.s1 - PYLON_AT, span = sB - sA;
    const h = (t: number): number => 4 * APEX * t * (1 - t) + 1.2;
    for (const side of [-1, 1] as const) {
      const SEG = 40;
      for (let i = 0; i < SEG; i++) {
        const t0 = i / SEG, t1 = (i + 1) / SEG;
        const s0 = sA + span * t0, s1 = sA + span * t1;
        const fr = q.frameVis(s0);
        // Tubes on both rib faces: the outer one reads from the riverside, the inner from the deck.
        for (const face of [1, -1] as const) {
          const xAt = (s: number): number => side * (field.bound(s, side) + 1.0 + face * (RIB_W / 2 + 0.03));
          const facing = new Vector3(fr.right.x * side * face, 0, fr.right.z * side * face);
          q.toWorld(s0, xAt(s0), h(t0) - 0.14, A); q.toWorld(s1, xAt(s1), h(t1) - 0.14, B);
          q.toWorld(s1, xAt(s1), h(t1) + 0.14, C); q.toWorld(s0, xAt(s0), h(t0) + 0.14, D);
          quadToward(b.glow.at(A.x, A.z), A, B, C, D, tube, facing);
        }
        if (i % 2 === 0) {
          const p = q.toWorld(s0, side * (field.bound(s0, side) + 1.0), h(t0) + RIB_D / 2 + 0.16, new Vector3());
          box(b.glow.at(p.x, p.z), trs(p.x, p.y, p.z, 0, 0.32, 0.32, 0.32, m), bulb);
        }
      }
      // Pink line along the deck fascia, just under the parapet.
      for (let s = f.s0; s < f.s1; s += 3) {
        const s1 = Math.min(f.s1, s + 3);
        const fr = q.frameVis(s);
        const facing = new Vector3(fr.right.x * side, 0, fr.right.z * side);
        const x = side * (field.bound(s, side) + 0.43);
        q.toWorld(s, x, -0.5, A); q.toWorld(s1, x, -0.5, B); q.toWorld(s1, x, -0.38, C); q.toWorld(s, x, -0.38, D);
        quadToward(b.glow.at(A.x, A.z), A, B, C, D, line, facing);
      }
    }
  }
}
