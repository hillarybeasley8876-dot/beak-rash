// Elements & reactions (SPEC §24). A skill with an element leaves an aura on the rider it hits (fire → 'burn',
// ice → 'cold' stacks, thunder → 'charged', water → 'wet', wind carries what it touches); a second, different
// element on top of an aura reacts:
//   fire + water   蒸发 vaporize       burst damage, both auras gone
//   fire + ice     融化 melt           burst damage, both auras gone
//   water + ice    冻结 freeze         frozen (no steering, no attacks) for REACT.freeze s
//   thunder + water 感电 electro       chains to every wet rider within REACT.electroRadius (rain: everyone is wet)
//   thunder + ice  超导 superconduct   a big slow and the victim's armour (shield) breaks
//   thunder + fire 超载 overload       an explosion that knocks everyone around the victim aside
//   wind + any aura 扩散 swirl         the aura spreads to riders around the victim
// Burn ticks damage over time (credited to whoever lit it). Rain (track weather) keeps every rider 'wet'.
// Callers: skills call applyElement() after their hit lands; combat/system.ts calls tickElements() each substep.
import type { Element, Reaction, RiderState, StatusId } from '../../core/types';
import { finished, others, targetable, type CombatCtx } from './ctx';
import { applyHit } from './damage';
import { addStatus, removeStatus, statusStrength } from './statuses';
import { ELEMENTS as E, REACT } from './tuning';

/** The status an element leaves on its victim. */
const AURA: Record<Exclude<Element, 'wind'>, StatusId> = { fire: 'burn', ice: 'cold', thunder: 'charged', water: 'wet' };
const AURA_ELEMENT: Partial<Record<StatusId, Exclude<Element, 'wind'>>> = { burn: 'fire', cold: 'ice', charged: 'thunder', wet: 'water' };

/** The element auras a rider carries right now (rain's wet included). */
export function auras(r: RiderState): Array<Exclude<Element, 'wind'>> {
  const out: Array<Exclude<Element, 'wind'>> = [];
  for (const st of r.statuses) {
    const el = st.time > 0 ? AURA_ELEMENT[st.id] : undefined;
    if (el && !out.includes(el)) out.push(el);
  }
  return out;
}

/** The reaction `incoming` makes with an aura already on the victim (null = none). */
export function reactionOf(incoming: Element, aura: Exclude<Element, 'wind'>): Reaction | null {
  if (incoming === aura) return null;
  if (incoming === 'wind') return 'swirl';
  const pair = new Set([incoming, aura]);
  if (pair.has('fire') && pair.has('water')) return 'vaporize';
  if (pair.has('fire') && pair.has('ice')) return 'melt';
  if (pair.has('water') && pair.has('ice')) return 'freeze';
  if (pair.has('thunder') && pair.has('water')) return 'electro';
  if (pair.has('thunder') && pair.has('ice')) return 'superconduct';
  if (pair.has('thunder') && pair.has('fire')) return 'overload';
  return null;
}

/** Lay the element's aura on `v` (ice adds a 'cold' stack; three stacks freeze). */
function layAura(ctx: CombatCtx, a: RiderState | null, v: RiderState, el: Exclude<Element, 'wind'>, stacks = 1): void {
  const src = a?.id ?? null;
  if (el === 'ice') {
    const n = Math.min(REACT.coldStacks, statusStrength(v, 'cold') + stacks);
    removeStatus(v, 'cold');
    if (n >= REACT.coldStacks) {
      addStatus(v, 'frozen', REACT.freeze, 1, src);
      return;
    }
    addStatus(v, 'cold', E.cold, n, src);
    return;
  }
  addStatus(v, AURA[el], el === 'fire' ? E.burn : el === 'thunder' ? E.charged : E.wet, 1, src);
}

/** A reaction's damage hit (a skill hit from `a`, or nobody's when the aura came from the weather). */
function reactHit(ctx: CombatCtx, a: RiderState | null, v: RiderState, damage: number, knock: number, stun = 0): void {
  if (!a) {
    v.hp = Math.max(0, v.hp - damage);
    return;
  }
  applyHit(ctx, {
    attacker: a, victim: v, damage, side: v.x >= a.x ? 1 : -1, weapon: 'none', heavy: true, crit: false,
    skillId: 'reaction', knock, speedLoss: 0.1, melee: false, impact: 'skill', stun: stun || undefined, countCombo: false,
  });
}

