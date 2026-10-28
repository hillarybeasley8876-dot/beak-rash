// When a rider fires its kit: one decision per slot — the ult, then the three skill slots of its loadout — each
// skill through its own rule (skill-rules.ts) and only when the runner would accept the cast (the cooldown, the
// SP, no silence). The autopilot player rides the same table on its own loadout.
import type { Controls } from '../../../core/types';
import { ruleFor, rammingAhead, SELF_SPEED, type Rule, type SkillView } from './skill-rules';

export type { SkillView } from './skill-rules';

/** Skills that hit or rob: a grudge fires these eagerly; the rest (shields, slides, vanishing) wait, as they block the payback swing. */
const PAYBACK = new Set(['goose.honk', 'cat.spin', 'seagull.steal']);

/** The ult no AI casts: freezing the pack for three seconds is a cutscene, not a fight. */
const NO_AI_ULT = new Set(['ult.timestop']);

/**
 * The eagerness of a pool skill relative to the signature skill in slot 1: the pool skills are the rider's
 * backup, so they are taken a little less eagerly — but only a little. The rivals really do use their whole
 * kit, and a pack that fights with everything is a pack the player cannot mash its way past: the SP bar fills
 * at a sane pace and the ult stays a mid-race event (the SP economy, tools/combat-check.mjs --soak).
 */
const BACKUP_EAGER = 0.85;

/** The slots a rider can press: 1–3 = U/I/O, 4 = the ult (P). */
type Slot = 1 | 2 | 3 | 4;

interface Candidate {
  slot: Slot;
  id: string;
  rule: Rule;
}

/** The skills this rider could fire now, in the order they are tried: the ult first, then the slots. */
function candidates(v: SkillView): Candidate[] {
  const { me } = v;
  const out: Candidate[] = [];
  const ult = me.loadout.ult;
  if (ult && !NO_AI_ULT.has(ult)) {
    const rule = ruleFor(ult);
    if (rule) out.push({ slot: 4, id: ult, rule });
  }
  for (let i = 0; i < 3; i++) {
    const id = me.loadout.slots[i];
    if (!id) continue;
    const rule = ruleFor(id);
    if (rule) out.push({ slot: (i + 1) as Slot, id, rule });
  }
  return out;
}

const press = (c: Controls, slot: Slot): void => {
  if (slot === 1) c.skill1 = true;
  else if (slot === 2) c.skill2 = true;
  else if (slot === 3) c.skill3 = true;
  else c.ult = true;
};

/** Decide and press a skill. `eager` 0..1 scales how quickly a valid chance is taken. */
export function useSkill(v: SkillView, c: Controls, eager: number, roll: number): boolean {
  const { me } = v;
  if (me.mode !== 'racing' || !me.mods.canAttack || me.action !== null || me.airborne) return false;
  if (me.mods.silenced) return false; // a silenced rider casts nothing (the runner would refuse it)
  const gate = v.grudge ? 0.75 : v.prefer ? 0.5 : 0.25;
  for (const cand of candidates(v)) {
    // Never press a skill the runner would refuse: the cooldown, the SP and the ult's own target check.
    if (cand.slot === 4) {
      if (me.sp < 100 || !me.ultTarget) continue;
    } else if ((me.cooldowns[cand.slot - 1] ?? 0) > 0) continue;
    // A shield or a slide would block the payback swing: a rider that owes the player one keeps it holstered.
    if (v.grudge && !PAYBACK.has(cand.id)) continue;
    // A skill that speeds the caster up waits for the lane ahead: boosting into a slower rider rams it.
    if (SELF_SPEED.has(cand.id) && rammingAhead(v)) continue;
    // The eagerness (one press per decision): a pool skill is the rider's backup and is taken less eagerly.
    const weight = cand.id.startsWith('pool.') ? BACKUP_EAGER : 1;
    if (roll > eager * gate * weight) continue;
    if (!cand.rule(v)) continue;
    // 宿敌: the skill goes at the player first.
    if (v.prefer) {
      const only: SkillView = { ...v, blips: v.blips.filter((b) => b.kind === 'rider' && b.rider === v.prefer) };
      if (cand.rule(only)) {
        press(c, cand.slot);
        return true;
      }
    }
    press(c, cand.slot);
    return true;
  }
  return false;
}
