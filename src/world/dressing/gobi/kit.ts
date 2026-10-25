// Shared colours and landscape props for 戈壁公路: the dune grid, rock mesas, distant snow peaks,
// dry scrub, boulders and the salt pan. Everything is written into a merged MeshBuf.
import { Color, Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { MeshBuf } from '../../geom';
import { cone, cylinder, sphere, trs } from '../../kit/shapes';

export const C = {
  sand: new Color('#e7cb8c'),
  sandLit: new Color('#f4e2ae'),
  sandShade: new Color('#c9a463'),
  salt: new Color('#f6f2e4'),
  saltDim: new Color('#dcd4bd'),
  rock: new Color('#c08d5e'),
  rockDark: new Color('#9c6b46'),
  rockLit: new Color('#d9a86b'),
  mud: new Color('#d3ab77'),
  mudDark: new Color('#a97f52'),
  steel: new Color('#8d97a3'),
  steelDark: new Color('#5d6670'),
  white: new Color('#f4f1ea'),
  red: new Color('#e5191c'),
  black: new Color('#16171c'),
  yellow: new Color('#ffe600'),
  camel: new Color('#c8965a'),
  camelDark: new Color('#8e6437'),
  green: new Color('#8a9152'),
  greenDark: new Color('#6b7340'),
  snow: new Color('#f2f6ff'),
  peakRock: new Color('#a3b3c6'),
} as const;

const m = new Matrix4();
const p = new Vector3(), pu = new Vector3(), pv = new Vector3(), n = new Vector3(), e1 = new Vector3(), e2 = new Vector3();

/**
 * Grid patch (nu × nv quads) with computed normals: `fn(u, v, out)` gives the point, `col` the colour
 * (per vertex when a function). Normals point up for a ground grid (u along x, v along z).
 */
export function grid(
  buf: MeshBuf, nu: number, nv: number,
  fn: (u: number, v: number, out: Vector3) => void,
  col: Color | ((u: number, v: number) => Color),
): void {
  const ids: number[][] = [];
  const du = 0.5 / nu, dv = 0.5 / nv;
  for (let i = 0; i <= nu; i++) {
    const row: number[] = [];
    for (let j = 0; j <= nv; j++) {
      const u = i / nu, v = j / nv;
      fn(u, v, p);
      fn(Math.min(1, u + du), v, pu);
      fn(u, Math.min(1, v + dv), pv);
      e1.subVectors(pu, p);
      e2.subVectors(pv, p);
      n.crossVectors(e2, e1).normalize();
      if (n.lengthSq() < 0.5) n.set(0, 1, 0);
      row.push(buf.vert(p, n, typeof col === 'function' ? col(u, v) : col));
    }
    ids.push(row);
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = ids[i]?.[j] ?? 0, b = ids[i]?.[j + 1] ?? 0, c = ids[i + 1]?.[j + 1] ?? 0, d = ids[i + 1]?.[j] ?? 0;
      buf.quad(a, b, c, d);
    }
  }
}

/** Crescent dune: a long sand mound whose crest line wanders. `yaw` is the long axis. */
export function dune(buf: MeshBuf, x: number, y: number, z: number, len: number, wid: number, h: number, yaw: number): void {
  const dx = Math.cos(yaw), dz = Math.sin(yaw);
  const ax = -dz, az = dx;
  const height = (u: number, v: number): number => {
    const q = Math.sin(Math.PI * u) ** 0.7;
    const crest = 0.22 * Math.sin(u * 5.2);
    const t = (v - 0.5 - crest) * 2;
    return h * q * Math.max(0, 1 - t * t) ** 1.25;
  };
  grid(buf, 22, 12, (u, v, out) => {
    const along = (u - 0.5) * len;
    const across = (v - 0.5) * wid;
    out.set(x + dx * along + ax * across, y + height(u, v), z + dz * along + az * across);
  }, (u, v) => {
    const lit = height(u, v) / Math.max(0.001, h);
    return lit > 0.55 ? C.sandLit : lit > 0.2 ? C.sand : C.sandShade;
  });
}

/** Rock mesa / butte: a talus cone, four strata bands and a flat cap. */
export function butte(buf: MeshBuf, x: number, y: number, z: number, r: number, h: number, rng: Rng): void {
  const yaw = rng.range(0, 6.28);
  cone(buf, trs(x, y - 0.4, z, yaw, r * 1.5, h * 0.18, r * 1.5, m), C.sandShade, 16);
  const bands = [C.rockDark, C.rockLit, C.rock, C.rockDark, C.rockLit];
  let y0 = y + h * 0.16;
  for (let i = 0; i < bands.length; i++) {
    const t = i / bands.length;
    const rr = r * (1 - t * 0.38);
    const hh = h * (0.17 - t * 0.012);
    cylinder(buf, trs(x, y0, z, yaw + i * 0.18, rr, hh, rr * 0.95, m), bands[i] as Color, 16);
    y0 += hh;
  }
  cylinder(buf, trs(x, y0 - 0.3, z, yaw, r * 0.6, 0.9, r * 0.56, m), C.rockLit, 16);
}

