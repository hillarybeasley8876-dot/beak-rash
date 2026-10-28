// r6 element reactions (SPEC §24): the burst at the victim when two elements meet, and the counter the
// acceptance reads (fx stats().reactionBursts). One burst per combat:reaction event; electro chains
// through every wet rider, so it gets a small zap per victim (six at most).
import type { Reaction } from '../../core/types';
import type { Session } from '../../core/contracts';
import type { FxContext } from '../context';

/** The burst each reaction throws at the victim. */
const BURST: Record<Reaction, { preset: string; scale: number }> = {
  vaporize: { preset: 'steam', scale: 1.2 },
  melt: { preset: 'meltSplash', scale: 1.2 },
  freeze: { preset: 'frostBurst', scale: 1.2 },
  electro: { preset: 'zaps', scale: 1.1 },
  superconduct: { preset: 'shatter', scale: 1.2 },
  overload: { preset: 'overload', scale: 1.3 },
  swirl: { preset: 'swirlBurst', scale: 1.2 },
};

/** The aura's colour: a small flash where the element landed. */
const AURA_COLOR: Record<string, string> = { fire: '#ff6a1e', ice: '#7fd8ff', thunder: '#ffe14d', water: '#3aa0ff' };

/** Reaction bursts per race session (a new session = a new race = a fresh count). */
const counts = new WeakMap<Session, number>();

/** How many reaction bursts this race has thrown. */
export function reactionBursts(session: Session | null): number {
  return session ? counts.get(session) ?? 0 : 0;
}

export function subscribeR6(ctx: FxContext): Array<() => void> {
  const { bus } = ctx.app;
  return [
    bus.on('combat:element', (e) => {
      const v = ctx.tracker.get(e.victim);
      ctx.burst('sparkle', v?.body ?? e.pos, {
        vel: v?.vel, ground: v?.ground, count: 4, scale: 0.7, color: AURA_COLOR[e.element] ?? '#ffffff',
      });
    }),
    bus.on('combat:reaction', (e) => {
      const session = ctx.session();
      if (session) counts.set(session, (counts.get(session) ?? 0) + 1);
      const spec = BURST[e.reaction];
      const v = ctx.tracker.get(e.victim);
      ctx.burst(spec.preset, v?.body ?? e.pos, { vel: v?.vel, ground: v?.ground, scale: spec.scale });
      if (e.reaction === 'electro') {
        // The chain: every wet rider the current jumped to gets its own zap.
        for (const id of e.victims.slice(0, 6)) {
          const t = ctx.tracker.get(id);
          ctx.burst('zaps', t?.body ?? e.pos, { vel: t?.vel, ground: t?.ground, scale: 0.7, count: 4 });
        }
      }
    }),
  ];
}
