// Keeps the hero visible past riders in the chase camera's gap (a rival drafting 2–5 m behind it, a fight
// on the same line). Riders are boxes in track space (|ds| < 0.85, |dx| < 0.35, 1.9 m tall); while one blocks
// the sight line to the hero's chest or head, the eye slides toward the open side (≤ 1.4 m) and, when that is
// not enough, rises (≤ 0.8 m), on calm ω-8 springs held 0.5 s after the line clears, still looking at the
// hero. The side sticks until the blocker is clearly on it (no swinging while a drafter weaves behind).
import { clamp, springStep } from '../core/math';
import type { Session } from '../core/contracts';
import type { RiderState } from '../core/types';
import type { TrackPoint } from './avoid';

export const OCCLUDE = {
  halfLength: 0.85, halfWidth: 0.35, height: 1.9, margin: 0.12, // rider box (+ clearance for the sight line)
  points: [1.2, 1.65],                                           // hero chest / head heights above its wheels
  sideMax: 1.4, liftMax: 0.8, omega: 8, hold: 0.5,
  switchGap: 0.3,                                                // m the blocker must be on the eye's side to flip it
};

/** True for a rider whose body can stand between the camera and the hero. */
function blocker(r: RiderState, hero: RiderState): boolean {
  if (r === hero || r.mods.invisible) return false;
  if (r.mode !== 'racing' && r.mode !== 'finished' && r.mode !== 'respawning') return false;
  return !r.statuses.some((st) => st.id === 'gulped' && st.time > 0);
}

export class RiderOcclude {
  /** Current eye offsets: lateral (m, + right) and lift (m), for the chase cam and telemetry. */
  side = 0;
  lift = 0;
  private sideV = 0;
  private liftV = 0;
  private wantSide = 0;
  private wantLift = 0;
  private held = 0;
  private dir: -1 | 0 | 1 = 0;

  reset(): void {
    this.side = this.lift = this.sideV = this.liftV = this.wantSide = this.wantLift = this.held = 0;
    this.dir = 0;
  }

  /** Side to slide toward, away from the blocker; keeps the current side unless it is clearly the wrong one. */
  private sideFor(heroX: number, riderX: number, roomL: number, roomR: number): -1 | 1 {
    const away = heroX - riderX;
    if (this.dir !== 0 && away * this.dir > -OCCLUDE.switchGap && (this.dir > 0 ? roomR : roomL) > 0.2) return this.dir;
    if (Math.abs(away) > 0.05) return away > 0 ? 1 : -1;
    return roomR >= roomL ? 1 : -1;
  }

  /**
   * `eye` = the natural (unshifted) eye in track space, `hero` = the followed rider's wheels point, `roomL/R` =
   * how far the eye may slide left / right before the road edge clamp (m). Inactive (crash cam): ease back to 0.
   */
  update(
    session: Session, eye: TrackPoint, hero: TrackPoint, dt: number, roomL: number, roomR: number, active = true,
  ): void {
    let side = 0;
    let lift = 0;
    const span = hero.s - eye.s;
    for (const r of session.riders) {
      if (!active || span < 1 || !blocker(r, session.player)) continue;
      const near = Math.min(r.s + OCCLUDE.halfLength, hero.s - 0.05); // the box face toward the hero
      if (near < eye.s || r.s - OCCLUDE.halfLength > hero.s - 0.3) continue;
      const f = (hero.s - near) / span; // where the sight line crosses that face (0 = hero, 1 = eye)
      const dir = this.sideFor(hero.x, r.x, roomL, roomR);
      for (const py of OCCLUDE.points) {
        const yp = hero.y + py;
        const yLine = yp + (eye.y - yp) * f;
        const xLine = hero.x + (eye.x - hero.x) * f;
        const top = r.y + OCCLUDE.height + OCCLUDE.margin;
        const wide = OCCLUDE.halfWidth + OCCLUDE.margin;
        if (yLine >= top || Math.abs(xLine - r.x) >= wide) continue;
        const needSide = (r.x + dir * wide - xLine) / f; // eye x shift (signed) that clears the box side
        const room = Math.min(OCCLUDE.sideMax, Math.max(0, dir > 0 ? roomR : roomL));
        if (Math.abs(needSide) > Math.abs(side)) side = clamp(needSide, -room, room);
        if (Math.abs(needSide) > room) lift = Math.max(lift, (top - yLine) / f);
      }
    }
    if (side !== 0 || lift > 0) {
      if (side !== 0) this.dir = side > 0 ? 1 : -1;
      this.wantSide = side;
      this.wantLift = Math.min(OCCLUDE.liftMax, lift);
      this.held = OCCLUDE.hold;
    } else if ((this.held -= dt) <= 0) {
      this.wantSide = this.wantLift = 0;
      this.dir = 0;
    }
    if (dt <= 0) return;
    [this.side, this.sideV] = springStep(this.side, this.sideV, this.wantSide, OCCLUDE.omega, dt);
    [this.lift, this.liftV] = springStep(this.lift, this.liftV, this.wantLift, OCCLUDE.omega, dt);
  }
}
