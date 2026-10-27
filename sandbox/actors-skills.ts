// Drives skills in the sandbox exactly like combat does (skills/runner.ts + TimedSkill): view.cue('skill') + a cast
// action that lasts the whole effect for lockout skills and only min(effect, 0.35 s) otherwise, plus the caster's own
// statuses (shield, boost, invisible). skillCheck() measures how long each pose reads and how fast the hands move.
import { type Bone, Vector3 } from 'three';
import type { CharacterId, StatusId } from '../src/core/types';
import type { CueOut } from '../src/actors/rig/cue-types';
import { B } from '../src/actors/rig/skeleton';
import type { Bench } from './actors-scene';

interface SkillSpec { id: string; character: CharacterId; dur: number; lockout: boolean; statuses: Array<[StatusId, number]>; minShown: number }

/** Effect durations mirror src/gameplay/combat/skills/*.ts (SPEC §7). minShown = seconds the pose must read. */
export const SKILL_SPECS: SkillSpec[] = [
  { id: 'pelican.torpedo', character: 'pelican', dur: 0.3, lockout: false, statuses: [], minShown: 0.3 },
  { id: 'pelican.gulp', character: 'pelican', dur: 1.2, lockout: true, statuses: [], minShown: 0.8 },
  { id: 'pelican.wing', character: 'pelican', dur: 2.2, lockout: true, statuses: [], minShown: 1.6 },
  { id: 'goose.honk', character: 'goose', dur: 0.82, lockout: false, statuses: [], minShown: 0.5 },
  { id: 'capybara.chill', character: 'capybara', dur: 4, lockout: false, statuses: [], minShown: 3.2 },
  { id: 'cat.spin', character: 'cat', dur: 0.8, lockout: true, statuses: [], minShown: 0.6 },
  { id: 'shiba.doge', character: 'shiba', dur: 3, lockout: false, statuses: [['shield', 3], ['boost', 3]], minShown: 2.4 },
  { id: 'pigeon.ghost', character: 'pigeon', dur: 1.5, lockout: false, statuses: [['invisible', 1.5], ['intangible', 1.5]], minShown: 1.2 },
  { id: 'penguin.slide', character: 'penguin', dur: 2.5, lockout: true, statuses: [], minShown: 1.8 },
  { id: 'seagull.steal', character: 'seagull', dur: 0.42, lockout: false, statuses: [], minShown: 0.3 },
  { id: 'sloth.flash', character: 'sloth', dur: 3, lockout: false, statuses: [['boost', 3]], minShown: 2.4 },
  { id: 'corgi.whistle', character: 'corgi', dur: 0.8, lockout: false, statuses: [], minShown: 0.5 },
  // r6 meme roster (SPEC §23–§24): durations mirror src/gameplay/combat/skills/meme/*.ts.
  { id: 'bananacat.peel', character: 'bananacat', dur: 4, lockout: false, statuses: [], minShown: 0.4 },
  { id: 'cryingcat.tears', character: 'cryingcat', dur: 3.2, lockout: false, statuses: [], minShown: 2.6 },
  { id: 'xinxian.fresh', character: 'xinxian', dur: 5, lockout: false, statuses: [], minShown: 0.4 },
  { id: 'moodeng.bounce', character: 'moodeng', dur: 1, lockout: true, statuses: [], minShown: 0.8 },
  { id: 'pedro.trash', character: 'pedro', dur: 0.9, lockout: false, statuses: [], minShown: 0.6 },
  { id: 'hamster.violin', character: 'hamster', dur: 3.5, lockout: false, statuses: [], minShown: 2.8 },
];

/** Cast `id` on every bench rider the way combat does. */
export function castSkill(riders: Bench[], id: string): void {
  const spec = SKILL_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`[actors] unknown skill ${id}`);
  for (const r of riders) {
    r.view.cue('skill', { skillId: id });
    const dur = spec.lockout ? spec.dur : Math.min(spec.dur, 0.35);
    r.state.action = { kind: 'skill', side: 1, t: 0, dur, weapon: r.state.weapon, skillId: id, resolved: true };
    for (const [sid, t] of spec.statuses) r.state.statuses.push({ id: sid, time: t, strength: 1, source: r.state.id });
  }
}

/** How strongly the cue layer departs from plain riding (≥ 0.3 = a pose you can read from the chase cam). */
function poseLevel(c: CueOut): number {
  return Math.max(c.armL.blend, c.armR.blend, Math.abs(c.spinePitch) / 0.25, c.wings / 0.3, c.neck / 0.5, c.pouch / 0.5,
    c.lie / 0.5, c.legTuck / 0.5, Math.abs(c.spin) > 0.1 ? 1 : 0, c.steam);
}

export interface SkillReport { id: string; shown: number; need: number; handCm: number; ok: boolean }

/** Cast each skill on its species (fresh spawn per species via `use`), step 60 fps for effect + 1 s. Hands are
 *  measured in pelvis space (the whole-body OIIA spin is not a limb pop). */
export function skillCheck(use: (c: CharacterId) => Bench, step: (n: number) => void): SkillReport[] {
  const out: SkillReport[] = [];
  const prev = [new Vector3(), new Vector3()], cur = new Vector3();
  for (const spec of SKILL_SPECS) {
    const r = use(spec.character);
    r.view.cues.clear();
    r.state.action = null;
    r.state.statuses = [];
    step(20);
    castSkill([r], spec.id);
    let shown = 0, hand = 0;
    const bones = r.view.inst.rig.bones;
    for (let f = 0; f < Math.round((spec.dur + 1) * 60); f++) {
      step(1);
      r.view.root.updateMatrixWorld(true);
      if (poseLevel(r.view.cueOut) >= 0.3) shown += 1 / 60;
      [B.handL, B.handR].forEach((b, i) => {
        (bones[B.pelvis] as Bone).worldToLocal((bones[b] as Bone).getWorldPosition(cur)); // OIIA spins the pelvis
        const p = prev[i] as Vector3;
        if (f > 0) hand = Math.max(hand, cur.distanceTo(p));
        p.copy(cur);
      });
    }
    const handCm = +(hand * 100).toFixed(1);
    out.push({ id: spec.id, shown: +shown.toFixed(2), need: spec.minShown, handCm, ok: shown >= spec.minShown && handCm <= 15 });
  }
  return out;
}
