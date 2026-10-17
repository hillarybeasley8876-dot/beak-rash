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

interface Item { spec: CalloutSpec; root: HTMLDivElement; en: HTMLSpanElement; x: HTMLSpanElement; t: number; life: number; n: number; y: number; bumpT: number }

const MAX = 3;
const GAP = 96;

export class Callouts {
  readonly root: HTMLDivElement;
  private items: Item[] = [];

  constructor(stage: HTMLElement) {
    this.root = el('div', 'co-stack', stage);
  }

  push(spec: CalloutSpec): void {
    const key = spec.key ?? spec.kind;
    const same = this.items.find((i) => (i.spec.key ?? i.spec.kind) === key);
    if (same) {
      same.n++;
      same.t = Math.min(same.t, 0.15);
      same.bumpT = 0;
      if (spec.en !== same.spec.en) this.fill(same, spec);
      same.spec = spec;
      if (spec.count) same.x.textContent = `×${same.n}`;
      return;
    }
    const root = el('div', `co co-${spec.kind}${spec.mod ? ` ${spec.mod}` : ''}`, this.root);
    el('div', 'co-sh', root);
    el('div', 'co-bg', root);
    const en = el('span', 'co-en', root);
    const cn = el('span', 'co-cn', root, spec.cn ?? '');
    cn.style.display = spec.cn ? '' : 'none';
    const x = el('span', 'co-x', root);
    const item: Item = { spec, root, en, x, t: 0, life: spec.life ?? 1.15, n: 1, y: -GAP, bumpT: 9 };
    this.fill(item, spec);
    this.items.unshift(item);
    while (this.items.length > MAX) this.items.pop()?.root.remove();
  }

  private fill(item: Item, spec: CalloutSpec): void {
    if (spec.ransom) setRansom(item.en, spec.en, { seed: item.n + 3, scheme: 'mono', tilt: 9 });
    else item.en.textContent = spec.en;
    if (spec.color) item.root.style.setProperty('--dc', spec.color);
  }

  clear(): void {
    for (const i of this.items) i.root.remove();
    this.items = [];
  }

  /** `alpha` dims the whole stack (0 while a cinematic plays). */
  update(dt: number, alpha: number): void {
    this.root.style.opacity = alpha >= 0.999 ? '' : alpha.toFixed(3);
    this.items = this.items.filter((it, idx) => {
      it.t += dt;
      it.bumpT += dt;
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
