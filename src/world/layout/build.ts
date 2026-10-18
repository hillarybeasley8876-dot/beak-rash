// Layout → sampled centre line. Curvature, slope and bank are piecewise constant per segment and
// change across each boundary with a smoothstep ramp (heading C2, no kinks); each segment keeps its
// exact total turn and rise because the ramps are symmetric. Samples every 1 m from −pre to
// length + post (visual road; the Track API is valid on [0, length + runoff], see query.ts).
import { smoothstep } from '../../core/math';
import type { TrackFeature } from '../../core/types';
import type { LayoutDef, SegmentDef } from './types';
import { buildSides, type SideTable } from './sides';

export interface Mark { kind: string; s: number; x: number; data: Record<string, number | string | boolean> }
export interface Zone { name: string; s0: number; s1: number }

export interface BuiltLayout {
  def: LayoutDef;
  length: number;
  halfWidth: number;
  /** s of sample 0 (= −pre); sample i sits at s = sMin + i. */
  sMin: number;
  n: number;
  px: Float64Array; py: Float64Array; pz: Float64Array;
  tx: Float32Array; ty: Float32Array; tz: Float32Array;   // tangent
  ux: Float32Array; uy: Float32Array; uz: Float32Array;   // up (incl. bank)
  rx: Float32Array; ry: Float32Array; rz: Float32Array;   // right
  curv: Float32Array; slope: Float32Array; bank: Float32Array;
  /** Tunnel roof height above the road (0 = open sky). */
  roof: Float32Array;
  sides: SideTable;
  segStart: number[];
  features: TrackFeature[];
  marks: Mark[];
  zones: Zone[];
}

const DEFAULT_EASE = 30;

/** Piecewise-constant value per segment with smoothstep transitions centred on segment starts. */
function ramped(segs: SegmentDef[], starts: number[], val: (g: SegmentDef) => number, ease: (g: SegmentDef) => number) {
  const widths = segs.map((g, i) => {
    if (i === 0) return 0;
    const prev = segs[i - 1] as SegmentDef;
    return Math.min(ease(g), g.len, prev.len);
  });
  const vals = segs.map(val);
  return (s: number, i: number): number => {
    const v = vals[i] ?? 0;
    const b0 = starts[i] ?? 0, w0 = widths[i] ?? 0;
    if (i > 0 && w0 > 0 && s < b0 + w0 / 2) {
      return (vals[i - 1] ?? 0) + (v - (vals[i - 1] ?? 0)) * smoothstep(b0 - w0 / 2, b0 + w0 / 2, s);
    }
    const b1 = starts[i + 1], w1 = widths[i + 1] ?? 0;
    if (b1 !== undefined && w1 > 0 && s > b1 - w1 / 2) {
      return v + ((vals[i + 1] ?? 0) - v) * smoothstep(b1 - w1 / 2, b1 + w1 / 2, s);
    }
    return v;
  };
}

