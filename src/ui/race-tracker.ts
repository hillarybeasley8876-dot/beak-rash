// Watches bus events while a race session is attached and decides which achievements were earned
// (ids from data/memes.ts ACHIEVEMENTS). The results screen reads earned() once the race ends.
import type { AppContext, Session } from '../core/contracts';
import type { RiderId } from '../core/types';

export class RaceTracker {
  private session: Session | null = null;
  private offs: Array<() => void> = [];
  private wasLast = false;
  private attacked = false;
  private alerted = false;
  private busted = false;
  private koTimes: number[] = [];
  private ultAt = -99;
  private ultKos = 0;
  private flags = new Set<string>();

  constructor(private readonly app: AppContext) {}

  attach(session: Session | null): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.session = session;
    if (!session) return;
    this.reset();
    const me = (id: RiderId | null): boolean => id !== null && id === session.player.id;
    const { bus } = this.app;
    this.offs.push(
      bus.on('race:start', () => this.checkLast()),
      bus.on('race:placeChange', ({ riderId, from, to }) => {
        if (!me(riderId)) return;
        this.checkLast();
        if (to > from && this.invisiblePigeonAhead()) this.flags.add('pigeon');
      }),
      bus.on('combat:swing', ({ riderId }) => { if (me(riderId)) this.attacked = true; }),
      bus.on('skill:cast', ({ riderId }) => { if (me(riderId)) this.attacked = true; }),
      bus.on('ult:start', ({ riderId }) => { if (me(riderId)) this.attacked = true; }),
      bus.on('skill:hit', ({ riderId, skillId }) => { if (me(riderId) && skillId === 'pelican.gulp') this.flags.add('gulp'); }),
      bus.on('ult:impact', ({ riderId }) => {
        if (!me(riderId)) return;
        this.ultAt = session.time;
        this.ultKos = 0;
      }),
      bus.on('combat:ko', ({ attacker, victim, skillId }) => {
        if (!me(attacker)) return;
        const t = session.time;
        this.koTimes = [...this.koTimes.filter((k) => t - k < 3), t];
        if (this.koTimes.length >= 2) this.flags.add('double');
        if (session.rider(victim)?.character === 'goose') this.flags.add('goose');
        if (skillId === 'pelican.ult' || t - this.ultAt < 2.5) {
          this.ultKos++;
          if (this.ultKos >= 3) this.flags.add('showtime');
        }
      }),
      bus.on('cine:ko', ({ attacker, chain }) => { if (me(attacker) && chain >= 2) this.flags.add('double'); }),
      bus.on('police:alert', ({ riderId, level }) => { if (me(riderId) && level > 0) this.alerted = true; }),
      bus.on('police:busted', ({ riderId }) => { if (me(riderId)) this.busted = true; }),
    );
  }

  /** Achievement ids earned in the race that just ended (player result decides the finish-based ones). */
  earned(playerPlace: number | null, finished: boolean): string[] {
    const out = new Set(this.flags);
    if (finished && playerPlace === 1 && this.wasLast) out.add('comeback');
    if (finished && !this.attacked) out.add('pacifist');
    if (finished && this.alerted && !this.busted) out.add('corgi');
    return Array.from(out);
  }

  private reset(): void {
    this.wasLast = this.attacked = this.alerted = this.busted = false;
    this.koTimes = [];
    this.ultAt = -99;
    this.ultKos = 0;
    this.flags.clear();
  }

  private checkLast(): void {
    const s = this.session;
    if (s && s.phase === 'racing' && s.player.place >= s.riders.length) this.wasLast = true;
  }

  private invisiblePigeonAhead(): boolean {
    const s = this.session;
    if (!s) return false;
    const p = s.player;
    return s.riders.some((r) => r.character === 'pigeon' && r.place < p.place && Math.abs(r.s - p.s) < 20
      && (r.mods.invisible || r.statuses.some((st) => st.id === 'invisible')));
  }
}
