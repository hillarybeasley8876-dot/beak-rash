// Screen transition: red / ink / white diagonal shard wipe (≤ 450 ms total: ~200 ms cover + ~220 ms reveal).
// Shards overlap (and an ink fill sits behind them while covered), so nothing leaks through the stripes.
// State machine so overlapping show() calls share one cover and never swap under a half-open wipe.
// prefers-reduced-motion → a short black fade, the shards stay parked off-screen.
import { h, reducedMotion, settle } from './dom';
import { jagged } from './shapes';

const SHARDS = 6;
const IN_MS = 165;
const OUT_MS = 175;
const STAGGER = 9;
const KINDS = ['is-red', 'is-black', 'is-white', 'is-red', 'is-black', 'is-hot'];
/** Shard pitch and height in % of the wipe box: each shard is 25 % taller than its slot. */
const PITCH = 100 / SHARDS;
const HEIGHT = PITCH * 1.25;
const PARKED = 'translateX(-105%)';

type State = 'idle' | 'covering' | 'covered' | 'revealing';

export class ShardWipe {
  private readonly shards: HTMLDivElement[] = [];
  private readonly fill: HTMLDivElement;
  private readonly fade: HTMLDivElement;
  private anims: Animation[] = [];
  private state: State = 'idle';
  private pending: Promise<void> = Promise.resolve();

  /** `onSlash` fires when a new cover starts (the shell plays the slash whoosh). */
  constructor(layer: HTMLElement, private readonly onSlash: () => void = () => undefined) {
    const box = h('div', { class: 'br-wipe-box' });
    for (let i = 0; i < SHARDS; i++) {
      const shard = h('div', {
        class: `br-wipe-shard ${KINDS[i % KINDS.length] ?? 'is-red'}`,
        vars: { '--clip': jagged(`wipe${i}`, { jx: 1.2, jy: 5, notches: 2 }) },
        style: `top:${(i * PITCH - (HEIGHT - PITCH) / 2).toFixed(3)}%;height:${HEIGHT.toFixed(3)}%`,
      });
      shard.append(h('i', { class: 'br-wipe-slash' }));
      this.shards.push(shard);
      box.append(shard);
    }
    this.fill = h('div', { class: 'br-wipe-fill' });
    this.fade = h('div', { class: 'br-wipe-fade' });
    layer.append(this.fill, box, this.fade);
  }

  get busy(): boolean {
    return this.state === 'covering' || this.state === 'revealing';
  }

  /** Slide shards in until the screen is covered. */
  cover(): Promise<void> {
    if (this.state === 'covered') return Promise.resolve();
    if (this.state === 'covering') return this.pending;
    this.halt(PARKED, '0');
    this.state = 'covering';
    this.onSlash();
    this.anims = reducedMotion()
      ? [this.fade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'forwards' })]
      : this.shards.map((s, i) => s.animate(
        [{ transform: PARKED }, { transform: 'translateX(0)' }],
        { duration: IN_MS, delay: (i % 2 ? SHARDS - i : i) * STAGGER, easing: 'cubic-bezier(.7,0,.25,1)', fill: 'forwards' },
      ));
    const anims = this.anims;
    this.pending = Promise.all(anims.map(settle)).then(() => {
      if (this.anims !== anims) return;
      this.state = 'covered';
      this.fill.style.opacity = '1';
    });
    return this.pending;
  }

  /** Slide shards out the far side, revealing the new screen. No-op when idle. */
  async reveal(): Promise<void> {
    if (this.state === 'idle') return;
    if (this.state === 'revealing') return this.pending;
    if (this.state === 'covering') await this.pending;
    if (this.state !== 'covered') return;
    const reduced = reducedMotion();
    this.halt(reduced ? PARKED : 'translateX(0)', '1');
    this.state = 'revealing';
    this.anims = reduced
      ? [this.fade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' })]
      : this.shards.map((s, i) => s.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(105%)' }],
        { duration: OUT_MS, delay: (i % 2 ? i : SHARDS - i) * STAGGER, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' },
      ));
    const anims = this.anims;
    this.pending = Promise.all(anims.map(settle)).then(() => {
      if (this.anims !== anims) return;
      this.state = 'idle';
      this.halt(PARKED, '0');
    });
    return this.pending;
  }

  /** Cancel running animations, pin shards at a resting transform, hide the ink fill. */
  private halt(transform: string, fadeOpacity: string): void {
    const running = this.anims;
    this.anims = [];
    for (const a of running) a.cancel();
    for (const s of this.shards) s.style.transform = transform;
    this.fill.style.opacity = '0';
    this.fade.style.opacity = reducedMotion() ? fadeOpacity : '0';
  }
}
