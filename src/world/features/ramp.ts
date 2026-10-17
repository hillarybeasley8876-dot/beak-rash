// Ramp feature: a wedge rising along +s from 0 at s0 to data.height at s1 across x0..x1 (matches
// sim/features.ts), red/white chevron deck, hazard-striped lip, dark sides, outlined.
import { Color, Vector3 } from 'three';
import type { TrackFeature } from '../../core/types';
import type { WorldCtx } from '../ctx';
import type { MeshBuf } from '../geom';
import type { PropBatch } from '../kit/batch';

const RED = new Color('#e5191c'), WHITE = new Color('#f4f2ec'), SIDE = new Color('#3a3d45');
const YEL = new Color('#ffe600'), BLK = new Color('#16161b');

const P = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
const N = new Vector3(), E1 = new Vector3(), E2 = new Vector3();

/** Quad with a computed flat normal (vertices CCW from the visible side). */
function face(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color): void {
  E1.subVectors(b, a);
  E2.subVectors(c, a);
  N.crossVectors(E1, E2).normalize();
  const i = buf.vert(a, N, col), j = buf.vert(b, N, col), k = buf.vert(c, N, col), l = buf.vert(d, N, col);
  buf.quad(i, j, k, l);
}

export function buildRamp(ctx: WorldCtx, batch: PropBatch, f: TrackFeature): void {
  const H = typeof f.data?.height === 'number' ? f.data.height : 1.2;
  const xl = Math.min(f.x0, f.x1), xr = Math.max(f.x0, f.x1);
  const len = f.s1 - f.s0;
  const steps = Math.max(4, Math.round(len / 0.7));
  const q = ctx.q;
  const w = (s: number, x: number, y: number, out: Vector3): Vector3 => q.toWorld(s, x, y, out);
  q.toWorld(f.s0, (xl + xr) / 2, 0, P[0] as Vector3);
  const buf = batch.at((P[0] as Vector3).x, (P[0] as Vector3).z);
  const [a, b, c, d] = P as [Vector3, Vector3, Vector3, Vector3];
  for (let i = 0; i < steps; i++) {
    const s0 = f.s0 + (len * i) / steps, s1 = f.s0 + (len * (i + 1)) / steps;
    const h0 = (H * i) / steps + 0.01, h1 = (H * (i + 1)) / steps + 0.01;
    const col = i % 2 === 0 ? RED : WHITE;
    // Deck (seen from above: left-near, right-near, right-far, left-far).
    face(buf, w(s0, xl, h0, a), w(s0, xr, h0, b), w(s1, xr, h1, c), w(s1, xl, h1, d), col);
    // Sides.
    face(buf, w(s0, xr, 0, a), w(s1, xr, 0, b), w(s1, xr, h1, c), w(s0, xr, h0, d), SIDE);
    face(buf, w(s1, xl, 0, a), w(s0, xl, 0, b), w(s0, xl, h0, c), w(s1, xl, h1, d), SIDE);
  }
  // Lip: vertical back face with hazard stripes.
  const stripes = Math.max(3, Math.round((xr - xl) / 0.5));
  for (let i = 0; i < stripes; i++) {
    const x0 = xr - ((xr - xl) * i) / stripes, x1 = xr - ((xr - xl) * (i + 1)) / stripes;
    face(buf, w(f.s1, x0, 0, a), w(f.s1, x1, 0, b), w(f.s1, x1, H + 0.01, c), w(f.s1, x0, H + 0.01, d), i % 2 === 0 ? YEL : BLK);
  }
}
