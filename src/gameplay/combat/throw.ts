// Throwing (SPEC §15): a heavy press starts the heavy swing as usual. If the heavy key is still held when
// that swing's windup ends and the rider holds a weapon, the swing becomes a throw aim (RiderAction kind
// 'throw', the weapon cocked back). Releasing throws; holding 1.5 s throws anyway. A tap (released before
// the windup ends) stays a normal heavy swing — no added latency.
import type { RiderState, WeaponId } from '../../core/types';
import { equip } from './armory';
import { active, type CombatCtx } from './ctx';
import { THROW } from './tuning';

/** The weapons that can leave the hand: bare wings cannot, the police baton never does. */
export type ThrowableId = Exclude<WeaponId, 'none' | 'baton'>;

export function throwable(weapon: WeaponId): weapon is ThrowableId {
  return weapon !== 'none' && weapon !== 'baton';
}

/**
 * preStep: the throw aim state machine. Runs after the action tick, so a swing whose windup ends on this
 * frame is turned into an aim before the melee resolver (postStep) can land a hit.
 */
export function tickThrow(ctx: CombatCtx, r: RiderState, dt: number): void {
  const d = ctx.rd(r);
  const c = ctx.session.controls.get(r.id);
  if (d.aim) {
    // A hit reaction, a stun or a crash ends the aim: the weapon stays in the hand.
    if (r.action && r.action.kind !== 'throw') {
      d.aim = null;
      return;
    }
    if (!r.mods.canAttack) {
      d.aim = null;
      return;
    }
    d.aim.t += dt;
    const held = c?.heavyHeld ?? false;
    if (d.aim.t >= 0 && (!held || d.aim.t >= THROW.aimTime)) {
      release(ctx, r);
      return;
    }
    r.action = { kind: 'throw', side: 1, t: d.aim.t, dur: THROW.aimTime, weapon: d.aim.weapon, skillId: null, resolved: false };
    return;
  }
  const a = r.action;
  if (!a || a.kind !== 'heavy' || d.swingChecked) return;
  if (a.t < d.swing.windup) return; // the windup is still running
  d.swingChecked = true;           // one decision per swing
  if (!c?.heavyHeld) return;       // a tap: the heavy swing carries on as a swing
  const weapon = r.weapon;
  if (!throwable(weapon)) return;
  if (!ctx.racing || !active(r)) return;
  d.aim = { weapon, t: 0 };
  a.resolved = true; // the swing never resolves a melee hit
  r.action = { kind: 'throw', side: 1, t: 0, dur: THROW.aimTime, weapon, skillId: null, resolved: false };
  ctx.view(r)?.cue('heavy', { side: 1, weapon });
}

/** The weapon leaves the hand: backwards when lookBack is held, forwards otherwise. */
function release(ctx: CombatCtx, r: RiderState): void {
  const d = ctx.rd(r);
  const aim = d.aim;
  d.aim = null;
  r.action = null;
  if (!aim) return;
  const c = ctx.session.controls.get(r.id);
  const dir = c?.lookBack ? -1 : 1;
  const uses = r.weaponUses;
  equip(ctx, r, 'none'); // the weapon is in the air now
  ctx.thrown.throwWeapon(r, aim.weapon, dir, uses);
}
