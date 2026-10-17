// Per-rider world data for effects: position, velocity (finite difference in sim time), anchors,
// heading and road height. Also feeds particle follow anchors (slot = rider id → head position).
import { Quaternion, Vector3 } from 'three';
import type { Session } from '../../core/contracts';
import type { RiderId } from '../../core/types';
import type { Particles } from '../particles/system';

export interface Tracked {
  readonly pos: Vector3;     // bike contact point (world)
  readonly vel: Vector3;     // world velocity (m/s)
  readonly head: Vector3;
  readonly body: Vector3;
  readonly wheelR: Vector3;
  readonly fwd: Vector3;     // bike heading (unit)
  readonly right: Vector3;
  ground: number;            // world Y of the road under the rider
  dist: number;              // metres to the camera
}

interface Entry extends Tracked { prev: Vector3; valid: boolean }

const MAX_SPEED = 45;

function entry(): Entry {
  return {
    pos: new Vector3(), vel: new Vector3(), head: new Vector3(), body: new Vector3(), wheelR: new Vector3(),
    fwd: new Vector3(0, 0, -1), right: new Vector3(1, 0, 0), ground: 0, dist: 0, prev: new Vector3(), valid: false,
  };
}

export class RiderTracker {
  private entries: Entry[] = [];
  private readonly q = new Quaternion();
  private readonly tmp = new Vector3();
  private readonly delta = new Vector3();

  constructor(private readonly particles: Particles) {}

  reset(): void {
    this.entries.length = 0;
  }

  get(id: RiderId | null | undefined): Tracked | undefined {
    return id === null || id === undefined ? undefined : this.entries[id];
  }

  update(session: Session, dtSim: number, camPos: Vector3): void {
    for (const r of session.riders) {
      let e = this.entries[r.id];
      if (!e) {
        e = entry();
        this.entries[r.id] = e;
      }
      session.physics.pose(r, e.pos, this.q);
      if (e.valid && dtSim > 1e-5) {
        this.delta.subVectors(e.pos, e.prev);
        // A jump of >10 m in one frame is a teleport/respawn, not motion.
        if (this.delta.lengthSq() < 100) e.vel.copy(this.delta).divideScalar(dtSim).clampLength(0, MAX_SPEED);
      }
      e.prev.copy(e.pos);
      e.valid = true;
      e.fwd.set(0, 0, -1).applyQuaternion(this.q);
      e.right.set(1, 0, 0).applyQuaternion(this.q);
      const view = session.views.get(r.id);
      if (view) {
        view.anchor('head', e.head);
        view.anchor('body', e.body);
        view.anchor('wheelR', e.wheelR);
      } else {
        e.head.copy(e.pos).y += 1.9;
        e.body.copy(e.pos).y += 1.3;
        e.wheelR.copy(e.pos).addScaledVector(e.fwd, -0.55).y += 0.3;
      }
      e.ground = session.track.toWorld(r.s, r.x, 0, this.tmp).y;
      e.dist = e.pos.distanceTo(camPos);
      this.particles.setAnchor(r.id, e.head);
    }
  }
}
