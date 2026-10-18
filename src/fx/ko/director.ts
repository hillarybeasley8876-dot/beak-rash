// KO director (SPEC §8): decides which cinematic plays (KO, player wrecked, SHOWTIME rise/impact),
// applies settings.slowmo and the repeat-shortening rule, picks the shot (room, occluders, variety)
// and restores everything cleanly. A player SHOWTIME owns the camera from ult:start to the end of its
// impact window: player KOs during the rise are announced at once and peak with the impact.
import { Vector3 } from 'three';
import { Rng } from '../../core/rng';
import { KoCine } from './cine';
import { FRAMINGS, makeConfine, pickFraming, ULT_WIDE } from './framing';
import { FULL, LITE, shortVariant, ULT_IMPACT, WRECKED, type CineKind, type Timeline } from './look';
import { UltRise, type SlowmoMode } from './rise';
import { heroIndex, subjectSphere, type Anchors } from './subject';
import type { ShotFraming } from './camera';
import type { Session } from '../../core/contracts';
import type { RiderId, Vec3Like } from '../../core/types';
import type { FxContext } from '../context';
import type { FxPart } from '../system';

const REPEAT_WINDOW = 10;
/** Shot length used when a chain KO re-targets a running window. */
const RESHOOT_DURATION = 1;

interface CineRequest {
  kind: CineKind;
  tl: Timeline;
  victim: RiderId;
  attacker: RiderId | null;
  ko: boolean;
  point?: Vec3Like;
  chain?: number;
  cluster?: RiderId[];
}

interface Pick {
  framing: ShotFraming;
  confine: (eye: Vector3, focus: Vector3) => void;
}

/** KOs announced during the SHOWTIME rise; the impact window peaks and ends them. */
interface Pending {
  count: number;
  victim: RiderId;
  attacker: RiderId | null;
}

export class KoDirector implements FxPart {
  readonly cine: KoCine;
  readonly rise: UltRise;
  private lastStart = -1e9;
  private lastFraming: string | null = null;
  /** race:end seen: no new cinematic until the next attach (late impacts / KOs behind the results). */
  private ended = false;
  private pending: Pending | null = null;
  private readonly live = new Map<RiderId, { head: Vector3; body: Vector3; bike: Vector3; ground: number }>();
  private readonly scores: string[] = [];
  private readonly rng = new Rng(0x6b0);
  private readonly offs: Array<() => void>;

  constructor(private readonly ctx: FxContext) {
    const { app, post, particles } = ctx;
    const host = {
      rig: app.rig, clock: app.clock, bus: app.bus, camera: app.camera, post,
      subject: (id: RiderId) => this.anchors(id),
      debris: { mark: () => particles.nowReal, cull: (from: number) => particles.cull(from) },
    };
    this.cine = new KoCine(host, (kind) => this.onCineEnd(kind));
    this.rise = new UltRise(ctx);
    const { bus } = app;
    this.offs = [
      bus.on('combat:ko', (e) => this.onKo(e.victim, e.attacker)),
      bus.on('ult:start', (e) => this.onUltStart(e.riderId)),
      bus.on('ult:impact', (e) => this.onUltImpact(e.riderId, e.pos, e.victims)),
      bus.on('race:end', () => this.onRaceEnd()),
    ];
  }

  /** A rider's anchors posed this frame (the views update before the rig; the tracker lags one frame,
   *  which showed as a swing when a chain victim had just been placed). One scratch set per rider. */
  private anchors(id: RiderId): Anchors | undefined {
    const t = this.ctx.tracker.get(id);
    const view = this.ctx.session()?.views.get(id);
    if (!t || !view) return t;
    let a = this.live.get(id);
    if (!a) {
      a = { head: new Vector3(), body: new Vector3(), bike: new Vector3(), ground: 0 };
      this.live.set(id, a);
    }
    view.anchor('head', a.head);
    view.anchor('body', a.body);
    view.anchor('bike', a.bike);
    a.ground = t.ground;
    return a;
  }

  private get slowmo(): SlowmoMode {
    return this.ctx.app.save.data.settings.slowmo;
  }