/** Resolve reaction `re` on `v`; returns every rider it touched (victim first). */
function react(ctx: CombatCtx, a: RiderState | null, v: RiderState, re: Reaction, incoming: Element, aura: Exclude<Element, 'wind'>): RiderState[] {
  const hit: RiderState[] = [v];
  const near = (radius: number): RiderState[] =>
    others(ctx, v, (o, ds, dx) => o !== a && targetable(ctx, o) && Math.hypot(ds, dx) <= radius);
  switch (re) {
    case 'vaporize':
    case 'melt':
      removeStatus(v, AURA[aura]);
      reactHit(ctx, a, v, re === 'vaporize' ? REACT.vaporize : REACT.melt, 2.5);
      break;
    case 'freeze':
      removeStatus(v, 'wet');
      removeStatus(v, 'cold');
      addStatus(v, 'frozen', REACT.freeze, 1, a?.id ?? null);
      break;
    case 'electro': {
      reactHit(ctx, a, v, REACT.electro, 1.5, REACT.electroStun);
      for (const o of near(REACT.electroRadius)) {
        if (!auras(o).includes('water')) continue;
        reactHit(ctx, a, o, REACT.electro, 1.5, REACT.electroStun);
        hit.push(o);
      }
      break;
    }
    case 'superconduct':
      removeStatus(v, 'charged');
      removeStatus(v, 'cold');
      removeStatus(v, 'shield');
      addStatus(v, 'slow', REACT.superconductTime, REACT.superconductSlow, a?.id ?? null);
      reactHit(ctx, a, v, REACT.superconduct, 1);
      break;
    case 'overload':
      removeStatus(v, 'burn');
      removeStatus(v, 'charged');
      reactHit(ctx, a, v, REACT.overload, REACT.overloadKnock);
      for (const o of near(REACT.overloadRadius)) {
        reactHit(ctx, a, o, Math.round(REACT.overload * 0.6), REACT.overloadKnock);
        hit.push(o);
      }
      break;
    case 'swirl':
      for (const o of near(REACT.swirlRadius)) {
        layAura(ctx, a, o, aura);
        hit.push(o);
      }
      break;
  }
  void incoming;
  return hit;
}

/**
 * Element `el` lands on `v` (call it after the skill's own hit landed). With a different aura already on the
 * victim it reacts (combat:reaction); otherwise it leaves its own aura (combat:element). Wind with no aura to
 * carry does nothing. Returns the reaction, or null.
 */
export function applyElement(ctx: CombatCtx, a: RiderState | null, v: RiderState, el: Element, stacks = 1): Reaction | null {
  if (!targetable(ctx, v) || (a && finished(a))) return null;
  const pos = ctx.pos(v);
  for (const aura of auras(v)) {
    const re = reactionOf(el, aura);
    if (!re) continue;
    const victims = react(ctx, a, v, re, el, aura);
    ctx.bus.emit('combat:reaction', {
      reaction: re, attacker: a?.id ?? null, victim: v.id, victims: victims.map((r) => r.id),
      damage: REACT_DAMAGE[re], pos,
    });
    return re;
  }
  if (el === 'wind') return null;
  layAura(ctx, a, v, el, stacks);
  ctx.bus.emit('combat:element', { attacker: a?.id ?? null, victim: v.id, element: el, pos });
  return null;
}

const REACT_DAMAGE: Record<Reaction, number> = {
  vaporize: REACT.vaporize, melt: REACT.melt, freeze: 0, electro: REACT.electro,
  superconduct: REACT.superconduct, overload: REACT.overload, swirl: 0,
};

const burnAcc = new WeakMap<RiderState, number>();

/** Per substep: burn damage (credited to whoever lit it), and rain keeps every racing rider wet. */
export function tickElements(ctx: CombatCtx, dt: number): void {
  const rain = ctx.session.track.weather === 'rain' || ctx.session.config.weather === 'rain';
  for (const r of ctx.session.riders) {
    if (r.mode !== 'racing') continue;
    if (rain && statusStrength(r, 'wet') <= 0) addStatus(r, 'wet', E.rainWet, 1, null, true);
    const burn = r.statuses.find((st) => st.id === 'burn' && st.time > 0);
    if (!burn) continue;
    const acc = (burnAcc.get(r) ?? 0) + dt;
    if (acc < E.burnTick) { burnAcc.set(r, acc); continue; }
    burnAcc.set(r, acc - E.burnTick);
    const src = burn.source !== null ? ctx.session.rider(burn.source) ?? null : null;
    if (src && !finished(src)) {
      r.lastHitBy = src.id;
      r.lastHitTime = ctx.now();
    }
    r.hp = Math.max(0, r.hp - E.burnDamage);
  }
}
