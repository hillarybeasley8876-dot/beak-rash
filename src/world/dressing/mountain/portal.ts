// Sunset Pass tunnel portals (env-mountain). The track's concrete portal sits under a small hill cap;
// each mouth gets a dressed-stone headwall (pilasters beside the arch, a block band with a cornice
// above it), stepped stone wing walls along the foot of the cutting, granite masses and tufted ledge
// slabs covering the face above the cornice, a jagged granite crest along the cap's edge with rocks
// stacked up both side edges, and big granite masses with pines and firs on the cap behind it, so the
// silhouette rises 25–40 m above the road with no straight edge.
import { Color, Matrix4, Vector3 } from 'three';
import type { TrackFeature } from '../../../core/types';
import { CROWN, capHalfW, capHeight, tunnelHalfW } from '../../features/tunnel';
import type { MeshBuf } from '../../geom';
import type { PropBatch } from '../../kit/batch';
import { box, trs } from '../../kit/shapes';
import { fir, pine } from '../../scenery/props/mountain-trees';
import { bevelRock, GRANITE } from '../../scenery/props/mountain-granite';
import { grassTuft } from '../../scenery/props/cover';
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

/**
 * Upper portal face, from above the cornice to under the crest: staggered rows of big granite masses
 * bedded at different depths (no flat face shows between them), and here and there a jutting slab on a
 * mass's shoulder with a grass tuft on it (ledges stepping up the face).
 */
function faceRock(d: Dress, rocks: PropBatch, f: TrackFeature, s: number, dir: number, halfW: number): number {
  const { rng, ctx, field } = d;
  const fr = ctx.q.frameVis(s);
  const roadY = fr.pos.y, W = halfW + 1.6, yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
  let n = 0;
  for (let y = CROWN + 5.2, row = 0; row < 6; row++) {
    const r0 = rng.range(1.9, 2.5);
    for (let x = -W + (row % 2 ? r0 * 0.85 : 0.2) + rng.range(-0.4, 0.4); x < W + 0.5; x += r0 * rng.range(1.3, 1.7)) {
      if (y > capHeight(ctx, field, f, s, x) - roadY - 1.2) continue;
      const r = rng.range(1.6, 2.6);
      ctx.q.toWorld(s + dir * rng.range(0.1, 0.6), x, y + rng.range(-0.4, 0.4), p);
      bevelRock(rocks.at(p.x, p.z), p.x, p.y, p.z, r * rng.range(0.9, 1.2), r * rng.range(0.7, 0.95), r * 0.55, yaw + rng.range(-0.35, 0.35), rng,
        rng.pick([...GRANITE]), false);
      n++;
      if (!rng.chance(0.4)) continue;
      const sx = rng.range(1.0, 1.5), sz = rng.range(0.6, 0.8);
      ctx.q.toWorld(s + dir * (r * 0.45 + 0.2), x + rng.range(-0.5, 0.5), y + r * 0.62, p);
      bevelRock(rocks.at(p.x, p.z), p.x, p.y, p.z, sx, rng.range(0.28, 0.4), sz, yaw + rng.range(-0.2, 0.2), rng, rng.pick([...GRANITE]), false);
      ctx.q.toWorld(s + dir * (r * 0.45 + 0.3), x + rng.range(-0.3, 0.3), y + r * 0.62 + 0.3, p);
      grassTuft(d.b.cover.at(p.x, p.z), p.x, p.y, p.z, rng, rng.range(0.4, 0.65));
      n++;
    }
    y += r0 * rng.range(1.1, 1.35);
  }
  return n;
}

/**
 * Jagged crest along the cap's front edge over the portal: granite masses poking 1–4 m above it (every
 * third a spire), tufts and the odd small pine between them, and a stack of rocks up each side edge of
 * the face where it meets the cutting (no straight edges against the sky or the rock wall).
 */
function crest(d: Dress, rocks: PropBatch, f: TrackFeature, s: number, dir: number, halfW: number): number {
  const { rng, ctx, field } = d;
  const fr = ctx.q.frameVis(s);
  const roadY = fr.pos.y, W = halfW + 1.6, yaw = Math.atan2(fr.tangent.x, fr.tangent.z), cap = capHalfW(field, f);
  let n = 0;
  for (let x = -W - 0.8, k = 0; x < W + 0.8 && Math.abs(x) <= cap; x += rng.range(1.5, 2.3), k++) {
    const top = capHeight(ctx, field, f, s, x) - roadY;
    const r = rng.range(1.1, 1.8), tall = k % 3 === 1 ? rng.range(1.6, 2.2) : rng.range(0.9, 1.3);
    ctx.q.toWorld(s + dir * r * 0.2, x, top + r * tall * 0.15, p);
    bevelRock(rocks.at(p.x, p.z), p.x, p.y, p.z, r * rng.range(0.85, 1.15), r * tall, r * 0.85, yaw + rng.range(-0.4, 0.4), rng,
      rng.pick([...GRANITE]), false);
    n++;
    const roll = rng.next();
    ctx.q.toWorld(s - dir * rng.range(0.6, 1.6), x + rng.range(-0.8, 0.8), top, p);
    if (roll < 0.45) grassTuft(d.b.cover.at(p.x, p.z), p.x, p.y + 0.1, p.z, rng, rng.range(0.5, 0.8));
    else if (roll < 0.6) pine(d.b.props.at(p.x, p.z), p.x, p.y - 0.2, p.z, rng, rng.range(0.4, 0.6));
  }
  for (const side of [-1, 1]) {
    const x = side * (W + 0.2), top = capHeight(ctx, field, f, s, x) - roadY;
    for (let y = CROWN + 4.4; y < top; y += rng.range(1.9, 2.5)) {
      const r = rng.range(0.9, 1.4);
      ctx.q.toWorld(s + dir * r * 0.3, x + side * rng.range(-0.3, 0.3), y, p);
      bevelRock(rocks.at(p.x, p.z), p.x, p.y, p.z, r * 1.1, r * rng.range(0.8, 1.1), r * 0.8, yaw + rng.range(-0.5, 0.5), rng, rng.pick([...GRANITE]), false);
      n++;
    }
  }
  return n;
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
  let ledges = 0, crests = 0;
  for (const f of d.ctx.L.features.filter((ft) => ft.kind === 'tunnel')) {
    const halfW = tunnelHalfW(d.field, f);
    for (const [s, dir] of [[f.s0, -1], [f.s1, 1]] as Array<[number, number]>) {
      headwall(d, s, dir, halfW);
      wingWalls(d, s, dir);
      ledges += faceRock(d, rocks, f, s, dir, halfW);
      crests += crest(d, rocks, f, s, dir, halfW);
      capRidge(d, rocks, f, s, dir);
    }
  }
  d.ctx.log(`portals: ${ledges} face rocks and ledge slabs, ${crests} crest + jamb rocks`);
}
