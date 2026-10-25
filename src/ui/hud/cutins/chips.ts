// Chip stack (top-right, under the counters): rival skills cast near the player and 成就解锁 toasts.
// Each chip steps the stack by its own measured height (outline + offset shadow + a margin). Achievements
// queue: one 成就解锁 chip on screen at a time, ACH_LIFE each; a burst past ACH_WAIT waiting lines is
// folded into one closing "还有 N 个成就" chip (the results screen lists them all).
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
const ACH_LIFE = 1.25;
/** Achievements that may wait behind the one on screen; later ones only add to the closing summary chip. */
const ACH_WAIT = 2;
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

/** `ach`: a 成就解锁 chip; `cue`: its unlock sound is still due (it plays when the chip first moves). */
interface Chip { root: HTMLDivElement; t: number; y: number; key: string; life: number; gap: number; ach: boolean; cue: boolean }

export class SkillChips {
  private host: HTMLDivElement;
  private chips: Chip[] = [];
  /** Live list of ui-screens' toasts (read by count only, no layout): the column starts below them. */
  private toasts = document.getElementsByClassName('br-toast');
  /** Current offset (px, 1080p) of the column's first slot below its anchor. */
  private base = 0;
  /** Achievements waiting for the one on screen, and how many more arrived past ACH_WAIT. */
  private achQueue: AchievementDef[] = [];
  private achExtra = 0;
  /** Stack step of an achievement chip, measured on the first one shown from a bus handler (queued ones
   *  are mounted inside the HUD frame, where nothing may read layout). */
  private achStep = ACH_GAP;

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
    this.add(root, key, LIFE, 0, false);
  }

  /** achievement:unlock — gold icon square, 成就解锁 and the achievement's name + description; waits its turn
   *  behind the one on screen. */
  achievement(def: AchievementDef): void {
    const key = `ach:${def.id}`;
    if (this.chips.some((c) => c.key === key) || this.achQueue.some((a) => a.id === def.id)) return;
    if (this.chips.some((c) => c.ach) || this.achQueue.length) {
      if (this.achQueue.length < ACH_WAIT) this.achQueue.push(def);
      else this.achExtra++;
      return;
    }
    this.achChip(key, def.icon, def.name, def.desc, true);
  }

  private achChip(key: string, icon: string, name: string, desc: string, measure: boolean): void {
    const root = el('div', 'chip chip-ach', this.host);
    const cardEl = el('div', 'chip-card', root);
    el('span', 'chip-ico', cardEl, icon);
    const txt = el('div', 'chip-t', cardEl);
    el('span', 'chip-kick', txt, '成就解锁 ACHIEVEMENT');
    el('span', 'chip-en', txt, name);
    el('span', 'chip-who', txt, desc);
    this.add(root, key, ACH_LIFE, measure ? 0 : this.achStep, true);
  }

  /** The achievement chip on screen has left: the next queued one (or the summary of the rest) goes up. */
  private nextAchievement(): void {
    const def = this.achQueue.shift();
    if (def) this.achChip(`ach:${def.id}`, def.icon, def.name, def.desc, false);
    else if (this.achExtra > 0) {
      this.achChip('ach:more', '★', `还有 ${this.achExtra} 个成就`, '赛后结算里慢慢看', false);
      this.achExtra = 0;
    }
  }

  private refresh(key: string): boolean {
    const old = this.chips.find((c) => c.key === key);
    if (old) old.t = Math.min(old.t, 0.12);
    return old !== undefined;
  }

  /** `step`: the chip's stack step, or 0 to measure it now (bus handlers only, never inside the HUD frame). */
  private add(root: HTMLDivElement, key: string, life: number, step: number, ach: boolean): void {
    let gap = step;
    if (gap <= 0) {
      // Measured here (a bus handler, outside the HUD frame); 0 while the HUD is not displayed.
      const h = root.offsetHeight;
      gap = h > 0 ? h + MARGIN : ach ? ACH_GAP : GAP;
      if (ach && h > 0) this.achStep = gap;
    }
    // Enters sideways at its slot (no drop from above across the counters); older chips slide down.
    this.chips.unshift({ root, t: 0, y: this.base, key, life, gap, ach, cue: ach });
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
    this.achQueue = [];
    this.achExtra = 0;
  }

  /** `height` = viewport height (px): the toast lane is laid out on the centred 1080p stage. */
  update(dt: number, k: number, height: number): void {
    const n = Math.min(TOAST_MAX, this.toasts.length);
    this.base = n ? Math.max(0, height / 2 / k + TOAST_TOP + n * TOAST_STEP - 540 + 12 - TOP) : 0;
    // The previous 成就解锁 chip has gone: the next one enters (frozen with the rest while dt is 0).
    if (dt > 0 && (this.achQueue.length || this.achExtra > 0) && !this.chips.some((c) => c.ach)) this.nextAchievement();
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
