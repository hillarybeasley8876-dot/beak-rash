// One KO-style cinematic window: hit-stop → slow-mo + orbit camera + comic post → peak → whoosh back.
// Chains extend it once; `lite` (settings.slowmo = 'off') keeps only the events and a flash.
import { Vector3, type Object3D, type PerspectiveCamera } from 'three';
import { clamp, smoothstep } from '../../core/math';
import { applyLook, WINDOW_MAX, type CineKind, type Timeline } from './look';
import { createShot, HANDBACK, type Shot, type ShotFraming } from './camera';
import { heroIndex, subjectSphere, type Anchors } from './subject';
import type { Clock } from '../../core/clock';
import type { CameraRig } from '../../core/contracts';
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';
import type { RiderId, Vec3Like } from '../../core/types';
import type { CastRole } from '../post/mask';
import type { PostState } from '../state';

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

/** SHOWTIME: share (default, ShotFraming.pan) and cap (m) of the cluster centroid's sideways offset the aim pans toward. */
const PAN = 0.35;
const PAN_MAX = 2;
/** SHOWTIME hero: its bike leaves the fitted sphere from this far (m), so the hero stays big while it tumbles. */
const HERO_BIKE_NEAR = 1;

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
  /** Riders framed with `point` (ult victims): the one nearest the impact is the hero of the shot. */
  cluster?: RiderId[];
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
  /** Everyone this window knocked out (all of them keep their colours in the comic look). */
  private victims: RiderId[] = [];
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
  private readonly point = new Vector3();
  private hasPoint = false;
  private cluster: RiderId[] = [];
  private hero: RiderId | null = null;
  private pan = PAN;
  private readonly bodies: Vector3[] = [];
  private readonly ndc = new Vector3();
  private readonly aim = new Vector3();
  private readonly centroid = new Vector3();
  /** Radius of the subject sphere the shot keeps in frame (head, body, bike). */
  private fitRadius = 0;
  /** Victim body height last frame and whether it is coming down (the release waits for the apex). */
  private prevY = Number.NaN;
  private falling = false;
  /** Particle real-time mark taken just before the window (the final blow's burst included). */
  private debrisFrom = 0;

  constructor(private readonly host: CineHost, private readonly onEnd: (kind: CineKind) => void) {}

  /** Rider the shot currently follows (changes when a chain KO re-targets the window). */
  get victimId(): RiderId {
    return this.victim;
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
    if (o.point) this.point.set(o.point.x, o.point.y, o.point.z);
    this.cluster = o.cluster ?? [];
    this.victims = this.cluster.length > 0 ? [...this.cluster] : [o.victim];
    this.hero = this.pickHero();
    this.fitRadius = 0;
    this.pan = o.shot?.pan ?? PAN;
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
   * Another KO inside the window: every KO the cinematic handles is announced with its own `start`
   * (chain = running count) so listeners skip their no-cinematic fallbacks; after the peak it re-peaks.
   * Extends the window once. False when the window is already closing.
   */
  addKo(victim: RiderId, attacker: RiderId | null): boolean {
    if (!this.active || this.released) return false;
    this.chain++;
    if (!this.victims.includes(victim)) this.victims.push(victim);
    if (!this.hasPoint && victim !== this.victim && (!this.koStarted || this.near(victim))) {
      this.victim = victim;
      this.prevY = Number.NaN;
      this.falling = false;
    }
    this.attacker = attacker ?? this.attacker;
    this.emitKo('start');
    if (this.peaked) {
      this.lastPeak = this.t;
      this.emitKo('peak');
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
      applyLook(post.cine, this.kind, tl, t, this.lastPeak, this.release, handedBack, this.continued);
      this.updateFocus();
      if (post.cine.ko > 0) this.host.cast?.(post.cine.cast, this.victims, this.attacker === null ? [] : [this.attacker]);
      else post.cine.cast.clear();
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
    this.host.post.whoosh(1);
    this.host.post.punch(0.01);
    this.host.bus.emit('cam:kick', { fov: 7, duration: 0.45 });
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
      for (const b of this.bodies) far = Math.max(far, this.depth(b));
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
    const id = this.hasPoint ? this.hero : this.victim;
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
    if (this.hasPoint) return this.clusterPoint();
    const v = this.host.subject(this.victim);
    if (!v) return null;
    this.fitRadius = subjectSphere(v, this.aim);
    return this.aim;
  }

  private clusterPoint(): Vector3 {
    this.bodies.length = 0;
    for (const id of this.cluster) {
      const b = this.host.subject(id)?.body;
      if (b) this.bodies.push(b);
    }
    const hero = this.hero === null ? undefined : this.host.subject(this.hero);
    if (!hero) {
      this.fitRadius = 0;
      return this.point;
    }
    this.fitRadius = subjectSphere(hero, this.aim, HERO_BIKE_NEAR);
    // Pan (never dolly) toward the rest of the cluster: the centroid offset across the line of sight.
    if (this.bodies.length > 1 && this.pan > 0) {
      const c = this.centroid.set(0, 0, 0);
      for (const b of this.bodies) c.add(b);
      c.divideScalar(this.bodies.length).sub(this.aim).setY(0);
      const v = this.ndc.subVectors(this.aim, this.host.camera.position).setY(0).normalize();
      c.addScaledVector(v, -c.dot(v)).multiplyScalar(this.pan * smoothstep(0, 0.3, this.t)).clampLength(0, PAN_MAX);
      this.aim.add(c);
    }
    return this.aim;
  }

  /** The SHOWTIME victim nearest the impact point frames the hold. */
  private pickHero(): RiderId | null {
    if (!this.hasPoint) return null;
    const ids: RiderId[] = [];
    const bodies: Vector3[] = [];
    for (const id of this.cluster) {
      const b = this.host.subject(id)?.body;
      if (b) {
        ids.push(id);
        bodies.push(b);
      }
    }
    return ids[heroIndex(this.point, bodies)] ?? null;
  }

  private ground(): number {
    const id = this.hasPoint ? this.hero : this.victim;
    const g = id === null ? undefined : this.host.subject(id)?.ground;
    return g ?? (this.hasPoint ? this.point.y - 1 : 0);
  }

  private emitKo(phase: 'start' | 'peak' | 'end'): void {
    if (phase === 'start') this.koStarted = true;
    if (!this.koStarted) return;
    this.host.bus.emit('cine:ko', { phase, attacker: this.attacker, victim: this.victim, chain: Math.max(1, this.chain) });
  }
}
