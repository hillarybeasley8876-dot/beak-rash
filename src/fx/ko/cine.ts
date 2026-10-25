// One KO-style cinematic window: hit-stop → slow-mo + orbit camera + comic post → peak → whoosh back.
// Chains extend it once; `lite` (settings.slowmo = 'off') keeps only the events and a flash.
import { Vector3, type Object3D, type PerspectiveCamera } from 'three';
import { clamp } from '../../core/math';
import { REDUCED, type PostState } from '../state';
import { applyLook, WINDOW_MAX, type CineKind, type Timeline } from './look';
import { createShot, HANDBACK, type Shot, type ShotFraming } from './camera';
import { UltAim } from './cine-aim';
import { subjectSphere, type Anchors } from './subject';
import type { Clock } from '../../core/clock';
import type { CameraRig } from '../../core/contracts';
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';
import type { RiderId, Vec3Like } from '../../core/types';
import type { CastRole } from '../post/mask';

/** What a cinematic window drives (narrow, so the fx sandbox can replay the real thing without a race). */
export interface CineHost {
  readonly rig: Pick<CameraRig, 'override'>;
  readonly clock: Clock;
  readonly bus: EventBus<GameEvents>;
  readonly camera: PerspectiveCamera;
  readonly post: PostState;
  /** Head / body / bike points and road height of a rider (undefined = unknown). */
  subject(id: RiderId): Anchors | undefined;
  /** Particle clock mark + fade of everything born since a mark (slow-mo debris must not litter the hand-back). */
  readonly debris?: { mark(): number; cull(from: number): void };
  /** Fill the subject-mask cast (rider / vehicle roots by role) while the comic look is on. */
  cast?(out: Map<Object3D, CastRole>, victims: readonly RiderId[], attackers: readonly RiderId[]): void;
}

type Confine = (eye: Vector3, focus: Vector3) => void;

/** Closest the eye may come to the subject's head / body / bike (actors fade a crashed rider within 1.9 m). */
const CLEARANCE = 2.15;
/** Release time handed to the look before the window has released (far ahead: no fade starts early). */
const NOT_YET = 1e6;
/** KO victim: its bike leaves the fitted sphere from this far (m), gone KO_BIKE_FADE m further, so the shot keeps the
 *  flung body (not the midpoint between it and a bike on the road) big and inside the bars through the release. */
const KO_BIKE_NEAR = 2;
const KO_BIKE_FADE = 2;

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
  /** Riders framed with `point` (ult victims); `victim` is the hero of the shot when it is one of them. */
  cluster?: RiderId[];
  /** Riders already known to be knocked out by this window (SHOWTIME: the impact's KOs, the rise's held KOs). */
  kod?: RiderId[];
  /** Keeps the eye inside the track bounds while the shot runs. */
  confine?: Confine;
  /** KOs already announced by a window this one takes over (no second `start`). */
  chain?: number;
  /** Take the camera immediately and keep bars + look on from the first frame (the ult dive). */
  cutNow?: boolean;
}

export class KoCine {
  active = false;
  kind: CineKind = 'ko';
  chain = 0;
  t = 0;
  private tl!: Timeline;
  private victim: RiderId = 0;
  /** Everyone this window hit or knocked out (all of them keep their colours in the comic look). */
  private victims: RiderId[] = [];
  /** Riders this window knocked out: the events name one of them, never a rider the impact only hit. */
  private koed: RiderId[] = [];
  private attacker: RiderId | null = null;
  private koStarted = false;
  private peaked = false;
  private slowed = false;
  private held = false;
  private flashed = false;
  private whooshPending = false;
  private released = false;
  private extended = false;
  private lite = false;
  private continued = false;
  private lastPeak = Infinity;
  private release = 0;
  private releaseFrame = false;
  private shot: Shot | null = null;
  /** SHOWTIME impact window: aimed by `ult` (hero, pair, impact point). */
  private hasPoint = false;
  private readonly ult: UltAim;
  private readonly ndc = new Vector3();
  private readonly aim = new Vector3();
  /** Radius of the subject sphere the shot keeps in frame (head, body, bike). */
  private fitRadius = 0;
  /** Victim body height last frame and whether it is coming down (the release waits for the apex). */
  private prevY = Number.NaN;
  private falling = false;
  /** Particle real-time mark taken just before the window (the final blow's burst included). */
  private debrisFrom = 0;

  constructor(private readonly host: CineHost, private readonly onEnd: (kind: CineKind) => void) {
    this.ult = new UltAim((id) => host.subject(id), host.camera);
  }

  /** Rider the shot currently follows (changes when a chain KO re-targets the window). */
  get victimId(): RiderId {
    return this.victim;
  }

  /** SHOWTIME window: the impact point and the riders it hit (null / empty for a KO window). */
  get impact(): Vector3 | null {
    return this.active && this.hasPoint ? this.ult.point : null;
  }

