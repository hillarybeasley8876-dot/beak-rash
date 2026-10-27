// Skill loadouts (SPEC §24): what each character carries into a race. The player edits theirs on the roster
// screen (SaveData.loadouts) or rolls a 盲盒 (blind box) each race; rivals ride with their signature skill plus
// one pool skill, and the nemesis brings its ult as well. Pure data + helpers (core and screens read it).
import type { Rng } from '../core/rng';
import type { CharacterId, SkillLoadout } from '../core/types';
import { equippable, equippableUlts, SKILLS } from './skills';

const L = (a: string, b: string, c: string, ult: string): SkillLoadout => ({ slots: [a, b, c], ult });

/** Default kit per character: the signature skill first (rivals fire slots 1 and 2), then two pool skills. */
export const DEFAULT_LOADOUTS: Record<CharacterId, SkillLoadout> = {
  pelican: L('pelican.torpedo', 'pelican.gulp', 'pelican.wing', 'pelican.ult'),
  goose: L('goose.honk', 'pool.firecracker', 'pool.warsong', 'ult.meteor'),
  capybara: L('capybara.chill', 'pool.thermos', 'pool.bubble', 'ult.timestop'),
  cat: L('cat.spin', 'pool.brainfight', 'pool.blink', 'ult.storm'),
  shiba: L('shiba.doge', 'pool.popup', 'pool.boomerang', 'ult.meteor'),
  pigeon: L('pigeon.ghost', 'pool.pie', 'pool.ducks', 'ult.timestop'),
  penguin: L('penguin.slide', 'pool.icelance', 'pool.snowball', 'ult.storm'),
  seagull: L('seagull.steal', 'pool.watergun', 'pool.boomerang', 'ult.meteor'),
  sloth: L('sloth.flash', 'pool.thermos', 'pool.pie', 'ult.timestop'),
  corgi: L('corgi.whistle', 'pool.watergun', 'pool.bubble', 'ult.storm'),
  bananacat: L('bananacat.peel', 'pool.popup', 'pool.warsong', 'ult.timestop'),
  cryingcat: L('cryingcat.tears', 'pool.thunder', 'pool.bubble', 'ult.storm'),
  xinxian: L('xinxian.fresh', 'pool.rocket', 'pool.boomerang', 'ult.meteor'),
  moodeng: L('moodeng.bounce', 'pool.watergun', 'pool.warsong', 'ult.meteor'),
  pedro: L('pedro.trash', 'pool.ducks', 'pool.tornado', 'ult.storm'),
  hamster: L('hamster.violin', 'pool.pie', 'pool.thermos', 'ult.timestop'),
};

const copy = (l: SkillLoadout): SkillLoadout => ({ slots: [l.slots[0], l.slots[1], l.slots[2]], ult: l.ult });

export const defaultLoadout = (c: CharacterId): SkillLoadout => copy(DEFAULT_LOADOUTS[c]);

/** A rival's kit: its signature skill and one pool skill (slots 1–2); the nemesis also brings an ult (never the
 *  time stop: an AI freezing the player for three seconds is not a fight, it is a cutscene). */
export function rivalLoadout(c: CharacterId, nemesis: boolean): SkillLoadout {
  const d = DEFAULT_LOADOUTS[c];
  const ult = nemesis ? (d.ult === 'ult.timestop' ? 'ult.meteor' : d.ult) : null;
  return { slots: [d.slots[0], d.slots[1], null], ult };
}

/**
 * The player's kit from a stored or requested loadout: every slot must hold a skill this character may equip,
 * no skill twice, the ult an equippable ult; anything else falls back slot by slot to the character's default.
 */
export function validLoadout(raw: SkillLoadout | null | undefined, c: CharacterId): SkillLoadout {
  const d = DEFAULT_LOADOUTS[c];
  if (!raw) return copy(d);
  const ok = new Set(equippable(c).map((s) => s.id));
  const used = new Set<string>();
  const slots = [0, 1, 2].map((i) => {
    const id = raw.slots[i];
    if (typeof id === 'string' && ok.has(id) && !used.has(id)) { used.add(id); return id; }
    return null;
  });
  // Empty or invalid slots take the default's skills that are not already equipped elsewhere.
  for (let i = 0; i < 3; i++) {
    if (slots[i] !== null) continue;
    const fill = d.slots.find((id) => id !== null && !used.has(id)) ?? null;
    slots[i] = fill;
    if (fill) used.add(fill);
  }
  const ultOk = typeof raw.ult === 'string' && equippableUlts(c).some((s) => s.id === raw.ult);
  return { slots: [slots[0] ?? null, slots[1] ?? null, slots[2] ?? null], ult: ultOk ? raw.ult : d.ult };
}

/** 盲盒: three different skills this character may equip and one ult, drawn from `rng`. */
export function randomLoadout(c: CharacterId, rng: Rng): SkillLoadout {
  const picks = rng.shuffle(equippable(c).map((s) => s.id)).slice(0, 3);
  const ults = equippableUlts(c).map((s) => s.id);
  return { slots: [picks[0] ?? null, picks[1] ?? null, picks[2] ?? null], ult: ults.length ? rng.pick(ults) : null };
}

/** Every skill id a loadout names (tests, warm-up of the skills' props and sounds). */
export const loadoutSkills = (l: SkillLoadout): string[] =>
  [...l.slots, l.ult].filter((id): id is string => id !== null && Object.hasOwn(SKILLS, id));
