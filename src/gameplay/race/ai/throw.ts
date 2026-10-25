// AI throws (SPEC §15): an armed rival with a target — the rider it is fighting, the player or a rival — 8–30 m
// ahead within ~12° of its heading cocks the weapon back (heavy pressed, heavy held 0.3–0.6 s) and lets go:
// the weapon leaves the hand. The throw is the rival's long-range answer: it lines up on the target for a
// moment, throws, and is unarmed afterwards.
// A rival never throws during the intro or the countdown, never at the player in the first seconds of the
// race, and never at a player that is invulnerable or crashed.
import { clamp, wrapAngle } from '../../../core/math';
import type { Rng } from '../../../core/rng';
import type { Controls, RiderState } from '../../../core/types';

export const THROW = {
  min: 8,          // m: closer than this is a swing, not a throw
  max: 30,         // m
  cone: (12 * Math.PI) / 180,   // rad: the target must be within ~12° of the heading
  aimCone: (30 * Math.PI) / 180, // rad: how far off the rider will turn to line up on the target
  hold: [0.3, 0.6],  // s the heavy key is held (the swing becomes a throw aim)
  cooldown: 6,     // s between two throws of the same rider
  chance: 0.7,     // × the rider's aggression, per opportunity
  offer: 0.4,      // s between two looks for a target
  calm: 6,         // s after GO before anybody throws at the player
  aimSide: 0.9,    // m: the throw lines up beside the target, not on top of it
} as const;

export interface ThrowView {
  phase: 'intro' | 'countdown' | 'racing' | 'finished';
  time: number;
  /** The rider this one is fighting right now (null when it is not hunting anyone). */
  hunt: RiderState | null;
}

/** A rider the throw could go at: it has to be there, awake and in front. */
function hittable(t: RiderState): boolean {
  if (t.mode !== 'racing' && t.mode !== 'finished') return false;
  if (t.mods.intangible || t.mods.invisible) return false;
  return t.invuln <= 0;
}

export class Thrower {
  private hold = 0;        // s left of the hold (the weapon is cocked back)
  private cool = 0;        // s left of the cooldown
  private offerT = 0;      // s left before the next look for a target
  private aim: number | null = null;   // the lateral spot the rider lines up on (null = keep the line)

  constructor(private me: RiderState, private rng: Rng, private aggression: () => number) {}

  /** The lateral target the rider steers to while it lines up on a throw (null = no throw planned). */
  get aimX(): number | null {
    return this.aim;
  }

  /** Called every step: keeps the hold, looks for a target and presses the heavy key. */
  update(dt: number, v: ThrowView, c: Controls, eager: boolean): void {
    this.cool = Math.max(0, this.cool - dt);
    if (this.hold > 0) {
      this.hold -= dt;
      c.heavyHeld = true;
      if (this.hold <= 0) {
        c.heavyHeld = false;
        this.cool = THROW.cooldown;
      }
      return;
    }
    c.heavyHeld = false;
    if (v.phase !== 'racing') { this.aim = null; return; }
    if (this.me.weapon === 'none' || this.me.weapon === 'baton') { this.aim = null; return; }
    this.offerT -= dt;
    if (this.offerT > 0) return;
    this.offerT = THROW.offer;
    const target = this.pick(v);
    if (!target) { this.aim = null; return; }
    const ds = target.s - this.me.s;
    const bearing = Math.atan2(target.x - this.me.x, ds);
    const off = Math.abs(wrapAngle(bearing - this.me.yaw));
    // Not lined up yet: turn towards the target and try again on the next look.
    if (off > THROW.cone) {
      this.aim = target.x + (this.me.x >= target.x ? THROW.aimSide : -THROW.aimSide);
      if (off > THROW.aimCone) this.aim = null;   // too far off to bother
      return;
    }
    this.aim = null;
    const chance = clamp(this.aggression() * THROW.chance * (eager ? 1.5 : 1), 0.05, 0.95);
    if (this.rng.next() > chance) return;
    this.hold = this.rng.range(THROW.hold[0], THROW.hold[1]);
    c.heavy = true;      // the press starts the heavy swing…
    c.heavyHeld = true;  // …held past its windup, it becomes a throw aim
  }

  /**
   * The throw target: the rider this one is fighting right now — the player or a rival (SPEC §15).
   * A rider that is not fighting anyone keeps its weapon: the field does not turn into a shooting gallery.
   */
  private pick(v: ThrowView): RiderState | null {
    const me = this.me;
    const t = v.hunt;
    if (!t || t === me || !hittable(t)) return null;
    // Nobody throws at the player in the first seconds of the race, nor at one that cannot be hit.
    if (t.isPlayer && (v.time < THROW.calm || t.mode === 'crashed')) return null;
    const ds = t.s - me.s;
    if (ds < THROW.min || ds > THROW.max) return null;
    return t;
  }
}
