// The same road, driven the other way (SPEC §20). reverseLayout mirrors a layout: the segment list runs
// backwards, the turns / slopes / banks flip sign, the left and right side profiles swap, and every
// feature, mark and bump is re-anchored on the mirrored road. The mirrored road starts at the forward
// finish (same world position, heading turned by 180°) so it lies exactly on the forward one: the riders
// see the same corners in the same order, the other way round.
import { buildLayout } from './build';
import { mergeSide, type SidePatch } from './sides';
import type { FeatureDef, GroundDef, LayoutDef, MarkDef, SegmentDef, SideDef } from './types';

/** The ground fields that differ between two profiles (the patch that turns one into the other). */
function groundDiff(a: GroundDef, b: GroundDef): Partial<GroundDef> {
  const g: Partial<GroundDef> = {};
  if (a.step !== b.step) g.step = b.step;
  if (a.stepW !== b.stepW) g.stepW = b.stepW;
  if (a.flat !== b.flat) g.flat = b.flat;
  if (a.slope !== b.slope) g.slope = b.slope;
  if (a.target !== b.target) g.target = b.target;
  if (a.rough !== b.rough) g.rough = b.rough;
  if (a.abs !== b.abs) g.abs = b.abs;
  if (a.detached !== b.detached) g.detached = b.detached;
  if (a.mat !== b.mat) g.mat = b.mat;
  return g;
}

/** Patch that turns the side profile `a` into `b` (only the fields that differ). */
function sideDiff(a: SideDef, b: SideDef): SidePatch {
  const p: SidePatch = {};
  if (a.shoulder !== b.shoulder) p.shoulder = b.shoulder;
  if (a.surface !== b.surface) p.surface = b.surface;
  if (a.edge !== b.edge) p.edge = b.edge;
  const g = groundDiff(a.ground, b.ground);
  if (Object.keys(g).length) p.ground = g;
  return p;
}

/** A feature re-anchored on the mirrored road: same length, mirrored across the centre line, and the
 *  crest's peak (an absolute s) moved to its mirrored place. */
function mirrorFeature(f: FeatureDef, len: number, L: number): FeatureDef {
  const out: FeatureDef = { kind: f.kind, at: len - f.at - f.len, len: f.len, x0: -f.x1, x1: -f.x0 };
  if (f.data) {
    const data = { ...f.data };
    if (f.kind === 'jumpCrest' && typeof data.peak === 'number') data.peak = L - data.peak;
    out.data = data;
  }
  return out;
}

/** A mark re-anchored on the mirrored road: mirrored along s and across the centre line. */
function mirrorMark(m: MarkDef, len: number): MarkDef {
  const out: MarkDef = { kind: m.kind, at: len - m.at, x: -m.x };
  if (m.data) out.data = { ...m.data };
  return out;
}

/** Move the mark of `kind` to the absolute s `absS` (the set pieces change ends when the road turns). */
function moveMark(segs: SegmentDef[], kind: string, absS: number): void {
  let found: MarkDef | null = null;
  for (const g of segs) {
    const list = g.marks;
    if (!list) continue;
    const i = list.findIndex((m) => m.kind === kind);
    if (i < 0) continue;
    found = list[i] as MarkDef;
    list.splice(i, 1);
    break;
  }
  if (!found) return;
  let acc = 0;
  for (const g of segs) {
    if (absS <= acc + g.len + 1e-6) {
      found.at = Math.max(0, Math.min(g.len, absS - acc));
      (g.marks ??= []).push(found);
      return;
    }
    acc += g.len;
  }
}