  get framed(): readonly RiderId[] {
    return this.hasPoint ? this.ult.cluster : [];
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
    this.koStarted = this.peaked = this.slowed = this.held = this.flashed = this.released = this.extended = false;
    this.whooshPending = this.falling = false;
    this.prevY = Number.NaN;
    if (this.chain > 0 && !o.ko) this.koStarted = true;
    this.lastPeak = Infinity;
    this.release = o.tl.releaseAt;
    this.hasPoint = !!o.point;
    this.continued = !!o.cutNow;
    const cluster = o.cluster ?? [];
    if (o.point) this.ult.start(o.point, cluster, o.victim);
    this.victims = cluster.length > 0 ? [...cluster] : [o.victim];
    this.koed = o.kod ? [...o.kod] : o.ko ? [o.victim] : [];
    this.fitRadius = 0;
    this.debrisFrom = (this.host.debris?.mark() ?? 0) - 0.06;
    this.shot = o.shot && !o.lite ? this.makeShot(o.shot, o.confine) : null;
    if (o.cutNow && this.shot) rig.override(this.shot.override, HANDBACK);
    clock.hitStop(o.tl.hitStop);
    bus.emit('hitstop', { seconds: o.tl.hitStop });
    if (o.lite || post.reducedFlashes) post.flash(0.5, '#ffffff');
    else post.impact(0.034, '#ff1e3c');
    if (o.ko) this.emitKo('start');
  }

  /** Cut to a freshly picked framing (a chain KO moved the window onto another victim): no swing. */
  reshoot(framing: ShotFraming, confine?: Confine): void {
    if (!this.active || this.released || this.lite) return;
    this.shot?.stop();
    this.shot = this.makeShot(framing, confine);
    if (this.slowed || this.continued) this.host.rig.override(this.shot.override, HANDBACK);
  }

