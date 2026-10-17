// Small skill chips for rivals casting near the player (top-right, under the counters).
import { ROSTER } from '../../../data/roster';
import type { SkillDef } from '../../../data/skills';
import type { CharacterId } from '../../../core/types';
import { enter, exit, fadeOut } from '../anim';
import { badge } from '../badge';
import { el } from '../dom';

const LIFE = 1.7;
const MAX = 3;
const GAP = 76;

interface Chip { root: HTMLDivElement; t: number; y: number; key: string }

export class SkillChips {
  private host: HTMLDivElement;
  private chips: Chip[] = [];

  constructor(parent: HTMLElement) {
    this.host = el('div', 'chips', parent);
  }

  push(character: CharacterId, def: SkillDef): void {
    const key = `${character}:${def.id}`;
    const old = this.chips.find((c) => c.key === key);
    if (old) {
      old.t = Math.min(old.t, 0.12);
      return;
    }
    const root = el('div', 'chip', this.host);
    root.style.setProperty('--c3', ROSTER[character].colors.accent);
    const cardEl = el('div', 'chip-card', root);
    cardEl.append(badge(character));
    const txt = el('div', 'chip-t', cardEl);
    el('span', 'chip-en', txt, def.nameEn);
    el('span', 'chip-cn', txt, def.name);
    el('span', 'chip-who', txt, ROSTER[character].name);
    this.chips.unshift({ root, t: 0, y: -GAP, key });
    while (this.chips.length > MAX) this.chips.pop()?.root.remove();
  }

  clear(): void {
    for (const c of this.chips) c.root.remove();
    this.chips = [];
  }

  update(dt: number, k: number): void {
    this.chips = this.chips.filter((c, i) => {
      c.t += dt;
      if (c.t >= LIFE) {
        c.root.remove();
        return false;
      }
      c.y += (i * GAP - c.y) * Math.min(1, dt * 14);
      const x = (1 - enter(c.t, 0.14)) * 420 + exit(c.t, LIFE, 0.18) * 420;
      c.root.style.transform = `scale(${k.toFixed(4)}) translate(${x.toFixed(0)}px, ${c.y.toFixed(1)}px)`;
      c.root.style.opacity = fadeOut(c.t, LIFE, 0.18).toFixed(3);
      return true;
    });
  }
}
