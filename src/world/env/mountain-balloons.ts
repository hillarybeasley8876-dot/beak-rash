// Sunset Pass hot-air balloons (env-mountain): striped envelopes with baskets drifting slowly over
// the lake — one GPU-animated mesh (slow loop drift + bob per balloon).
import { BufferAttribute, Color, Matrix4, Sphere, Vector3 } from 'three';
import type { Rng } from '../../core/rng';
import type { WorldCtx } from '../ctx';
import { MeshBuf } from '../geom';
import { box, cylinder, trs } from '../kit/shapes';
import { animatedMesh } from './mountain-anim';

const C = (h: string): Color => new Color(h);
const SCHEMES: Array<[Color, Color]> = [
  [C('#e5191c'), C('#f6f1e8')], [C('#ffcf3a'), C('#ff7a2a')], [C('#2f6fd6'), C('#ffcf3a')],
  [C('#16151a'), C('#e5191c')], [C('#3fae5a'), C('#f6f1e8')], [C('#ff5fa2'), C('#ffd84a')],
];
const BASKET = C('#8a5a36'), ROPE = C('#3a2c26'), BURNER = C('#4a4550');
const m = new Matrix4(), p = new Vector3(), n = new Vector3();

/** Envelope: a teardrop of revolution with vertical gore stripes (two alternating colours). */
function envelope(buf: MeshBuf, c: Vector3, r: number, cols: [Color, Color]): void {
  const segs = 16, rings = 10;
  const prof = (v: number): [number, number] => {
    // v 0 (top) → 1 (mouth): radius bulges near the top, tapers to the mouth.
    const a = v * Math.PI;
    const rad = v < 0.62 ? Math.sin(Math.min(a * 1.25, Math.PI / 2)) : 1 - (v - 0.62) * 1.85;
    return [Math.max(0.16, rad) * r, r * (1.05 - v * 2.3)];
  };
  for (let i = 0; i < segs; i++) {
    const col = cols[i % 2] as Color;
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    for (let j = 0; j < rings; j++) {
      const [r0, y0] = prof(j / rings), [r1, y1] = prof((j + 1) / rings);
      const ids = ([[a0, r0, y0], [a0, r1, y1], [a1, r1, y1], [a1, r0, y0]] as Array<[number, number, number]>).map(([a, rr, yy]) => {
        p.set(c.x + Math.cos(a) * rr, c.y + yy, c.z + Math.sin(a) * rr);
        n.set(Math.cos(a), 0.35 - (yy / r) * 0.3, Math.sin(a)).normalize();
        return buf.vert(p, n, col);
      });
      buf.quad(ids[0] ?? 0, ids[3] ?? 0, ids[2] ?? 0, ids[1] ?? 0);
    }
  }
}

function balloon(buf: MeshBuf, c: Vector3, r: number, cols: [Color, Color]): void {
  envelope(buf, c, r, cols);
  const mouthY = c.y + r * (1.05 - 2.3), basketY = mouthY - r * 0.55;
  box(buf, trs(c.x, basketY, c.z, 0.4, r * 0.24, r * 0.2, r * 0.24, m), BASKET);
  cylinder(buf, trs(c.x, basketY + r * 0.12, c.z, 0, r * 0.07, r * 0.16, r * 0.07, m), BURNER, 6);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>) {
    const s = r * 0.1;
    const a = new Vector3(c.x + dx * s, basketY + r * 0.1, c.z + dz * s), b = new Vector3(c.x + dx * r * 0.17, mouthY + 0.2, c.z + dz * r * 0.17);
    const len = a.distanceTo(b);
    m.lookAt(a, b, new Vector3(0, 1, 0));
    m.setPosition(new Vector3().lerpVectors(a, b, 0.5));
    box(buf, m.multiply(new Matrix4().makeScale(0.12, 0.12, len)), ROPE);
  }
}

const DECL = /* glsl */`attribute vec4 aDrift;`;
// aDrift = (phase, radius, centre x, centre z): slow loop around the anchor + gentle bob.
const MOTION = /* glsl */`
{
  float t = uLifeTime * 0.045 + aDrift.x;
  transformed += vec3(sin(t) * aDrift.y, sin(uLifeTime * 0.35 + aDrift.x * 3.0) * 2.5, cos(t * 0.8) * aDrift.y);
}`;

export interface BalloonSite { x: number; y: number; z: number }

/** Balloons at `sites` (envelope centre), radius 7–10 m, drifting ±25 m. */
export function buildBalloons(ctx: WorldCtx, sites: BalloonSite[], rng: Rng): void {
  if (!sites.length) return;
  const buf = new MeshBuf();
  const drift: number[] = [];
  const pts: Vector3[] = [];
  sites.forEach((s, i) => {
    const start = buf.count;
    const c = new Vector3(s.x, s.y, s.z);
    balloon(buf, c, rng.range(7, 10), SCHEMES[i % SCHEMES.length] as [Color, Color]);
    const ph = rng.range(0, 6.28), rad = rng.range(14, 28);
    for (let k = start; k < buf.count; k++) drift.push(ph, rad, s.x, s.z);
    pts.push(c);
  });
  const geo = buf.build();
  geo.setAttribute('aDrift', new BufferAttribute(new Float32Array(drift), 4));
  const bounds = new Sphere().setFromPoints(pts);
  bounds.radius += 50;
  animatedMesh(ctx, geo, { name: 'balloons', decl: DECL, motion: MOTION, attributes: ['aDrift'], outline: 0.22, bounds });
  console.info(`[mountain] balloons: ${sites.length}`);
}
