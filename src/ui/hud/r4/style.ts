// The STYLE chain meter (SPEC §17): a strip under the place badge that shows "STYLE ×2.25 · 1,240"
// while a chain is alive, the action labels flying in, and the bank pop when the chain pays out.
import { clamp01, easeOutCubic } from '../../../core/math';
import type { GameEvents } from '../../../core/events-map';
import { R4_HUD as S } from '../../../data/strings';
import { reducedMotion } from '../anim';
import { el, w, type W } from '../dom';

/** 1,240 — a thousands separator, so a big chain reads at a glance. */
export const fmtInt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** ×2.25 — whole multipliers lose the decimals. */
export const fmtMult = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(2));

const ACT_LIFE = 0.95;
const BANK_LIFE = 1.5;

export class StyleMeter {
  readonly root: HTMLDivElement;
  private mult: W;
  private total: W;
  private act: HTMLDivElement | null = null;
  private actT = 0;
  private bankPop: HTMLDivElement | null = null;
  private bankT = 0;
  private slamT = 9;

  constructor(private parent: HTMLElement) {
    this.root = el('div', 'brh-style', parent);
    el('span', 'brh-style-k', this.root, S.style);
    this.mult = w(el('span', 'brh-style-m', this.root, '×1'));
    el('span', 'brh-style-d', this.root, '·');
    this.total = w(el('span', 'brh-style-t', this.root, '0'));
    w(this.root).show(false);
  }

  /** style:chain — the chain grew: show the meter and fly the action label in. */
  chain(e: GameEvents['style:chain']): void {
    this.mult.text(`×${fmtMult(e.mult)}`);
    this.total.text(fmtInt(e.total));
    w(this.root).show(true);
    this.slamT = 0;
    this.fly(e.label);
  }

  /** style:bank — the chain paid out (or broke): the meter leaves, the pop says what it was worth. */
  bank(e: GameEvents['style:bank']): void {
    w(this.root).show(false);
    this.pop(e);
  }

  /** The action label of the last chain step, flying in from the right. */
  private fly(label: string): void {
    this.act?.remove();
    this.act = el('div', 'sty-act', this.parent, label);
    this.actT = 0;
  }

  /** "+12 SP +4 小鱼干" — red when the chain broke on a hit. */
  private pop(e: GameEvents['style:bank']): void {
    this.bankPop?.remove();
    const root = el('div', `sty-bank${e.broken ? ' broken' : ''}`, this.parent);
    el('b', '', root, `+${e.sp} SP`);
    root.append(document.createTextNode(` +${e.coins} 小鱼干`));
    this.bankPop = root;
    this.bankT = 0;
  }

  /** Drop everything (a new race). */
  clear(): void {
    w(this.root).show(false);
    this.act?.remove();
    this.act = null;
    this.bankPop?.remove();
    this.bankPop = null;
  }

  update(dt: number): void {
    const still = reducedMotion();
    this.slamT += dt;
    const s = still ? 1 : 1 + 0.25 * Math.max(0, 1 - this.slamT / 0.18);
    this.root.style.setProperty('--s', s.toFixed(3));
    if (this.act) {
      this.actT += dt;
      const t = clamp01(this.actT / ACT_LIFE);
      this.act.style.setProperty('--x', still ? '0px' : `${((1 - easeOutCubic(t)) * 240).toFixed(1)}px`);
      this.act.style.setProperty('--s', (still ? 1 : 1 + 0.2 * (1 - t)).toFixed(3));
      this.act.style.opacity = (1 - clamp01((this.actT - 0.45) / 0.5)).toFixed(3);
      if (this.actT >= ACT_LIFE) {
        this.act.remove();
        this.act = null;
      }
    }
    if (this.bankPop) {
      this.bankT += dt;
      const t = clamp01(this.bankT / BANK_LIFE);
      this.bankPop.style.setProperty('--y', still ? '0px' : `${(-easeOutCubic(t) * 40).toFixed(1)}px`);
      this.bankPop.style.setProperty('--s', (still ? 1 : 1 + 0.18 * Math.max(0, 1 - this.bankT / 0.2)).toFixed(3));
      this.bankPop.style.opacity = (1 - clamp01((this.bankT - 0.9) / 0.6)).toFixed(3);
      if (this.bankT >= BANK_LIFE) {
        this.bankPop.remove();
        this.bankPop = null;
      }
    }
  }
}
