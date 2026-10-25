// Weapon traits (SPEC §15): the pan's parry (完美格挡), the leek's three-hit chain (甩葱三连) and the
// keyboard's crit chance (青轴) live here. The selfie's flash (闪光灯) and the baguette's knock-loose
// (硬核) are one-liners in damage.ts / armory.ts; the saltfish boomerang (回旋镖) and the slipper seeker
// (必中) are flight rules and live in projectiles/thrown.ts; the umbrella's glide (滑翔) is the sim's.
import { WEAPONS, type WeaponTrait } from '../../data/weapons';
import type { RiderState, Vec3Like, WeaponId } from '../../core/types';
import type { CombatCtx } from './ctx';
import { impact, nudge } from './feedback';
import { addStatus } from './statuses';
import { MELEE, TRAIT } from './tuning';

/** The trait a weapon carries (undefined for the plain ones). */
export function traitOf(weapon: WeaponId): WeaponTrait | undefined {
  return WEAPONS[weapon].trait;
}

/** The crit chance of a weapon: the keyboard's 青轴 is 25 %, everything else 10 %. */
export function critChance(weapon: WeaponId): number {
  return WEAPONS[weapon].crit ?? MELEE.critChance;
}

/**
 * Arm the parry: the rider just pressed a swing with the pan in hand. The SPEC's window is 0.15 s
 * after the press; the parry stays armed while the swing is still up, so a swing pressed a moment
 * before the hit lands still parries it (the attacker is a rider with a heavy windup of its own).
 */
export function armParry(ctx: CombatCtx, r: RiderState, swingSeconds: number): void {
  if (WEAPONS[r.weapon].trait !== 'parry') return;
  ctx.rd(r).parryUntil = ctx.time + Math.max(TRAIT.parry.window, swingSeconds);
}

/** Is this rider armed to parry an incoming hit? */
export function parryArmed(ctx: CombatCtx, v: RiderState): boolean {
  if (WEAPONS[v.weapon].trait !== 'parry') return false;
  return ctx.time <= ctx.rd(v).parryUntil;
}

/**
 * The parry itself: no damage, the attacker's swing is cancelled and it is stunned, "当！".
 * `attacker` is null for a strike from outside the riders (a police baton).
 */
export function parry(
  ctx: CombatCtx, v: RiderState, attacker: RiderState | null, obstacleId: number | null, pos: Vec3Like,
): void {
  ctx.bus.emit('combat:parry', { riderId: v.id, attacker: attacker?.id ?? null, obstacleId, weapon: v.weapon, pos });
  if (attacker) {
    const a = attacker.action;
    if (a && (a.kind === 'attack' || a.kind === 'heavy')) attacker.action = null; // the swing is cancelled
    ctx.rd(attacker).buffered = null;
    addStatus(attacker, 'stun', TRAIT.parry.stun, 1, v.id);
    ctx.view(attacker)?.cue('stun');
  }
  ctx.view(v)?.cue('hit', { intensity: 0.8 });
  impact(ctx, 'light', v, attacker); // the pan rings: a short clang, not a full hit
  nudge(ctx, v, 0.3);
}

/** The count this hit would be in the attacker's three-hit chain on this victim (not committed yet). */
export function tripleCount(ctx: CombatCtx, a: RiderState, v: RiderState): number {
  const d = ctx.rd(a);
  const last = d.tripleAt[v.id] ?? -Infinity;
  return ctx.time - last <= TRAIT.triple.window ? (d.tripleCount[v.id] ?? 0) + 1 : 1;
}

/** Commit a landed hit of the chain: the third hit in a row is the bonus one and restarts the count. */
export function commitTriple(ctx: CombatCtx, a: RiderState, v: RiderState, count: number): void {
  const d = ctx.rd(a);
  const bonus = count % 3 === 0;
  d.tripleCount[v.id] = bonus ? 0 : count;
  d.tripleAt[v.id] = ctx.time;
}
