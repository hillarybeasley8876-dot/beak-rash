// One KO-style cinematic window: hit-stop → slow-mo + orbit camera + comic post → peak → whoosh back.
// Chains extend it once; `lite` (settings.slowmo = 'off') keeps only the events and a flash.
import { Vector3, type PerspectiveCamera } from 'three';
import { clamp } from '../../core/math';
import { applyLook, type CineKind, type Timeline } from './look';
import { createShot, HANDBACK, type Shot, type ShotFraming } from './camera';
import type { Clock } from '../../core/clock';
import type { CameraRig } from '../../core/contracts';
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';
import type { RiderId, Vec3Like } from '../../core/types';
import type { PostState } from '../state';

/** What a cinematic window drives (narrow, so the fx sandbox can replay the real thing without a race). */
export interface CineHost {
  readonly rig: Pick<CameraRig, 'override'>;
  readonly clock: Clock;
  readonly bus: EventBus<GameEvents>;
  readonly camera: PerspectiveCamera;
  readonly post: PostState;
  /** Body point and road height of a rider (undefined = unknown). */
  subject(id: RiderId): { readonly body: Vector3; readonly ground: number } | undefined;
}

export interface CineStart {
  kind: CineKind;
  tl: Timeline;
  victim: RiderId;
  attacker: RiderId | null;
  /** Emit cine:ko start now (false for an ult impact until its first KO lands). */
  ko: boolean;
  lite: boolean;
  shot: ShotFraming | null;
  /** Fixed focus (ult impact point); otherwise the victim's body is followed. */
  point?: Vec3Like;
  /** KOs already announced by a window this one takes over (no second `start`). */
  chain?: number;
  /** Take the camera immediately (already inside a cinematic, e.g. the ult dive). */
  cutNow?: boolean;
}

export class KoCine {
  active = false;
  kind: CineKind = 'ko';
  chain = 0;
  t = 0;
  private tl!: Timeline;
  private victim: RiderId = 0;
  private attacker: RiderId | null = null;
  private koStarted = false;
  private peaked = false;
  private slowed = false;
  private flashed = false;
  private released = false;
  private extended = false;
  private lite = false;
  private cutDone = false;
  private lastPeak = Infinity;
  private release = 0;
  private releaseFrame = false;
  private shot: Shot | null = null;
  private readonly point = new Vector3();
  private hasPoint = false;
  private readonly ndc = new Vector3();

  constructor(private readonly host: CineHost, private readonly onEnd: (kind: CineKind) => void) {}

  get releasedYet(): boolean {
    return this.released;
  }

  start(o: CineStart): void {
    const { clock, rig, bus, post } = this.host;
    if (this.active) {
      this.releaseNow();
      this.onEnd(this.kind);
    }
    this.active = true;
    Object.assign(this, { kind: o.kind, tl: o.tl, victim: o.victim, attacker: o.attacker, lite: o.lite, t: 0 });
    this.chain = Math.max(o.chain ?? 0, o.ko ? 1 : 0);
    this.koStarted = this.peaked = this.slowed = this.flashed = this.released = this.extended = false;
    if (this.chain > 0 && !o.ko) this.koStarted = true;
    this.lastPeak = Infinity;
    this.release = o.tl.releaseAt;
    this.hasPoint = !!o.point;
    this.cutDone = !!o.cutNow;
    if (o.point) this.point.set(o.point.x, o.point.y, o.point.z);
    this.shot = o.shot && !o.lite
      ? createShot({
        ...o.shot, subject: () => this.subject(), ground: () => this.ground(),
        frozen: () => clock.getScale('pause') === 0,
      })
      : null;
    if (o.cutNow && this.shot) rig.override(this.shot.override, HANDBACK);
    clock.hitStop(o.tl.hitStop);
    bus.emit('hitstop', { seconds: o.tl.hitStop });
    post.punch(0.016);
    if (o.lite || post.reducedFlashes) post.flash(0.5, '#ffffff');
    else post.impact(0.034, '#ff1e3c');
    if (o.ko) this.emitKo('start');
  }

  /**
   * Another KO inside the window: every KO the cinematic handles is announced with its own `start`
   * (chain = running count) so listeners skip their no-cinematic fallbacks; after the peak it re-peaks.
   * Extends the window once. False when the window is already closing.
   */
  addKo(victim: RiderId, attacker: RiderId | null): boolean {
    if (!this.active || this.released) return false;
    this.chain++;
    if (!this.hasPoint && (!this.koStarted || this.near(victim))) this.victim = victim;
    this.attacker = attacker ?? this.attacker;
    this.emitKo('start');
    if (this.peaked) {
      this.lastPeak = this.t;
      this.emitKo('peak');
    }
    if (!this.extended) {
      this.release += this.tl.extend;
      this.extended = true;
    }
    this.host.clock.hitStop(0.05);
    this.host.post.flash(0.35, '#ffffff');
    return true;
  }

