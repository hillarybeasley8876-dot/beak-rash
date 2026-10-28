// Impact punctuation (hit-stop, camera shake, gamepad rumble), scaled by how close the action is to a
// human so rivals brawling 80 m ahead never freeze your race. Impacts are coalesced per substep: one AoE
// hitting six riders punches like its strongest hit, not six stacked hit-stops, shakes and rumbles.
// The sim's "the player" is a human (SPEC §28): the feedback reads the humans, never the local rider.
import type { RiderState } from '../../core/types';
import { humanDistance, type CombatCtx } from './ctx';
import { FEEDBACK_RANGE, HITSTOP, SHAKE } from './tuning';

export type ImpactKind = keyof typeof HITSTOP;

interface Pending { kind: ImpactKind; k: number }
const pending = new WeakMap<CombatCtx, Pending>();

/** 1 = a human is involved, fades to 0 at FEEDBACK_RANGE metres from the nearest human. */
export function involvement(ctx: CombatCtx, a: RiderState | null, b: RiderState | null): number {
  if (a?.human || b?.human) return 1;
  let best = Infinity;
  for (const r of [a, b]) {
    if (!r) continue;
    best = Math.min(best, humanDistance(ctx, r));
  }
  return best >= FEEDBACK_RANGE ? 0 : 0.5 * (1 - best / FEEDBACK_RANGE);
}

/** Queue an impact; flushImpacts() plays the strongest one of the substep once. */
export function impact(ctx: CombatCtx, kind: ImpactKind, a: RiderState | null, b: RiderState | null): void {
  const k = involvement(ctx, a, b);
  if (k <= 0) return;
  const cur = pending.get(ctx);
  if (!cur) {
    pending.set(ctx, { kind, k });
    return;
  }
  if (HITSTOP[kind] > HITSTOP[cur.kind]) cur.kind = kind;
  cur.k = Math.max(cur.k, k);
}

/** End of a combat step: one hit-stop / shake / rumble for everything that landed in it. */
export function flushImpacts(ctx: CombatCtx): void {
  const p = pending.get(ctx);
  if (!p) return;
  pending.delete(ctx);
  const { kind, k } = p;
  const { clock, bus, input } = ctx.session.app;
  if (k >= 1) {
    const stop = HITSTOP[kind];
    clock.hitStop(stop);
    bus.emit('hitstop', { seconds: stop });
    input.rumble(kind === 'light' ? 0.35 : 0.8, 0.6, kind === 'light' ? 90 : 160);
  }
  bus.emit('cam:shake', { intensity: SHAKE[kind] * k, duration: kind === 'light' ? 0.18 : 0.3 });
}

/** Lighter feedback for non-damage moments (block clang, steal, bell). */
export function nudge(ctx: CombatCtx, a: RiderState, intensity = 0.12): void {
  const k = involvement(ctx, a, null);
  if (k > 0) ctx.bus.emit('cam:shake', { intensity: intensity * k, duration: 0.12 });
}
