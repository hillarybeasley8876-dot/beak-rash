// A rival's rare blunder (acceptance r1: traffic never bit the AI): while the player watches, a rider fixates on
// the road and misses a slow vehicle (or an oncoming one) in its lane: it neither steers nor brakes for it, and
// the sim crashes it into the bumper. The director allows one per race, only in view of the chase camera
// (ai/index.ts); the chance scales with (1.2 − skill), so a sloppy driver on poor form is the likely victim.
import type { Rng } from '../../../core/rng';
import type { RiderState } from '../../../core/types';
import type { Blip } from './sense';

const RATE = 0.6;            // 1/s × (1.2 − skill) while a vehicle qualifies (≈ 30 % per encounter)
const NEAR = 10, FAR = 40;   // m bumper gap where the vehicle must be (time to steer into it end-on)
const LATERAL = 1;           // m beyond the vehicle's half width: in or next to its lane
const CLOSING = 8.5;         // m/s: closing faster than this crashes the rider (sim trafficCrashRel 8)
const BLIND_TIME = 3;        // s the rider stays blind to it

export interface BlunderGate {
  /** May this rider blunder now (budget left, in view of the chase camera, mid-race)? */
  may(r: RiderState): boolean;
  /** A blunder started: spends the race's budget. */
  spend(): void;
}

export class Blunder {
  /** Obstacle id the rider is blind to, or null. */
  oid: number | null = null;
  /** Lateral spot of that vehicle: target fixation steers the rider at what it stares at. */
  aimX = 0;
  private t = 0;

  constructor(private r: RiderState, private skill: number, private rng: Rng) {}

  /** Call every plan tick (`dt` s) with fresh blips; returns the obstacle id the rider is blind to (or null). */
  update(dt: number, blips: readonly Blip[], gate: BlunderGate): number | null {
    const r = this.r;
    if (this.oid !== null) {
      this.t -= dt;
      const b = blips.find((x) => x.oid === this.oid);
      if (this.t <= 0 || !b || b.ds < -b.hl || r.mode !== 'racing') this.oid = null;
      else this.aimX = b.x;
      return this.oid;
    }
    if (r.mode !== 'racing' || !gate.may(r)) return null;
    const target = blips.find((b) => b.kind === 'traffic' && b.oid !== null && this.qualifies(b));
    if (!target || this.rng.next() > RATE * Math.max(0.1, 1.2 - this.skill) * dt) return null;
    this.oid = target.oid;
    this.aimX = target.x;
    this.t = BLIND_TIME;
    gate.spend();
    return this.oid;
  }

  private qualifies(b: Blip): boolean {
    const gap = b.ds - b.hl - 0.9;
    return gap > NEAR && gap < FAR && Math.abs(b.x - this.r.x) < b.hw + LATERAL && this.r.speed - b.vs > CLOSING;
  }
}
