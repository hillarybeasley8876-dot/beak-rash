// AI air tricks (SPEC §16): the show-off species (cat, shiba, seagull, pigeon) spin on a big air 40 % of the
// time — a fresh drift press with a steer, held for 2–4 frames, then released. Every other species never
// tricks. The air that is left is estimated from y, vy and the gravity (17 m/s²), so a press that comes too
// late is just a drift, exactly like a player's.
import type { Rng } from '../../../core/rng';
import type { CharacterId, Controls, RiderState } from '../../../core/types';

export const SHOWOFF = {
  species: ['cat', 'shiba', 'seagull', 'pigeon'] as readonly CharacterId[],
  chance: 0.4,       // of the airs
  minAir: 0.25,      // s of air before the trick may start
  minLeft: 0.55,     // s of air left (a spin needs 0.55 s)
  gravity: 17,       // m/s² of a launched air
  spin: 0.55,        // s of a full spin
  hold: [2, 4],      // frames the drift and the steer are held
  steer: 0.9,        // |steer| that turns a drift press into a spin
} as const;

/** Seconds until touchdown on flat road from the current height and vertical speed. */
export function airLeft(r: RiderState): number {
  const g = SHOWOFF.gravity;
  return (r.vy + Math.sqrt(Math.max(0, r.vy * r.vy + 2 * g * Math.max(0, r.y)))) / g;
}

export class Showoff {
  private hold = 0;       // frames left of the press
  private decided = false; // the roll was made for this air
  private dir = 1;

  constructor(private rng: Rng) {}

  /** True when this species ever shows off. */
  static shows(character: CharacterId): boolean {
    return SHOWOFF.species.includes(character);
  }

  /**
   * Called every step after the driving: it owns the drift and the steer while the rider is in the air.
   * A trick is a spin: the drift is pressed fresh and a steer is held for a couple of frames.
   */
  update(r: RiderState, c: Controls): void {
    if (!Showoff.shows(r.character)) return;
    if (!r.airborne || r.mode !== 'racing') {
      this.decided = false;
      this.hold = 0;
      return;
    }
    if (this.hold > 0) {
      this.hold -= 1;
      c.drift = true;
      c.steer = this.dir * SHOWOFF.steer;
      return;
    }
    // No trick running: the drift is released, so the next press is a fresh one.
    c.drift = false;
    if (this.decided) return;
    if (r.airTime < SHOWOFF.minAir) return;
    if (airLeft(r) < SHOWOFF.minLeft) return;
    this.decided = true;
    if (this.rng.next() > SHOWOFF.chance) return;
    this.hold = this.rng.range(SHOWOFF.hold[0], SHOWOFF.hold[1]);
    this.dir = this.rng.next() < 0.5 ? -1 : 1;
    c.drift = true;
    c.steer = this.dir * SHOWOFF.steer;
  }
}
