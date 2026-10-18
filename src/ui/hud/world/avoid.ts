// Screen-space rectangle avoidance for world-anchored overlays: taunt bubbles settle above name tags
// and each other (nearest speaker first), and docked bubbles stack per screen side.
import { clamp } from '../../../core/math';

/** Screen rectangle in CSS px: left, right, top, bottom. */
export interface Rect { l: number; r: number; t: number; b: number }

export const overlaps = (a: Rect, b: Rect, pad: number): boolean =>
  a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;

/** Rect of a box `w`×`h` whose bottom-centre sits at (cx, by). */
export const boxAt = (cx: number, by: number, w: number, h: number, out: Rect): Rect => {
  out.l = cx - w / 2;
  out.r = cx + w / 2;
  out.t = by - h;
  out.b = by;
  return out;
};

export interface Bounds { minX: number; maxX: number; top: number; bottom: number }

const probe: Rect = { l: 0, r: 0, t: 0, b: 0 };

/**
 * Move a w×h box (bottom-centre at cx, by) up past every obstacle it overlaps; when the ceiling stops
 * it, slide it sideways to the nearer free side instead. Returns the settled bottom-centre in `out`.
 */
export function settle(
  cx: number, by: number, w: number, h: number, obstacles: readonly Rect[], bounds: Bounds, pad: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  let x = clamp(cx, bounds.minX, bounds.maxX);
  let y = clamp(by, bounds.top + h, bounds.bottom);
  for (let pass = 0; pass < 10; pass++) {
    boxAt(x, y, w, h, probe);
    const hit = obstacles.find((o) => overlaps(probe, o, pad));
    if (!hit) break;
    const up = hit.t - pad;
    if (up - h >= bounds.top) {
      y = up;
      continue;
    }
    const left = hit.l - pad - w / 2;
    const right = hit.r + pad + w / 2;
    const goLeft = left >= bounds.minX && (Math.abs(left - x) <= Math.abs(right - x) || right > bounds.maxX);
    x = clamp(goLeft ? left : right, bounds.minX, bounds.maxX);
  }
  out.x = x;
  out.y = y;
  return out;
}
