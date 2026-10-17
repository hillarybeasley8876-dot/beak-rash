// KO director (SPEC §8): decides which cinematic plays (KO, player wrecked, SHOWTIME rise/impact),
// applies settings.slowmo and the repeat-shortening rule, and restores everything cleanly.
import { Vector3 } from 'three';
import { KoCine } from './cine';
import { shotFor } from './camera';
import { FULL, LITE, shortVariant, ULT_IMPACT, WRECKED, type CineKind, type Timeline } from './look';
import { UltRise } from './rise';
import type { Session } from '../../core/contracts';
import type { RiderId, Vec3Like } from '../../core/types';
import type { FxContext } from '../context';
import type { FxPart } from '../system';

const REPEAT_WINDOW = 10;

export class KoDirector implements FxPart {
  readonly cine: KoCine;
  readonly rise: UltRise;
  private lastStart = -1e9;
  private readonly offs: Array<() => void>;

  constructor(private readonly ctx: FxContext) {
    const { app, post, tracker } = ctx;
    const host = {
      rig: app.rig, clock: app.clock, bus: app.bus, camera: app.camera, post,
      subject: (id: RiderId) => tracker.get(id),
    };
    this.cine = new KoCine(host, (kind) => this.onCineEnd(kind));
    this.rise = new UltRise(ctx);
    const { bus } = app;
    this.offs = [
      bus.on('combat:ko', (e) => this.onKo(e.victim, e.attacker)),
      bus.on('ult:start', (e) => this.onUltStart(e.riderId)),
      bus.on('ult:impact', (e) => this.onUltImpact(e.riderId, e.pos, e.victims)),
      bus.on('race:end', () => {
        this.cine.releaseNow();
        this.rise.stop();
      }),
    ];
  }

  private get slowmo(): 'full' | 'short' | 'off' {
    return this.ctx.app.save.data.settings.slowmo;
  }

  private session(): Session | null {
    return this.ctx.session();
  }

  private onKo(victim: RiderId, attacker: RiderId | null): void {
    const s = this.session();
    if (!s) return;
    const p = s.player.id;
    if (victim !== p && attacker !== p) return;
    if (this.cine.addKo(victim, attacker)) return;
    const wrecked = victim === p;
    const realTime = this.ctx.app.clock.realTime;
    let tl: Timeline = wrecked ? WRECKED : FULL;
    if (this.slowmo === 'short' || realTime - this.lastStart < REPEAT_WINDOW) tl = shortVariant(tl);
    if (this.slowmo === 'off') tl = LITE;
    this.lastStart = realTime;
    this.rise.abort();
    this.cine.releaseNow();
    this.startCine(wrecked ? 'wrecked' : 'ko', tl, victim, attacker, true);
  }

  private startCine(kind: CineKind, tl: Timeline, victim: RiderId, attacker: RiderId | null, ko: boolean, point?: Vec3Like, chain = 0): void {
    const cutNow = kind === 'ult';
    const s = this.session();
    const r = s?.rider(victim);
    const tan = r && s ? s.track.frameAt(r.s).tangent : { x: 0, y: 0, z: -1 };
    const heading = new Vector3(tan.x, 0, tan.z).normalize();
    const other = attacker !== null && attacker !== victim ? s?.rider(attacker) : undefined;
    const cameraLeft = other && r ? other.x > r.x : (r?.x ?? 0) > 0;
    const shot = shotFor(kind, heading, cameraLeft, tl.releaseAt + 0.3);
    this.cine.start({ kind, tl, victim, attacker, ko, lite: this.slowmo === 'off', shot, point, chain, cutNow });
  }

  private onUltStart(rider: RiderId): void {
    const s = this.session();
    if (!s || rider !== s.player.id) return;
    this.cine.releaseNow();
    this.rise.start(rider, this.slowmo === 'off');
  }

  private onUltImpact(rider: RiderId, pos: Vec3Like, victims: RiderId[]): void {
    const s = this.session();
    if (!s) return;
    const t = this.ctx.tracker.get(rider);
    this.ctx.burst('shockwave', pos, { ground: t?.ground ?? pos.y });
    if (rider !== s.player.id) return;
    this.ctx.app.bus.emit('cine:ult', { phase: 'impact', riderId: rider });
    this.rise.handoff();
    // KOs reported in the same instant as the impact belong to the SHOWTIME window.
    const carry = this.cine.active && !this.cine.releasedYet && this.cine.t < 0.15 ? this.cine.takeOver() : 0;
    this.cine.releaseNow();
    this.lastStart = this.ctx.app.clock.realTime;
    const tl = this.slowmo === 'off' ? LITE : this.slowmo === 'short' ? shortVariant(ULT_IMPACT) : ULT_IMPACT;
    const focus = { x: pos.x, y: (t?.ground ?? pos.y) + 1, z: pos.z };
    this.startCine('ult', tl, victims[0] ?? rider, rider, false, focus, carry);
  }

  private onCineEnd(kind: CineKind): void {
    const s = this.session();
    if (kind === 'ult' && s) this.ctx.app.bus.emit('cine:ult', { phase: 'end', riderId: s.player.id });
  }

  attach(): void {
    this.cine.abort();
    this.rise.abort();
    this.lastStart = -1e9;
  }

  update(_dtSim: number, dtReal: number): void {
    if (this.ctx.app.clock.getScale('pause') === 0) return;
    this.rise.update(dtReal);
    this.cine.update(dtReal);
  }

  /** Debug summary for __br.fx.stats(). */
  info(): Record<string, unknown> {
    return { ko: this.cine.active ? { kind: this.cine.kind, t: +this.cine.t.toFixed(3), chain: this.cine.chain } : null, rise: this.rise.active };
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.cine.abort();
    this.rise.abort();
  }
}
