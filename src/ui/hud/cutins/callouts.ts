// Callout stack (left-middle): PERFECT, DRIFT L1–3, NEAR MISS, SLIPSTREAM/SLINGSHOT, ONE MORE!,
// place changes and pickups. Newest on top, max 3, same kind merges (×2, level upgrade).
import '../css/callouts.css';
import { approach } from '../../../core/math';
import { enter, exit, fadeOut, slam } from '../anim';
import { el } from '../dom';
import { setRansom } from '../ransom';

export type CalloutKind = 'perfect' | 'drift' | 'near' | 'slip' | 'more' | 'place' | 'pick';

export interface CalloutSpec {
  kind: CalloutKind;
  en: string;
  cn?: string;
  /** Extra class (e.g. 'down' for a lost place). */
  mod?: string;
  /** Drift level colour. */
  color?: string;
  ransom?: boolean;
  life?: number;
  /** Merge key: same key while alive bumps the existing callout (default = kind). */
  key?: string;
  /** Show a ×N counter when merged. */
  count?: boolean;
}

interface Item {
  spec: CalloutSpec | null; root: HTMLDivElement; en: HTMLSpanElement; cn: HTMLSpanElement; x: HTMLSpanElement;
  t: number; life: number; n: number; y: number; bumpT: number;
  /** Pushed or merged but not yet seen: `onShow` fires once it is live (after a cinematic / splash). */
  cue: boolean;
}

const MAX = 3;
const GAP = 96;

/** The speedometer's own tag already says SLIPSTREAM (and shows the draft meter): a callout with the
 *  same word would announce it twice (r6). */
const REDUNDANT = new Set(['SLIPSTREAM']);

const keyOf = (spec: CalloutSpec | null): string => (spec ? spec.key ?? spec.kind : '');

export class Callouts {
  readonly root: HTMLDivElement;
  private items: Item[] = [];

  /** `onShow` runs when a pushed (or merged) callout actually plays: its sound cue. */
  constructor(stage: HTMLElement, private onShow: (spec: CalloutSpec) => void = () => {}) {
    this.root = el('div', 'co-stack', stage);
  }

  push(spec: CalloutSpec): void {
    if (REDUNDANT.has(spec.en)) return;
    const key = spec.key ?? spec.kind;
    const same = this.items.find((i) => keyOf(i.spec) === key);
    if (same) {
      same.n++;
      same.t = Math.min(same.t, 0.15);
      same.bumpT = 0;
      same.cue = true;
      this.fill(same, spec);
      return;
    }
    const root = el('div', 'co', this.root);
    el('div', 'co-sh', root);
    el('div', 'co-bg', root);
    const en = el('span', 'co-en', root);
    const cn = el('span', 'co-cn', root);
    const x = el('span', 'co-x', root);
    const item: Item = { spec: null, root, en, cn, x, t: 0, life: spec.life ?? 1.15, n: 1, y: -GAP, bumpT: 9, cue: true };
    this.fill(item, spec);
    this.items.unshift(item);
    while (this.items.length > MAX) this.items.pop()?.root.remove();
  }

  /** Write every per-spec part (title, Chinese line, style modifier, colour, ×N), so a merge never keeps
   *  the previous callout's text or up/down style. */
  private fill(item: Item, spec: CalloutSpec): void {
    const old = item.spec;
    if (!old || old.en !== spec.en || old.ransom !== spec.ransom) {
      if (spec.ransom) setRansom(item.en, spec.en, { seed: item.n + 3, scheme: 'mono', tilt: 9 });
      else item.en.textContent = spec.en;
    }
    item.cn.textContent = spec.cn ?? '';
    item.cn.style.display = spec.cn ? '' : 'none';
    for (const c of [old?.mod, old && `co-${old.kind}`]) if (c) item.root.classList.remove(c);
    for (const c of [spec.mod, `co-${spec.kind}`]) if (c) item.root.classList.add(c);
    if (spec.color) item.root.style.setProperty('--dc', spec.color);
    else item.root.style.removeProperty('--dc');
    item.x.textContent = spec.count && item.n > 1 ? `×${item.n}` : '';
    item.spec = spec;
  }

  clear(): void {
    for (const i of this.items) i.root.remove();
    this.items = [];
  }

  /** `alpha` dims the whole stack (0 while a cinematic plays). Lifetimes freeze while dimmed, so a callout
   *  raised during a KO / SHOWTIME cinematic (ONE MORE!, a place change) plays once the HUD is back. */
  /** Callouts on the stack right now. */
  get count(): number {
    return this.items.length;
  }

  update(dt: number, alpha: number): void {
    this.root.style.opacity = alpha >= 0.999 ? '' : alpha.toFixed(3);
    const live = alpha >= 0.999 ? dt : 0;
    this.items = this.items.filter((it, idx) => {
      if (live > 0 && it.cue && it.spec) {
        it.cue = false;
        this.onShow(it.spec);
      }
      it.t += live;
      it.bumpT += live;
      if (it.t >= it.life) {
        it.root.remove();
        return false;
      }
      it.y = approach(it.y, idx * GAP, dt * 900);
      const inS = slam(it.t, 0.14, 1.6);
      const bump = it.bumpT < 0.2 ? slam(it.bumpT, 0.16, 1.3) : 1;
      const x = (1 - enter(it.t, 0.1)) * -80 - exit(it.t, it.life, 0.16) * 140;
      it.root.style.transform = `translate(${x.toFixed(0)}px, ${it.y.toFixed(1)}px) skewX(-10deg) scale(${(inS * bump).toFixed(3)})`;
      it.root.style.opacity = fadeOut(it.t, it.life, 0.16).toFixed(3);
      return true;
    });
  }
}
