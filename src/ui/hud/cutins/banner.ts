// FINAL STRETCH hazard-tape banner (top centre, under the progress strip).
import { exit, fadeOut, pop } from '../anim';
import { el } from '../dom';

const LIFE = 2.0;

export class FinalStretch {
  private root: HTMLDivElement;
  private t = LIFE;

  /** `onShow` runs when the banner actually slams in (it waits out cinematics and splashes). */
  constructor(stage: HTMLElement, private onShow: () => void = () => {}) {
    this.root = el('div', 'fs', stage);
    el('div', 'fs-tape', this.root);
    const text = el('div', 'fs-text', this.root);
    el('b', '', text, 'FINAL STRETCH');
    el('i', '', text, '最后冲刺');
    this.root.style.visibility = 'hidden';
  }

  show(): void {
    this.t = 0;
  }

  clear(): void {
    this.t = LIFE;
    this.root.style.visibility = 'hidden';
  }

  /** `alpha` dims the banner (0 while a cinematic plays); its lifetime waits for the HUD to come back. */
  update(dt: number, alpha: number): void {
    if (this.t >= LIFE) return;
    if (alpha >= 0.999) {
      if (this.t === 0) this.onShow();
      this.t += dt;
    }
    const t = this.t;
    if (t >= LIFE) {
      this.root.style.visibility = 'hidden';
      return;
    }
    this.root.style.visibility = 'inherit';
    this.root.style.transform = `translateY(${((1 - pop(t, 0.18, 1.8)) * -160 - exit(t, LIFE, 0.2) * 160).toFixed(1)}px) rotate(-2deg)`;
    this.root.style.opacity = (fadeOut(t, LIFE, 0.2) * alpha).toFixed(3);
  }
}
