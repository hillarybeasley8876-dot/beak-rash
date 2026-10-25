// Seeded routes (SPEC §20): the authored layout's opening and closing set pieces stay where they
// are, the middle is drawn again from a pool of the track's own blocks and generic pieces. The seed
// decides the order, which blocks are mirrored and which are re-shaped; the same seed always builds
// the same road. Every draw is checked against the authored layout (length, curve radius, the road
// never coming back to itself, the elevation band, the feature spacing) and the authored layout is
// kept when no draw passes.
import { Rng } from '../../core/rng';
import { buildLayout, type BuiltLayout } from './build';
import { cutBlocks, copySeg, genericBlock, mirrorBlock, resolveProfiles, type Block } from './route-blocks';
import { routeHint, type RouteHint } from './route-hints';
import { approachTo, planAfter, planOf, selfDistance, SELF_GAP, SELF_MIN, SELF_RISE, type Plan, type PlanState } from './route-plan';
import type { BumpDef, LayoutDef, SegmentDef } from './types';

/** How many draws the generator makes before it keeps the authored layout. */
const ATTEMPTS = 40;
/** Features that own their stretch of road: a block holding one is never re-shaped. */
const STRUCTURAL = new Set(['tunnel', 'bridge', 'jumpCrest', 'ramp']);
/** How close two features may come (m). */
const FEATURE_GAP = 1;
/** The tightest curve a ramp or a crest jump may sit in (m). */
const FEATURE_RADIUS = 50;
/** How much room the road keeps around a terrain dome (m). */
const KEEP_CLEAR = 40;
/** The room a layout's own dome keeps from the road (m). */
const DOME_GAP = 14;
/** The plan step of the greedy's own look at the road (m); the final check is finer. */
const GREEDY_STEP = 8;
/** How many candidates the greedy weighs against the road it has laid so far. */
const CANDIDATES = 4;

interface Band { lo: number; hi: number }

/** A layout under construction: the segments, where the middle starts and ends, and the blocks. */
interface Draft {
  def: LayoutDef;
  segs: SegmentDef[];
  midStart: number;
  midEnd: number;
  /** Where each block ended up (its distance along the new road). */
  at: Map<Block, number>;
  order: Block[];
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/**
 * A seeded route of a track: the authored layout with a new middle. The same seed always builds the
 * same road; a route that breaks a rule of the road (too tight a curve, a road that meets itself,
 * a hill outside the track's band) is never handed out.
 */
export function routeLayout(def: LayoutDef, seed: number, report?: (msg: string) => void): LayoutDef {
  const hint = routeHint(def.id);
  const authored = buildLayout(def);
  const band = bandOf(authored, hint);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = new Rng((seed + attempt * 0x9e3779b9) >>> 0);
    const why: string[] = [], notes: string[] = [];
    const out = draw(def, hint, band, authored, rng, why, notes);
    if (out) {
      report?.(`route ${def.id} #${seed}: ${notes.join(', ') || 'the authored order'}`);
      return out;
    }
    report?.(`route ${def.id} #${seed}: draw ${attempt} rejected (${why[0] ?? 'no order'})`);
  }
  console.warn(`[route] ${def.id}: no seeded route passed the checks — keeping the authored layout`);
  report?.(`route ${def.id} #${seed}: every draw rejected`);
  return def;
}

/** The elevation the route may stay within: the authored band, padded by the track's hint. */
function bandOf(L: BuiltLayout, hint: RouteHint): Band {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < L.n; i++) {
    const s = L.sMin + i;
    if (s < 0 || s > L.length) continue;
    const y = L.py[i] ?? 0;
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return { lo: lo - hint.bandBottom, hi: hi + hint.bandTop };
}

/** One draw: the pool, the order, the road. Null when the draw breaks a rule. */
function draw(def: LayoutDef, hint: RouteHint, band: Band, authored: BuiltLayout, rng: Rng, why: string[], notes: string[]): LayoutDef | null {
  const pool = transform(cutBlocks(def, hint.head, hint.tail), hint, rng, notes);
  const order = greedy(def, hint, pool, band);
  if (!order) { why.push('no order'); return null; }
  const draft = assemble(def, hint, order);
  balanceTurn(draft.segs, draft.midStart, draft.midEnd, middleTurn(def, hint), hint.minRadius);
  fixPeaks(draft.segs);
  draft.def.bumps = reanchorBumps(def, draft);
  const L = buildLayout(draft.def);
  const problem = fault(L, band, hint, authored);
  if (problem) { why.push(problem); return null; }
  return draft.def;
}

/** The net turn of a block (rad). */
function blockTurn(b: Block): number {
  return b.segs.reduce((a, g) => a + (g.radius ? g.len / g.radius : 0), 0);
}