  private session(): Session | null {
    return this.ended ? null : this.ctx.session();
  }

  private onKo(victim: RiderId, attacker: RiderId | null): void {
    const s = this.session();
    if (!s) return;
    const p = s.player.id;
    if (victim !== p && attacker !== p) return;
    const before = this.cine.victimId;
    if (this.cine.addKo(victim, attacker)) {
      if (this.cine.victimId !== before) this.reshoot(attacker);
      return;
    }
    const wrecked = victim === p;
    if (!wrecked && this.rise.open) {
      this.holdForImpact(victim, attacker);
      return;
    }
    this.flushPending();
    const realTime = this.ctx.app.clock.realTime;
    let tl: Timeline = wrecked ? WRECKED : FULL;
    if (this.slowmo === 'short' || realTime - this.lastStart < REPEAT_WINDOW) tl = shortVariant(tl);
    if (this.slowmo === 'off') tl = LITE;
    this.lastStart = realTime;
    this.rise.abort();
    this.cine.releaseNow();
    this.startCine({ kind: wrecked ? 'wrecked' : 'ko', tl, victim, attacker, ko: true });
  }

  /** A player KO during the SHOWTIME rise: announced now (listeners skip their fallbacks), never aborts the rise. */
  private holdForImpact(victim: RiderId, attacker: RiderId | null): void {
    const count = (this.pending?.count ?? 0) + 1;
    this.pending = { count, victim, attacker };
    const { bus, clock } = this.ctx.app;
    bus.emit('cine:ko', { phase: 'start', attacker, victim, chain: count });
    clock.hitStop(0.05);
    bus.emit('hitstop', { seconds: 0.05 });
    this.ctx.post.flash(0.25, '#ffffff');
  }

