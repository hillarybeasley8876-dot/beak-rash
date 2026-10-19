// AI perception: everything on the road around one rider, in that rider's track-space frame.
import type { Session } from '../../../core/contracts';
import type { RiderState, TrackFeature } from '../../../core/types';

export type BlipKind = 'rider' | 'traffic' | 'police' | 'hazard' | 'solid' | 'boost' | 'ramp';

export interface Blip {
  kind: BlipKind;
  ds: number;          // m along s, centre to centre (+ = ahead)
  x: number;           // lateral centre (absolute)
  vs: number;          // speed along +s (m/s)
  hw: number;          // half width
  hl: number;          // half length
  rider: RiderState | null;
  oid: number | null;  // obstacle id (traffic, police, props), else null
}

const RIDER_HW = 0.42;
const RIDER_HL = 0.9;
const BEHIND = 25;
const AHEAD = 140;

const featureKind = (f: TrackFeature): BlipKind | null => {
  switch (f.kind) {
    case 'oil': case 'puddle': return 'hazard';
    case 'cones': case 'barrier': return 'solid';
    case 'boostPad': return 'boost';
    case 'ramp': case 'jumpCrest': return 'ramp';
    default: return null;
  }
};

export class Senses {
  readonly blips: Blip[] = [];
  private pool: Blip[] = [];
  private features: Array<{ f: TrackFeature; kind: BlipKind }>;

  constructor(private session: Session) {
    this.features = session.track.features
      .map((f) => ({ f, kind: featureKind(f) }))
      .filter((e): e is { f: TrackFeature; kind: BlipKind } => e.kind !== null)
      .sort((a, b) => a.f.s0 - b.f.s0);
  }

  private take(): Blip {
    const b = this.pool.pop() ?? { kind: 'rider', ds: 0, x: 0, vs: 0, hw: 0, hl: 0, rider: null, oid: null };
    this.blips.push(b);
    return b;
  }

  /** Refresh `blips` for rider `me`. */
  scan(me: RiderState): void {
    for (const b of this.blips) this.pool.push(b);
    this.blips.length = 0;
    for (const r of this.session.riders) {
      if (r === me || r.mode === 'crashed' || r.mods.intangible) continue;
      const ds = r.s - me.s;
      if (ds < -BEHIND || ds > AHEAD) continue;
      const b = this.take();
      b.kind = 'rider'; b.ds = ds; b.x = r.x; b.vs = r.speed; b.hw = RIDER_HW; b.hl = RIDER_HL; b.rider = r; b.oid = null;
    }
    for (const o of this.session.obstacles) {
      if (!o.active) continue;
      const ds = o.s - me.s;
      if (ds < -BEHIND - o.halfLength || ds > AHEAD + o.halfLength) continue;
      const b = this.take();
      b.kind = o.kind === 'police' ? 'police' : o.solid ? 'traffic' : 'hazard';
      b.ds = ds; b.x = o.x; b.vs = o.speed; b.hw = o.halfWidth; b.hl = o.halfLength; b.rider = null; b.oid = o.id;
    }
    for (const { f, kind } of this.features) {
      if (f.s0 > me.s + AHEAD) break;
      if (f.s1 < me.s - 5) continue;
      const b = this.take();
      b.kind = kind;
      b.hl = (f.s1 - f.s0) / 2;
      b.ds = (f.s0 + f.s1) / 2 - me.s;
      b.x = (f.x0 + f.x1) / 2;
      b.hw = Math.abs(f.x1 - f.x0) / 2;
      b.vs = 0;
      b.rider = null;
      b.oid = null;
    }
  }
}

export { RIDER_HW, RIDER_HL };
