// Finds the last sim substep of each rendered frame, so render-only work (rebuilding ribbons, placing visual
// meshes, rewriting pickup instances) runs once per frame on final poses instead of on every substep.
// The clock advances sim time once per frame before the session steps it; our substeps add up to that time.
import type { Clock } from '../../../core/clock';

/** Sim seconds of slack when matching our summed substeps against the clock (float error only). */
const EPS = 1e-7;

export class FrameGate {
  private end = Number.NaN;    // clock.simTime of the frame being stepped
  private cursor = Number.NaN; // sim time our substeps have reached (NaN: this frame's start is unknown)
  private pending = 0;         // sim seconds since the last sync

  constructor(private clock: Clock) {}

  /** Per substep: returns the sim time to sync (summed since the last sync) on the frame's last substep, else null. */
  tick(dt: number): number | null {
    const end = this.clock.simTime;
    if (end !== this.end) {
      if (this.cursor !== this.end) this.cursor = Number.NaN; // we didn't see the previous frame end: unknown start
      this.end = end;
    }
    this.pending += dt;
    this.cursor += dt;
    // Unknown start (first frame of a session): sync every substep this frame, and line up for the next one.
    const last = Number.isNaN(this.cursor) || this.cursor >= end - EPS;
    if (!last) return null;
    this.cursor = end;
    const sync = this.pending;
    this.pending = 0;
    return sync;
  }
}
