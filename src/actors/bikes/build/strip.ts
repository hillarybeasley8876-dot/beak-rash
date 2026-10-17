// Flat strips: chains (closed loops lying in the bike plane) and ribbons (streamers, straps).
// Two-sided by construction (front + back faces), optional per-segment colour alternation.
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import type { V3 } from './geo';

export interface StripOpts {
  closed?: boolean;
  /** Unit normal of the strip's faces (e.g. +X for a chain in the wheel plane). */
  normal: V3;
  /** Alternate these colours per segment (chain links, candy stripes). Omit for one colour. */
  colors?: readonly string[];
  /** Half-width multiplier per point (0..1 along the strip) — tapering ribbons. */
  taper?: (t: number) => number;
}

/** Strip through `pts`, `halfW` either side of the path, within the plane ⟂ normal. */
export function strip(pts: readonly V3[], halfW: number, o: StripOpts): BufferGeometry {
  const n = pts.length;
  const segs = o.closed ? n : n - 1;
  const cols = (o.colors ?? []).map((c) => new Color(c));
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const t = new Vector3(), off = new Vector3();
  const offsetAt = (i: number): Vector3[] => {
    const p = pts[(i + n) % n] as V3;
    const prev = pts[o.closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as V3;
    const next = pts[o.closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as V3;
    t.subVectors(next, prev).normalize();
    off.crossVectors(t, o.normal).normalize().multiplyScalar(halfW * (o.taper ? o.taper(i / Math.max(1, n - 1)) : 1));
    return [p.clone().add(off), p.clone().sub(off)];
  };
  for (let s = 0; s < segs; s++) {
    const [a0, a1] = offsetAt(s) as [Vector3, Vector3];
    const [b0, b1] = offsetAt(s + 1) as [Vector3, Vector3];
    const c = cols.length ? (cols[s % cols.length] as Color) : null;
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (const p of [a0, a1, b0, b1]) {
        pos.push(p.x, p.y, p.z);
        nor.push(o.normal.x * side, o.normal.y * side, o.normal.z * side);
        if (c) col.push(c.r, c.g, c.b);
      }
      if (side === 1) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  if (col.length) g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  return g;
}

/** Points around a stadium (two circles joined by tangents) in the YZ plane: chain loops. */
export function chainLoop(c1: V3, r1: number, c2: V3, r2: number, perArc: number): V3[] {
  // Outer tangent lines of two circles (c1 front chainring, c2 rear cog), both in the plane x = c1.x.
  const dy = c2.y - c1.y, dz = c2.z - c1.z;
  const d = Math.hypot(dy, dz);
  const base = Math.atan2(dy, dz);
  const phi = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
  const pts: V3[] = [];
  const arc = (c: V3, r: number, a0: number, a1: number): void => {
    for (let i = 0; i <= perArc; i++) {
      const a = a0 + ((a1 - a0) * i) / perArc;
      pts.push(new Vector3(c1.x, c.y + Math.sin(a) * r, c.z + Math.cos(a) * r));
    }
  };
  // Angles measured from +Z toward +Y. Wrap the big ring on the side away from the cog, the cog on its far side.
  arc(c2, r2, base + phi, base - phi);
  arc(c1, r1, base - phi, base + phi - Math.PI * 2);
  return pts;
}
