// KO pipeline (SPEC §7): hp ≤ 0 → physics.crash(victim,'ko') + combat:ko exactly once per wreck, credit
// to lastHitBy within 3 s (+1 KO, +50 coins, +10 SP). A crash of any other cause within 3 s of being hit
// (knocked into a wall / traffic) is credited the same way. Respawned riders return at ≥ 70 % HP.
import type { CrashCause, RiderState, Vec3Like, WeaponId } from '../../core/types';
import { finished, type CombatCtx } from './ctx';
import { fightSp, gainSp } from './sp';
import { KO, SP } from './tuning';

/** Detect lastHitBy written by another unit (debug.ko, sim bumps) and treat it as a fresh hit. */
function syncMirror(ctx: CombatCtx, r: RiderState): void {
  const d = ctx.rd(r);
  if (r.lastHitBy === d.hitByMirror) return;
  d.hitByMirror = r.lastHitBy;
  if (r.lastHitBy === null) return;
  if (ctx.now() - r.lastHitTime > 0.5) r.lastHitTime = ctx.now();
  if (d.koBy?.attacker !== r.lastHitBy) d.koBy = null;
}

function creditFor(ctx: CombatCtx, r: RiderState): RiderState | null {
  if (r.lastHitBy === null || r.lastHitBy === r.id) return null;
  if (ctx.now() - r.lastHitTime > KO.creditWindow) return null;
  const a = ctx.session.rider(r.lastHitBy);
  return a && !finished(a) ? a : null; // a rider past the line scores nothing more (no KO, coins or SP)
}

interface KoMethod { skillId: string | null; weapon: WeaponId }

/** The credited attacker's last hit on the victim (skill / weapon), if that hit was theirs. */
function koMethod(ctx: CombatCtx, victim: RiderState, attacker: RiderState | null): KoMethod {
  const how = ctx.rd(victim).koBy;
  if (how && attacker && how.attacker === attacker.id) return { skillId: how.skillId, weapon: how.weapon };
  return { skillId: null, weapon: attacker?.weapon ?? 'none' };
}

/** +1 KO, coins and SP (none for KOs scored with an SP-paid skill or right after casting one: sp.ts fightSp). */
function award(ctx: CombatCtx, victim: RiderState, attacker: RiderState | null, how: KoMethod): void {
  victim.wrecked += 1;
  if (!attacker) return;
  attacker.kos += 1;
  attacker.coins += KO.coins;
  gainSp(attacker, SP.ko * fightSp(ctx, attacker, how.skillId));
}

function emitKo(ctx: CombatCtx, victim: RiderState, attacker: RiderState | null, cause: CrashCause, pos: Vec3Like, how: KoMethod): void {
  ctx.bus.emit('combat:ko', { attacker: attacker?.id ?? null, victim: victim.id, cause, pos, skillId: how.skillId, weapon: how.weapon });
}

/** postStep: knock out every racing rider at 0 HP (once). */
export function checkKos(ctx: CombatCtx): void {
  for (const r of ctx.session.riders) {
    syncMirror(ctx, r);
    if (r.hp > 0 || r.mode !== 'racing') continue;
    const d = ctx.rd(r);
    if (d.koFired) continue;
    d.koFired = true;
    const attacker = creditFor(ctx, r);
    const pos = ctx.pos(r, 0.9);
    const how = koMethod(ctx, r, attacker);
    award(ctx, r, attacker, how);
    ctx.view(r)?.cue('ko');
    emitKo(ctx, r, attacker, 'ko', pos, how); // SPEC §7 order: combat:ko, then the crash (rider:crash)
    ctx.session.physics.crash(r, 'ko', attacker?.id ?? null);
  }
}

/**
 * A wreck with no attacker (SPEC §14): a police baton or an event hazard. combat:ko with that cause and
 * the crash that follows it; nobody gets the credit, and the victim's last hit is forgotten.
 */
export function koExternal(ctx: CombatCtx, victim: RiderState, cause: CrashCause, weapon: WeaponId): void {
  const d = ctx.rd(victim);
  if (d.koFired) return;
  d.koFired = true;
  victim.wrecked += 1;
  victim.lastHitBy = null; // a police baton is nobody's kill
  d.hitByMirror = null;
  d.koBy = null;
  const pos = ctx.pos(victim, 0.9);
  emitKo(ctx, victim, null, cause, pos, { skillId: null, weapon });
  ctx.session.physics.crash(victim, cause, null);
}

/** Crash/respawn bookkeeping. Returns the unsubscribe function. */
export function listenKo(ctx: CombatCtx, onCrash: (r: RiderState) => void): () => void {
  const { bus } = ctx;
  const offCrash = bus.on('rider:crash', ({ riderId, cause, pos, attacker: by }) => {
    const r = ctx.session.rider(riderId);
    if (!r) return;
    const d = ctx.rd(r);
    syncMirror(ctx, r);
    d.hpAtCrash = Math.max(0, r.hp);
    onCrash(r);
    if (cause === 'ko' || d.koFired) return;
    if (by !== null && by !== r.id && by !== r.lastHitBy) {
      r.lastHitBy = by;
      r.lastHitTime = ctx.now();
      d.hitByMirror = by;
    }
    const attacker = creditFor(ctx, r);
    if (!attacker) return;
    d.koFired = true;
    const how = koMethod(ctx, r, attacker);
    award(ctx, r, attacker, how);
    emitKo(ctx, r, attacker, cause, { x: pos.x, y: pos.y, z: pos.z }, how);
  });
  const offRespawn = bus.on('rider:respawn', ({ riderId }) => {
    const r = ctx.session.rider(riderId);
    if (!r) return;
    const d = ctx.rd(r);
    r.hp = Math.round(Math.max(d.hpAtCrash, r.maxHp * KO.respawnHp));
    r.hp = Math.min(r.hp, r.maxHp);
    d.koFired = false;
    d.koBy = null;
    r.lastHitBy = null;
    d.hitByMirror = null;
  });
  return () => {
    offCrash();
    offRespawn();
  };
}
