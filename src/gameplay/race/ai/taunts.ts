// Taunts: each rival near the player says a roster line every ~8–14 s; KO and respawn lines.
import { ROSTER } from '../../../data/roster';
import type { Session } from '../../../core/contracts';
import type { Rng } from '../../../core/rng';
import type { RiderId, RiderState } from '../../../core/types';

const NEAR = 25;          // m from the player for idle taunts
const EARSHOT = 60;       // m from the player for KO / respawn lines
const GAP = [8, 14];      // s between taunts per rider

export class Taunts {
  private next = new Map<RiderId, number>();
  private time = 0;
  private offs: Array<() => void> = [];

  constructor(private session: Session, private rng: Rng, private taunty: (id: RiderId) => number) {
    const { bus } = session.app;
    this.offs.push(bus.on('combat:ko', ({ attacker }) => {
      const r = attacker !== null ? session.rider(attacker) : undefined;
      if (r && !r.isPlayer && this.rng.next() < 0.75) this.say(r, ROSTER[r.character].koLines, true);
    }));
    this.offs.push(bus.on('rider:respawn', ({ riderId }) => {
      const r = session.rider(riderId);
      if (r && !r.isPlayer && this.rng.next() < 0.45) this.say(r, ROSTER[r.character].hurtLines, true);
    }));
  }

  private say(r: RiderState, lines: readonly string[], force: boolean): void {
    if (lines.length === 0 || !this.near(r, force ? EARSHOT : NEAR)) return;
    this.next.set(r.id, this.time + this.gap(r));
    this.session.app.bus.emit('taunt', { riderId: r.id, text: this.rng.pick(lines), character: r.character });
  }

  private near(r: RiderState, within = NEAR): boolean {
    return Math.abs(r.s - this.session.player.s) < within;
  }

  private gap(r: RiderState): number {
    return this.rng.range(GAP[0], GAP[1]) / Math.max(0.3, this.taunty(r.id));
  }

  update(dt: number): void {
    this.time += dt;
    if (this.session.phase !== 'racing') return;
    for (const r of this.session.riders) {
      if (r.isPlayer || r.mode !== 'racing') continue;
      const due = this.next.get(r.id);
      if (due === undefined) {
        this.next.set(r.id, this.time + this.rng.range(2, 9));
        continue;
      }
      if (this.time >= due && this.near(r)) this.say(r, ROSTER[r.character].taunts, false);
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