  /**
   * Another KO inside the window: every KO the cinematic handles is announced with its own `start` naming
   * that rider (chain = running count) so listeners skip their no-cinematic fallbacks; after the peak it
   * re-peaks. A SHOWTIME shot whose hero was only hit hands the shot to the KO'd rider. Extends the window
   * once. False when the window is already closing.
   */
  addKo(victim: RiderId, attacker: RiderId | null): boolean {
    if (!this.active || this.released) return false;
    this.chain++;
    if (!this.victims.includes(victim)) this.victims.push(victim);
    if (!this.koed.includes(victim)) this.koed.push(victim);
    if (this.hasPoint) {
      const hero = this.ult.hero;
      if (hero !== null && !this.koed.includes(hero) && this.ult.cluster.includes(victim)) {
        this.ult.retarget(victim);
        this.victim = victim;
      }
    } else if (victim !== this.victim && (!this.koStarted || this.near(victim))) {
      this.victim = victim;
      this.prevY = Number.NaN;
      this.falling = false;
    }
    this.attacker = attacker ?? this.attacker;
    this.emitKo('start', victim);
    if (this.peaked) {
      this.lastPeak = this.t;
      this.emitKo('peak', victim);
    }
    if (!this.extended) {
      // Chains play at the hold scale and never stretch the window past WINDOW_MAX.
      this.release = Math.max(this.release, Math.min(this.release + this.tl.extend, WINDOW_MAX - this.tl.fadeOut));
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
    // After the two impact frames the frozen hit stays crisp; the chromatic punch lands here.
    if (!this.flashed && t >= 0.034) {
      this.flashed = true;
      if (!this.lite) post.punch(0.012);
    }
    if (!this.slowed && t >= tl.slowAt) {
      this.slowed = true;
      if (!this.lite) clock.setScale('ko', tl.scale, tl.rampIn);
      if (this.shot && !this.continued) rig.override(this.shot.override, HANDBACK);
    }
    if (!this.held && t >= tl.holdAt && !this.released) {
      this.held = true;
      if (!this.lite) clock.setScale('ko', tl.holdScale, tl.holdRamp);
    }
    if (!this.peaked && t >= tl.peakAt) {
      this.peaked = true;
      this.lastPeak = t;
      this.emitKo('peak');
      if (!this.lite) post.flash(0.3, '#ffffff');
    }
    this.trackApex();
    this.releaseFrame = false;
    if (!this.released && t >= this.release && this.mayRelease(t)) {
      this.release = t;
      this.doRelease(true);
    }
    // The rig hands the camera back on the frame after the release.
    const handedBack = this.released && !this.releaseFrame;
    if (handedBack && this.whooshPending) this.whoosh();
    if (!this.lite) {
      // The fades start at the actual release (it may wait past tl.releaseAt for the victim's apex).
      const release = this.released ? this.release : NOT_YET;
      applyLook(post.cine, this.kind, tl, t, this.lastPeak, release, handedBack, this.continued, post.reducedFlashes);
      this.updateFocus();
      if (post.cine.ko > 0) this.host.cast?.(post.cine.cast, this.victims, this.attacker === null ? [] : [this.attacker]);
      else post.cine.cast.clear();
      // A look still easing out (reduced motion) over the chase view hides nobody.
      if (this.released) post.cine.hide.clear();
    }
    if (this.released && t >= this.release + tl.fadeOut) {
      this.active = false;
      post.resetCine();
      this.onEnd(this.kind);
      return false;
    }
    return true;
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
    const { clock } = this.host;
    this.released = true;
    this.releaseFrame = true;
    this.shot?.stop();
    if (!this.lite) clock.setScale('ko', 1, this.tl.rampOut);
    this.whooshPending = !this.lite && whoosh;
    this.emitKo('end');
  }

  /** Back to full speed on the first chase frame: speed lines, edge blur and a FOV kick rush in; the
   *  window's slow-mo debris and smoke fade out (0.1 s). */
  private whoosh(): void {
    this.whooshPending = false;
    this.host.debris?.cull(this.debrisFrom);
    const { post } = this.host;
    post.whoosh(1);
    post.punch(0.01);
    this.host.bus.emit('cam:kick', { fov: post.reducedFlashes ? REDUCED.kick : 7, duration: 0.45 });
  }

  /** Release once the victim's arc has turned over (its fall starts on camera), or after tl.apexWait. */
  private mayRelease(t: number): boolean {
    if (this.falling || this.hasPoint || this.lite) return true;
    return t >= Math.min(this.release + this.tl.apexWait, WINDOW_MAX - this.tl.fadeOut);
  }

  private trackApex(): void {
    const y = this.host.subject(this.victim)?.body.y;
    if (y === undefined || this.host.clock.scale <= 0) return;
    if (!Number.isNaN(this.prevY)) this.falling = y < this.prevY - 1e-4;
    this.prevY = y;
  }

  /** Screen position + depth of the subject for the zoom blur, KO lines and burst mask (frozen once released). */
  private updateFocus(): void {
    const p = this.shot?.ready ? this.shot.focus : this.subject();
    if (!p || this.released) return;
    const c = this.host.post.cine;
    c.subjectDepth = this.depth(p);
    if (this.hasPoint) {
      // Every SHOWTIME victim gets the subject palette: the dark band starts past the farthest one.
      let far = c.subjectDepth;
      for (const b of this.ult.bodies) far = Math.max(far, this.depth(b));
      c.behindAt = far - c.subjectDepth + 2;
      c.bgMargin = c.behindAt + 1;
    }
    this.ndc.copy(p).project(this.host.camera);
    if (this.ndc.z > 1) return;
    c.focus.set(clamp(this.ndc.x * 0.5 + 0.5, 0.15, 0.85), clamp(this.ndc.y * 0.5 + 0.5, 0.18, 0.82));
  }

  /** View-space distance of a world point. */
  private depth(p: Vector3): number {
    return -this.ndc.copy(p).applyMatrix4(this.host.camera.matrixWorldInverse).z;
  }

  private near(id: RiderId): boolean {
    const a = this.host.subject(id);
    const b = this.host.subject(this.victim);
    return !!a && !!b && a.body.distanceTo(b.body) < 25;
  }

  private makeShot(framing: ShotFraming, confine?: Confine): Shot {
    return createShot({
      ...framing, subject: () => this.subject(), ground: () => this.ground(),
      frozen: () => this.host.clock.getScale('pause') === 0, confine, fit: () => this.fitRadius, clear: (eye) => this.keepClear(eye),
    });
  }

  /** Move the eye straight out from any subject point closer than CLEARANCE. */
  private keepClear(eye: Vector3): void {
    const id = this.hasPoint ? this.ult.hero : this.victim;
    const a = id === null ? undefined : this.host.subject(id);
    if (!a) return;
    for (const p of [a.head, a.body, a.bike]) {
      if (!p) continue;
      const d = eye.distanceTo(p);
      if (d < CLEARANCE && d > 1e-3) eye.sub(p).multiplyScalar(CLEARANCE / d).add(p);
    }
  }

  /** Centre of the victim's head + body + bike sphere (fitRadius = its radius), or the SHOWTIME aim. */
  private subject(): Vector3 | null {
    if (this.hasPoint) {
      const p = this.ult.aimAt(this.t);
      this.fitRadius = this.ult.radius;
      return p;
    }
    const v = this.host.subject(this.victim);
    if (!v) return null;
    this.fitRadius = subjectSphere(v, this.aim, KO_BIKE_NEAR, KO_BIKE_FADE);
    return this.aim;
  }

  private ground(): number {
    const id = this.hasPoint ? this.ult.hero : this.victim;
    const g = id === null ? undefined : this.host.subject(id)?.ground;
    return g ?? (this.hasPoint ? this.ult.point.y - 1 : 0);
  }

  /** `who` = the rider this event is about (default: the shot's victim if it was knocked out, else the latest KO). */
  private emitKo(phase: 'start' | 'peak' | 'end', who?: RiderId): void {
    if (phase === 'start') this.koStarted = true;
    if (!this.koStarted) return;
    const victim = who ?? (this.koed.includes(this.victim) ? this.victim : this.koed[this.koed.length - 1] ?? this.victim);
    this.host.bus.emit('cine:ko', { phase, attacker: this.attacker, victim, chain: Math.max(1, this.chain) });
  }
}
