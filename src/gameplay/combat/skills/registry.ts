// Skill id → implementation (ids match data/skills.ts). r6: the pool, meme-roster and ult folders list their own.
import { chill } from './chill';
import { MEME_SKILLS } from './meme/index';
import { POOL_SKILLS } from './pool/index';
import { ULT_SKILLS } from './ults/index';
import { doge } from './doge';
import { flash } from './flash';
import { ghost } from './ghost';
import { gulp } from './gulp';
import { honk } from './honk';
import { slide } from './slide';
import { spin } from './spin';
import { steal } from './steal';
import { torpedo } from './torpedo';
import type { SkillImpl } from './types';
import { ult } from './ult';
import { whistle } from './whistle';
import { wing } from './wing';

export const SKILL_IMPLS: Record<string, SkillImpl | undefined> = Object.fromEntries(
  [torpedo, gulp, wing, ult, honk, chill, spin, doge, ghost, slide, steal, flash, whistle, ...POOL_SKILLS, ...MEME_SKILLS, ...ULT_SKILLS]
    .map((s) => [s.id, s]),
);
