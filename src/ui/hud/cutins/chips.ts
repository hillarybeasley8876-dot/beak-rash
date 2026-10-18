// Chip stack (top-right, under the counters): rival skills cast near the player and 成就解锁 toasts.
// Each chip steps the stack by its own measured height (outline + offset shadow + a margin).
import { approach } from '../../../core/math';
import type { AchievementDef } from '../../../data/achievements';
import { ROSTER } from '../../../data/roster';
import type { SkillDef } from '../../../data/skills';
import type { CharacterId } from '../../../core/types';
import { enter, exit, fadeOut } from '../anim';
import { badge } from '../badge';
import { el } from '../dom';
import type { Rect } from '../world/avoid';

const LIFE = 1.7;
const ACH_LIFE = 2.6;
const MAX = 3;
const GAP = 100;     // fallback stack step under a skill chip (px, 1080p) until it is measured
const ACH_GAP = 112; // achievement chips have a third text line
/** Below each card: its 3 px outline, 6 px offset shadow and air before the next chip. */
const MARGIN = 16;
/** Column anchor (css/cutins.css .chips) and the widest card, for the taunt-bubble layout. */
const RIGHT = 34;
const TOP = 150;
const COL_W = 470;
/** ui-screens' toast lane in the same corner (src/ui/toast.ts): stage top 136, ≤ 2 strips ~70 px + 12 px apart. */
const TOAST_TOP = 136;
const TOAST_STEP = 84;
const TOAST_MAX = 2;

interface Chip { root: HTMLDivElement; t: number; y: number; key: string; life: number; gap: number; cue: boolean }

export class SkillChips {
  private host: HTMLDivElement;
  private chips: Chip[] = [];
  /** Live list of ui-screens' toasts (read by count only, no layout): the column starts below them. */
  private toasts = document.getElementsByClassName('br-toast');
  /** Current offset (px, 1080p) of the column's first slot below its anchor. */
  private base = 0;

  /** `onAchievement` runs when a 成就解锁 chip starts to show (chips freeze while the HUD hides). */
  constructor(parent: HTMLElement, private onAchievement: () => void = () => {}) {
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
    this.add(root, key, LIFE, GAP, false);
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
    this.add(root, key, ACH_LIFE, ACH_GAP, true);
  }

  private refresh(key: string): boolean {
    const old = this.chips.find((c) => c.key === key);
    if (old) old.t = Math.min(old.t, 0.12);
    return old !== undefined;
  }

  private add(root: HTMLDivElement, key: string, life: number, gap: number, cue: boolean): void {
    // Measured here (a bus handler, outside the HUD frame); 0 while the HUD is not displayed.
    const h = root.offsetHeight;
    const step = h > 0 ? h + MARGIN : gap;
    // Enters sideways at its slot (no drop from above across the counters); older chips slide down.
    this.chips.unshift({ root, t: 0, y: this.base, key, life, gap: step, cue });
    while (this.chips.length > MAX) this.chips.pop()?.root.remove();
  }

  /** Screen rect of the column while chips are up (null otherwise). */
  rect(width: number, k: number, out: Rect): Rect | null {
    if (!this.chips.length) return null;
    out.r = width - RIGHT * k;
    out.l = out.r - COL_W * k;
    out.t = (TOP + this.base) * k;
    out.b = out.t + this.chips.reduce((sum, c) => sum + c.gap, 0) * k;
    return out;
  }

  clear(): void {
    for (const c of this.chips) c.root.remove();
    this.chips = [];
  }

  /** `height` = viewport height (px): the toast lane is laid out on the centred 1080p stage. */
  update(dt: number, k: number, height: number): void {
    const n = Math.min(TOAST_MAX, this.toasts.length);
    this.base = n ? Math.max(0, height / 2 / k + TOAST_TOP + n * TOAST_STEP - 540 + 12 - TOP) : 0;
    let top = this.base;
    this.chips = this.chips.filter((c) => {
      if (dt > 0 && c.cue) {
        c.cue = false;
        this.onAchievement();
      }
      c.t += dt;
      if (c.t >= c.life) {
        c.root.remove();
        return false;
      }
      // Fast enough that a chip entering at the top slot never sits on the one sliding down below it.
      c.y = approach(c.y, top, dt * 1600);
      top += c.gap;
      const x = (1 - enter(c.t, 0.14)) * 420 + exit(c.t, c.life, 0.18) * 420;
      c.root.style.transform = `scale(${k.toFixed(4)}) translate(${x.toFixed(0)}px, ${c.y.toFixed(1)}px)`;
      c.root.style.opacity = fadeOut(c.t, c.life, 0.18).toFixed(3);
      return true;
    });
  }
}
