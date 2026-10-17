// Skill flair table: which presets fire, and where, when a skill is cast / hits / ends.
import type { RiderId, Vec3Like } from '../../core/types';
import type { FxContext } from '../context';
import type { BurstOpts } from '../presets/kit';

type Anchor = 'head' | 'body' | 'ground' | 'event';

interface Flair { preset: string; at: Anchor; opts?: BurstOpts; follow?: boolean }

interface SkillFlair { cast?: Flair[]; hit?: Flair[]; end?: Flair[] }

const TABLE: Record<string, SkillFlair> = {
  'pelican.torpedo': { cast: [{ preset: 'poof', at: 'head', opts: { scale: 0.6 } }], hit: [{ preset: 'scales', at: 'event' }] },
  'pelican.gulp': { cast: [{ preset: 'poof', at: 'head', opts: { color: '#ffd0b0', color2: '#ff9a6a', scale: 0.8 } }], hit: [{ preset: 'sparkle', at: 'event', opts: { color: '#ff9a6a' } }] },
  'pelican.wing': { cast: [{ preset: 'feathers', at: 'body', opts: { count: 8 } }, { preset: 'boost', at: 'body', opts: { color: '#9fdcff' } }] },
  'goose.honk': { cast: [{ preset: 'shout', at: 'head' }] },
  'capybara.chill': { cast: [{ preset: 'aura', at: 'body', opts: { color: '#ffd166', color2: '#ffb000', scale: 1.6 } }] },
  'cat.spin': { cast: [{ preset: 'spin', at: 'body', follow: true, opts: { color: '#f2a03d', color2: '#fff4e0' } }], hit: [{ preset: 'fur', at: 'event', opts: { count: 5, color: '#f2a03d' } }] },
  'shiba.doge': { cast: [{ preset: 'aura', at: 'body', opts: { color: '#ffe600', color2: '#ffffff', scale: 0.6 } }, { preset: 'sparkle', at: 'head', opts: { color: '#ffffff' } }] },
  'pigeon.ghost': { cast: [{ preset: 'poof', at: 'body', opts: { color: '#d9cdf0', color2: '#9c8cc0', scale: 1.3 } }], end: [{ preset: 'poof', at: 'body', opts: { color: '#d9cdf0', color2: '#9c8cc0', scale: 1.3 } }] },
  'penguin.slide': { cast: [{ preset: 'splash', at: 'ground', opts: { scale: 0.7 } }, { preset: 'sparkle', at: 'body', opts: { color: '#bfefff' } }] },
  'seagull.steal': { cast: [{ preset: 'feathers', at: 'body', opts: { count: 5, color: '#ffffff', color2: '#b8c0c8' } }], hit: [{ preset: 'fries', at: 'event' }] },
  'sloth.flash': { cast: [{ preset: 'zaps', at: 'body' }, { preset: 'boost', at: 'body', opts: { color: '#ffd000' } }] },
  'corgi.whistle': { cast: [{ preset: 'notes', at: 'head' }, { preset: 'shout', at: 'head', opts: { scale: 0.7, color: '#ffe600' } }] },
};

/** Generic accents for skills not in the table (new skills keep some feedback). */
const DEFAULT: SkillFlair = { cast: [{ preset: 'sparkle', at: 'body' }], hit: [{ preset: 'sparkle', at: 'event', opts: { scale: 0.8 } }] };

/** Fire the flair for `phase`; 'event' anchors use eventPos and the victim's velocity. */
export function skillFlair(
  ctx: FxContext, phase: keyof SkillFlair, skillId: string, riderId: RiderId, eventPos?: Vec3Like, victim?: RiderId,
): void {
  const flairs = (TABLE[skillId] ?? DEFAULT)[phase];
  if (!flairs) return;
  const t = ctx.tracker.get(riderId);
  const v = ctx.tracker.get(victim);
  for (const f of flairs) {
    const event = f.at === 'event';
    const pos = event ? eventPos ?? v?.body : f.at === 'head' ? t?.head : f.at === 'ground' ? t?.pos : t?.body;
    if (!pos) continue;
    ctx.burst(f.preset, pos, {
      ground: (event ? v : t)?.ground, vel: (event ? v : t)?.vel, follow: f.follow ? riderId : undefined, ...f.opts,
    });
  }
}
