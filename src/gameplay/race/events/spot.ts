// Where an event may put its props: never inside a rider. The race soak fails when an obstacle spawns
// inside one (a rider would be shoved out of thin air), so every prop checks the spot first.
import type { Session } from '../../../core/contracts';

/** Is the track spot (s, x) free of riders? */
export function spotFree(session: Session, s: number, x: number, halfS: number, halfX: number): boolean {
  for (const r of session.riders) {
    if (Math.abs(r.s - s) < halfS + 0.9 && Math.abs(r.x - x) < halfX + 0.45) return false;
  }
  return true;
}

/**
 * Is the track spot (s, x) free of the traffic that is already driving there? A wall of barriers never
 * goes up under a car: the piece is left out, so the car keeps its road and the wall closes around it.
 */
export function clearOfTraffic(session: Session, s: number, x: number, halfS: number, halfX: number): boolean {
  for (const o of session.obstacles) {
    if (!o.active || !o.solid) continue;
    if (o.kind !== 'car' && o.kind !== 'van' && o.kind !== 'truck' && o.kind !== 'bus') continue;
    if (Math.abs(o.s - s) < o.halfLength + halfS + 0.6 && Math.abs(o.x - x) < o.halfWidth + halfX + 0.6) return false;
  }
  return true;
}

/** How far on (m) a prop whose spot is taken may be pushed by `freeSpot`. */
export const FREE_SPAN = 30;

/** The first free spot at or after `s`, up to `span` metres further on; null when there is none. */
export function freeSpot(
  session: Session, s: number, x: number, halfS: number, halfX: number, span = FREE_SPAN,
): number | null {
  for (let d = 0; d <= span; d += 3) {
    if (spotFree(session, s + d, x, halfS, halfX)) return s + d;
  }
  return null;
}