/** Distant snow-capped peak: three stacked cones. */
export function peak(buf: MeshBuf, x: number, y: number, z: number, r: number, h: number, snow: number): void {
  const yaw = (x + z) * 0.7;
  cone(buf, trs(x, y, z, yaw, r, h, r, m), C.peakRock, 12);
  cone(buf, trs(x, y + h * 0.5, z, yaw + 0.4, r * 0.5, h * 0.5, r * 0.5, m), C.snow, 12);
  if (snow > 0) cone(buf, trs(x, y + h * 0.66, z, yaw + 0.8, r * 0.36 * snow, h * 0.36, r * 0.36 * snow, m), C.snow, 10);
}

/** Weathered boulder: a squashed, faceted lump. */
export function boulder(buf: MeshBuf, x: number, y: number, z: number, s: number, rng: Rng): void {
  const yaw = rng.range(0, 6.28);
  sphere(buf, trs(x, y + s * 0.35, z, yaw, s, s * 0.7, s * 0.85, m), rng.chance(0.5) ? C.rock : C.rockDark, 7, 5, C.rockDark);
}

/** Dry desert scrub: a few crossed leaf cards. */
export function scrub(buf: MeshBuf, x: number, y: number, z: number, rng: Rng, s = 1): void {
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, 6.28), r = rng.range(0, 0.55) * s;
    const h = rng.range(0.25, 0.6) * s;
    sphere(buf, trs(x + Math.cos(a) * r, y + h * 0.6, z + Math.sin(a) * r, rng.range(0, 6.28),
      rng.range(0.35, 0.6) * s, h, rng.range(0.35, 0.6) * s, m), i % 2 ? C.green : C.greenDark, 6, 4, C.greenDark);
  }
}

/** A boulder + a few pebbles (a rock cluster, like the coast's cragCluster but low). */
export function rockCluster(buf: MeshBuf, x: number, y: number, z: number, s: number, rng: Rng): void {
  boulder(buf, x, y, z, s, rng);
  for (let i = 0; i < rng.int(2, 4); i++) {
    const a = rng.range(0, 6.28), r = rng.range(0.9, 1.9) * s;
    boulder(buf, x + Math.cos(a) * r, y - 0.1 * s, z + Math.sin(a) * r, s * rng.range(0.3, 0.55), rng);
  }
}

/** The dry salt pan: a wide white sheet on the lake bed, following the ground. */
export function saltPan(
  buf: MeshBuf, x: number, z: number, w: number, d: number, yaw: number,
  heightAt: (wx: number, wz: number) => number, uOf: (wx: number, wz: number) => number,
): void {
  const dx = Math.cos(yaw), dz = Math.sin(yaw);
  const cell = 13;
  const nA = Math.max(2, Math.round(d / cell)), nC = Math.max(2, Math.round(w / cell));
  const p = new Vector3(), n = new Vector3(0, 1, 0);
  const corner = (a: number, c: number): Vector3 => {
    const wx = x + dx * a - dz * c, wz = z + dz * a + dx * c;
    return p.set(wx, heightAt(wx, wz) + 0.22, wz);
  };
  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < nC; j++) {
      const a0 = (i / nA - 0.5) * d, a1 = ((i + 1) / nA - 0.5) * d;
      const c0 = (j / nC - 0.5) * w, c1 = ((j + 1) / nC - 0.5) * w;
      // The road runs along the pan's middle: the plates near it are skipped without a lookup.
      if (Math.abs((c0 + c1) / 2) < 30) continue;
      const mid = corner((a0 + a1) / 2, (c0 + c1) / 2);
      if (uOf(mid.x, mid.z) < 28) continue;   // keep the pan off the road embankment
      const col = (i + j) % 4 === 0 ? C.saltDim : C.salt;
      const i0 = buf.vert(corner(a0, c0), n, col);
      const i1 = buf.vert(corner(a0, c1), n, col);
      const i2 = buf.vert(corner(a1, c1), n, col);
      const i3 = buf.vert(corner(a1, c0), n, col);
      buf.quad(i0, i1, i2, i3);
    }
  }
}
