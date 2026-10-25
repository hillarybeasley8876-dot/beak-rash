// Collects what the results screen shows about the race it just ended: the achievements gameplay
// unlocked (and saved) during it, and the race report (the nemesis, the STYLE chain, the police).
// The tally is kept after the race closes and cleared when the next race attaches.
import type { AppContext, Session } from '../core/contracts';
import type { CharacterId, RiderId } from '../core/types';

/** What the race report says about the race (SPEC §14, §17, §18). */
export interface RaceReport {
  /** The rival that held the grudge this race (null = no nemesis). */
  nemesis: CharacterId | null;
  /** The coins the player got for knocking the nemesis down (0 = still standing). */
  nemesisBonus: number;
  /** Corgis the player knocked down. */
  corgisDown: number;
  /** Bribes the player paid (V我50). */
  bribes: number;
}

const emptyReport = (): RaceReport => ({ nemesis: null, nemesisBonus: 0, corgisDown: 0, bribes: 0 });

export class RaceTracker {
  private off: (() => void) | null = null;
  private ids: string[] = [];
  private report: RaceReport = emptyReport();
  private playerId: RiderId | null = null;

  constructor(private readonly app: AppContext) {}

  attach(session: Session | null): void {
    this.off?.();
    this.off = null;
    if (!session) return;   // the tally stays after the race is closed; the next race clears it
    this.ids = [];
    this.report = emptyReport();
    this.playerId = session.player.id;
    this.report.nemesis = session.config.nemesis ?? null;
    const offs: Array<() => void> = [
      this.app.bus.on('achievement:unlock', ({ id }) => {
        if (!this.ids.includes(id)) this.ids.push(id);
      }),
      // The player KO'd the nemesis: the race paid a bonus for it (the coins are in the player's total).
      this.app.bus.on('race:nemesisDown', ({ attacker, bonus }) => {
        if (attacker === this.playerId) this.report.nemesisBonus += bonus;
      }),
      this.app.bus.on('police:down', ({ attacker }) => {
        if (attacker === this.playerId) this.report.corgisDown += 1;
      }),
      this.app.bus.on('police:bribe', ({ riderId, accepted }) => {
        if (riderId === this.playerId && accepted) this.report.bribes += 1;
      }),
    ];
    this.off = () => {
      for (const off of offs) off();
    };
  }

  /** Ids unlocked during the current / most recent race, in unlock order. */
  unlocked(): readonly string[] {
    return this.ids;
  }

  /** What happened in the current / most recent race (empty when there was no race). */
  raceReport(): RaceReport {
    return this.report;
  }
}
