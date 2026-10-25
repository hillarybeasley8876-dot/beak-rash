// The nemesis of this race (SPEC §18): the rival with the biggest grudge (≥ 50) in the field. It is announced
// when the race goes green, it fights harder (the buffs live in the AI: aggression ×1.5, an always-armed
// payback hunt with a 2× window, its signature skill aimed at the player first, +3 % top speed while it is
// behind the player within 80 m) and it speaks with its own lines. Knocking it out pays 150 小鱼干 and ends
// the grudge at 20; when it knocks the player out it says "这只是开始。".
import type { RaceCtx } from '../ctx';
import type { AiDirector } from '../ai';
import type { RiderId } from '../../../core/types';
import { NEMESIS_STRIKE_LINE } from '../../../data/rival-lines';

export const NEMESIS = {
  bounty: 150,       // 小鱼干 for knocking the nemesis out
} as const;

export class Nemesis {
  private readonly riderId: RiderId | null;
  private readonly grudge: number;
  private announced = false;
  private down = false;
  private readonly offs: Array<() => void> = [];

  constructor(private ctx: RaceCtx, private ai: AiDirector) {
    const { session } = ctx;
    const character = session.config.nemesis ?? null;
    this.riderId = character === null ? null : (session.riders.find((r) => r.character === character)?.id ?? null);
    this.grudge = character === null ? 0 : (session.app.save.data.rivalry[character] ?? 0);
    const { bus } = session.app;
    this.offs.push(bus.on('combat:ko', ({ attacker, victim }) => {
      this.onKo(attacker, victim);
    }));
  }

  private onKo(attacker: RiderId | null, victim: RiderId): void {
    const { session } = this.ctx;
    if (attacker === null || this.riderId === null) return;
    if (victim === this.riderId && attacker === session.player.id) {
      if (this.down) return;
      this.down = true;
      session.player.coins += NEMESIS.bounty;
      session.app.bus.emit('race:nemesisDown', { riderId: victim, attacker, bonus: NEMESIS.bounty });
      return;
    }
    if (victim === session.player.id && attacker === this.riderId) {
      this.ai.taunt(attacker, NEMESIS_STRIKE_LINE);
    }
  }

  /** Called every step: the card is announced when the race goes green. */
  update(): void {
    if (this.announced || this.riderId === null) return;
    if (this.ctx.session.phase !== 'racing') return;
    this.announced = true;
    this.emit();
  }

  private emit(): void {
    if (this.riderId === null) return;
    const rider = this.ctx.session.rider(this.riderId);
    if (!rider) return;
    this.ctx.session.app.bus.emit('race:nemesis', {
      riderId: this.riderId, character: rider.character, grudge: this.grudge,
    });
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
