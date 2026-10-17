// Screen transition: red/black diagonal shard wipe (≤ 450 ms total: ~200 ms cover + ~220 ms reveal).
// State machine so overlapping show() calls share one cover and never swap under a half-open wipe.
// prefers-reduced-motion → a short black fade instead.
import { h, reducedMotion, settle } from './dom';
import { jagged } from './shapes';

const SHARDS = 6;
const IN_MS = 165;
const OUT_MS = 175;
const STAGGER = 9;

type State = 'idle' | 'covering' | 'covered' | 'revealing';

export class ShardWipe {
  private readonly shards: HTMLDivElement[] = [];
  private readonly fade: HTMLDivElement;
  private anims: Animation[] = [];
  private state: State = 'idle';
  private pending: Promise<void> = Promise.resolve();

  constructor(layer: HTMLElement) {
    const box = h('div', { class: 'br-wipe-box' });
    for (let i = 0; i < SHARDS; i++) {
      const kind = i % 3 === 1 ? 'is-black' : i % 3 === 2 ? 'is-hot' : 'is-red';
      const shard = h('div', {
        class: `br-wipe-shard ${kind}`,
        vars: { '--clip': jagged(`wipe${i}`, { jx: 1.2, jy: 14, notches: 2 }) },
        style: `top:${(i * 100) / SHARDS}%;height:calc(${100 / SHARDS}% + 3px)`,
      });
      shard.append(h('i', { class: 'br-wipe-slash' }));
      this.shards.push(shard);
      box.append(shard);
    }
    this.fade = h('div', { class: 'br-wipe-fade' });
    layer.append(box, this.fade);
  }

  get busy(): boolean {
    return this.state === 'covering' || this.state === 'revealing';
  }

  /** Slide shards in until the screen is covered. */
  cover(): Promise<void> {
    if (this.state === 'covered') return Promise.resolve();
    if (this.state === 'covering') return this.pending;
    this.halt('translateX(-105%)', '0');
    this.state = 'covering';
    this.anims = reducedMotion()
      ? [this.fade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'forwards' })]
      : this.shards.map((s, i) => s.animate(
        [{ transform: 'translateX(-105%)' }, { transform: 'translateX(0)' }],
        { duration: IN_MS, delay: (i % 2 ? SHARDS - i : i) * STAGGER, easing: 'cubic-bezier(.7,0,.25,1)', fill: 'forwards' },
      ));
    const anims = this.anims;
    this.pending = Promise.all(anims.map(settle)).then(() => {
      if (this.anims === anims) this.state = 'covered';
    });
    return this.pending;
  }

  /** Slide shards out the far side, revealing the new screen. No-op when idle. */
  async reveal(): Promise<void> {
    if (this.state === 'idle') return;
    if (this.state === 'revealing') return this.pending;
    if (this.state === 'covering') await this.pending;
    if (this.state !== 'covered') return;
    this.halt('translateX(0)', '1');
    this.state = 'revealing';
    this.anims = reducedMotion()
      ? [this.fade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' })]
      : this.shards.map((s, i) => s.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(105%)' }],
        { duration: OUT_MS, delay: (i % 2 ? i : SHARDS - i) * STAGGER, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' },
      ));
    const anims = this.anims;
    this.pending = Promise.all(anims.map(settle)).then(() => {
      if (this.anims !== anims) return;
      this.state = 'idle';
      this.halt('translateX(-105%)', '0');
    });
    return this.pending;
  }

  /** Cancel running animations and pin shards at a resting transform. */
  private halt(transform: string, fadeOpacity: string): void {
    const running = this.anims;
    this.anims = [];
    for (const a of running) a.cancel();
    for (const s of this.shards) s.style.transform = transform;
    this.fade.style.opacity = reducedMotion() ? fadeOpacity : '0';
  }
}
