// Big Gulp's defensive half: an open pouch eats what flies into it (HONK / WHISTLE waves, rival projectiles)
// instead of the pelican suffering it, for a little SP. Shared by the wave skills (common.skillAffect) and gulp.
import type { RiderState } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { nudge } from '../feedback';
import { gainSp } from '../sp';
import { FlatRing } from '../visuals/waves';

export const SWALLOW = { sp: 4 } as const;

/** `r`'s open pouch ate something: a burst at the beak (`burst` = fx preset), +SP, a 咕嘟！ bubble. */
export function swallowed(ctx: CombatCtx, r: RiderState, burst: string): void {
  const at = ctx.pos(r, 1.5);
  ctx.session.app.fx.burst(burst, at, { count: 10 });
  ctx.session.app.fx.burst('poof', at, { scale: 0.6 });
  ctx.visuals.add(new FlatRing(ctx.visuals, r.s, r.x, { color: '#ffffff', from: 0.3, to: 2, dur: 0.3 }));
  gainSp(r, SWALLOW.sp);
  ctx.bus.emit('taunt', { riderId: r.id, text: '咕嘟！', character: r.character });
  nudge(ctx, r, 0.1);
}
