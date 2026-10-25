// The pieces a seeded route is drawn from (SPEC §20): the authored middle cut into blocks (one per
// zone, with its side profile, features and marks) and generic pieces (curves of several radii,
// S-chicanes, hairpins, straights that carry features). A block travels with its content: the marks
// and features are re-anchored when the block is re-shaped, and the side profile goes with it.
import type { Rng } from '../../core/rng';
import type { GenericKind, RouteHint } from './route-hints';
import { mergeSide } from './sides';
import type { FeatureDef, LayoutDef, MarkDef, SegmentDef, SideDef } from './types';

/** A piece of road: its segments plus the absolute side profile at each of them. */
export interface Block {
  segs: SegmentDef[];
  keyL: SideDef[];
  keyR: SideDef[];
  /** Total length (m). */
  len: number;
  /** Net rise over the block (m). */
  rise: number;
  /** Zone name (the dressing's handle on this run of road). */
  name: string;
  /** The authored stretch of road the block came from (m along the authored layout). */
  src0: number;
  src1: number;
  /** The block was mirrored (the turn and the sides flipped). */
  mirrored: boolean;
}

/** A generic piece's segment: length, radius and bank (no profile or content yet). */
interface ShapeSeg {
  len: number;
  radius?: number;
  bank?: number;
  ease: number;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** A copy of a segment (its features and marks are copied too, so the authored layout stays clean). */
export function copySeg(g: SegmentDef): SegmentDef {
  const out: SegmentDef = { ...g };
  if (g.features) out.features = g.features.map((f) => ({ ...f, data: f.data ? { ...f.data } : undefined }));
  if (g.marks) out.marks = g.marks.map((m) => ({ ...m, data: m.data ? { ...m.data } : undefined }));
  return out;
}

/** The absolute side profile at every segment of a layout (each profile merges onto the previous). */
export function resolveProfiles(def: LayoutDef): { keyL: SideDef[]; keyR: SideDef[] } {
  const keyL: SideDef[] = [], keyR: SideDef[] = [];
  let l = def.left, r = def.right;
  for (const g of def.segments) {
    l = mergeSide(l, g.left);
    r = mergeSide(r, g.right);
    keyL.push(l);
    keyR.push(r);
  }
  return { keyL, keyR };
}

/** The authored middle cut into blocks, one per zone (consecutive segments of the same name). */
export function cutBlocks(def: LayoutDef, head: number, tail: number): Block[] {
  const { keyL, keyR } = resolveProfiles(def);
  const segs = def.segments;
  const end = Math.max(head, segs.length - tail);
  const blocks: Block[] = [];
  let i = head, src = 0;
  // The authored distance along the layout (the head's segments are skipped).
  for (let k = 0; k < head; k++) src += segs[k]?.len ?? 0;
  while (i < end) {
    const name = segs[i]?.name ?? 'road';
    let j = i;
    while (j + 1 < end && (segs[j + 1]?.name ?? 'road') === name) j++;
    const parts: SegmentDef[] = [];
    let len = 0;
    for (let k = i; k <= j; k++) { parts.push(copySeg(segs[k] as SegmentDef)); len += segs[k]?.len ?? 0; }
    blocks.push({
      segs: parts,
      keyL: keyL.slice(i, j + 1),
      keyR: keyR.slice(i, j + 1),
      len,
      rise: sum(parts.map((g) => g.rise ?? 0)),
      name,
      src0: src,
      src1: src + len,
      mirrored: false,
    });
    src += len;
    i = j + 1;
  }
  return blocks;
}

/**
 * The mirrored block: the turns and banks flip sign, the marks and features cross the centre line
 * and the side profiles swap — the same corner, the other way round. The rider still drives
 * forward, so a ramp keeps its launch end (its lateral extent is mirrored, not reversed).
 */
export function mirrorBlock(b: Block): Block {
  const segs = b.segs.map((g) => {
    const out = copySeg(g);
    if (g.radius !== undefined) out.radius = -g.radius;
    if (g.bank !== undefined) out.bank = -g.bank;
    if (g.features) out.features = g.features.map((f) => ({ ...f, x0: -f.x0, x1: -f.x1 }));
    if (g.marks) out.marks = g.marks.map((m) => ({ ...m, x: -m.x }));
    return out;
  });
  return { ...b, segs, keyL: b.keyR, keyR: b.keyL, mirrored: !b.mirrored };
}

/** The shape of a generic piece of the given length (metres; the radii come from the track's hint). */
function shapeOf(kind: GenericKind, len: number, hint: RouteHint, rng: Rng): ShapeSeg[] {
  const curve = (): ShapeSeg[] => {
    const r = rng.pick(hint.radii);
    if (len < 110) return [{ len, radius: r, bank: Math.sign(r) * 4, ease: Math.min(60, len / 3) }];
    return [
      { len: len * 0.3, ease: 30 },
      { len: len * 0.7, radius: r, bank: Math.sign(r) * 4, ease: Math.min(70, len * 0.35) },
    ];
  };
  if (kind === 'straight') return [{ len, ease: 20 }];
  if (kind === 'chicane' && len >= 100) {
    const rc = Math.max(hint.minRadius, hint.chicane);
    return [
      { len: len * 0.25, ease: 24 },
      { len: len * 0.375, radius: -rc, bank: -5, ease: 24 },
      { len: len * 0.375, radius: rc, bank: 5, ease: 24 },
    ];
  }
  if (kind === 'hairpin' && len >= 120) {
    const b = len * 0.7;
    const r = b / Math.PI;                       // a real 180° turn
    if (r >= hint.minRadius) return [{ len: len * 0.3, ease: 26 }, { len: b, radius: r, bank: 7, ease: 26 }];
  }
  return curve();
}

/** The new segment's rise, taken from the authored segment it sits on (the shape of the grade is kept). */
function riseFor(oldSegs: SegmentDef[], oldStart: number[], shape: ShapeSeg[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const g of shape) {
    const mid = acc + g.len / 2;
    acc += g.len;
    let i = 0;
    while (i < oldSegs.length - 1 && oldStart[i + 1] <= mid) i++;
    const src = oldSegs[i];
    const srcLen = src?.len ?? 1;
    out.push(((src?.rise ?? 0) * g.len) / srcLen);
  }
  return out;
}

/**
 * A generic piece: the block re-shaped into a curve of one of the track's radii, an S-chicane, a
 * hairpin or a straight. Same length, same net rise, same zone name and the block's own profile at
 * its start; the marks and features travel with it (re-anchored to the same metres along the road).
 */
export function genericBlock(b: Block, kind: GenericKind, hint: RouteHint, rng: Rng): Block {
  const shape = shapeOf(kind, b.len, hint, rng);
  const oldStart: number[] = [];
  let acc = 0;
  for (const g of b.segs) { oldStart.push(acc); acc += g.len; }
  const newStart: number[] = [];
  acc = 0;
  for (const g of shape) { newStart.push(acc); acc += g.len; }
  const rises = riseFor(b.segs, oldStart, shape);
  // The generic piece keeps the block's net rise exactly (the shape of the grade follows the
  // authored segments it covers).
  const rSum = sum(rises);
  if (Math.abs(rSum) > 1e-6) for (let i = 0; i < rises.length; i++) rises[i] = (rises[i] as number) * (b.rise / rSum);
  else for (let i = 0; i < rises.length; i++) rises[i] = b.rise / rises.length;
  // The profile of the block's first segment covers the whole generic piece (the side of the road
  // does not change in the middle of a re-shaped run).
  const keyL = shape.map(() => b.keyL[0] as SideDef);
  const keyR = shape.map(() => b.keyR[0] as SideDef);
  // Where a mark or feature lands on the new segments.
  const place = (absS: number, len: number): { j: number; at: number; len: number } => {
    let j = 0;
    while (j < shape.length - 1 && (newStart[j + 1] ?? 0) <= absS) j++;
    const at = Math.max(0, Math.min(shape[j]!.len, absS - (newStart[j] ?? 0)));
    const room = Math.max(0.5, b.len - (newStart[j] ?? 0) - at);
    return { j, at, len: Math.max(0.5, Math.min(len, room)) };
  };
  const feats: FeatureDef[][] = shape.map(() => []);
  const marks: MarkDef[][] = shape.map(() => []);
  b.segs.forEach((g, i) => {
    const base = oldStart[i] ?? 0;
    for (const f of g.features ?? []) {
      const p = place(base + f.at, f.len);
      feats[p.j]?.push({ ...f, at: p.at, len: p.len, data: f.data ? { ...f.data } : undefined });
    }
    for (const m of g.marks ?? []) {
      const p = place(base + m.at, 0);
      marks[p.j]?.push({ ...m, at: p.at, data: m.data ? { ...m.data } : undefined });
    }
  });
  const segs: SegmentDef[] = shape.map((g, i) => {
    const out: SegmentDef = { len: g.len, name: b.name, rise: rises[i] ?? 0 };
    if (g.radius !== undefined) out.radius = g.radius;
    if (g.bank !== undefined) out.bank = g.bank;
    out.ease = g.ease;
    if (feats[i]?.length) out.features = feats[i];
    if (marks[i]?.length) out.marks = marks[i];
    return out;
  });
  // A straight that carries a feature: a pickup row of coins down the middle of the road.
  if (kind === 'straight' && segs.length === 1 && !segs[0].features?.length) {
    segs[0].features = [{ kind: 'pickupRow', at: segs[0].len / 2 - 8, len: 16, x0: -4.5, x1: 1.5, data: { kind: 'coin' } }];
  }
  return { segs, keyL, keyR, len: b.len, rise: sum(rises), name: b.name, src0: b.src0, src1: b.src1, mirrored: b.mirrored };
}