/** Does the block hold a feature that owns its stretch of road? */
function hasStructural(b: Block): boolean {
  return b.segs.some((g) => (g.features ?? []).some((f) => STRUCTURAL.has(f.kind)));
}

/**
 * May the block be mirrored? The sides swap, so both sides have to hold the same kind of world
 * (the sea on one side and the hills on the other may not change hands: the dressing of the track
 * stands on the side it knows).
 */
function swappable(b: Block): boolean {
  const l = b.keyL[0], r = b.keyR[0];
  if (!l || !r) return false;
  return l.ground.abs === r.ground.abs && l.ground.detached === r.ground.detached;
}

/** The pool: the track's own blocks, some mirrored, some re-shaped into a generic piece. */
function transform(blocks: Block[], hint: RouteHint, rng: Rng, notes: string[]): Block[] {
  return blocks.map((b) => {
    let out = b;
    // Mirror a block whose corner is small: the road keeps its line, the corner changes hands.
    if (swappable(out) && Math.abs(blockTurn(b)) <= 0.55 && rng.chance(0.3)) {
      out = mirrorBlock(out);
      notes.push(`mirrored ${b.name}`);
    }
    // Re-shape a plain block into one of the track's generic pieces.
    if (!hasStructural(out) && rng.chance(0.25)) {
      out = genericBlock(out, rng.pick(hint.kinds), hint, rng);
      notes.push(`generic ${b.name}`);
    }
    return out;
  });
}

/**
 * The order the blocks are laid in: the road always climbs and falls inside the track's band, and
 * it never comes back to itself. The block that hurts least is taken first, so a draw always ends
 * with a complete road; the checks afterwards decide whether it is good enough.
 */
function greedy(def: LayoutDef, hint: RouteHint, pool: Block[], band: Band): Block[] | null {
  const head = def.segments.slice(0, hint.head);
  const start: PlanState = { h: def.heading, x: def.origin?.x ?? 0, y: def.elevation, z: def.origin?.z ?? 0, s: 0 };
  let segs: SegmentDef[] = head.slice();
  let plan = planOf(segs, start, GREEDY_STEP);
  let y = def.elevation + sum(head.map((g) => g.rise ?? 0));
  const remaining = pool.slice();
  const order: Block[] = [];
  while (remaining.length) {
    const costs = remaining.map((b) => ({ b, e: elevCost(b, y, band) }));
    costs.sort((a, c) => a.e - c.e);
    let best: { b: Block; cost: number } | null = null;
    for (const c of costs.slice(0, CANDIDATES)) {
      const p = planOf([...segs, ...c.b.segs], start, GREEDY_STEP);
      const d = approachTo(plan, planAfter(p, plan.s[plan.s.length - 1] ?? 0));
      const cost = c.e * 2 + Math.max(0, SELF_MIN - d);
      if (!best || cost < best.cost) best = { b: c.b, cost };
    }
    if (!best) return null;
    const b = best.b;
    order.push(b);
    segs = [...segs, ...b.segs];
    plan = planOf(segs, start, GREEDY_STEP);
    y += b.rise;
    remaining.splice(remaining.indexOf(b), 1);
  }
  return order;
}

/** How far the block's own grade would leave the band (m). */
function elevCost(b: Block, y: number, band: Band): number {
  let cum = 0, lo = 0, hi = 0;
  for (const g of b.segs) {
    cum += g.rise ?? 0;
    if (cum < lo) lo = cum;
    if (cum > hi) hi = cum;
  }
  return Math.max(0, band.lo - (y + lo)) + Math.max(0, (y + hi) - band.hi);
}

/** The road of a draw: the authored head, the new middle, the authored tail. */
function assemble(def: LayoutDef, hint: RouteHint, order: Block[]): Draft {
  const segs: SegmentDef[] = [];
  for (const g of def.segments.slice(0, hint.head)) segs.push(copySeg(g));
  const midStart = segs.length;
  const at = new Map<Block, number>();
  let acc = 0;
  for (const b of order) {
    at.set(b, acc);
    b.segs.forEach((g, i) => {
      const o = copySeg(g);
      o.left = b.keyL[i];
      o.right = b.keyR[i];
      segs.push(o);
    });
    acc += b.len;
  }
  const midEnd = segs.length;
  const keys = resolveProfiles(def);
  const tail0 = def.segments.length - hint.tail;
  for (let i = 0; i < hint.tail; i++) {
    const o = copySeg(def.segments[tail0 + i] as SegmentDef);
    o.left = keys.keyL[tail0 + i];
    o.right = keys.keyR[tail0 + i];
    segs.push(o);
  }
  return { def: { ...def, segments: segs }, segs, midStart, midEnd, at, order };
}

