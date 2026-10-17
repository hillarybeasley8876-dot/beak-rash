// SHOWTIME rise: slow-mo leap with a low hero camera until the dive impact (or a timeout).
import { Vector3 } from 'three';
import { DEG } from '../../core/math';
import { applyRiseLook } from './look';
import { createShot, HANDBACK, type Shot } from './camera';
import type { RiderId } from '../../core/types';
import type { FxContext } from '../context';

const RISE_SCALE = 0.3;
const RESUME_AT = 0.95;   // real s: let the dive play at speed after the cut-in
const TIMEOUT = 3;

export class UltRise {
  active = false;
  t = 0;
  private rider: RiderId = 0;
  private shot: Shot | null = null;
  private end: number | null = null;
  private resumed = false;
  private lite = false;

  constructor(private readonly ctx: FxContext) {}

  start(rider: RiderId, lite: boolean): void {
    const { app, tracker } = this.ctx;
    const session = this.ctx.session();
    Object.assign(this, { active: true, t: 0, rider, end: null, resumed: false, lite });
    if (!lite) app.clock.setScale('ult', RISE_SCALE, 0.12);
    const r = session?.rider(rider);
    const tan = r && session ? session.track.frameAt(r.s).tangent : { x: 0, y: 0, z: -1 };
    this.shot = lite ? null : createShot({
      subject: () => tracker.get(rider)?.body ?? null,
      ground: () => tracker.get(rider)?.ground ?? 0,
      heading: new Vector3(tan.x, 0, tan.z).normalize(),
      azimuth: 50 * DEG, orbit: -12 * DEG, dist: [5.2, 6.8], height: [0.5, 0.6], fov: [56, 64], duration: 1.4, lookUp: 0.2,
      heightFollow: 0.72, frozen: () => app.clock.getScale('pause') === 0,
    });
    if (this.shot) app.rig.override(this.shot.override, HANDBACK);
    app.bus.emit('cine:ult', { phase: 'start', riderId: rider });
  }

  update(dtReal: number): boolean {
    if (!this.active) return false;
    this.t += dtReal;
    if (!this.lite && !this.resumed && this.t >= RESUME_AT) {
      this.resumed = true;
      this.ctx.app.clock.setScale('ult', 1, 0.2);
    }
    if (this.end === null && this.t >= TIMEOUT) this.stop();
    if (!this.lite) applyRiseLook(this.ctx.post.cine, this.t, this.end);
    if (this.end !== null && this.t >= this.end + 0.25) {
      this.active = false;
      this.ctx.post.resetCine();
      return false;
    }
    return true;
  }

  /** The dive landed: the impact cinematic takes over the camera and look right now. */
  handoff(): void {
    if (!this.active) return;
    this.ctx.app.clock.clearScale('ult');
    this.shot?.stop();
    this.active = false;
  }

  /** No impact (timeout / race over): blend home and close the ult cinematic. */
  stop(): void {
    if (!this.active || this.end !== null) return;
    this.end = this.t;
    this.ctx.app.clock.setScale('ult', 1, 0.15);
    this.shot?.stop();
    this.ctx.app.bus.emit('cine:ult', { phase: 'end', riderId: this.rider });
  }

  abort(): void {
    if (!this.active) return;
    this.ctx.app.clock.clearScale('ult');
    if (this.shot && this.end === null) this.ctx.app.rig.override(null);
    this.shot?.stop();
    if (this.end === null) this.ctx.app.bus.emit('cine:ult', { phase: 'end', riderId: this.rider });
    this.active = false;
    this.ctx.post.resetCine();
  }
}
