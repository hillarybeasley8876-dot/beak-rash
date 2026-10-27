// r6 shared ults (SPEC §24, job r6-skills-meme): every implementation is listed here.
import type { SkillImpl } from '../types';
import { meteor } from './meteor';
import { storm } from './storm';
import { timestop } from './timestop';

export const ULT_SKILLS: SkillImpl[] = [timestop, meteor, storm];
