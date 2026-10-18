// Chip stack (top-right, under the counters): rival skills cast near the player and 成就解锁 toasts.
import type { AchievementDef } from '../../../data/achievements';
import { ROSTER } from '../../../data/roster';
import type { SkillDef } from '../../../data/skills';
import type { CharacterId } from '../../../core/types';
import { enter, exit, fadeOut } from '../anim';
import { badge } from '../badge';
import { el } from '../dom';

const LIFE = 1.7;
const ACH_LIFE = 2.6;
const MAX = 3;
const GAP = 76;      // stack step under a skill chip (px, 1080p)
const ACH_GAP = 98;  // achievement chips have a third text line

interface Chip { root: HTMLDivElement; t: number; y: number; key: string; life: number; gap: number }

export class SkillChips {
  private host: HTMLDivElement;
  private chips: Chip[] = [];

  constructor(parent: HTMLElement) {
    this.host = el('div', 'chips', parent);
  }

  push(character: CharacterId, def: SkillDef): void {
    const key = `${character}:${def.id}`;
    if (this.refresh(key)) return;
    const root = el('div', 'chip', this.host);
    root.style.setProperty('--c3', ROSTER[character].colors.accent);
    const cardEl = el('div', 'chip-card', root);
    cardEl.append(badge(character));
    const txt = el('div', 'chip-t', cardEl);
    el('span', 'chip-en', txt, def.nameEn);
    el('span', 'chip-cn', txt, def.name);
    el('span', 'chip-who', txt, ROSTER[character].name);
    this.add(root, key, LIFE, GAP);
  }

  /** achievement:unlock — gold icon square, 成就解锁 and the achievement's name + description. */
  achievement(def: AchievementDef): void {
    const key = `ach:${def.id}`;
    if (this.refresh(key)) return;
    const root = el('div', 'chip chip-ach', this.host);
    const cardEl = el('div', 'chip-card', root);
    el('span', 'chip-ico', cardEl, def.icon);
    const txt = el('div', 'chip-t', cardEl);
    el('span', 'chip-kick', txt, '成就解锁 ACHIEVEMENT');
    el('span', 'chip-en', txt, def.name);
    el('span', 'chip-who', txt, def.desc);
    this.add(root, key, ACH_LIFE, ACH_GAP);
  }

  private refresh(key: string): boolean {
    const old = this.chips.find((c) => c.key === key);
    if (old) old.t = Math.min(old.t, 0.12);
    return old !== undefined;
  }

  private add(root: HTMLDivElement, key: string, life: number, gap: number): void {
    this.chips.unshift({ root, t: 0, y: -gap, key, life, gap });
    while (this.chips.length > MAX) this.chips.pop()?.root.remove();
  }

  clear(): void {
    for (const c of this.chips) c.root.remove();
    this.chips = [];
  }

  update(dt: number, k: number): void {
    let top = 0;
    this.chips = this.chips.filter((c) => {
      c.t += dt;
      if (c.t >= c.life) {
        c.root.remove();
        return false;
      }
      c.y += (top - c.y) * Math.min(1, dt * 14);
      top += c.gap;
      const x = (1 - enter(c.t, 0.14)) * 420 + exit(c.t, c.life, 0.18) * 420;
      c.root.style.transform = `scale(${k.toFixed(4)}) translate(${x.toFixed(0)}px, ${c.y.toFixed(1)}px)`;
      c.root.style.opacity = fadeOut(c.t, c.life, 0.18).toFixed(3);
      return true;
    });
  }
}
