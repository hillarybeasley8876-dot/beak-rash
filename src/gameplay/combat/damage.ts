// The single path every damaging hit takes (melee, projectiles, skills, the ult): blocks and reflects,
// damage, knockback, reactions, combo / ONE MORE!, SP, events and impact feedback. KOs are resolved
// later in postStep (ko.ts) so a rider can only be knocked out once per wreck.
import { WEAPONS } from '../../data/weapons';
import type { RiderState, Side, Vec3Like, WeaponId } from '../../core/types';
import { targetable, type CombatCtx } from './ctx';
import { impact, nudge, type ImpactKind } from './feedback';
import { gainSp, spRefund } from './sp';
import { addStatus, removeStatus, statusStrength } from './statuses';
import { COMBO, MELEE, SHIELD_IMMUNE, SHIELD_REFLECT, SP } from './tuning';

export interface Hit {
  attacker: RiderState;
  victim: RiderState;
  damage: number;          // power-scaled, before crit
  side: Side;              // attacker's swing side (skills: side the victim is on)
  weapon: WeaponId;
  heavy: boolean;
  crit: boolean;
  skillId: string | null;
  knock: number;           // lateral knockback magnitude (m/s), pushed away from the attacker
  speedLoss: number;       // fraction of the victim's speed lost
  melee: boolean;          // melee can be blocked (shield, pan, umbrella) or reflected (doge)
  impact: ImpactKind;
  stun?: number;
  wobble?: number;
  countCombo?: boolean;    // AoE skills count the combo once per cast
}

export type HitOutcome = 'landed' | 'blocked' | 'reflected' | 'ignored';

/** Lateral direction the victim is pushed: away from the attacker. */
export function pushDir(a: RiderState, v: RiderState, fallback: Side): Side {
  const dx = v.x - a.x;
  return Math.abs(dx) > 0.05 ? (dx > 0 ? 1 : -1) : fallback;
}

export function applyHit(ctx: CombatCtx, h: Hit): HitOutcome {
  const { victim: v } = h;
  if (!targetable(ctx, v)) return 'ignored';
  const pos = ctx.pos(v);
  if (h.melee) {
    const shield = statusStrength(v, 'shield');
    if (shield >= SHIELD_REFLECT) {
      reflect(ctx, h, pos);
      return 'reflected';
    }
    if (shield > 0 || weaponBlocks(ctx, v)) {
      if (shield > 0 && shield < SHIELD_IMMUNE) removeStatus(v, 'shield');
      block(ctx, h, pos);
      return 'blocked';
    }
  }
  land(ctx, h, pos);
  return 'landed';
}

function land(ctx: CombatCtx, h: Hit, pos: Vec3Like): void {
  const { attacker: a, victim: v } = h;
  const damage = Math.max(1, Math.round(h.damage * (h.crit ? MELEE.critMul : 1)));
  v.hp = Math.max(0, v.hp - damage);
  v.lastHitBy = a.id;
  v.lastHitTime = ctx.now();
  const vd = ctx.rd(v);
  vd.hitByMirror = a.id;
  vd.koBy = { attacker: a.id, skillId: h.skillId, weapon: h.weapon };
  ctx.rd(a).lastAttack = ctx.now();
  const dir = pushDir(a, v, h.side);
  ctx.session.physics.applyImpulse(v, { lateral: dir * h.knock, forward: -v.speed * h.speedLoss });
  addStatus(v, 'wobble', h.wobble ?? MELEE.wobble, 1, a.id);
  if (h.stun) addStatus(v, 'stun', h.stun, 1, a.id);
  react(ctx, v, (dir === 1 ? -1 : 1) as Side, h.heavy || h.crit, Boolean(h.stun));
  v.combo = 0;
  v.comboTimer = 0;
  const refund = spRefund(h.skillId);
  gainSp(a, SP.hit * refund);
  gainSp(v, SP.hurt);
  ctx.bus.emit('combat:hit', {
    attacker: a.id, victim: v.id, damage, side: h.side, weapon: h.weapon, heavy: h.heavy, crit: h.crit,
    blocked: false, pos, skillId: h.skillId,
  });
  if (h.skillId) ctx.bus.emit('skill:hit', { riderId: a.id, skillId: h.skillId, victim: v.id, pos });
  if (h.countCombo !== false) countCombo(ctx, a, refund);
  impact(ctx, h.crit ? 'crit' : h.impact, a, v);
}

/** Victim reaction: a short 'hit' action cancels any swing; views get hit/stun cues. */
function react(ctx: CombatCtx, v: RiderState, from: Side, big: boolean, stunned: boolean): void {
  const kind = v.action?.kind;
  if (!kind || kind === 'attack' || kind === 'heavy' || kind === 'bell' || kind === 'hit') {
    v.action = { kind: 'hit', side: from, t: 0, dur: MELEE.hitReaction, weapon: v.weapon, skillId: null, resolved: true };
    ctx.rd(v).buffered = null;
  }
  const view = ctx.view(v);
  view?.cue('hit', { side: from, intensity: big ? 1 : 0.6 });
  if (stunned) view?.cue('stun');
}

function countCombo(ctx: CombatCtx, a: RiderState, refund: number): void {
  a.combo = a.comboTimer > 0 ? a.combo + 1 : 1;
  a.comboTimer = COMBO.gap;
  if (a.combo < 2) return;
  ctx.bus.emit('combat:combo', { riderId: a.id, count: a.combo });
  if (a.combo % COMBO.oneMore === 0) {
    gainSp(a, COMBO.oneMoreSp * refund);
    ctx.rd(a).nextCrit = true;
  }
}

function weaponBlocks(ctx: CombatCtx, v: RiderState): boolean {
  const chance = WEAPONS[v.weapon].block;
  if (chance <= 0) return false;
  const swinging = v.action?.kind === 'attack' || v.action?.kind === 'heavy';
  return !swinging && ctx.roll(chance, ctx.force.block);
}

function block(ctx: CombatCtx, h: Hit, pos: Vec3Like): void {
  const { attacker: a, victim: v } = h;
  ctx.session.physics.applyImpulse(a, { lateral: -pushDir(a, v, h.side) * MELEE.blockedRecoil });
  ctx.bus.emit('combat:hit', {
    attacker: a.id, victim: v.id, damage: 0, side: h.side, weapon: h.weapon, heavy: h.heavy, crit: false,
    blocked: true, pos, skillId: h.skillId,
  });
  nudge(ctx, a, 0.18);
}

/** Doge shield: the swing bounces back and hits the attacker instead (not reflectable again). */
function reflect(ctx: CombatCtx, h: Hit, pos: Vec3Like): void {
  block(ctx, h, pos);
  const back: Hit = {
    ...h, attacker: h.victim, victim: h.attacker, damage: h.damage * 0.75, side: (h.side === 1 ? -1 : 1) as Side,
    weapon: h.victim.weapon, crit: false, skillId: 'shiba.doge', melee: false, countCombo: false,
  };
  if (targetable(ctx, back.victim)) land(ctx, back, ctx.pos(back.victim));
}
