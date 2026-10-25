// Debug replays for critics: KO, chain KO, player wrecked and SHOWTIME, staged next to the player.
import { Vector3 } from 'three';
import { clamp } from '../../core/math';
import type { RiderId } from '../../core/types';
import type { FxContext } from '../context';
import type { FxPart } from '../system';

export interface KoTestOpts {
  victim?: number;
  attacker?: number | null;
  /** Emit combat:ko + crash directly instead of letting combat notice hp ≤ 0. */
  direct?: boolean;
  /** Teleport the victim next to the player for a good shot (default true). */
  stage?: boolean;
  /** Also knock out a second rival this many real seconds later (DOUBLE KNOCK OUT). */
  chainAfter?: number;
  /** Staging: metres ahead of the player (default 4.5) and side (+1 right / −1 left, default toward the centre). */
  ahead?: number;
  side?: 1 | -1;
}

interface Pending { at: number; run: () => void }

export class KoTester implements FxPart {
  private pending: Pending[] = [];
  private t = 0;

  constructor(private readonly ctx: FxContext) {}

  attach(): void {
    this.pending = [];
  }

  update(_dtSim: number, dtReal: number): void {
    this.t += dtReal;
    const due = this.pending.filter((p) => p.at <= this.t);
    this.pending = this.pending.filter((p) => p.at > this.t);
    for (const p of due) p.run();
  }

  private later(seconds: number, run: () => void): void {
    this.pending.push({ at: this.t + seconds, run });
  }

  /** Nearest racing rival ahead of (or level with) the player, excluding `skip`. */
  private pickRival(skip: RiderId[] = []): RiderId | undefined {
    const s = this.ctx.session();
    if (!s) return undefined;
    const p = s.player;
    const rivals = s.riders.filter((r) => !r.isPlayer && r.mode === 'racing' && !skip.includes(r.id));
    rivals.sort((a, b) => Math.abs(a.s - p.s - 4) - Math.abs(b.s - p.s - 4));
    return rivals[0]?.id;
  }

  ko(o: KoTestOpts = {}): number | null {
    const s = this.ctx.session();
    if (!s) return null;
    const p = s.player;
    const victim = o.victim ?? this.pickRival();
    const v = victim === undefined ? undefined : s.rider(victim);
    if (!v || v.mode !== 'racing') return null;
    const attacker = o.attacker === undefined ? (v.isPlayer ? this.pickRival() ?? null : p.id) : o.attacker;
    const side = o.side ?? (p.x > 0 ? -1 : 1);
    if (o.stage !== false && !v.isPlayer) {
      v.s = p.s + (o.ahead ?? 4.5);
      v.x = clamp(p.x + side * 1.7, -5, 5);
      v.speed = p.speed;
    }
    const pos = s.track.toWorld(v.s, v.x, 1.3, new Vector3());
    this.ctx.burst('hitHeavy', pos, { ground: s.track.toWorld(v.s, v.x, 0, new Vector3()).y });
    v.lastHitBy = attacker;
    v.lastHitTime = s.time;
    v.hp = 0;
    if (o.direct) {
      s.physics.crash(v, 'ko', attacker);
      this.ctx.app.bus.emit('combat:ko', { attacker, victim: v.id, cause: 'ko', pos, skillId: null, weapon: 'none' });
    }
    if (o.chainAfter !== undefined) {
      const second = this.pickRival([v.id]);
      // The chained victim stands on the other side, a few metres further on, so the re-target reads.
      const next = { ...o, victim: second, chainAfter: undefined, ahead: (o.ahead ?? 4.5) + 3.5, side: -side as 1 | -1 };
      if (second !== undefined) this.later(o.chainAfter, () => this.ko(next));
    }
    return v.id;
  }

  /** SHOWTIME: ult:start now, the dive impact 1.1 s later knocking out (up to 3) rivals in range. Like combat, the
   *  riders it knocks out are at 0 HP when ult:impact goes out. */
  ult(direct = false): void {
    const s = this.ctx.session();
    if (!s) return;
    const p = s.player;
    this.ctx.app.bus.emit('ult:start', { riderId: p.id, skillId: 'pelican.ult' });
    this.later(1.1, () => {
      const victims = s.riders.filter((r) => !r.isPlayer && r.mode === 'racing' && r.s > p.s - 12 && r.s < p.s + 40).map((r) => r.id);
      const kos = victims.slice(0, 3);
      for (const id of kos) {
        const v = s.rider(id);
        if (v) v.hp = 0;
      }
      const pos = s.track.toWorld(p.s + 2, p.x, 0.2, new Vector3());
      this.ctx.app.bus.emit('ult:impact', { riderId: p.id, skillId: 'pelican.ult', pos, victims });
      for (const id of kos) this.ko({ victim: id, attacker: p.id, direct, stage: false });
    });
  }
}
