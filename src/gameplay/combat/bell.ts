// Bell taunt (B): 叮叮叮! Rivals within 15 m turn 'angry' (they hunt the ringer). The ringer gains +5 SP only
// when somebody was actually provoked: the risk is the point, an empty road pays nothing.
import type { RiderState } from '../../core/types';
import { active, type CombatCtx } from './ctx';
import { nudge } from './feedback';
import { gainSp } from './sp';
import { addStatus } from './statuses';
import { BELL, SP } from './tuning';

export function ringBell(ctx: CombatCtx, r: RiderState): boolean {
  const d = ctx.rd(r);
  if (!active(r) || d.bellCd > 0 || r.action) return false; // never rings a hit stagger away
  d.bellCd = BELL.cooldown;
  r.action = { kind: 'bell', side: 1, t: 0, dur: BELL.action, weapon: r.weapon, skillId: null, resolved: true };
  ctx.view(r)?.cue('bell');
  const angered: number[] = [];
  for (const o of ctx.session.riders) {
    if (o === r || o.mode !== 'racing' || Math.hypot(o.s - r.s, o.x - r.x) > BELL.radius) continue;
    if (addStatus(o, 'angry', BELL.angry, 1, r.id, true)) angered.push(o.id);
  }
  if (angered.length > 0) gainSp(r, SP.bell);
  ctx.bus.emit('combat:bell', { riderId: r.id, pos: ctx.pos(r, 1.2), angered });
  ctx.bus.emit('taunt', { riderId: r.id, text: '叮叮叮！', character: r.character });
  nudge(ctx, r, 0.06);
  return true;
}
