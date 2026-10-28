// Bus → audio, part 4 (r6 SPEC §24): the element reactions get a sting of their own, played at the
// victim, and a couple of r6 skills have sounds that belong to their own event (the fresh one
// munches every pickup it vacuums in). Everything that can repeat is rate limited: a reaction
// burst is one sting, not one per victim.
import { SFX } from './sfx/bank';
import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/events-map';
import type { Host, Where } from './host';
import type { PlayOpts } from './sfx/bank';

/** A reaction is a highlight: it must be heard over the race mix, so it never plays below this. */
const MIN_CUE_GAIN = 0.6;
/** The gap (s) between two stings of the same reaction (a burst is one sting, not one per victim). */
const REACT_GAP = 0.2;

export function wireR6(bus: EventBus<GameEvents>, h: Host): void {
  /** Play a cue in the world, but never so quietly that the player misses it. */
  const cue = (id: string, where: Where, opts: PlayOpts = {}): void => {
    if (where === null || typeof where === 'number') {
      h.play(id, where, opts);
      return;
    }
    const p = h.place(where);
    h.play(id, null, {
      ...opts,
      volume: (opts.volume ?? 1) * Math.max(p.gain, MIN_CUE_GAIN),
      pan: (opts.pan ?? 0) + p.pan,
      lowpass: p.lowpass,
    });
  };

  // 蒸发 / 融化 / 冻结 / 感电 / 超导 / 超载 / 扩散 — a sting of their own, at the victim.
  bus.on('combat:reaction', ({ reaction, pos }) => {
    const id = `react.${reaction}`;
    if (!(id in SFX)) return;
    if (!h.cooldown(`react${reaction}`, REACT_GAP)) return;
    cue(id, pos, { volume: 1.1 });
  });

  // The fresh one munches every pickup it vacuums in (its own event, not a skill hit).
  const fresh = new Set<number>();
  bus.on('skill:cast', ({ riderId, skillId }) => {
    if (skillId === 'xinxian.fresh') fresh.add(riderId);
  });
  bus.on('skill:end', ({ riderId, skillId }) => {
    if (skillId === 'xinxian.fresh') fresh.delete(riderId);
  });
  bus.on('pickup:take', ({ riderId }) => {
    if (fresh.has(riderId)) h.play('skill.xinxian.fresh.hit', riderId);
  });
}
