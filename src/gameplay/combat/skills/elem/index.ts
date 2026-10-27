// r6 elemental pool skills (SPEC §24, job r6-skills-elem): every implementation is listed here.
import { bubble } from './bubble';
import { firebreath } from './firebreath';
import { firecracker } from './firecracker';
import { icelance } from './icelance';
import { rocket } from './rocket';
import { snowball } from './snowball';
import { thunder } from './thunder';
import { tornado } from './tornado';
import { watergun } from './watergun';
import type { SkillImpl } from '../types';

export const ELEM_SKILLS: SkillImpl[] = [
  firebreath, icelance, thunder, watergun, tornado, snowball, rocket, firecracker, bubble,
];
