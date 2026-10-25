// The easter eggs (SPEC §21): the five ducks, the SVG easel, the goose's poem, the lazy sloth, the pelican god
// and the Konami bike. An egg found in the race earns its achievement at once; the eggs that are found
// outside a race (the title word, the credits, the Konami code) are collected at the end of the next race,
// like the cup clears are.
import type { SaveData } from '../../core/save';
import { DUCK_IDS } from '../secrets/tuning';
import type { RuleCtx } from './facts';

const DUCK_PREFIX = 'duck_';
const SVG_PREFIX = 'svg_';
const KONAMI = 'llm';   // the unlocked bike is the Konami code's proof
/** The nine eggs of the records sheet (SPEC §21); the five ducks count as one. */
const EGGS = ['ducks', 'konami', 'bribe', 'svg', 'goose_poem', 'sloth', 'pelican_god', 'pelican_word', 'credits_thanks'] as const;
type EggId = typeof EGGS[number];

/** Which eggs the profile has: the found ids in the save, the Konami bike in the unlocks. */
function foundEggs(save: SaveData): Set<EggId> {
  const { secrets, unlocks } = save;
  const found = new Set<EggId>();
  if (secrets.some((id) => id.startsWith(DUCK_PREFIX))) found.add('ducks');
  if (unlocks.includes(KONAMI)) found.add('konami');
  if (secrets.includes('bribe')) found.add('bribe');
  if (secrets.some((id) => id.startsWith(SVG_PREFIX))) found.add('svg');
  if (secrets.includes('goose_poem')) found.add('goose_poem');
  if (secrets.includes('sloth')) found.add('sloth');
  if (secrets.includes('pelican_god')) found.add('pelican_god');
  if (secrets.includes('pelican_word')) found.add('pelican_word');
  if (secrets.includes('credits_thanks')) found.add('credits_thanks');
  return found;
}

export function eggRules(ctx: RuleCtx): Array<() => void> {
  const { bus, app } = ctx;

  /** What the profile's eggs earn right now: the five ducks count as one achievement. */
  const fromSave = (): void => {
    const { secrets, unlocks } = app.save.data;
    if (DUCK_IDS.every((id) => secrets.includes(id))) ctx.unlock('ducks');
    if (secrets.some((id) => id.startsWith(SVG_PREFIX))) ctx.unlock('svg');
    if (secrets.includes('goose_poem')) ctx.unlock('goose_poem');
    if (secrets.includes('sloth')) ctx.unlock('sloth_wait');
    if (secrets.includes('pelican_god')) ctx.unlock('pelican_god');
    if (unlocks.includes(KONAMI)) ctx.unlock('konami');
    if (EGGS.every((egg) => foundEggs(app.save.data).has(egg))) ctx.unlock('eggs_all');
  };

  return [
    bus.on('secret:found', ({ id }) => {
      // The egg the player just found: its achievement, and the nine-egg set with it.
      if (id.startsWith(DUCK_PREFIX) && DUCK_IDS.every((duck) => app.save.data.secrets.includes(duck))) ctx.unlock('ducks');
      if (id.startsWith(SVG_PREFIX)) ctx.unlock('svg');
      if (id === 'goose_poem') ctx.unlock('goose_poem');
      if (id === 'sloth') ctx.unlock('sloth_wait');
      if (id === 'pelican_god') ctx.unlock('pelican_god');
      if (id === 'bribe') ctx.unlock('bribe');
      fromSave();
    }),
    bus.on('race:end', () => fromSave()),
  ];
}
