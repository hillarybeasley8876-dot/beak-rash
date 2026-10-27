// r6 gag / utility pool skills (SPEC §24, job r6-skills-gag): every implementation is listed here.
import type { SkillImpl } from '../types';
import { blink } from './blink';
import { boomerang } from './boomerang';
import { brainfight } from './brainfight';
import { ducks } from './ducks';
import { pie } from './pie';
import { popup } from './popup';
import { thermos } from './thermos';
import { warsong } from './warsong';

export const GAG_SKILLS: SkillImpl[] = [boomerang, pie, brainfight, blink, thermos, ducks, popup, warsong];
