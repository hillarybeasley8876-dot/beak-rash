// Sunset Pass tunnel portals (env-mountain). The track's concrete portal sits under a small hill cap;
// each mouth gets a dressed-stone headwall (pilasters beside the arch, a block band with a cornice
// above it), stepped stone wing walls along the foot of the cutting, and big granite masses with pines
// and firs on the cap behind it, so the silhouette rises 25–40 m above the road.
import { Color, Matrix4, Vector3 } from 'three';
import type { TrackFeature } from '../../../core/types';
import { CROWN, capHalfW, capHeight, tunnelHalfW } from '../../features/tunnel';
import type { MeshBuf } from '../../geom';
import type { PropBatch } from '../../kit/batch';
import { box, trs } from '../../kit/shapes';
import { fir, pine } from '../../scenery/props/mountain-trees';
import { bevelRock, GRANITE } from '../../scenery/props/mountain-granite';
import type { Dress } from '../dress';

const STONE = [new Color('#b9aa9b'), new Color('#a39489'), new Color('#cbbca9')] as const;
const CORNICE = new Color('#d8cab6');
const m = new Matrix4();
const p = new Vector3();

/** One dressed block: track-space centre (s, x, y above the road), size w (across) × h × t (along s). */
function block(d: Dress, buf: MeshBuf, yaw: number, s: number, x: number, y: number, w: number, h: number, t: number, col: Color): void {
  d.ctx.q.toWorld(s, x, y, p);
  box(buf, trs(p.x, p.y, p.z, yaw, w, h, t, m), col);
}

/** Pilasters, block band and cornice on the portal face at s (dir = −1 entrance, +1 exit). */
function headwall(d: Dress, s: number, dir: number, halfW: number): void {
  const { q } = d.ctx;
  const fr = q.frameVis(s);
  const yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
  const buf = d.b.props.at(fr.pos.x, fr.pos.z);
  // The face spans W = halfW + 1.6 (features/tunnel.ts); the red ring reaches 0.8 m beyond the tube.
  const W = halfW + 1.6, base = CROWN + 0.9, top = base + 3;
  const pick = (i: number): Color => STONE[i % STONE.length] as Color;
  // Pilasters: courses of 0.9 m blocks from the road to the band, offset every other course.
  for (const side of [-1, 1]) {
    for (let k = 0, y = 0; y < top; k++, y += 0.9) {
      const w = k % 2 ? 0.7 : 0.8;
      block(d, buf, yaw, s + dir * 0.3, side * (W - w / 2), y + 0.45, w, 0.86, 0.6, pick(k + (side > 0 ? 1 : 0)));
    }
  }
  // Band over the arch: three courses of staggered blocks, then a protruding cornice.
  for (let row = 0; row < 3; row++) {
    const n = 7 + (row % 2);
    for (let i = 0; i < n; i++) {
      const w = (2 * W) / n;
      block(d, buf, yaw, s + dir * 0.12, -W + w * (i + 0.5), base + row + 0.48, w - 0.06, 0.94, 0.24, pick(i + row));
    }
  }
  block(d, buf, yaw, s + dir * 0.35, 0, top + 0.25, 2 * W + 1.0, 0.5, 0.9, CORNICE);
}

/** Stepped stone wing walls along the foot of both cutting faces, running away from the mouth. */
function wingWalls(d: Dress, s: number, dir: number): void {
  const { q } = d.ctx;
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 7; k++) {
      const sk = s + dir * (1 + k * 2);
      if (q.edgeKindAt(sk, side) === 'tunnel') continue;
      const fr = q.frameVis(sk);
      const yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
      const x = side * (d.field.bound(sk, side) + 0.45);
      const h = 3.2 - k * 0.3;
      block(d, d.b.props.at(fr.pos.x, fr.pos.z), yaw, sk, x, d.field.edgeY(sk, side) - fr.pos.y + h / 2, 0.8, h, 2.0, STONE[k % 3] as Color);
    }
  }
}

/** Granite masses bedded in the upper portal face above the cornice, up to the cap's skyline. */
function faceMasses(d: Dress, rocks: PropBatch, f: TrackFeature, s: number, dir: number, halfW: number): void {
  const { rng, ctx, field } = d;
  const fr = ctx.q.frameVis(s);
  const roadY = fr.pos.y, W = halfW + 1.6, low = CROWN + 4.6, yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
  // A broad band over the arch (not a tower): at most ~7 m above the cornice, spread across the face.
  for (let k = 0; k < 16; k++) {
    const x = -W + ((k + rng.range(0.1, 0.9)) / 16) * 2 * W, r = rng.range(2.0, 3.2);
    const top = Math.min(capHeight(ctx, field, f, s, x) - roadY + 0.4, low + 7);
    if (top - low < r) continue;
    const y = rng.range(low + r * 0.75, top - r * 0.25);
    ctx.q.toWorld(s + dir * r * 0.1, x, y, p);
    bevelRock(rocks.at(p.x, p.z), p.x, p.y, p.z, r * rng.range(1.0, 1.4), r * rng.range(0.8, 1.1), r * 0.6, yaw + rng.range(-0.3, 0.3), rng,
      rng.pick([...GRANITE]), false);
  }
}

/** Granite masses, pines and firs on the cap from 3 to 46 m behind the mouth. */
function capRidge(d: Dress, rocks: PropBatch, f: TrackFeature, s: number, dir: number): void {
  const { rng, ctx, field } = d;
  const W = capHalfW(field, f);
  for (let k = 0; k < 26; k++) {
    const sk = s - dir * rng.range(3, 46);
    const x = rng.range(-W, W) * (k < 8 ? 0.6 : 1);
    const y = capHeight(ctx, field, f, sk, x);
    ctx.q.toWorld(sk, x, 0, p);
    const roll = rng.next();
    if (roll < 0.45) {
      const r = rng.range(2.4, 4.6);
      bevelRock(rocks.at(p.x, p.z), p.x, y + r * 0.15, p.z, r * rng.range(1.0, 1.4), r * rng.range(0.8, 1.3), r, rng.range(0, 6.3), rng, rng.pick([...GRANITE]));
    } else if (roll < 0.8) pine(d.b.props.at(p.x, p.z), p.x, y, p.z, rng, rng.range(0.9, 1.3));
    else fir(d.b.props.at(p.x, p.z), p.x, y, p.z, rng, rng.range(0.9, 1.15));
  }
}

/** Headwall, wing walls, face masses and cap ridge at both mouths of every tunnel. */
export function portals(d: Dress, rocks: PropBatch): void {
  for (const f of d.ctx.L.features.filter((ft) => ft.kind === 'tunnel')) {
    const halfW = tunnelHalfW(d.field, f);
    for (const [s, dir] of [[f.s0, -1], [f.s1, 1]] as Array<[number, number]>) {
      headwall(d, s, dir, halfW);
      wingWalls(d, s, dir);
      faceMasses(d, rocks, f, s, dir, halfW);
      capRidge(d, rocks, f, s, dir);
    }
  }
}