export function buildLayout(def: LayoutDef): BuiltLayout {
  const segs = def.segments;
  const starts: number[] = [];
  let acc = 0;
  for (const g of segs) { starts.push(acc); acc += g.len; }
  const length = acc;
  const kappa = ramped(segs, starts, (g) => (g.radius ? 1 / g.radius : 0), (g) => g.ease ?? DEFAULT_EASE);
  const grade = ramped(segs, starts, (g) => (g.rise ?? 0) / g.len, (g) => g.vEase ?? g.ease ?? DEFAULT_EASE);
  const bankF = ramped(segs, starts, (g) => ((g.bank ?? 0) * Math.PI) / 180, (g) => g.ease ?? DEFAULT_EASE);
  const roofF = ramped(segs, starts, (g) => g.roof ?? 0, () => 0);
  let seg = 0;
  const segAt = (s: number): number => {
    while (seg < segs.length - 1 && s >= (starts[seg + 1] ?? Infinity)) seg++;
    while (seg > 0 && s < (starts[seg] ?? 0)) seg--;
    return seg;
  };
  const sMin = -def.pre;
  const n = Math.floor(def.pre + length + def.post) + 1;
  const F64 = () => new Float64Array(n), F32 = () => new Float32Array(n);
  const L: BuiltLayout = {
    def, length, halfWidth: def.halfWidth, sMin, n,
    px: F64(), py: F64(), pz: F64(), tx: F32(), ty: F32(), tz: F32(), ux: F32(), uy: F32(), uz: F32(),
    rx: F32(), ry: F32(), rz: F32(), curv: F32(), slope: F32(), bank: F32(), roof: F32(),
    sides: buildSides(def, starts, sMin, n),
    segStart: starts, features: [], marks: [], zones: [],
  };
  // Integrate forward from s = 0 (substeps of 0.25 m, midpoint rule); the pre-start road is straight.
  const i0 = Math.round(-sMin);
  let h = def.heading, x = 0, y = def.elevation, z = 0;
  const SUB = 4, ds = 1 / SUB;
  const heading = new Float64Array(n);
  for (let i = i0; i < n; i++) {
    const s = sMin + i;
    const inTrack = s >= 0 && s <= length;
    const k = inTrack ? kappa(s, segAt(s)) : 0;
    const g = inTrack ? grade(s, segAt(s)) : 0;
    L.px[i] = x; L.py[i] = y; L.pz[i] = z; heading[i] = h;
    L.curv[i] = k; L.slope[i] = g;
    L.bank[i] = inTrack ? bankF(s, segAt(s)) : 0;
    L.roof[i] = inTrack ? roofF(s, segAt(s)) : 0;
    for (let j = 0; j < SUB; j++) {
      const sm = s + (j + 0.5) * ds;
      const on = sm >= 0 && sm <= length;
      const km = on ? kappa(sm, segAt(sm)) : 0;
      const hm = h + km * ds * 0.5;
      x += Math.sin(hm) * ds;
      z -= Math.cos(hm) * ds;
      y += (on ? grade(sm, segAt(sm)) : 0) * ds;
      h += km * ds;
    }
  }
  for (let i = i0 - 1; i >= 0; i--) {
    const nx = L.px[i + 1] ?? 0, ny = L.py[i + 1] ?? 0, nz = L.pz[i + 1] ?? 0;
    L.px[i] = nx - Math.sin(def.heading);
    L.py[i] = ny;
    L.pz[i] = nz + Math.cos(def.heading);
    heading[i] = def.heading;
  }
  frames(L, heading);
  collect(L, segs, starts);
  return L;
}

function frames(L: BuiltLayout, heading: Float64Array): void {
  for (let i = 0; i < L.n; i++) {
    const h = heading[i] ?? 0, g = L.slope[i] ?? 0, b = L.bank[i] ?? 0;
    const sh = Math.sin(h), ch = Math.cos(h);
    const inv = 1 / Math.hypot(sh, g, ch);
    const tx = sh * inv, ty = g * inv, tz = -ch * inv;
    // right0 = horizontal right; up0 = right0 × tangent; bank rotates both about the tangent.
    const r0x = ch, r0z = sh;
    const u0x = -r0z * ty, u0y = r0z * tx - r0x * tz, u0z = r0x * ty;
    const cb = Math.cos(b), sb = Math.sin(b);
    L.tx[i] = tx; L.ty[i] = ty; L.tz[i] = tz;
    L.rx[i] = r0x * cb - u0x * sb; L.ry[i] = -u0y * sb; L.rz[i] = r0z * cb - u0z * sb;
    L.ux[i] = u0x * cb + r0x * sb; L.uy[i] = u0y * cb; L.uz[i] = u0z * cb + r0z * sb;
  }
}

function collect(L: BuiltLayout, segs: SegmentDef[], starts: number[]): void {
  segs.forEach((g, i) => {
    const b = starts[i] ?? 0;
    for (const f of g.features ?? []) {
      L.features.push({ kind: f.kind, s0: b + f.at, s1: b + f.at + f.len, x0: f.x0, x1: f.x1, ...(f.data ? { data: f.data } : {}) });
    }
    for (const m of g.marks ?? []) L.marks.push({ kind: m.kind, s: b + m.at, x: m.x, data: m.data ?? {} });
    if (!g.name) return;
    const last = L.zones[L.zones.length - 1];
    if (last && last.name === g.name && Math.abs(last.s1 - b) < 1e-6) last.s1 = b + g.len;
    else L.zones.push({ name: g.name, s0: b, s1: b + g.len });
  });
  L.features.sort((a, b) => a.s0 - b.s0);
  L.marks.sort((a, b) => a.s - b.s);
}

/** Sample index (float) for s, clamped to the sampled range. */
export function sampleIndex(L: BuiltLayout, s: number): number {
  const f = s - L.sMin;
  return f < 0 ? 0 : f > L.n - 1 ? L.n - 1 : f;
}

/** Zones containing s (names), e.g. 'tunnel', 'market'. */
export function zoneAt(L: BuiltLayout, s: number): string | null {
  for (const z of L.zones) if (s >= z.s0 && s < z.s1) return z.name;
  return null;
}
