// SHOWTIME impact aim (KoCine helper): the hero victim's body + head sphere (its bike leaves the fit as the body flies
// off, so the hero stays big while it tumbles), trucked across the line of sight toward the victim nearest the hero so
// the pair shares the frame; the impact point when nobody near it was hit.
import { Vector3, type PerspectiveCamera } from 'three';
import { DEG, smoothstep } from '../../core/math';
import { CLUSTER_RADIUS, heroIndex, PAIR_MAX, subjectSphere, type Anchors } from './subject';
import type { RiderId, Vec3Like } from '../../core/types';

/** Hero bike: leaves the fitted sphere from this far (m), gone HERO_BIKE_FADE m further. */
const HERO_BIKE_NEAR = 0.4;
const HERO_BIKE_FADE = 1.2;
/** Pair truck: PAIR_SHARE of the paired victim's offset across the line of sight, the hero kept within PAIR_NDC of the
 *  frame centre; eased in over the first PAIR_EASE s. */
const PAIR_SHARE = 0.5;
const PAIR_NDC = 0.3;
const PAIR_EASE = 0.3;

export class UltAim {
  readonly point = new Vector3();
  /** Riders the impact hit; `hero` frames the hold. */
  cluster: RiderId[] = [];
  hero: RiderId | null = null;
  /** Radius of the sphere the shot keeps in frame (0 = none, the impact point). */
  radius = 0;
  /** The cluster's bodies this frame (KoCine starts the dark 'behind' band past the farthest). */
  readonly bodies: Vector3[] = [];
  private second: RiderId | null = null;
  private readonly aim = new Vector3();
  private readonly view = new Vector3();
  private readonly across = new Vector3();

  constructor(private readonly subject: (id: RiderId) => Anchors | undefined, private readonly camera: PerspectiveCamera) {}

  /** A new impact window: `hero` frames the hold when the impact hit it, else the victim nearest the impact does. */
  start(point: Vec3Like, cluster: RiderId[], hero: RiderId): void {
    this.point.set(point.x, point.y, point.z);
    this.cluster = cluster;
    this.radius = 0;
    this.hero = cluster.includes(hero) ? hero : this.nearest(this.point, cluster, CLUSTER_RADIUS);
    this.second = this.pickSecond();
  }

  /** A knocked-out rider takes the shot over from a hero the impact only hit. */
  retarget(hero: RiderId): void {
    this.hero = hero;
    this.second = this.pickSecond();
  }

  /** Aim point `t` real seconds into the window (radius = the sphere to fit around it). */
  aimAt(t: number): Vector3 {
    this.bodies.length = 0;
    for (const id of this.cluster) {
      const b = this.subject(id)?.body;
      if (b) this.bodies.push(b);
    }
    const hero = this.hero === null ? undefined : this.subject(this.hero);
    if (!hero) {
      this.radius = 0;
      return this.point;
    }
    this.radius = subjectSphere(hero, this.aim, HERO_BIKE_NEAR, HERO_BIKE_FADE);
    const second = this.second === null ? undefined : this.subject(this.second)?.body;
    const cam = this.camera;
    const view = this.view.subVectors(this.aim, cam.position).setY(0);
    const dist = view.length();
    if (second && dist > 1e-3) {
      view.divideScalar(dist);
      const off = this.across.subVectors(second, this.aim).setY(0);
      off.addScaledVector(view, -off.dot(view));
      const most = PAIR_NDC * dist * Math.tan((cam.fov * DEG) / 2) * cam.aspect;
      this.aim.add(off.multiplyScalar(PAIR_SHARE * smoothstep(0, PAIR_EASE, t)).clampLength(0, most));
    }
    return this.aim;
  }

  /** The victim nearest the hero within PAIR_MAX m (it shares the frame), or null. */
  private pickSecond(): RiderId | null {
    const hero = this.hero === null ? undefined : this.subject(this.hero)?.body;
    return hero ? this.nearest(hero, this.cluster.filter((id) => id !== this.hero), PAIR_MAX) : null;
  }

  /** The rider among `ids` whose body is nearest `p` within `max` m. */
  private nearest(p: Vector3, ids: readonly RiderId[], max: number): RiderId | null {
    const known: RiderId[] = [];
    const bodies: Vector3[] = [];
    for (const id of ids) {
      const b = this.subject(id)?.body;
      if (b) {
        known.push(id);
        bodies.push(b);
      }
    }
    return known[heroIndex(p, bodies, max)] ?? null;
  }
}
