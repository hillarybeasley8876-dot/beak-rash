// The r4 cut-ins (SPEC §14 / §18): the corgi going off duty and the 宿敌 NEMESIS card. Both use the
// shared splash machinery (ransom lettering, portrait cards, a star burst) and share the one splash slot.
import type { CharacterId } from '../../../core/types';
import { R4_HUD as S } from '../../../data/strings';
import { ROSTER } from '../../../data/roster';
import { splashCut } from './splash';
import { nextSeed } from './splashes';
import type { CutIn } from './types';

/** The corgi goes off duty (SPEC §14): a red splash with the officer's smug mug. */
export function policeDownCut(): CutIn {
  return splashCut({
    cls: 'ci-police', title: S.policeDown.en, scheme: 'hot', dur: 1.2, seed: nextSeed(), flash: true,
    cn: S.policeDown.cn,
    left: { id: 'corgi', mood: 'smug', name: ROSTER.corgi.name },
  });
}

/** The nemesis card (SPEC §18): a red 宿敌 NEMESIS card with the rival's portrait and the grudge. */
export function nemesisCut(character: CharacterId, grudge: number): CutIn {
  return splashCut({
    cls: 'ci-nemesis', title: S.nemesis.en, scheme: 'mono', dur: 1.4, seed: nextSeed(),
    cn: S.nemesis.cn, sub: `仇恨 ${Math.max(0, Math.round(grudge))}`,
    left: { id: character, mood: 'smug', name: ROSTER[character].name },
  });
}
