// r6 meme-roster signature skills (SPEC §23–§24, job r6-skills-meme): every implementation is listed here.
import type { SkillImpl } from '../types';
import { bounce } from './bounce';
import { fresh } from './fresh';
import { peel } from './peel';
import { tears } from './tears';
import { trash } from './trash';
import { violin } from './violin';

export const MEME_SKILLS: SkillImpl[] = [peel, tears, fresh, bounce, trash, violin];
