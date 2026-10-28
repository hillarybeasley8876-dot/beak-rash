// Melee (SPEC §7): J/L swing left/right, K heavy (auto side). windup → active → recover; the first
// rival on that side inside lateral 0.4…reach and |ds| < 1.6 m during the active window is hit once.
import { ROSTER } from '../../data/roster';
import { WEAPONS } from '../../data/weapons';
import type { Controls, RiderAction, RiderState, Side, WeaponId } from '../../core/types';
import { consumeUse, knockLoose } from './armory';
import { active, humanNear, nearest, posing, targetable, type CombatCtx, type SwingTiming } from './ctx';
import { applyHit } from './damage';
import { armParry, commitTriple, critChance, parry, parryArmed, traitOf, tripleCount } from './traits';
import { HEAVY_PHASES, HEAVY_TELL, INPUT_BUFFER, LIGHT_PHASES, MELEE, PRESS_HOLD, SWING_REF, TRAIT, powerMul } from './tuning';
import { HeavyTell } from './visuals/tell';

/** Swing timing for this weapon; a rival's heavy near a human is telegraphed (longer windup + glint). */
function timing(ctx: CombatCtx, r: RiderState, heavy: boolean): { ph: SwingTiming; tell: boolean } {
  const k = WEAPONS[r.weapon].swing / SWING_REF;
  const p = heavy ? HEAVY_PHASES : LIGHT_PHASES;
  // The tell is shown when a human is close enough to read it (offline: the player; online: any member).
  const tell = heavy && !r.human && humanNear(ctx, r, HEAVY_TELL.range);
  const windup = p.windup * k * (tell ? HEAVY_TELL.windupMul : 1), act = p.active * k, recover = p.recover * k;
  return { ph: { windup, active: act, recover, total: windup + act + recover }, tell };
}

const isSwing = (a: RiderAction | null): a is RiderAction => a?.kind === 'attack' || a?.kind === 'heavy';

/** True while `r` is winding up a swing (being hit now is a counter crit). */
function inWindup(ctx: CombatCtx, r: RiderState): boolean {
  const a = r.action;
  return isSwing(a) && a.t < ctx.rd(r).swing.windup;
}

/** preStep: advance the current action. Skill/ult actions belong to the skill runner. */
export function tickAction(ctx: CombatCtx, r: RiderState, dt: number): void {
  const d = ctx.rd(r);
  if (d.buffered && (d.buffered.age += dt) > PRESS_HOLD) d.buffered = null;
  const a = r.action;
  if (!a) return;
  a.t += dt;
  const owned = a.kind === 'skill' || a.kind === 'ult';
  if (a.t >= a.dur + (owned ? 1 : 0)) r.action = null;
}

/** Free to swing now: nothing running, or only a pose (bell, a cast pose) that the swing cuts short. */
function canSwing(ctx: CombatCtx, r: RiderState): boolean {
  return active(r) && r.mods.canAttack && !ctx.skills.busy(r) && (r.action === null || posing(ctx, r));
}

/** A press now is held (PRESS_HOLD) for the end of a hit stagger, or of the last INPUT_BUFFER s of any other action. */
function holds(a: RiderAction): boolean {
  return a.kind === 'hit' || (a.kind !== 'ult' && a.dur - a.t <= INPUT_BUFFER);
}

/** preStep: turn attack presses into swings (or buffer them while the current action finishes). */
export function requestSwing(ctx: CombatCtx, r: RiderState, c: Controls): void {
  const side: Side | 0 | null = c.heavy ? 0 : c.attackL ? -1 : c.attackR ? 1 : null;
  if (side === null) return;
  if (canSwing(ctx, r)) {
    startSwing(ctx, r, c.heavy, side);
    return;
  }
  const a = r.action;
  if (a && holds(a)) ctx.rd(r).buffered = { heavy: c.heavy, side, age: 0 };
}

export function runBuffered(ctx: CombatCtx, r: RiderState): void {
  const b = ctx.rd(r).buffered;
  if (!b || !canSwing(ctx, r)) return;
  ctx.rd(r).buffered = null;
  startSwing(ctx, r, b.heavy, b.side);
}

/** Start a swing now (also used by the debug API). side 0 = auto. */
export function startSwing(ctx: CombatCtx, r: RiderState, heavy: boolean, sideIn: Side | 0): void {
  const side = sideIn === 0 ? autoSide(ctx, r) : sideIn;
  const { ph, tell } = timing(ctx, r, heavy);
  ctx.rd(r).swing = ph;
  ctx.rd(r).swingChecked = false; // the throw decision is taken once per swing
  r.invuln = 0; // attacking gives up respawn protection
  r.action = { kind: heavy ? 'heavy' : 'attack', side, t: 0, dur: ph.total, weapon: r.weapon, skillId: null, resolved: false };
  armParry(ctx, r, ph.total); // the pan arms its parry on the press
  if (tell) ctx.visuals.add(new HeavyTell(ctx.visuals, r, side, ph.windup));
  ctx.view(r)?.cue(heavy ? 'heavy' : 'attack', { side, weapon: r.weapon });
  ctx.bus.emit('combat:swing', { riderId: r.id, side, heavy, weapon: r.weapon });
}

