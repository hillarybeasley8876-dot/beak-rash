// SHOWTIME rise: slow-mo leap with a low hero camera until the dive impact (or a timeout).
import { Vector3 } from 'three';
import { clamp, DEG } from '../../core/math';
import { applyRiseLook } from './look';
import { createShot, HANDBACK, type Shot } from './camera';
import type { RiderId } from '../../core/types';
import type { FxContext } from '../context';

export type SlowmoMode = 'full' | 'short' | 'off';

/** Beats per settings.slowmo: deep slow-mo while the leap climbs under the ~1 s cut-in (real seconds), then
 *  the near-static top of the leap rushes by at `rush` until `rushSim` sim seconds into the skill (combat:
 *  rise 0.5 + hang 0.18, dive from 0.68), and the dive plays at full speed. 'short' only eases the leap. */
const BEATS: Record<SlowmoMode, { scale: number; resumeAt: number; rush: number; rushSim: number }> = {
  full: { scale: 0.28, resumeAt: 1.0, rush: 1.6, rushSim: 0.6 },
  short: { scale: 0.75, resumeAt: 0, rush: 1, rushSim: 0 },
  off: { scale: 1, resumeAt: 0, rush: 1, rushSim: 0 },
};
const TIMEOUT = 3.2;

export class UltRise {
  active = false;
  t = 0;
  private rider: RiderId = 0;
  private shot: Shot | null = null;
  private end: number | null = null;
  private resumed = false;
  private rushing = false;
  private simAt = 0;
  private mode: SlowmoMode = 'full';
  private readonly aim = new Vector3();
  private readonly ndc = new Vector3();

  constructor(private readonly ctx: FxContext) {}

  /** The SHOWTIME cinematic is running and has not announced its end. */
  get open(): boolean {
    return this.active && this.end === null;
  }

  start(rider: RiderId, mode: SlowmoMode): void {
    const { app, tracker } = this.ctx;
    const session = this.ctx.session();
    const beats = BEATS[mode];
    Object.assign(this, { active: true, t: 0, rider, end: null, resumed: beats.resumeAt <= 0, rushing: false, mode, simAt: app.clock.simTime });
    if (beats.scale < 1) app.clock.setScale('ult', beats.scale, 0.12);
    const r = session?.rider(rider);
    const tan = r && session ? session.track.frameAt(r.s).tangent : { x: 0, y: 0, z: -1 };
    // Front three-quarter turning to the side; pushes in while the pose hangs at the top.
    this.shot = mode === 'off' ? null : createShot({
      subject: () => this.aimPoint(),
      ground: () => tracker.get(rider)?.ground ?? 0,
      heading: new Vector3(tan.x, 0, tan.z).normalize(),
      azimuth: 20 * DEG, orbit: 34 * DEG, dist: [6.2, 4.3], height: [0.5, 0.75], fov: [58, 50],
      delay: mode === 'full' ? 0.6 : 0.3, duration: 0.6, lookUp: 0.15,
      heightFollow: 0.72, followY: 500, followXZ: 500, frozen: () => app.clock.getScale('pause') === 0,
    });
    if (this.shot) app.rig.override(this.shot.override, HANDBACK);
    app.bus.emit('cine:ult', { phase: 'start', riderId: rider });
  }

  update(dtReal: number): boolean {
    if (!this.active) return false;
    this.t += dtReal;
    const beats = BEATS[this.mode];
    const clock = this.ctx.app.clock;
    if (!this.resumed && this.t >= beats.resumeAt) {
      this.resumed = true;
      this.rushing = beats.rush > 1 && this.end === null;
      clock.setScale('ult', this.rushing ? beats.rush : 1, 0.08);
    }
    if (this.rushing && clock.simTime - this.simAt >= beats.rushSim) {
      this.rushing = false;
      clock.setScale('ult', 1, 0.05);
    }
    if (this.end === null && this.t >= TIMEOUT) this.stop();
    if (this.mode !== 'off') {
      applyRiseLook(this.ctx.post.cine, this.t, this.end);
      this.updateFocus();
    }
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
    this.rushing = false;
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

  /** The pelican's body this frame (the view is posed before the rig runs; the tracker lags a frame,
   *  which slipped the fast dive under the bottom bar). */
  private aimPoint(): Vector3 | null {
    const view = this.ctx.session()?.views.get(this.rider);
    if (view) return view.anchor('body', this.aim);
    return this.ctx.tracker.get(this.rider)?.body ?? null;
  }

  /** White speed lines converge on the pelican (screen position of its body). */
  private updateFocus(): void {
    const t = this.ctx.tracker.get(this.rider);
    if (!t || this.end !== null) return;
    this.ndc.copy(t.body).project(this.ctx.app.camera);
    if (this.ndc.z > 1) return;
    this.ctx.post.cine.focus.set(clamp(this.ndc.x * 0.5 + 0.5, 0.15, 0.85), clamp(this.ndc.y * 0.5 + 0.5, 0.18, 0.82));
  }
}
