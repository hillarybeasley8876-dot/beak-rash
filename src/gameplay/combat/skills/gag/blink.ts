// pool.blink — 闪现: a flash of light and the rider is 20 m further up the road, speed kept, four fading afterimages
// left along the jump and a flash at both ends. Never through a wall, never past the line, never off the asphalt.
import type { RiderState } from '../../../../core/types';
import { finished, type CombatCtx } from '../../ctx';
import { FlatRing } from '../../visuals/waves';
import { clearLane, skillBoost } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { Afterimages } from './afterimage';
import { Glint } from './glint';

const ID = 'pool.blink';
export const BLINK = {
  dist: 20,                                  // m up the road (r7 SPEC §29: a jump you can see, ≥ 15 m in the audit)
  gap: 5,                                    // m kept before the finish line
  dur: 0.3,                                  // s the cast pose holds
  ghosts: 4,                                 // afterimages left along the jump
  ghostLife: 0.4,                            // s each one takes to fade
  ghostSize: 1.25,                           // m across, the size of the rider they stand in for
  kick: { time: 0.6, power: 0.15 },          // the short pick-me-up that punches the camera
  flash: { from: 0.2, to: 2.6, dur: 0.45 },  // the flat ring at each end
  glint: { size: 2.4, dur: 0.4 },            // the star flash at each end
} as const;

class Blink extends TimedSkill {
  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, BLINK.dur, false);
    const from = { s: r.s, x: r.x };
    const s = Math.min(ctx.session.track.length - BLINK.gap, r.s + BLINK.dist);
    if (s > r.s && !finished(r)) {
      r.x = clearLane(ctx, r, s, r.x);
      r.s = s;
      r.y = 0; // back on the road, never in the air over a jump
      r.vy = 0;
      r.airborne = false;
      ctx.visuals.add(new Afterimages(ctx.visuals, from.s, from.x, r.s, r.x, BLINK.ghosts, { life: BLINK.ghostLife, size: BLINK.ghostSize }));
      skillBoost(ctx, r, BLINK.kick.time, BLINK.kick.power);
    }
    // the flash at both ends: a flat ring where the rider left and another where it lands, and the star where it
    // lands (a star over the caster's own head would white out the screen, it is a metre from the chase camera)
    ctx.visuals.add(new FlatRing(ctx.visuals, from.s, from.x, { color: '#ffffff', ...BLINK.flash }));
    ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#7ef9ff', ...BLINK.flash, to: 3.2, delay: 0.08 }));
    ctx.visuals.add(new Glint(ctx.visuals, r.s, r.x, 1.2, { ...BLINK.glint, color: '#7ef9ff', delay: 0.08 }));
  }

  protected tick(): void {}
}

export const blink: SkillImpl = { id: ID, cast: (ctx, r) => new Blink(ctx, r) };