  /** Advance by real time; returns false once the window has fully faded. */
  update(dtReal: number): boolean {
    if (!this.active) return false;
    const { clock, rig, post } = this.host;
    const tl = this.tl;
    this.t += dtReal;
    const t = this.t;
    if (!this.flashed && t >= 0.034) {
      this.flashed = true;
      if (!this.lite) post.flash(0.65, '#ffffff');
    }
    if (!this.slowed && t >= tl.slowAt) {
      this.slowed = true;
      if (!this.lite) clock.setScale('ko', tl.scale, tl.rampIn);
      if (this.shot && !this.cutDone) rig.override(this.shot.override, HANDBACK);
    }
    if (!this.peaked && t >= tl.peakAt) {
      this.peaked = true;
      this.lastPeak = t;
      this.emitKo('peak');
    }
    this.releaseFrame = false;
    if (!this.released && t >= this.release) this.doRelease(true);
    // The rig hands the camera back on the frame after the release.
    const handedBack = this.released && !this.releaseFrame;
    if (!this.lite) {
      applyLook(post.cine, this.kind, tl, t, this.lastPeak, this.release, handedBack);
      this.updateFocus();
    }
    if (this.released && t >= this.release + tl.fadeOut) {
      this.active = false;
      post.resetCine();
      this.onEnd(this.kind);
      return false;
    }
    return true;
  }

  /** Hand this window's KO count to a successor without announcing its end. */
  takeOver(): number {
    const chain = this.koStarted ? this.chain : 0;
    this.koStarted = false;
    return chain;
  }

  /** Release now without the whoosh (race ended, or a new cinematic needs the camera). */
  releaseNow(): void {
    if (this.active && !this.released) {
      this.release = Math.min(this.release, this.t);
      this.doRelease(false);
    }
  }

  /** Hard stop: restore clock, camera and post immediately (session disposed). */
  abort(): void {
    if (!this.active) return;
    const { clock, rig, post } = this.host;
    clock.clearScale('ko');
    if (this.shot && !this.released) rig.override(null);
    this.shot?.stop();
    if (!this.released) this.emitKo('end');
    this.active = false;
    post.resetCine();
  }

  private doRelease(whoosh: boolean): void {
    const { clock, post, bus } = this.host;
    this.released = true;
    this.releaseFrame = true;
    this.shot?.stop();
    if (!this.lite) clock.setScale('ko', 1, this.tl.rampOut);
    if (!this.lite && whoosh) {
      // Back to full speed: speed lines, edge blur and a FOV kick rush in as time ramps up.
      post.whoosh(1);
      post.punch(0.01);
      bus.emit('cam:kick', { fov: 7, duration: 0.45 });
    }
    this.emitKo('end');
  }

  /** Screen position of the subject for the zoom blur / KO lines (frozen once the camera leaves). */
  private updateFocus(): void {
    const p = this.shot?.focus ?? this.subject();
    if (!p || this.released) return;
    const cam = this.host.camera;
    this.host.post.cine.subjectDepth = -this.ndc.copy(p).applyMatrix4(cam.matrixWorldInverse).z;
    this.ndc.copy(p).project(cam);
    if (this.ndc.z > 1) return;
    this.host.post.cine.focus.set(clamp(this.ndc.x * 0.5 + 0.5, 0.15, 0.85), clamp(this.ndc.y * 0.5 + 0.5, 0.18, 0.82));
  }

  private near(id: RiderId): boolean {
    const a = this.host.subject(id);
    const b = this.host.subject(this.victim);
    return !!a && !!b && a.body.distanceTo(b.body) < 25;
  }

  private subject(): Vector3 | null {
    if (this.hasPoint) return this.point;
    return this.host.subject(this.victim)?.body ?? null;
  }

  private ground(): number {
    return this.hasPoint ? this.point.y - 1 : this.host.subject(this.victim)?.ground ?? 0;
  }

  private emitKo(phase: 'start' | 'peak' | 'end'): void {
    if (phase === 'start') this.koStarted = true;
    if (!this.koStarted) return;
    this.host.bus.emit('cine:ko', { phase, attacker: this.attacker, victim: this.victim, chain: Math.max(1, this.chain) });
  }
}
