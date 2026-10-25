// Requests that come from outside the riders (SPEC §14, §19): a police baton or an event hazard strikes a
// rider ('npc:strike' is answered with exactly one 'npc:hit'), and another unit asks combat for a pickup on
// the road ('pickup:spawn').
import type { GameEvents } from '../../core/events-map';
import type { RiderState } from '../../core/types';
import { active, finished, type CombatCtx } from './ctx';
import { reactHit, weaponBlocks } from './damage';
import { impact, nudge } from './feedback';
import { koExternal } from './ko';
import { gainSp } from './sp';
import { addStatus, statusStrength } from './statuses';
import { NPC_STRIKE, SHIELD_IMMUNE, SP } from './tuning';
type Strike = GameEvents['npc:strike'];

/** Subscribe to the outside world's requests. Returns the unsubscribe function. */
export function listenExternal(ctx: CombatCtx): () => void {
  const { bus } = ctx;
  const offStrike = bus.on('npc:strike', (e) => resolveStrike(ctx, e));
  const offSpawn = bus.on('pickup:spawn', (e) => {
    const weapon = e.kind === 'weapon' ? e.weapon ?? 'saltfish' : 'saltfish';
    ctx.pickups.spawn(e.kind, e.s, e.x, weapon);
  });
  return () => {
    offStrike();
    offSpawn();
  };
}

/** A rider that can be hit at all: racing, not intangible, not still invulnerable. */
function canBeStruck(ctx: CombatCtx, v: RiderState): boolean {
  if (!active(v) || finished(v)) return false;
  if (v.invuln > 0 || v.mods.intangible) return false;
  return true;
}

/** The strike lands like a melee hit from nobody: block, shield, damage, knock, wobble, KO. */
function resolveStrike(ctx: CombatCtx, e: Strike): void {
  const v = ctx.session.rider(e.victim);
  const pos = v ? ctx.pos(v) : { x: e.pos.x, y: e.pos.y, z: e.pos.z };
  if (!v || !canBeStruck(ctx, v)) {
    answer(ctx, e, 0, false, pos);
    return;
  }
  const shielded = statusStrength(v, 'shield') >= SHIELD_IMMUNE;
  if (shielded || weaponBlocks(ctx, v)) {
    answer(ctx, e, 0, true, pos);
    nudge(ctx, v, 0.18); // a blocked baton only rings
    return;
  }
  v.hp = Math.max(0, v.hp - e.damage);
  ctx.session.physics.applyImpulse(v, { lateral: -e.side * e.knock, forward: -v.speed * NPC_STRIKE.speedLoss });
  addStatus(v, 'wobble', NPC_STRIKE.wobble, 1, null);
  reactHit(ctx, v, e.side, e.heavy, false); // the blow comes from the attacker's side
  gainSp(v, SP.hurt);
  impact(ctx, 'skill', v, null); // 0.06 s of hit-stop
  answer(ctx, e, e.damage, false, pos);
  if (v.hp <= 0) koExternal(ctx, v, e.cause, e.weapon);
}

/** Exactly one 'npc:hit' per 'npc:strike'. */
function answer(ctx: CombatCtx, e: Strike, damage: number, blocked: boolean, pos: { x: number; y: number; z: number }): void {
  ctx.bus.emit('npc:hit', {
    victim: e.victim, obstacleId: e.obstacleId, damage, blocked, parried: false,
    side: e.side, weapon: e.weapon, pos,
  });
}
