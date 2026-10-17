// Skill id → implementation (ids match data/skills.ts).
import { chill } from './chill';
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
  [torpedo, gulp, wing, ult, honk, chill, spin, doge, ghost, slide, steal, flash, whistle].map((s) => [s.id, s]),
);