/** The mirrored layout of a track: the same road, driven from the other end. */
export function reverseLayout(def: LayoutDef): LayoutDef {
  const fwd = buildLayout(def);
  const L = fwd.length;
  const iEnd = Math.min(fwd.n - 1, Math.max(0, Math.round(L - fwd.sMin)));
  const endHeading = fwd.hdg[iEnd] ?? def.heading;
  const endY = fwd.py[iEnd] ?? def.elevation;
  const endX = fwd.px[iEnd] ?? 0;
  const endZ = fwd.pz[iEnd] ?? 0;

  const segs = def.segments;
  const n = segs.length;
  // The forward side profiles, one per segment (each merges onto the previous one).
  const keyL: SideDef[] = [], keyR: SideDef[] = [];
  let l = def.left, r = def.right;
  for (const g of segs) {
    l = mergeSide(l, g.left);
    r = mergeSide(r, g.right);
    keyL.push(l);
    keyR.push(r);
  }
  // The start and the finish swap ends: the zone names and the set pieces follow.
  const zoneName = (name: string | undefined): string | undefined =>
    name === 'start' ? 'finish' : name === 'finish' ? 'start' : name;
  const kinds = new Set<string>();
  for (const g of segs) for (const m of g.marks ?? []) kinds.add(m.kind);
  const startKinds = [...kinds].filter((k) => k.startsWith('start'));
  const finishKinds = [...kinds].filter((k) => k.startsWith('finish'));
  const kindMap = new Map<string, string>();
  if (startKinds.length === 1 && finishKinds.length === 1) {
    kindMap.set(startKinds[0] as string, finishKinds[0] as string);
    kindMap.set(finishKinds[0] as string, startKinds[0] as string);
  } else {
    for (const k of startKinds) kindMap.set(k, `finish${k.slice(5)}`);
    for (const k of finishKinds) kindMap.set(k, `start${k.slice(6)}`);
  }
  // Where the forward start / finish pieces stand (absolute s), so the mirrored ones can stand like theirs.
  let startS = 0, finishS = L, acc = 0, gotStart = false, gotFinish = false;
  for (const g of segs) {
    for (const m of g.marks ?? []) {
      if (!gotStart && startKinds.includes(m.kind)) { startS = acc + m.at; gotStart = true; }
      if (!gotFinish && finishKinds.includes(m.kind)) { finishS = acc + m.at; gotFinish = true; }
    }
    acc += g.len;
  }

  const out: SegmentDef[] = [];
  for (let j = 0; j < n; j++) {
    const i = n - 1 - j;
    const src = segs[i] as SegmentDef;
    const next = segs[i + 1];
    const seg: SegmentDef = { len: src.len };
    if (src.radius !== undefined) seg.radius = -src.radius;
    if (src.rise !== undefined) seg.rise = -src.rise;
    if (src.bank !== undefined) seg.bank = -src.bank;
    if (src.roof !== undefined) seg.roof = src.roof;
    // The transitions sat at a segment's start; on the mirrored road that boundary is this segment's end,
    // so they move one segment along (the ramp keeps its width, centred on the same boundary).
    if (next?.ease !== undefined) seg.ease = next.ease;
    if (next?.vEase !== undefined) seg.vEase = next.vEase;
    if (next?.sideEase !== undefined) seg.sideEase = next.sideEase;
    if (src.name !== undefined) seg.name = zoneName(src.name);
    // The side profiles swap: the mirrored left profile is the forward right one, and back.
    if (j > 0) {
      const pl = sideDiff(keyR[i + 1] as SideDef, keyR[i] as SideDef);
      if (Object.keys(pl).length) seg.left = pl;
      const pr = sideDiff(keyL[i + 1] as SideDef, keyL[i] as SideDef);
      if (Object.keys(pr).length) seg.right = pr;
    }
    if (src.features) seg.features = src.features.map((f) => mirrorFeature(f, src.len, L));
    if (src.marks) {
      seg.marks = src.marks.map((m) => {
        const mm = mirrorMark(m, src.len);
        const swap = kindMap.get(m.kind);
        if (swap) mm.kind = swap;
        return mm;
      });
    }
    out.push(seg);
  }
  // The set pieces stand where their own kind stands on the forward road: the start gantry ahead of the
  // grid, the finish arch on the line.
  for (const k of startKinds) {
    const swap = kindMap.get(k);
    if (swap) moveMark(out, swap, finishS);
  }
  for (const k of finishKinds) {
    const swap = kindMap.get(k);
    if (swap) moveMark(out, swap, startS);
  }
  return {
    ...def,
    heading: endHeading + Math.PI,
    elevation: endY,
    origin: { x: endX, z: endZ },
    reversed: true,
    pre: def.post,
    post: def.pre,
    left: keyR[n - 1] as SideDef,
    right: keyL[n - 1] as SideDef,
    segments: out,
    bumps: def.bumps?.map((b) => ({ ...b, s: L - b.s, x: -b.x })),
  };
}
