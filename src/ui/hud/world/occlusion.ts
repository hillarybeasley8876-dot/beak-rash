// Riders (and their name tags) that the battle cluster's gauges would hide. covered() is true while a rival
// from 4 m behind to 12 m ahead projects partly into the gauges' rectangle (bars, skill diamonds, weapon
// slot), or a drawn name tag sits mostly inside it; the HUD then fades those gauges so the rider stays visible.
import { Vector3 } from 'three';
import type { Session } from '../../../core/contracts';
import type { Rect } from './avoid';
import type { TagBox } from './tags';
import { newPoint, type Projector } from './project';

const AHEAD = 12;       // m (track s) ahead of the player
const BEHIND = 4;       // m behind (between the camera and the player)
const MIN_SHARE = 0.2;  // share of the rider's screen box behind the gauges that counts as hidden
const TAG_SHARE = 0.3;  // share of a name tag's box behind the gauges that counts as hidden

/** Overlap area of the box l..r × t..b with `g`. */
const inter = (g: Rect, l: number, t: number, r: number, b: number): number =>
  Math.max(0, Math.min(r, g.r) - Math.max(l, g.l)) * Math.max(0, Math.min(b, g.b) - Math.max(t, g.t));

export class GaugeOcclusion {
  private v = new Vector3();
  private head = newPoint();
  private feet = newPoint();

  covered(session: Session, proj: Projector, gauges: Rect, tags: readonly TagBox[]): boolean {
    for (const b of tags) {
      if (inter(gauges, b.l, b.t, b.r, b.b) > TAG_SHARE * Math.max(1, (b.r - b.l) * (b.b - b.t))) return true;
    }
    const me = session.player;
    for (const r of session.riders) {
      const ds = r.s - me.s;
      if (r.isPlayer || r.mods.invisible || r.mode === 'crashed' || ds > AHEAD || ds < -BEHIND) continue;
      proj.project(proj.riderHead(session, r, 0, this.v), this.head);
      proj.project(session.track.toWorld(r.s, r.x, r.y, this.v), this.feet);
      if (this.head.depth <= 0 && this.feet.depth <= 0) continue;
      const half = Math.abs(this.feet.y - this.head.y) * 0.35;
      const cx = (this.head.x + this.feet.x) / 2;
      const l = cx - half;
      const rr = cx + half;
      const t = Math.min(this.head.y, this.feet.y);
      const b = Math.max(this.head.y, this.feet.y);
      if (inter(gauges, l, t, rr, b) > MIN_SHARE * Math.max(1, (rr - l) * (b - t))) return true;
    }
    return false;
  }
}