/** The net turn of the authored middle (rad): the route keeps the road's overall line. */
function middleTurn(def: LayoutDef, hint: RouteHint): number {
  const segs = def.segments.slice(hint.head, def.segments.length - hint.tail);
  return segs.reduce((a, g) => a + (g.radius ? g.len / g.radius : 0), 0);
}

/**
 * Give the middle back the turn it lost (or won) when the blocks were shuffled: the error is spread
 * over the corners, the straights taking most of it (a straight may become the gentlest curve), and
 * no corner may end up tighter than the track's tightest curve.
 */
function balanceTurn(segs: SegmentDef[], from: number, to: number, target: number, minR: number): void {
  const idx: number[] = [];
  for (let i = from; i < to; i++) if (segs[i]?.radius) idx.push(i);
  if (!idx.length) return;
  const turnOf = (i: number): number => {
    const r = segs[i]?.radius;
    return r ? (segs[i]?.len ?? 0) / r : 0;
  };
  let err = target - sum(idx.map(turnOf));
  for (let pass = 0; pass < 4 && Math.abs(err) > 0.02; pass++) {
    const w = idx.map((i) => 1 / (1 + 4 * Math.abs(turnOf(i))));
    const wsum = sum(w) || 1;
    for (let k = 0; k < idx.length && Math.abs(err) > 0.02; k++) {
      const i = idx[k] as number;
      const g = segs[i] as SegmentDef;
      const t = turnOf(i);
      const cap = g.len / minR;
      const want = t + err * (w[k] as number) / wsum;
      const nt = Math.max(-cap, Math.min(cap, want));
      if (Math.abs(nt - t) < 1e-6) continue;
      const sign = Math.sign(nt) !== Math.sign(t) ? -1 : 1;
      if (g.bank !== undefined) g.bank = Math.max(-12, Math.min(12, g.bank * sign * (Math.abs(nt) / Math.abs(t))));
      // A corner that is straightened loses its radius; every other one keeps at least the track's
      // tightest curve.
      if (Math.abs(nt) < 1e-4) g.radius = undefined;
      else g.radius = g.len / nt;
      err -= nt - t;
    }
  }
}

/** The crest jump's peak is the top of the crest: the middle of the jump, on the new road. */
function fixPeaks(segs: SegmentDef[]): void {
  let s = 0;
  for (const g of segs) {
    for (const f of g.features ?? []) {
      if (f.kind !== 'jumpCrest') continue;
      f.data = { ...(f.data ?? {}), peak: s + f.at + f.len / 2 };
    }
    s += g.len;
  }
}

/** The terrain domes follow the block they stood on (the head and the tail keep theirs). */
function reanchorBumps(def: LayoutDef, draft: Draft): BumpDef[] | undefined {
  if (!def.bumps?.length) return def.bumps;
  const out: BumpDef[] = [];
  for (const b of def.bumps) {
    const blk = draft.order.find((o) => b.s >= o.src0 && b.s < o.src1);
    if (blk) {
      const ns = (draft.at.get(blk) ?? 0) + (b.s - blk.src0);
      out.push({ ...b, s: ns, x: blk.mirrored ? -b.x : b.x });
      continue;
    }
    out.push({ ...b });
  }
  return out;
}

/** The plan view of a built layout: the same samples the tracks are measured on (every `step` metres
 *  from the start line, or from the very beginning of the visual road). */
function planFromBuilt(L: BuiltLayout, step = 4, from = 0): Plan {
  const i0 = Math.round(from - L.sMin);
  const n = Math.max(1, Math.floor((L.sMin + L.n - 1 - from) / step) + 1);
  const s = new Float64Array(n), x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = Math.min(L.n - 1, Math.max(0, i0 + i * step));
    s[i] = from + i * step;
    x[i] = L.px[j] ?? 0;
    y[i] = L.py[j] ?? 0;
    z[i] = L.pz[j] ?? 0;
  }
  const last = Math.min(L.n - 1, Math.max(0, i0 + (n - 1) * step));
  return {
    s, x, y, z,
    end: {
      h: Math.atan2(L.tx[last] ?? 0, -(L.tz[last] ?? 1)),
      x: x[n - 1] ?? 0, y: y[n - 1] ?? 0, z: z[n - 1] ?? 0, s: s[n - 1] ?? 0,
    },
  };
}

/** The world centre of a layout's own dome (an island, a headland) at (s, x). */
function bumpAt(L: BuiltLayout, b: BumpDef): { x: number; z: number } {
  const i = Math.min(L.n - 1, Math.max(0, Math.round(b.s - L.sMin)));
  return { x: (L.px[i] ?? 0) + (L.rx[i] ?? 0) * b.x, z: (L.pz[i] ?? 0) + (L.rz[i] ?? 0) * b.x };
}

