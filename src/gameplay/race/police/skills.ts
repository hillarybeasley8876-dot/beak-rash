// The skills that reach the officers without a hit of their own (SPEC §25 薄纱警察). Combat routes every damaging
// skill to the obstacles itself ('combat:obstacleHit' with the skill id, `ko` for SHOWTIME and the big ults); the
// police unit only adds what combat has no obstacle hit for:
//   goose.honk   — the officers in the sound cone are stunned for HONK.stun (no wind-up meanwhile)
//   pelican.wing — the ram hurts WING.damage (the knock itself is the police unit's wing timer, police.ts)
import { HONK } from '../../combat/skills/honk';
import { WING } from '../../combat/skills/wing';
import type { FightCtx } from './fight';

/** The damage the wing dash does to an officer (the ram knocks it aside as well). */
export const WING_DAMAGE = WING.damage;

/** Is the offset (ds ahead, dx to the side) inside the honk's sound cone? */
const inHonk = (ds: number, dx: number): boolean =>
  ds > 0.3 && Math.hypot(ds, dx) <= HONK.range && Math.atan2(Math.abs(dx), ds) <= HONK.cone;

/** Listen for the casts that reach the officers without an obstacle hit (the honk's stun). */
export function listenSkills(ctx: FightCtx): () => void {
  const off = ctx.app.bus.on('skill:cast', (e) => {
    if (e.skillId !== 'goose.honk') return;
    const caster = ctx.session.rider(e.riderId);
    if (!caster) return;
    for (const c of ctx.officers()) {
      if (!c.active || c.down || c.leaving) continue;
      if (inHonk(c.st.s - caster.s, c.st.x - caster.x)) c.stunT = Math.max(c.stunT, HONK.stun);
    }
  });
  return off;
}
