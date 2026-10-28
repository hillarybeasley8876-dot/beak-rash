// Skill flair table: which presets fire, and where, when a skill is cast / hits / ends.
// Every skill in data/skills.ts has an entry, so a cast always looks like the skill it is (SPEC §24).
import type { RiderId, Vec3Like } from '../../core/types';
import type { FxContext } from '../context';
import type { BurstOpts } from '../presets/kit';

type Anchor = 'head' | 'body' | 'ground' | 'event';

interface Flair { preset: string; at: Anchor; opts?: BurstOpts; follow?: boolean }

interface SkillFlair { cast?: Flair[]; hit?: Flair[]; end?: Flair[] }

const TABLE: Record<string, SkillFlair> = {
  // Torpedo hits land 15+ m ahead: a big heavy POW + a fan of scales so the hit reads at that distance.
  'pelican.torpedo': {
    cast: [{ preset: 'poof', at: 'head', opts: { scale: 0.6 } }],
    hit: [{ preset: 'hitHeavy', at: 'event', opts: { scale: 1.5 } }, { preset: 'scales', at: 'event', opts: { scale: 1.6 } }],
  },
  'pelican.gulp': { cast: [{ preset: 'poof', at: 'head', opts: { color: '#ffd0b0', color2: '#ff9a6a', scale: 0.8 } }], hit: [{ preset: 'sparkle', at: 'event', opts: { color: '#ff9a6a' } }] },
  'pelican.wing': { cast: [{ preset: 'feathers', at: 'body', opts: { count: 8 } }, { preset: 'boost', at: 'body', opts: { color: '#9fdcff' } }] },
  'pelican.ult': {
    cast: [{ preset: 'boost', at: 'body', opts: { color: '#ffe600', scale: 1.3 } }, { preset: 'aura', at: 'body', opts: { color: '#ffe600', color2: '#ff8a00', scale: 1.8 } }],
    hit: [{ preset: 'shockwave', at: 'event', opts: { scale: 1.5 } }, { preset: 'hitHeavy', at: 'event', opts: { scale: 1.6 } }],
  },
  'goose.honk': { cast: [{ preset: 'shout', at: 'head' }] },
  'capybara.chill': { cast: [{ preset: 'aura', at: 'body', opts: { color: '#ffd166', color2: '#ffb000', scale: 1.6 } }] },
  'cat.spin': { cast: [{ preset: 'spin', at: 'body', follow: true, opts: { color: '#f2a03d', color2: '#fff4e0' } }], hit: [{ preset: 'fur', at: 'event', opts: { count: 5, color: '#f2a03d' } }] },
  'shiba.doge': { cast: [{ preset: 'aura', at: 'body', opts: { color: '#ffe600', color2: '#ffffff', scale: 0.6 } }, { preset: 'sparkle', at: 'head', opts: { color: '#ffffff' } }] },
  'pigeon.ghost': { cast: [{ preset: 'poof', at: 'body', opts: { color: '#d9cdf0', color2: '#9c8cc0', scale: 1.3 } }], end: [{ preset: 'poof', at: 'body', opts: { color: '#d9cdf0', color2: '#9c8cc0', scale: 1.3 } }] },
  'penguin.slide': { cast: [{ preset: 'splash', at: 'ground', opts: { scale: 0.7 } }, { preset: 'sparkle', at: 'body', opts: { color: '#bfefff' } }] },
  'seagull.steal': { cast: [{ preset: 'feathers', at: 'body', opts: { count: 5, color: '#ffffff', color2: '#b8c0c8' } }], hit: [{ preset: 'fries', at: 'event' }] },
  'sloth.flash': { cast: [{ preset: 'zaps', at: 'body' }, { preset: 'boost', at: 'body', opts: { color: '#ffd000' } }] },
  'corgi.whistle': { cast: [{ preset: 'notes', at: 'head' }, { preset: 'shout', at: 'head', opts: { scale: 0.7, color: '#ffe600' } }] },

  // ---- r6 meme signatures (SPEC §23–§24): every one of them is its own joke.
  'bananacat.peel': {
    cast: [{ preset: 'bananaBits', at: 'ground', opts: { scale: 0.9 } }],
    hit: [{ preset: 'bananaBits', at: 'event', opts: { count: 5 } }, { preset: 'poof', at: 'event', opts: { scale: 0.7, color: '#ffe14d' } }],
  },
  'cryingcat.tears': {
    cast: [{ preset: 'tears', at: 'head', opts: { scale: 1.2 } }],
    hit: [{ preset: 'droplets', at: 'event', opts: { count: 8 } }],
  },
  'xinxian.fresh': {
    cast: [{ preset: 'fishBits', at: 'body', opts: { scale: 1.1 } }],
    hit: [{ preset: 'fishBits', at: 'event', opts: { count: 6 } }],
  },
  'moodeng.bounce': {
    cast: [{ preset: 'poof', at: 'body', opts: { scale: 0.8, color: '#ffd0b0', color2: '#ff9a6a' } }],
    hit: [{ preset: 'hitHeavy', at: 'event', opts: { scale: 1.4 } }, { preset: 'dust', at: 'event', opts: { count: 6 } }],
  },
  'pedro.trash': {
    cast: [{ preset: 'trashBits', at: 'body', opts: { scale: 1.1 } }],
    hit: [{ preset: 'trashBits', at: 'event', opts: { count: 6 } }],
  },
  'hamster.violin': {
    cast: [{ preset: 'notes', at: 'head', opts: { scale: 1.2 } }],
    hit: [{ preset: 'notes', at: 'event', opts: { count: 4, color: '#9fb6ff' } }],
  },

  // ---- r6 shared pool (SPEC §24): the four elements read at a glance.
  'pool.firebreath': {
    cast: [{ preset: 'embers', at: 'head', opts: { scale: 0.9 } }],
    hit: [{ preset: 'embers', at: 'event', opts: { scale: 1.3 } }],
  },
  'pool.icelance': {
    cast: [{ preset: 'iceShards', at: 'head', opts: { scale: 0.8 } }],
    hit: [{ preset: 'iceShards', at: 'event', opts: { scale: 1.2 } }],
  },
  'pool.thunder': {
    cast: [{ preset: 'zaps', at: 'head', opts: { scale: 0.8 } }],
    hit: [{ preset: 'zaps', at: 'event', opts: { scale: 1.3 } }],
  },
  'pool.watergun': {
    cast: [{ preset: 'droplets', at: 'head', opts: { scale: 0.8 } }],
    hit: [{ preset: 'droplets', at: 'event', opts: { scale: 1.1 } }],
  },
  'pool.tornado': {
    cast: [{ preset: 'windDust', at: 'body', opts: { scale: 1.1, color: '#cfe8c8' } }],
    hit: [{ preset: 'windDust', at: 'event', opts: { scale: 1.3 } }],
  },
  'pool.boomerang': {
    cast: [{ preset: 'scales', at: 'head', opts: { count: 5 } }],
    hit: [{ preset: 'scales', at: 'event', opts: { scale: 1.1 } }],
  },
  'pool.pie': {
    cast: [{ preset: 'pieBits', at: 'head', opts: { scale: 0.9 } }],
    hit: [{ preset: 'pieBits', at: 'event', opts: { scale: 1.2 } }],
  },
  'pool.brainfight': {
    cast: [{ preset: 'swirlBurst', at: 'head', opts: { scale: 0.9, color: '#ff9ad8' } }],
    hit: [{ preset: 'swirlBurst', at: 'event', opts: { scale: 1.1, color: '#ff9ad8' } }],
  },
  'pool.rocket': {
    cast: [{ preset: 'embers', at: 'body', opts: { scale: 1.1 } }],
    hit: [{ preset: 'embers', at: 'event', opts: { scale: 1.2 } }],
  },
  'pool.blink': {
    cast: [{ preset: 'poof', at: 'body', opts: { scale: 0.9, color: '#d9cdf0', color2: '#9c8cc0' } }],
    end: [{ preset: 'poof', at: 'body', opts: { scale: 1.1, color: '#eaf6ff', color2: '#8fd8ff' } }],
  },
  'pool.bubble': {
    cast: [{ preset: 'bubbles', at: 'body', opts: { scale: 1.1 } }],
    hit: [{ preset: 'bubbles', at: 'event', opts: { scale: 1.2 } }],
  },
  'pool.thermos': {
    cast: [{ preset: 'steam', at: 'head', opts: { scale: 0.9 } }],
    hit: [{ preset: 'heal', at: 'body' }],
  },
  'pool.ducks': {
    cast: [{ preset: 'quack', at: 'body', opts: { scale: 1.1 } }],
    hit: [{ preset: 'quack', at: 'event', opts: { scale: 0.9 } }],
  },
  'pool.firecracker': {
    cast: [{ preset: 'smoke', at: 'ground', opts: { count: 3 } }],
    hit: [{ preset: 'hitHeavy', at: 'event', opts: { scale: 1.2 } }, { preset: 'debris', at: 'event', opts: { count: 6 } }, { preset: 'embers', at: 'event', opts: { count: 8 } }],
  },
  'pool.popup': {
    cast: [{ preset: 'confetti', at: 'head', opts: { scale: 0.7 } }],
    hit: [{ preset: 'confetti', at: 'event', opts: { scale: 1.1 } }],
  },
  'pool.warsong': {
    cast: [{ preset: 'notes', at: 'head', opts: { scale: 1.2 } }, { preset: 'confetti', at: 'body', opts: { scale: 0.6 } }],
    hit: [{ preset: 'notes', at: 'event', opts: { count: 5, color: '#ff8a00' } }],
  },
  'pool.snowball': {
    cast: [{ preset: 'iceShards', at: 'head', opts: { scale: 0.7 } }],
    hit: [{ preset: 'iceShards', at: 'event', opts: { scale: 1.3 } }],
  },

  // ---- r6 shared ults (SPEC §24)
  'ult.timestop': {
    cast: [{ preset: 'aura', at: 'body', opts: { color: '#bfe9ff', color2: '#7fd8ff', scale: 2 } }],
    end: [{ preset: 'sparkle', at: 'body', opts: { color: '#bfe9ff', count: 10 } }],
  },
  'ult.meteor': {
    cast: [{ preset: 'embers', at: 'head', opts: { scale: 1.6 } }],
    hit: [{ preset: 'hitHeavy', at: 'event', opts: { scale: 1.6 } }, { preset: 'embers', at: 'event', opts: { scale: 1.6 } }],
  },
  'ult.storm': {
    cast: [{ preset: 'zaps', at: 'head', opts: { scale: 1.4 } }],
    hit: [{ preset: 'zaps', at: 'event', opts: { scale: 1.5 } }, { preset: 'droplets', at: 'event', opts: { count: 8 } }],
  },
};

/** The skills that have their own flair (the acceptance reads this list). */
export const FLAIR_SKILLS: readonly string[] = Object.keys(TABLE);

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
