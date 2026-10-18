// Name-tag level of detail and layout policy: which rivals get a full plate (name + HP + chip) and where
// every label goes. At most three full plates (casting, angry, current melee target, nearest within
// ~12 m); everyone else collapses to a compact place pip. Plates never sit in the keep-clear area above
// the vanishing point: they slide out sideways (a leader line keeps them attached) and fan out sideways
// from each other instead of stacking into a column.
import type { RiderState } from '../../../core/types';
import { overlaps, type Rect } from './avoid';

export const MAX_FULL = 3;
/** A rival this close (metres, track space) is relevant; one already shown full keeps it up to FAR. */
const NEAR = 12;
const FAR = 14;

export interface TagLayoutItem {
  /** Anchor above the head (screen px) and depth (m) of this frame. */
  x: number;
  y: number;
  depth: number;
  /** Drawn size in screen px (scale applied) of the current form (plate or pip). */
  w: number;
  h: number;
  full: boolean;
  /** Side the plate left the keep-clear zone to (−1 left, +1 right, 0 none); kept between frames so a
   *  rider near the centre line does not make its plate flip sides. */
  side: number;
  /** Out: bottom-centre of the drawn label. */
  tx: number;
  ty: number;
}

/** Relevance of a rival for a full plate (0 = not relevant: pip only). */
export function relevance(r: RiderState, me: RiderState, casting: boolean, wasFull: boolean): number {
  const ds = Math.abs(r.s - me.s);
  const dx = Math.abs(r.x - me.x);
  const angry = r.statuses.some((s) => s.id === 'angry' && s.source === me.id);
  const target = ds < 1.8 && dx < 1.6;
  const near = ds < (wasFull ? FAR : NEAR);
  if (!casting && !angry && !target && !near) return 0;
  return (casting ? 100 : 0) + (angry ? 50 : 0) + (target ? 40 : 0) + Math.max(0, FAR - ds) * 2 + (wasFull ? 3 : 0);
}

const probe: Rect = { l: 0, r: 0, t: 0, b: 0 };
const rectOf = (x: number, y: number, w: number, h: number, out: Rect): Rect => {
  out.l = x - w / 2;
  out.r = x + w / 2;
  out.t = y - h;
  out.b = y;
  return out;
};

/** Centre x of a plate standing at the keep-clear zone's edge on its side (it.side ≠ 0). */
export const zoneWall = (it: TagLayoutItem, zone: Rect, pad: number): number =>
  it.side < 0 ? zone.l - it.w / 2 - 2 * pad : zone.r + it.w / 2 + 2 * pad;

/**
 * Place full plates first (nearest first): out of the keep-clear zone to their side, then stacked up above
 * any `blocked` HUD rect or earlier plate they overlap (sideways only when there is no room above), never
 * back into the zone. Then pips at their anchors, nudged sideways (≤ 2.5 pip widths) off plates and pips.
 */
export function layoutTags(
  items: TagLayoutItem[], zone: Rect, blocked: readonly Rect[], width: number, top: number, pad: number,
): void {
  const placed: Rect[] = [...blocked];
  const mid = (zone.l + zone.r) / 2;
  const flip = (zone.r - zone.l) * 0.12;
  const toSide = (it: TagLayoutItem, x: number): number => {
    // Keep last frame's side unless the anchor is now well over on the other side.
    if (it.side === 0 || (it.side < 0 && x > mid + flip) || (it.side > 0 && x < mid - flip)) it.side = x < mid ? -1 : 1;
    return zoneWall(it, zone, pad);
  };
  for (const it of items.filter((i) => i.full).sort((a, b) => a.depth - b.depth)) {
    let x = it.x;
    let y = it.y;
    // The zone is a wall (2·pad also clears the plate's skew and outline): a plate reaching it stops at
    // its edge, so the target moves continuously.
    if (overlaps(rectOf(x, y, it.w, it.h, probe), zone, 2 * pad)) x = toSide(it, x);
    else it.side = 0;
    for (let pass = 0; pass < 6; pass++) {
      const hit = placed.find((o) => overlaps(rectOf(x, y, it.w, it.h, probe), o, pad));
      if (!hit) break;
      if (hit.t - pad - it.h >= top) y = hit.t - pad;
      else x = x < width / 2 ? hit.l - pad - it.w / 2 : hit.r + pad + it.w / 2;
      if (overlaps(rectOf(x, y, it.w, it.h, probe), zone, 2 * pad)) x = toSide(it, x);
    }
    it.tx = Math.min(width - it.w / 2 - pad, Math.max(it.w / 2 + pad, x));
    it.ty = y;
    placed.push(rectOf(it.tx, y, it.w, it.h, { l: 0, r: 0, t: 0, b: 0 }));
  }
  for (const it of items.filter((i) => !i.full).sort((a, b) => a.depth - b.depth)) {
    it.side = 0;
    let x = it.x;
    for (let pass = 0; pass < 4; pass++) {
      const hit = placed.find((o) => overlaps(rectOf(x, it.y, it.w, it.h, probe), o, 2));
      if (!hit) break;
      const left = hit.l - 2 - it.w / 2;
      const right = hit.r + 2 + it.w / 2;
      const nx = Math.abs(left - it.x) <= Math.abs(right - it.x) ? left : right;
      if (Math.abs(nx - it.x) > it.w * 2.5) break;
      x = nx;
    }
    it.tx = x;
    it.ty = it.y;
    placed.push(rectOf(x, it.y, it.w, it.h, { l: 0, r: 0, t: 0, b: 0 }));
  }
}
