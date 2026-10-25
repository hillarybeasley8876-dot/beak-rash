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

/** The first free spot at or after `s`, up to `span` metres further on; null when there is none. */
export function freeSpot(
  session: Session, s: number, x: number, halfS: number, halfX: number, span = 30,
): number | null {
  for (let d = 0; d <= span; d += 3) {
    if (spotFree(session, s + d, x, halfS, halfX)) return s + d;
  }
  return null;
}
