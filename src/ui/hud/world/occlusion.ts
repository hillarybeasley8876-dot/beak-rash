// Riders alongside the player that the battle cluster's gauges would hide. covered() is true while any
// rival within a few metres projects mostly into the gauges' rectangle (bars, skill diamonds, weapon
// slot); the HUD then fades those gauges so the rider you are swinging at stays visible.
import { Vector3 } from 'three';
import type { Session } from '../../../core/contracts';
import type { Rect } from './avoid';
import { newPoint, type Projector } from './project';

const RANGE = 4;        // m (track s) around the player
const MIN_SHARE = 0.2;  // share of the rider's screen box behind the gauges that counts as hidden

export class GaugeOcclusion {
  private v = new Vector3();
  private head = newPoint();
  private feet = newPoint();

  covered(session: Session, proj: Projector, gauges: Rect): boolean {
    const me = session.player;
    for (const r of session.riders) {
      if (r.isPlayer || r.mods.invisible || r.mode === 'crashed' || Math.abs(r.s - me.s) > RANGE) continue;
      proj.project(proj.riderHead(session, r, 0, this.v), this.head);
      proj.project(session.track.toWorld(r.s, r.x, r.y, this.v), this.feet);
      if (this.head.depth <= 0 && this.feet.depth <= 0) continue;
      const half = Math.abs(this.feet.y - this.head.y) * 0.35;
      const cx = (this.head.x + this.feet.x) / 2;
      const l = cx - half;
      const rr = cx + half;
      const t = Math.min(this.head.y, this.feet.y);
      const b = Math.max(this.head.y, this.feet.y);
      const ix = Math.min(rr, gauges.r) - Math.max(l, gauges.l);
      const iy = Math.min(b, gauges.b) - Math.max(t, gauges.t);
      if (ix > 0 && iy > 0 && (ix * iy) / Math.max(1, (rr - l) * (b - t)) > MIN_SHARE) return true;
    }
    return false;
  }
}
