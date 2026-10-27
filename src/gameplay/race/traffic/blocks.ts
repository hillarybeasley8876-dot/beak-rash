// The solid obstacles on the road that are not traffic: the work-zone wall, the market crates, the
// tipped-over fish truck, the police roadblock. The traffic has to drive around them, so it needs to
// know where the free lateral room is at any point of the road — and the work-zone wall is a *moving*
// gap: its open lane slides from the right side of the road to the left one over the zone.
import type { Obstacle } from '../../../core/types';

/** One solid obstacle on the road, in track space. */
export interface Blocker {
  s: number;
  x: number;
  halfWidth: number;
  halfLength: number;
}

/** One piece of a work-zone wall that is planned but not up yet (the traffic must know it early). */
export interface ZonePiece {
  s: number;
  x: number;
  /** The lateral width of the piece. */
  w: number;
  /** The half length of the piece (along the road). */
  halfLength: number;
}

/** The solid obstacles on the road, sorted by s (so a lookup is a binary search). */
export interface RoadBlockers {
  list: Blocker[];
  /** The longest half length in the list (the search window around any s). */
  maxHalf: number;
}

/** The solid obstacles that are not traffic vehicles, sorted by s. */
export function collectBlockers(obstacles: readonly Obstacle[], own: ReadonlySet<number>): RoadBlockers {
  const list: Blocker[] = [];
  let maxHalf = 0;
  for (const o of obstacles) {
    if (!o.active || !o.solid) continue;
    if (own.has(o.id)) continue;
    list.push({ s: o.s, x: o.x, halfWidth: o.halfWidth, halfLength: o.halfLength });
    if (o.halfLength > maxHalf) maxHalf = o.halfLength;
  }
  list.sort((a, b) => a.s - b.s);
  return { list, maxHalf };
}

/** The first index of `sorted` whose s is ≥ `s`. */
export function lowerBound(sorted: readonly Blocker[], s: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.s < s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The free lateral bands at track position `s`: [lo, hi] pairs inside [-halfWidth, halfWidth]. */
export function freeBands(road: RoadBlockers, s: number, halfWidth: number): Array<[number, number]> {
  const list = road.list;
  const window = road.maxHalf + 0.35;
  const spans: Array<[number, number]> = [];
  for (let i = lowerBound(list, s - window); i < list.length; i++) {
    const b = list[i]!;
    if (b.s > s + window) break;
    // The pad closes the small gaps between the pieces of a wall: the wall is one continuous barrier.
    if (Math.abs(b.s - s) > b.halfLength + 0.35) continue;
    spans.push([b.x - b.halfWidth, b.x + b.halfWidth]);
  }
  if (!spans.length) return [[-halfWidth, halfWidth]];
  spans.sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let edge = -halfWidth;
  for (const [lo, hi] of spans) {
    if (lo > edge + 0.05) out.push([edge, Math.min(lo, halfWidth)]);
    if (hi > edge) edge = hi;
    if (edge >= halfWidth) break;
  }
  if (edge < halfWidth) out.push([edge, halfWidth]);
  return out;
}

/** The first solid obstacle the vehicle meets ahead of it (null when the road ahead is clear). */
export function nextBlocker(
  road: RoadBlockers, s: number, dir: 1 | -1, halfLength: number, range: number,
): Blocker | null {
  const list = road.list;
  const front = s + dir * halfLength;
  let best: Blocker | null = null;
  let bestAlong = Infinity;
  const i0 = lowerBound(list, s);
  if (dir > 0) {
    for (let i = i0; i < list.length; i++) {
      const b = list[i]!;
      const along = b.s - front - b.halfLength;
      if (along > range) break;
      if (along > -2.5 && along < bestAlong) { bestAlong = along; best = b; }
    }
  } else {
    for (let i = i0 - 1; i >= 0; i--) {
      const b = list[i]!;
      const along = front - b.s - b.halfLength;
      if (along > range) break;
      if (along > -2.5 && along < bestAlong) { bestAlong = along; best = b; }
    }
  }
  return best;
}
