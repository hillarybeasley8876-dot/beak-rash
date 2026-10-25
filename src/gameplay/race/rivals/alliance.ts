// Alliance 围剿 (SPEC §18): when the player runs away with the race (a lead of more than 5 s over the second
// place) or has knocked out three riders, the 2–3 rivals nearest behind it (within 120 m) gang up on it for
// 20 s: they hunt the player, never each other, and draft each other on the way. The alliance breaks on a
// friendly fire (塑料友谊! — those two fight each other for 5 s), when the player knocks a member out, or
// when the 20 s are up. At most one alliance per 60 s.
import type { Session } from '../../../core/contracts';
import type { RiderId } from '../../../core/types';
import { ALLIANCE_LINES, BETRAYAL_LINE } from '../../../data/rival-lines';
import type { AiDirector, AllianceView } from '../ai';

export const ALLIANCE = {
  lead: 5,           // s of lead over the second place that calls the pack together
  rampageKos: 3,     // …or this many KOs of the player
  cooldown: 60,      // s between two alliances
  duration: 20,      // s the alliance lasts
  radius: 120,       // m behind the player an ally may be
  minMembers: 2,
  maxMembers: 3,
  feud: 5,           // s the two betrayers fight each other
  check: 0.25,       // s between two checks of the formation
} as const;

export type AllianceReason = 'leader' | 'rampage';
export type AllianceBreak = 'betrayal' | 'ko' | 'timeout';

export class Alliance {
  private members: RiderId[] = [];
  private target: RiderId = -1;
  private until = 0;
  private lastForm = -Infinity;
  private checkT = 0;
  private time = 0;
  private feuds = new Map<RiderId, RiderId>();
  private feudUntil = new Map<RiderId, number>();
  private viewCache: AllianceView = { members: [], target: -1, feuds: new Map() };
  private dirty = true;
  private readonly offs: Array<() => void> = [];

  constructor(private session: Session, private ai: AiDirector) {
    const { bus } = session.app;
    this.offs.push(
      bus.on('combat:ko', ({ attacker, victim }) => {
        if (!this.active) return;
        if (attacker !== this.session.player.id) return;
        if (!this.members.includes(victim)) return;
        this.breakWith('ko');
      }),
      bus.on('combat:hit', ({ attacker, victim, blocked }) => {
        if (!this.active || blocked) return;
        if (!this.members.includes(attacker) || !this.members.includes(victim) || attacker === victim) return;
        this.betrayal(attacker, victim);
      }),
    );
  }

  get active(): boolean {
    return this.members.length > 0;
  }

  /** The alliance as the AI sees it (no members when there is none; the feuds outlive the alliance). */
  view(): AllianceView {
    if (!this.dirty) return this.viewCache;
    this.dirty = false;
    this.viewCache = { members: [...this.members], target: this.target, feuds: new Map(this.feuds) };
    return this.viewCache;
  }

  /** Called every step with the race time (seconds since GO). */
  update(dt: number, time: number): void {
    this.time = time;
    this.expireFeuds(time);
    if (this.active) {
      if (time >= this.until) this.breakWith('timeout');
      return;
    }
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = ALLIANCE.check;
    this.tryForm(time);
  }

  /** The second place (the best of the others) and the rivals behind the player. */
  private tryForm(time: number): void {
    const { session } = this;
    const p = session.player;
    if (p.mode !== 'racing' && p.finishTime === null) return;
    if (time - this.lastForm < ALLIANCE.cooldown) return;
    let secondS = -Infinity;
    for (const r of session.riders) {
      if (r.isPlayer || r.mode !== 'racing') continue;
      secondS = Math.max(secondS, r.s);
    }
    if (secondS === -Infinity) return;
    // A runaway leader: more than 5 s of driving between the player and the second place.
    const gap = (p.s - secondS) / Math.max(p.speed, 12);
    const reason: AllianceReason | null = gap > ALLIANCE.lead ? 'leader'
      : p.kos >= ALLIANCE.rampageKos ? 'rampage' : null;
    if (!reason) return;
    const behind = session.riders
      .filter((r) => !r.isPlayer && r.mode === 'racing' && r.s < p.s && p.s - r.s <= ALLIANCE.radius)
      .sort((a, b) => b.s - a.s)
      .slice(0, ALLIANCE.maxMembers);
    if (behind.length < ALLIANCE.minMembers) return;
    this.members = behind.map((r) => r.id);
    this.target = p.id;
    this.until = time + ALLIANCE.duration;
    this.lastForm = time;
    this.feuds.clear();
    this.feudUntil.clear();
    this.dirty = true;
    session.app.bus.emit('race:alliance', {
      phase: 'form', members: [...this.members], target: this.target, reason,
    });
    const shout = session.rider(this.members[0]);
    if (shout) this.ai.taunt(shout.id, ALLIANCE_LINES[shout.character] ?? '围上！');
  }

  /** A friendly fire between two allies: the alliance breaks and those two settle it themselves. */
  private betrayal(a: RiderId, b: RiderId): void {
    const until = this.time + ALLIANCE.feud;
    this.feuds.set(a, b);
    this.feuds.set(b, a);
    this.feudUntil.set(a, until);
    this.feudUntil.set(b, until);
    this.dirty = true;
    this.breakWith('betrayal');
    this.ai.taunt(a, BETRAYAL_LINE);
  }

  private breakWith(reason: AllianceBreak): void {
    if (!this.active) return;
    const members = [...this.members];
    this.members = [];
    this.target = -1;
    this.dirty = true;
    this.session.app.bus.emit('race:alliance', { phase: 'break', members, target: this.session.player.id, reason });
  }

  private expireFeuds(time: number): void {
    for (const [id, until] of this.feudUntil) {
      if (time < until) continue;
      this.feudUntil.delete(id);
      this.feuds.delete(id);
      this.dirty = true;
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
