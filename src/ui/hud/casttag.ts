// Compact cast tag for repeat casts of the player's skills (the top-strip band plays only for the first cast
// of each skill per race): a small skewed plate just above the skill diamonds — glyph, nameEn, 中文名 —
// for 0.7 s, so the road ahead stays clear on every later cast.
import { SKILLS } from '../../data/skills';
import { enter, exit, slam } from './anim';
import { el, w, type W } from './dom';

const LIFE = 0.7;
const IN = 0.08;
const OUT = 0.12;

export class CastTag {
  private root: W;
  private glyph: W;
  private en: W;
  private cn: W;
  private t = LIFE;

  constructor(parent: HTMLElement) {
    const root = el('div', 'ct', parent);
    this.glyph = w(el('span', 'ct-g', root));
    const txt = el('span', 'ct-t', root);
    this.en = w(el('b', '', txt));
    this.cn = w(el('i', '', txt));
    this.root = w(root);
    this.root.show(false);
  }

  /** The player cast `skillId` (U/I/O skills only: the ult has its own SHOWTIME cut-in). */
  show(skillId: string): void {
    const def = SKILLS[skillId];
    if (!def || def.slot === 'ult') return;
    this.glyph.text(def.glyph);
    this.en.text(def.nameEn);
    this.cn.text(def.name);
    this.t = 0;
  }

  update(dt: number): void {
    if (this.t >= LIFE) return;
    this.t += dt;
    const on = this.t < LIFE;
    this.root.show(on);
    if (!on) return;
    const x = (1 - enter(this.t, IN)) * 120 + exit(this.t, LIFE, OUT) * 60;
    this.root.tf(`translateX(${x.toFixed(0)}px) skewX(-12deg) scale(${slam(this.t, 0.14, 1.25).toFixed(3)})`);
    this.root.op(Math.min(1, (LIFE - this.t) / OUT));
  }
}
