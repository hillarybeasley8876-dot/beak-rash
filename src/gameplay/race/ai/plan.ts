// Lateral planner: scores candidate lanes across the road (racing line, traffic, riders, hazards,
// walls) and picks the cheapest, with hysteresis so riders commit to a pass instead of dithering.
import { clamp } from '../../../core/math';
import type { RiderId } from '../../../core/types';
import { BLOCKING, freeLanes, RIDER_HL, RIDER_HW, type Blip } from './sense';

export interface PlanInput {
  desiredX: number;      // where the rider wants to be with an empty road
  prevX: number;         // last plan (hysteresis)
  x: number;             // current lateral position
  v: number;             // current speed (m/s)
  lo: number;            // drivable lateral limits (already with margins)
  hi: number;
  asphalt: number;       // asphalt half-width
  horizon: number;       // s of look-ahead time
  ignore: RiderId | null; // hunted target: get close instead of avoiding
  blind: number | null;   // obstacle id the rider has not seen (a blunder: rides straight into it)
  canHop: boolean;
  /** The one lane through the barrier row ahead (blockGap), if there is one: everything else hits the wall. */
  gap?: BlockGap | null;
}

export interface PlanOutput {
  x: number;
  /** Speed to hold when the chosen lane is still blocked ahead (null = free). */
  followSpeed: number | null;
  followGap: number;
  followKind: Blip['kind'] | null;
  /** Distance to a hazard in the chosen lane worth hopping (null = none). */
  hopAt: number | null;
}

const CLEAR: Record<Blip['kind'], number> = { rider: 0.35, traffic: 0.75, police: 0.6, hazard: 0.25, solid: 0.55, boost: 0, ramp: 0 };
const WEIGHT: Record<Blip['kind'], number> = { rider: 7, traffic: 45, police: 30, hazard: 5, solid: 45, boost: -2.5, ramp: -1.5 };
const STEP = 0.35;
const STOPPED = 4;         // m/s: a rider this slow is a roadblock (wider berth, weighted like a prop)
const CROSS_T = 1.5;       // s: don't swing across the line of something we reach this soon
const SWITCH_COST = 0.8;   // commit to a lane instead of flip-flopping between two similar ones
const ROW = 1.4;           // m: blocking blips this close along s are one row of the wall
export const BLOCK_LOOK = 60;     // m: how far ahead a barrier row is planned for
const GAP_MIN = 1.2;       // m: the narrowest gap the bike rides through
const GAP_MAX = 6;         // m: free width of a row that is a wall with one gap, not a car or two
const GAP_MARGIN = 0.3;    // m kept beside a barrier on top of the bike's own half width
const GAP_INSET = 0.15;    // m: the planner aims this far inside the gap, not at its very edge
const WALL = 200;          // cost of a lane that ends in a barrier row: no blip cost outweighs it

/** The one way through a barrier row ahead (SPEC §14 roadblock, §19 works): its lane and how far off it is. */
export interface BlockGap { x: number; half: number; ds: number }

/**
 * The gap of the nearest row of standing barriers ahead of the rider, or null when the road is open (or
 * walled shut). A row is two or more static blocking blips at the same s that leave at most GAP_MAX of free
 * road: everything else on the road is traffic to drive around, not a wall to aim at.
 */
export function blockGap(blips: readonly Blip[], lo: number, hi: number): BlockGap | null {
  const wall = blips
    .filter((b) => BLOCKING.has(b.kind) && Math.abs(b.vs) < 0.5 && b.ds > ROW && b.ds < BLOCK_LOOK)
    .sort((a, b) => a.ds - b.ds);
  for (let i = 0; i < wall.length;) {
    const at = wall[i].ds;
    let j = i;
    while (j < wall.length && wall[j].ds - at <= ROW) j++;
    const row = wall.slice(i, j);
    i = j;
    if (row.length < 2) continue;
    const lanes = freeLanes(row, lo, hi, at - ROW, at + ROW, RIDER_HW + GAP_MARGIN, GAP_MIN);
    const open = lanes.reduce((sum, l) => sum + l.half * 2, 0);
    if (!lanes.length || open > GAP_MAX) continue;
    const best = lanes.reduce((a, l) => (l.half > a.half ? l : a));
    return { x: best.x, half: best.half, ds: at };
  }
  return null;
}

/** Seconds until we reach the blip's near end, 0 when alongside, Infinity when not closing. */
function timeTo(b: Blip, v: number): number {
  const gap = Math.abs(b.ds) - (b.hl + RIDER_HL);
  if (gap <= 0) return 0;
  if (b.ds < 0) return Infinity;
  const closing = v - b.vs;
  if (b.kind === 'boost' || b.kind === 'ramp' || b.kind === 'hazard' || b.kind === 'solid') return gap / Math.max(1, v);
  return closing > 0.2 ? gap / closing : Infinity;
}

/** A rider (possibly the hunted one) slow enough to be a roadblock rather than traffic to race. */
const stopped = (b: Blip): boolean => b.kind === 'rider' && b.vs < STOPPED;
/** The hunted rider is ignored (we want to get close) unless it is stopped in the road; so is an unseen vehicle. */
const ignored = (b: Blip, inp: PlanInput): boolean =>
  (!!b.rider && b.rider.id === inp.ignore && !stopped(b)) || (b.oid !== null && b.oid === inp.blind);
