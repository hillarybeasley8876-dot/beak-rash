// hamster.violin — 悲伤小提琴: the hamster plays a sad violin; everybody within earshot is too sad to use their
// skills, and the tune drags at their legs while it lasts, so a silenced rival visibly drops back. It silences,
// it does not damage: the hamster never wants to hurt anybody, it just makes them sad. The sadness is seen (r7
// SPEC §29): a grey-blue aura on the road the size of its reach, the notes flying out to every listener, and a
// little rain cloud over each rider it silences.
import type { RiderState } from '../../../../core/types';
import type { CombatCtx } from '../../ctx';
import { AuraDisc } from '../../visuals/auras';
import { inRadius, skillAffect } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { RainCloud, SadNotes, ViolinPlayer } from './visuals';

const ID = 'hamster.violin';
export const VIOLIN = {
  dur: 3.5,      // s of playing
  radius: 8,     // m the tune reaches
  tick: 0.3,     // s between the silencings
  silence: 3,    // s a listener stays silent
  slow: 0.15,    // fraction of speed the tune takes off a listener while it plays
  slowTime: 1.2,
  rain: 1.4,      // m the little cloud over a silenced rider rains on
  cloud: 0.34,   // m size of that cloud (small: a silenced rider may be right beside the camera)
} as const;

class Violin extends TimedSkill {
  private next = 0;
  private sad = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, VIOLIN.dur, false);
    ctx.visuals.add(new ViolinPlayer(ctx.visuals, r, VIOLIN.dur));
    ctx.visuals.add(new AuraDisc(ctx.visuals, r, VIOLIN.radius, VIOLIN.dur, '#93a7c8', '#6c82ab'));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    if (this.t >= this.next) {
      this.next = this.t + VIOLIN.tick;
      for (const v of inRadius(ctx, r, VIOLIN.radius)) {
        this.sadden(v);
        skillAffect(ctx, r, v, ID, [['silenced', VIOLIN.silence, 1], ['slow', VIOLIN.slowTime, VIOLIN.slow]]);
      }
      ctx.session.app.fx.burst('notes', ctx.pos(r, 1.6), { count: 3 });
    }
  }

  /** The first time a rider hears it, the tune becomes theirs: notes fly out and a little cloud follows them. */
  private sadden(v: RiderState): void {
    if (this.sad.has(v.id)) return;
    this.sad.add(v.id);
    this.ctx.visuals.add(new SadNotes(this.ctx.visuals, this.caster, v, VIOLIN.silence));
    this.ctx.visuals.add(new RainCloud(this.ctx.visuals, v, VIOLIN.silence, VIOLIN.rain, VIOLIN.cloud));
  }
}

export const violin: SkillImpl = { id: ID, cast: (ctx, r) => new Violin(ctx, r) };
