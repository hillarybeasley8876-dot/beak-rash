// Cut-in director: one exclusive splash slot (priority + short queue) and one skill-band slot.
// Interrupted cut-ins leave with a 0.1 s fade instead of vanishing; nothing ever piles up.
import { el } from '../dom';
import { PRIORITY, type CutIn, type SplashKind } from './types';

const OUT = 0.1;
const QUEUE_TTL = 1.2;

interface Live { cut: CutIn; kind: SplashKind; key: string; t: number }
interface Leaving { root: HTMLElement; t: number }
interface Queued { make: () => CutIn; kind: SplashKind; age: number; key: string }

export class Director {
  readonly stage: HTMLDivElement;
  private splash: Live | null = null;
  private band: Live | null = null;
  private leaving: Leaving[] = [];
  private queue: Queued[] = [];

  constructor(parent: HTMLElement) {
    this.stage = el('div', 'brh-stage brh-cutins', parent);
  }

  get splashKind(): SplashKind | null {
    return this.splash?.kind ?? null;
  }

  /** Show a splash now if it outranks the current one, else queue it briefly (deduped by key).
   *  The same key arriving twice (e.g. rider:crash + cine:ko for one wreck) never restarts it. */
  splashIn(kind: SplashKind, make: () => CutIn, key: string = kind): void {
    const cur = this.splash;
    if (cur && cur.key === key && cur.t < cur.cut.dur * 0.6) return;
    if (!cur || PRIORITY[kind] >= PRIORITY[cur.kind] || cur.t > cur.cut.dur - 0.15) {
      this.retire(cur);
      this.splash = this.mount(kind, make(), key);
      if (PRIORITY[kind] >= PRIORITY.ko) this.endBand();
      return;
    }
    this.queue = this.queue.filter((q) => q.key !== key);
    this.queue.push({ make, kind, age: 0, key });
    if (this.queue.length > 2) this.queue.shift();
  }

  /** Player skill band: replaces the previous band; hidden while a KO-level splash plays. */
  bandIn(make: () => CutIn): void {
    if (this.splash && PRIORITY[this.splash.kind] >= PRIORITY.ko) return;
    this.retire(this.band);
    this.band = this.mount('skill', make(), 'band');
  }

  /** Drop everything immediately (detach, race restart). */
  clear(): void {
    for (const l of [this.splash, this.band]) l?.cut.root.remove();
    for (const l of this.leaving) l.root.remove();
    this.splash = null;
    this.band = null;
    this.leaving = [];
    this.queue = [];
  }

  update(dt: number): void {
    this.splash = this.advance(this.splash, dt);
    this.band = this.advance(this.band, dt);
    for (const q of this.queue) q.age += dt;
    this.queue = this.queue.filter((q) => q.age < QUEUE_TTL);
    if (!this.splash && this.queue.length) {
      const next = this.queue.shift();
      if (next) this.splash = this.mount(next.kind, next.make(), next.key);
    }
    this.leaving = this.leaving.filter((l) => {
      l.t += dt;
      l.root.style.opacity = String(Math.max(0, 1 - l.t / OUT));
      if (l.t < OUT) return true;
      l.root.remove();
      return false;
    });
  }

  private endBand(): void {
    this.retire(this.band);
    this.band = null;
  }

  private mount(kind: SplashKind, cut: CutIn, key: string): Live {
    this.stage.append(cut.root);
    cut.frame(0);
    return { cut, kind, key, t: 0 };
  }

  private advance(live: Live | null, dt: number): Live | null {
    if (!live) return null;
    live.t += dt;
    if (live.t >= live.cut.dur) {
      live.cut.root.remove();
      return null;
    }
    live.cut.frame(live.t);
    return live;
  }

  private retire(live: Live | null): void {
    if (!live) return;
    this.leaving.push({ root: live.cut.root, t: 0 });
  }
}
