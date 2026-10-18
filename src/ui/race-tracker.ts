// Collects the achievement ids that gameplay/achievements unlocked (and saved) during the attached race,
// so the results screen can show them. The list is kept after detach and cleared when the next race attaches.
import type { AppContext, Session } from '../core/contracts';

export class RaceTracker {
  private off: (() => void) | null = null;
  private ids: string[] = [];

  constructor(private readonly app: AppContext) {}

  attach(session: Session | null): void {
    this.off?.();
    this.off = null;
    if (!session) return;
    this.ids = [];
    this.off = this.app.bus.on('achievement:unlock', ({ id }) => {
      if (!this.ids.includes(id)) this.ids.push(id);
    });
  }

  /** Ids unlocked during the current / most recent race, in unlock order. */
  unlocked(): readonly string[] {
    return this.ids;
  }
}