function autoSide(ctx: CombatCtx, r: RiderState): Side {
  const reach = WEAPONS[r.weapon].reach + MELEE.heavyAutoSideRange;
  const near =
    nearest(ctx, r, (o, ds, dx) => targetable(ctx, o) && Math.abs(ds) < MELEE.maxDs + 0.6 && Math.abs(dx) <= reach) ??
    nearest(ctx, r, (o, ds, dx) => targetable(ctx, o) && Math.abs(ds) < 8 && Math.abs(dx) < 6);
  if (near) return near.x >= r.x ? 1 : -1;
  return r.x > 0 ? -1 : 1;
}

interface Strike { r: RiderState; v: RiderState; side: Side; weapon: WeaponId; heavy: boolean }
const strikes: Strike[] = [];

/**
 * postStep: resolve every swing inside its active window, exactly one hit (or whiff) per swing. Targets are
 * picked for everyone before any hit lands, so two riders striking on the same substep trade blows instead
 * of the lower rider id always winning.
 */
export function resolveSwings(ctx: CombatCtx): void {
  strikes.length = 0;
  for (const r of ctx.session.riders) {
    const s = pickStrike(ctx, r);
    if (s) strikes.push(s);
  }
  for (const s of strikes) strike(ctx, s.r, s.v, s.side, s.weapon, s.heavy);
  strikes.length = 0;
}

function pickStrike(ctx: CombatCtx, r: RiderState): Strike | null {
  const a = r.action;
  if (!isSwing(a) || a.resolved) return null;
  const heavy = a.kind === 'heavy';
  const ph = ctx.rd(r).swing;
  if (a.t < ph.windup) return null;
  if (a.t >= ph.windup + ph.active || !active(r) || !r.mods.canAttack) {
    a.resolved = true; // window over, or stunned / chilled / gone untouchable mid-swing: a whiff
    return null;
  }
  const v = findTarget(ctx, r, a.side, a.weapon);
  if (!v) return null;
  a.resolved = true;
  return { r, v, side: a.side, weapon: a.weapon, heavy };
}

function findTarget(ctx: CombatCtx, r: RiderState, side: Side, weapon: WeaponId): RiderState | undefined {
  const reach = WEAPONS[weapon].reach;
  let best: RiderState | undefined;
  let bestLat = Infinity;
  for (const o of ctx.session.riders) {
    if (o === r || !targetable(ctx, o)) continue;
    const lat = (o.x - r.x) * side;
    if (Math.abs(o.s - r.s) >= MELEE.maxDs || Math.abs(o.y - r.y) > MELEE.maxDy) continue;
    if (lat < MELEE.minLateral || lat > reach || lat >= bestLat) continue;
    best = o;
    bestLat = lat;
  }
  return best;
}

function strike(ctx: CombatCtx, r: RiderState, v: RiderState, side: Side, weapon: WeaponId, heavy: boolean): void {
  const w = WEAPONS[weapon];
  const d = ctx.rd(r);
  if (parryArmed(ctx, v)) {
    // 完美格挡: the pan turns the hit into a parry (the attacker's swing is cancelled and it is stunned).
    parry(ctx, v, r, null, ctx.pos(v));
    return;
  }
  const counter = inWindup(ctx, v);
  const bonus = d.nextCrit;
  d.nextCrit = false;
  const crit = ctx.force.crit ?? (counter || bonus || ctx.rng.chance(critChance(weapon)));
  const triple = traitOf(weapon) === 'triple';
  const chain = triple ? tripleCount(ctx, r, v) : 0;
  const finisher = triple && chain % 3 === 0; // the third hit in a row: ×1.5 damage, +50 % knock
  const outcome = applyHit(ctx, {
    attacker: r, victim: v,
    damage: (heavy ? w.heavyDamage : w.damage) * powerMul(ROSTER[r.character].stats.power) * (finisher ? TRAIT.triple.damage : 1),
    side, weapon, heavy, crit, skillId: null,
    knock: w.knock * (heavy ? MELEE.heavyKnockMul : 1) * (finisher ? TRAIT.triple.knock : 1),
    speedLoss: ctx.rng.range(MELEE.speedLoss[0], MELEE.speedLoss[1]), melee: true, impact: heavy ? 'heavy' : 'light',
  });
  if (outcome !== 'landed') {
    if (bonus) d.nextCrit = true;
    return;
  }
  if (triple) commitTriple(ctx, r, v, chain);
  consumeUse(ctx, r);
  knockLoose(ctx, r, v, heavy);
}