/** One of the barriers of the row whose gap we are riding for: crossing its line is the whole point. */
const inRow = (b: Blip, inp: PlanInput): boolean =>
  !!inp.gap && BLOCKING.has(b.kind) && Math.abs(b.vs) < 0.5 && Math.abs(b.ds - inp.gap.ds) <= ROW;

/** The half width of the lane a rider may ride in to get through the gap (the gap less its very edges). */
export const gapHalf = (gap: BlockGap): number => Math.max(0, gap.half - GAP_INSET);

/** Keep the wanted lane `x` inside the gap of the row ahead, and inside the road where that row stands. */
export function gapLane(gap: BlockGap, x: number, at: { left: number; right: number }): number {
  const room = gapHalf(gap);
  return clamp(gap.x + clamp(x - gap.x, -room, room), -at.left + 0.7, at.right - 0.7);
}

/** Outside the one gap of a barrier row every lane ends in the wall, however far off the row still is. */
function gapCost(x: number, inp: PlanInput): number {
  if (!inp.gap) return 0;
  const off = Math.abs(x - inp.gap.x) - gapHalf(inp.gap);
  return off > 0 ? WALL * (1 + off) : 0;
}

/** The lane is inside the gap and `b` is standing in that gap: the one way through is not free. */
function inGap(b: Blip, x: number, inp: PlanInput): boolean {
  if (!inp.gap) return false;
  const lane = Math.abs(x - inp.gap.x) <= gapHalf(inp.gap) + 1e-6;
  return lane && Math.abs(b.x - inp.gap.x) < inp.gap.half + b.hw;
}

function blipCost(b: Blip, x: number, inp: PlanInput, out: { block: boolean }): number {
  if (ignored(b, inp)) return 0;
  const t = timeTo(b, inp.v);
  if (t > inp.horizon) return 0;
  const urgency = Math.pow(1 - t / inp.horizon, 0.7);
  const oncoming = b.vs < -1;
  const bx = b.x + (b.rider ? b.rider.vx * Math.min(t, 0.6) : 0);
  const roadblock = stopped(b);
  const clear = b.hw + RIDER_HW + CLEAR[b.kind] + (oncoming ? 0.4 : 0) + (roadblock ? 0.35 : 0);
  // A lane on the far side of a blip we are beside (not behind) means cutting across its nose: as bad as hitting
  // it — unless it is a barrier of the row we are crossing to reach its gap, which is the only way past it.
  const crossing = !inRow(b, inp) && t < CROSS_T
    && Math.abs(inp.x - bx) >= b.hw + RIDER_HW && (bx - inp.x) * (bx - x) < 0;
  const d = crossing ? 0 : Math.abs(x - bx);
  const w = WEIGHT[b.kind] * (oncoming ? 1.4 : 1) * (b.kind === 'hazard' && inp.canHop ? 0.5 : 1) * (roadblock ? 4 : 1);
  if (w < 0) return d < b.hw ? w * urgency : 0;
  if (d < clear) {
    out.block = true;
    return w * urgency * (1 + (clear - d));
  }
  return d < clear + 1 ? w * 0.12 * (1 - (d - clear)) * urgency : 0;
}

export function planLateral(inp: PlanInput, blips: readonly Blip[]): PlanOutput {
  let bestX = inp.x, bestCost = Infinity;
  const flag = { block: false };
  for (let x = inp.lo; x <= inp.hi + 1e-6; x += STEP) {
    const dl = (x - inp.desiredX) / 2;
    const dh = (x - inp.prevX) / 2;
    let cost = dl * dl + 0.6 * dh * dh + (Math.abs(x - inp.prevX) > 1.4 ? SWITCH_COST : 0);
    const off = Math.abs(x) - (inp.asphalt - 0.4);
    if (off > 0) cost += 3 * off;
    cost += gapCost(x, inp);
    for (const b of blips) cost += blipCost(b, x, inp, flag);
    if (cost < bestCost) { bestCost = cost; bestX = x; }
  }
  return { x: bestX, ...blockage(bestX, inp, blips) };
}

/**
 * What still sits in the chosen lane (and, until we are out of it, in the current lane when we reach it
 * within CROSS_T): who to follow and what to hop.
 */
function blockage(x: number, inp: PlanInput, blips: readonly Blip[]): Omit<PlanOutput, 'x'> {
  let followSpeed: number | null = null, followGap = Infinity, hopAt: number | null = null;
  let followKind: Blip['kind'] | null = null;
  for (const b of blips) {
    if (b.ds <= 0 || ignored(b, inp) || b.kind === 'boost' || b.kind === 'ramp') continue;
    const clear = b.hw + RIDER_HW + CLEAR[b.kind] * 0.5;
    const chosen = Math.abs(x - b.x) < clear || inGap(b, x, inp);
    const gap = b.ds - b.hl - RIDER_HL;
    if (b.kind === 'hazard') {
      if (chosen && inp.canHop && gap > 0 && gap < inp.v * 0.22 + 1.5 && b.hl * 2 < inp.v * 0.36) hopAt = gap;
      continue;
    }
    const t = timeTo(b, inp.v);
    if (!chosen && !(t < CROSS_T && Math.abs(inp.x - b.x) < clear)) continue;
    if (t > inp.horizon * 0.8 || gap >= followGap) continue;
    followGap = gap;
    followKind = b.kind;
    followSpeed = b.kind === 'solid' ? 0 : Math.max(0, b.vs);
  }
  return { followSpeed, followGap, followKind, hopAt };
}