/** The world centre of a terrain dome the track pins to a fixed place ([s, along, x, radius]). */
function anchorAt(L: BuiltLayout, a: [number, number, number, number]): { x: number; z: number; r: number } {
  const i = Math.min(L.n - 1, Math.max(0, Math.round(a[0] - L.sMin)));
  const rl = Math.hypot(L.rx[i] ?? 0, L.rz[i] ?? 0) || 1;
  const tl = Math.hypot(L.tx[i] ?? 0, L.tz[i] ?? 0) || 1;
  return {
    x: (L.px[i] ?? 0) + ((L.tx[i] ?? 0) / tl) * a[1] + ((L.rx[i] ?? 0) / rl) * a[2],
    z: (L.pz[i] ?? 0) + ((L.tz[i] ?? 0) / tl) * a[1] + ((L.rz[i] ?? 0) / rl) * a[2],
    r: a[3],
  };
}

/** Does the drawn road keep the track's rules? The first rule it breaks is named. */
function fault(L: BuiltLayout, band: Band, hint: RouteHint, authored: BuiltLayout): string | null {
  // The length stays within a tenth of the authored one.
  if (Math.abs(L.length - authored.length) > authored.length * 0.1) return `length ${Math.round(L.length)} m`;
  // Every curve is at least as wide as the track's tightest curve.
  for (let i = 0; i < L.n; i++) {
    const k = Math.abs(L.curv[i] ?? 0);
    if (k > 1 / hint.minRadius + 1e-6) return `curve R ${(1 / k).toFixed(1)} m`;
  }
  // The road stays in the track's elevation band.
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < L.n; i++) {
    const s = L.sMin + i;
    if (s < 0 || s > L.length) continue;
    const y = L.py[i] ?? 0;
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  if (lo < band.lo - 0.5 || hi > band.hi + 0.5) return `elevation ${lo.toFixed(1)}–${hi.toFixed(1)} m`;
  // The road never comes back to itself.
  const hit = selfDistance(planFromBuilt(L), SELF_GAP, SELF_RISE, 2);
  if (hit.dist < SELF_MIN) return `self ${hit.dist.toFixed(1)} m at ${hit.at.map((v) => Math.round(v)).join('–')} m`;
  // The visual road before the start and after the finish may not run over the road either.
  const whole = selfDistance(planFromBuilt(L, 4, L.sMin), SELF_GAP, SELF_RISE, 2);
  if (whole.dist < SELF_MIN) return `the road runs over itself at ${whole.at.map((v) => Math.round(v)).join('–')} m`;
  // The road stays clear of the terrain domes the track pins to a fixed place.
  for (const a of hint.keepClear ?? []) {
    const c = anchorAt(L, a);
    let d = Infinity;
    for (let i = 0; i < L.n; i += 4) d = Math.min(d, Math.hypot((L.px[i] ?? 0) - c.x, (L.pz[i] ?? 0) - c.z));
    if (d < c.r + KEEP_CLEAR) return `a terrain dome at s ${a[0]} is only ${Math.round(d)} m away`;
  }
  // The layout's own domes (an island, a headland) follow their block and keep their distance.
  for (const b of L.def.bumps ?? []) {
    const c = bumpAt(L, b);
    let d = Infinity;
    for (let i = 0; i < L.n; i += 4) d = Math.min(d, Math.hypot((L.px[i] ?? 0) - c.x, (L.pz[i] ?? 0) - c.z));
    if (d - b.r < DOME_GAP) return `the dome at s ${b.s} is only ${Math.round(d - b.r)} m from the road`;
  }
  // The features keep their distance to each other and stay out of the tight corners. A tunnel or
  // a bridge is a shell around the road, so the features inside it do not count as an overlap.
  const feats = L.features;
  const shell = (f: { kind: string }): boolean => f.kind === 'tunnel' || f.kind === 'bridge';
  for (let i = 1; i < feats.length; i++) {
    const a = feats[i - 1], b = feats[i];
    if (!a || !b) continue;
    if (shell(a) || shell(b)) continue;
    if (b.s0 < a.s1 - FEATURE_GAP) return `features overlap at ${Math.round(b.s0)} m`;
  }
  for (const f of feats) {
    if (f.kind !== 'ramp' && f.kind !== 'jumpCrest') continue;
    for (const s of feats) {
      if (!shell(s) || s === f) continue;
      if (f.s0 < s.s1 && f.s1 > s.s0) return `${f.kind} inside the ${s.kind} at ${Math.round(f.s0)} m`;
    }
    for (let s = Math.max(0, f.s0); s <= f.s1; s += 2) {
      if (Math.abs(L.curv[Math.round(s - L.sMin)] ?? 0) > 1 / FEATURE_RADIUS) return `${f.kind} in a tight corner at ${Math.round(f.s0)} m`;
    }
  }
  return null;
}
