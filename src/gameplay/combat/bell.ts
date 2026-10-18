// Bell taunt (B): 叮叮叮! Rivals within 15 m turn 'angry' (they hunt the ringer). The ringer gains +5 SP only
// for a fresh provocation: a rival ahead or within reach (|ds| < 6 m) who wasn't already angry at the ringer and
// hasn't paid out for this ringer in the last 8 s. Ringing on cooldown at the same rival pays once, not forever.
import type { RiderState } from '../../core/types';
import { posing, type CombatCtx } from './ctx';
import { nudge } from './feedback';
import { gainSp } from './sp';
import { addStatus } from './statuses';
import { BELL, PRESS_HOLD, SP } from './tuning';

const angryAt = (o: RiderState, ringer: RiderState): boolean =>
  o.statuses.some((st) => st.id === 'angry' && st.time > 0 && st.source === ringer.id);

/** Would angering `o` now count as a fresh provocation by `r` (before the status is applied)? */
function fresh(ctx: CombatCtx, r: RiderState, o: RiderState): boolean {
  const ds = o.s - r.s;
  if (ds < 0 && -ds >= BELL.payReach) return false; // well behind: no risk, no reward
  if (angryAt(o, r)) return false;
  return ctx.time - (ctx.rd(r).bellPaid[o.id] ?? -Infinity) >= BELL.angry;
}

/**
 * preStep (racing riders): a B press rings now, cutting a pose short (bell, cast pose), or is held PRESS_HOLD s for
 * a swing / hit stagger to finish (it never rings a stagger away). Presses on cooldown or while unable to attack
 * (stunned, chilled, gulped) are dropped.
 */
export function requestBell(ctx: CombatCtx, r: RiderState, pressed: boolean, dt: number): void {
  const d = ctx.rd(r);
  if (d.bellBuf !== null && (d.bellBuf += dt) > PRESS_HOLD) d.bellBuf = null;
  if (pressed) d.bellBuf = 0;
  if (d.bellBuf === null) return;
  if (d.bellCd > 0 || !r.mods.canAttack) {
    d.bellBuf = null;
    return;
  }
  if (r.action && !posing(ctx, r)) return;
  d.bellBuf = null;
  ring(ctx, r);
}

function ring(ctx: CombatCtx, r: RiderState): void {
  const d = ctx.rd(r);
  d.bellCd = BELL.cooldown;
  r.action = { kind: 'bell', side: 1, t: 0, dur: BELL.action, weapon: r.weapon, skillId: null, resolved: true };
  ctx.view(r)?.cue('bell');
  const angered: number[] = [];
  let paid = false;
  for (const o of ctx.session.riders) {
    if (o === r || o.mode !== 'racing' || Math.hypot(o.s - r.s, o.x - r.x) > BELL.radius) continue;
    const isFresh = fresh(ctx, r, o);
    if (!addStatus(o, 'angry', BELL.angry, 1, r.id, true)) continue;
    angered.push(o.id);
    if (!isFresh) continue;
    d.bellPaid[o.id] = ctx.time;
    paid = true;
  }
  if (paid) gainSp(r, SP.bell);
  ctx.bus.emit('combat:bell', { riderId: r.id, pos: ctx.pos(r, 1.2), angered });
  ctx.bus.emit('taunt', { riderId: r.id, text: '叮叮叮！', character: r.character });
  nudge(ctx, r, 0.06);
}
