// Crisp paint borders for SDF meshes: every triangle whose corners got different colours is split along the
// exact colour border (bisection on the paint function), with border vertices duplicated per colour, so no
// colour is ever smeared across a border. Positions, normals, weights and outline widths stay continuous.
import type { Painter } from './paint';

export interface MeshArrays {
  pos: Float32Array; nrm: Float32Array; hex: Float32Array; outl: Float32Array;
  skinI: Uint16Array; skinW: Float32Array; idx: Uint32Array;
}

interface Grow { pos: number[]; nrm: number[]; hex: number[]; outl: number[]; skinI: number[]; skinW: number[] }

/** Append a vertex interpolated between a and b at t, painted `hex`. */
function lerpVertex(m: MeshArrays, g: Grow, a: number, b: number, t: number, hex: number): number {
  const n = m.pos.length / 3 + g.hex.length;
  const at = (arr: ArrayLike<number>, extra: number[], i: number, k: number, w: number): number => {
    const base = m.pos.length / 3;
    return i < base ? arr[i * w + k] ?? 0 : extra[(i - base) * w + k] ?? 0;
  };
  let nl = 0;
  const nv = [0, 1, 2].map((k) => { const v = at(m.nrm, g.nrm, a, k, 3) * (1 - t) + at(m.nrm, g.nrm, b, k, 3) * t; nl += v * v; return v; });
  for (let k = 0; k < 3; k++) {
    g.pos.push(at(m.pos, g.pos, a, k, 3) * (1 - t) + at(m.pos, g.pos, b, k, 3) * t);
    g.nrm.push((nv[k] ?? 0) / Math.sqrt(nl || 1));
  }
  const inf = new Map<number, number>();
  for (const [v, w] of [[a, 1 - t], [b, t]] as const) {
    for (let k = 0; k < 4; k++) {
      const bone = at(m.skinI, g.skinI, v, k, 4), wt = at(m.skinW, g.skinW, v, k, 4) * w;
      if (wt > 0) inf.set(bone, (inf.get(bone) ?? 0) + wt);
    }
  }
  const top = [...inf.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4);
  const sum = top.reduce((s, e) => s + e[1], 0) || 1;
  for (let k = 0; k < 4; k++) { g.skinI.push(top[k]?.[0] ?? 0); g.skinW.push((top[k]?.[1] ?? 0) / sum); }
  g.outl.push(at(m.outl, g.outl, a, 0, 1) * (1 - t) + at(m.outl, g.outl, b, 0, 1) * t);
  g.hex.push(hex);
  return n;
}

export function crispBorders(m: MeshArrays, painter: Painter): MeshArrays {
  const g: Grow = { pos: [], nrm: [], hex: [], outl: [], skinI: [], skinW: [] };
  const P = (i: number, k: number): number => m.pos[i * 3 + k] ?? 0;
  const H = (i: number): number => m.hex[i] ?? 0;
  const tCache = new Map<number, number>(), vCache = new Map<string, number>();
  const N = m.pos.length / 3;
  /** Border parameter along a→b (from a), found by bisection on the paint colour. */
  const crossT = (a: number, b: number): number => {
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo * N + hi;
    let t = tCache.get(key);
    if (t === undefined) {
      const c0 = H(lo);
      let t0 = 0, t1 = 1;
      for (let i = 0; i < 7; i++) {
        const tm = (t0 + t1) / 2;
        const c = painter.colorAt(P(lo, 0) + (P(hi, 0) - P(lo, 0)) * tm, P(lo, 1) + (P(hi, 1) - P(lo, 1)) * tm, P(lo, 2) + (P(hi, 2) - P(lo, 2)) * tm).color;
        if (c === c0) t0 = tm; else t1 = tm;
      }
      t = (t0 + t1) / 2;
      tCache.set(key, t);
    }
    return a === lo ? t : 1 - t;
  };
  const edgeVertex = (a: number, b: number, hex: number): number => {
    const key = `${Math.min(a, b)}_${Math.max(a, b)}_${hex}`;
    let v = vCache.get(key);
    if (v === undefined) { v = lerpVertex(m, g, a, b, crossT(a, b), hex); vCache.set(key, v); }
    return v;
  };
  const out: number[] = [];
  for (let f = 0; f < m.idx.length; f += 3) {
    const a = m.idx[f] ?? 0, b = m.idx[f + 1] ?? 0, c = m.idx[f + 2] ?? 0;
    const ha = H(a), hb = H(b), hc = H(c);
    if (ha === hb && hb === hc) { out.push(a, b, c); continue; }
    if (ha !== hb && hb !== hc && ha !== hc) {
      // Three colours: each corner keeps its own colour up to the edge borders and a shared centre.
      for (const [o, p, q] of [[a, b, c], [b, c, a], [c, a, b]] as const) {
        const ho = H(o);
        const mid = lerpVertex(m, g, lerpVertex(m, g, a, b, 0.5, ho), c, 1 / 3, ho);
        out.push(o, edgeVertex(o, p, ho), mid, o, mid, edgeVertex(q, o, ho));
      }
      continue;
    }
    // Two colours: rotate so the odd corner `o` comes first (winding kept), split off its corner.
    const [o, p, q] = ha !== hb && ha !== hc ? [a, b, c] : hb !== ha && hb !== hc ? [b, c, a] : [c, a, b];
    const ho = H(o), hp = H(p);
    out.push(o, edgeVertex(o, p, ho), edgeVertex(o, q, ho));
    const x1 = edgeVertex(o, p, hp), x2 = edgeVertex(o, q, hp);
    out.push(x1, p, q, x1, q, x2);
  }
  const cat = <T extends Float32Array | Uint16Array>(base: T, extra: number[], make: (n: number) => T): T => {
    const r = make(base.length + extra.length);
    r.set(base);
    r.set(extra, base.length);
    return r;
  };
  return {
    pos: cat(m.pos, g.pos, (n) => new Float32Array(n)), nrm: cat(m.nrm, g.nrm, (n) => new Float32Array(n)),
    hex: cat(m.hex, g.hex, (n) => new Float32Array(n)), outl: cat(m.outl, g.outl, (n) => new Float32Array(n)),
    skinI: cat(m.skinI, g.skinI, (n) => new Uint16Array(n)), skinW: cat(m.skinW, g.skinW, (n) => new Float32Array(n)),
    idx: Uint32Array.from(out),
  };
}