  /** Close KOs held for an impact that never came (rise cancelled / timed out / race over): one `end`. */
  private flushPending(): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.ctx.app.bus.emit('cine:ko', { phase: 'end', attacker: p.attacker, victim: p.victim, chain: p.count });
  }

  private startCine(q: CineRequest): void {
    const lite = this.slowmo === 'off';
    const base = { ...q, lite, shot: null, cutNow: q.kind === 'ult' };
    const pick = lite ? null : this.pick(q.kind, q.victim, q.attacker, q.tl.releaseAt + 0.3, q.point, q.cluster);
    this.cine.start(pick ? { ...base, shot: pick.framing, confine: pick.confine } : base);
  }

  /** A chain KO moved the window onto another victim: cut to a fresh framing instead of swinging. */
  private reshoot(attacker: RiderId | null): void {
    if (this.slowmo === 'off') return;
    const pick = this.pick(this.cine.kind, this.cine.victimId, attacker, RESHOOT_DURATION);
    if (pick) this.cine.reshoot(pick.framing, pick.confine);
  }

  /** Framing for a subject (victim, or SHOWTIME hero + cluster) scored by room, occluders and variety. */
  private pick(kind: CineKind, victim: RiderId, attacker: RiderId | null, duration: number, at?: Vec3Like, cluster: RiderId[] = []): Pick | null {
    const s = this.session();
    const { tracker } = this.ctx;
    const point = at ? new Vector3(at.x, at.y, at.z) : null;
    const ids = cluster.filter((id) => !!tracker.get(id));
    const bodies = ids.map((id) => tracker.get(id)?.body ?? new Vector3());
    const heroId = point ? ids[heroIndex(point, bodies)] : victim;
    const r = s?.rider(heroId ?? victim);
    if (!s || !r) return null;
    const hero = heroId === undefined ? undefined : tracker.get(heroId);
    const focus = new Vector3();
    let fitRadius = 0;
    if (hero) fitRadius = subjectSphere(hero, focus);
    else if (point) focus.copy(point);
    else s.track.toWorld(r.s, r.x, 1.3, focus);
    const ground = hero?.ground ?? (point ? point.y - 1 : focus.y - 1.3);
    const tan = s.track.frameAt(r.s).tangent;
    const heading = new Vector3(tan.x, 0, tan.z).normalize();
    // Camera on the side away from the attacker, so it is seen behind the victim (or toward the road centre).
    const other = attacker !== null && attacker !== r.id ? s.rider(attacker) : undefined;
    const prefer = (other ? other.x > r.x : r.x > 0) ? 1 : -1;
    const skip = new Set<RiderId>([victim, r.id, ...ids]);
    const others = s.riders
      .filter((o) => !skip.has(o.id) && Math.abs(o.s - r.s) < 30)
      .map((o) => tracker.get(o.id))
      .filter((e) => !!e)
      .map((e) => ({ pos: e.body, vel: e.vel }));
    const focusVel = (hero?.vel.clone() ?? new Vector3()).multiplyScalar(point ? 0 : 0.7);
    const defs = kind === 'ult' ? (hero ? FRAMINGS.ult : [ULT_WIDE]) : undefined;
    const { framing, id } = pickFraming({
      kind, track: s.track, focus, ground, s: r.s, heading, duration, others, focusVel, prefer, defs, fitRadius,
      avoid: this.lastFraming, rand: () => this.rng.next(), trace: (this.scores.length = 0, this.scores),
    });
    this.lastFraming = id;
    const followId = r.id;
    return { framing, confine: makeConfine(s.track, () => s.rider(followId)?.s ?? r.s) };
  }

  private onUltStart(rider: RiderId): void {
    const s = this.session();
    if (!s || rider !== s.player.id) return;
    this.cine.releaseNow();
    this.flushPending();
    this.rise.start(rider, this.slowmo);
  }

  private onUltImpact(rider: RiderId, pos: Vec3Like, victims: RiderId[]): void {
    const s = this.session();
    if (!s) return;
    const t = this.ctx.tracker.get(rider);
    this.ctx.burst('shockwave', pos, { ground: t?.ground ?? pos.y });
    // Only a running player rise opens the impact window, so cine:ult stays start -> impact -> end.
    if (rider !== s.player.id || !this.rise.open) return;
    this.ctx.app.bus.emit('cine:ult', { phase: 'impact', riderId: rider });
    this.rise.handoff();
    const held = this.pending?.count ?? 0;
    this.pending = null;
    this.cine.releaseNow();
    this.lastStart = this.ctx.app.clock.realTime;
    const tl = this.slowmo === 'off' ? LITE : this.slowmo === 'short' ? shortVariant(ULT_IMPACT) : ULT_IMPACT;
    const point = { x: pos.x, y: (t?.ground ?? pos.y) + 1, z: pos.z };
    this.startCine({ kind: 'ult', tl, victim: victims[0] ?? rider, attacker: rider, ko: false, point, chain: held, cluster: victims });
  }

  private onRaceEnd(): void {
    this.ended = true;
    this.cine.releaseNow();
    this.rise.stop();
    this.flushPending();
  }

  private onCineEnd(kind: CineKind): void {
    const s = this.ctx.session();
    if (kind === 'ult' && s) this.ctx.app.bus.emit('cine:ult', { phase: 'end', riderId: s.player.id });
  }

  attach(): void {
    this.cine.abort();
    this.rise.abort();
    this.live.clear();
    this.pending = null;
    this.ended = false;
    this.lastStart = -1e9;
    this.lastFraming = null;
  }

  update(_dtSim: number, dtReal: number): void {
    if (this.ctx.app.clock.getScale('pause') === 0) return;
    this.rise.update(dtReal);
    if (this.pending && !this.rise.open) this.flushPending();
    this.cine.update(dtReal);
  }

  /** Debug summary for __br.fx.stats(). */
  info(): Record<string, unknown> {
    const ko = this.cine.active
      ? { kind: this.cine.kind, t: +this.cine.t.toFixed(3), chain: this.cine.chain, framing: this.lastFraming, scores: this.scores.join(' ') }
      : null;
    return { ko, rise: this.rise.active, pending: this.pending?.count ?? 0, ended: this.ended };
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.cine.abort();
    this.rise.abort();
    this.flushPending();
  }
}
